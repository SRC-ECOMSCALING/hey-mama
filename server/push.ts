// Native push, two channels picked by the device token's platform:
//   - Android: Firebase Cloud Messaging HTTP v1, configured by
//     FCM_SERVICE_ACCOUNT_JSON (the Firebase service-account JSON, one line).
//   - iOS: APNs directly (token-based auth, HTTP/2), configured by
//     APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8 (the .p8 contents, "\n" allowed),
//     APNS_BUNDLE_ID (default com.heymama.app) and APNS_ENV (production|sandbox).
// Without the matching config every send is a silent no-op, so the app keeps
// working with in-app notifications only. Implemented with node:crypto and
// node:http2 to keep the Firebase/APNs SDKs out of the serverless bundle.
import { createSign } from "crypto";
import http2 from "http2";
import { storage } from "./storage";

export interface PushPayload {
  title: string;
  body: string;
  // Deep-link hints for the client (all values must be strings for FCM)
  data?: Record<string, string>;
}

const b64url = (input: Buffer | string) =>
  Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

// ---------------------------------------------------------------- FCM (Android)
interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

let fcmAccount: ServiceAccount | null | undefined; // undefined = not parsed yet

function getFcmAccount(): ServiceAccount | null {
  if (fcmAccount !== undefined) return fcmAccount;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    fcmAccount = null;
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    fcmAccount =
      parsed?.project_id && parsed?.client_email && parsed?.private_key
        ? { project_id: parsed.project_id, client_email: parsed.client_email, private_key: parsed.private_key }
        : null;
    if (!fcmAccount) console.error("[push] FCM_SERVICE_ACCOUNT_JSON lacks project_id/client_email/private_key");
  } catch {
    console.error("[push] FCM_SERVICE_ACCOUNT_JSON is not valid JSON");
    fcmAccount = null;
  }
  return fcmAccount;
}

let fcmToken: { value: string; expiresAt: number } | null = null;

async function getFcmAccessToken(acc: ServiceAccount): Promise<string> {
  if (fcmToken && fcmToken.expiresAt > Date.now() + 60_000) return fcmToken.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: acc.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const assertion = `${header}.${claims}.${b64url(signer.sign(acc.private_key))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!res.ok) throw new Error(`FCM token request failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  fcmToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

// Returns true when FCM says the token is gone for good.
async function sendFcm(acc: ServiceAccount, token: string, payload: PushPayload): Promise<boolean> {
  const accessToken = await getFcmAccessToken(acc);
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${acc.project_id}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title: payload.title, body: payload.body },
        data: payload.data ?? {},
        android: { notification: { sound: "default" } },
      },
    }),
  });
  if (res.ok) return false;
  const text = await res.text();
  if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(text)) return true;
  console.error("[push] FCM send failed:", res.status, text.slice(0, 300));
  return false;
}

// ---------------------------------------------------------------- APNs (iOS)
interface ApnsConfig {
  keyId: string;
  teamId: string;
  key: string;
  bundleId: string;
  host: string;
}

let apnsConfig: ApnsConfig | null | undefined;

function getApnsConfig(): ApnsConfig | null {
  if (apnsConfig !== undefined) return apnsConfig;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const key = (process.env.APNS_KEY_P8 || "").replace(/\\n/g, "\n");
  if (!keyId || !teamId || !key) {
    apnsConfig = null;
    return null;
  }
  apnsConfig = {
    keyId,
    teamId,
    key,
    bundleId: process.env.APNS_BUNDLE_ID || "com.heymama.app",
    host:
      (process.env.APNS_ENV || "production") === "sandbox"
        ? "https://api.sandbox.push.apple.com"
        : "https://api.push.apple.com",
  };
  return apnsConfig;
}

let apnsJwt: { value: string; issuedAt: number } | null = null;

// APNs provider tokens are valid for an hour; refresh after 50 minutes.
function getApnsJwt(cfg: ApnsConfig): string {
  if (apnsJwt && Date.now() - apnsJwt.issuedAt < 50 * 60 * 1000) return apnsJwt.value;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: now }));
  const signer = createSign("SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign({ key: cfg.key, dsaEncoding: "ieee-p1363" });
  const value = `${header}.${claims}.${b64url(signature)}`;
  apnsJwt = { value, issuedAt: Date.now() };
  return value;
}

// Returns true when APNs says the token is gone for good.
function sendApns(cfg: ApnsConfig, token: string, payload: PushPayload): Promise<boolean> {
  return new Promise((resolve) => {
    const client = http2.connect(cfg.host);
    const finish = (gone: boolean) => {
      client.close();
      resolve(gone);
    };
    client.on("error", (err) => {
      console.error("[push] APNs connection error:", err?.message || err);
      finish(false);
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${token}`,
      authorization: `bearer ${getApnsJwt(cfg)}`,
      "apns-topic": cfg.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    });
    let status = 0;
    let body = "";
    req.on("response", (headers) => {
      status = Number(headers[":status"] || 0);
    });
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      if (status === 200) return finish(false);
      const gone = status === 410 || /BadDeviceToken|Unregistered|DeviceTokenNotForTopic/.test(body);
      if (!gone) console.error("[push] APNs send failed:", status, body.slice(0, 300));
      finish(gone);
    });
    req.on("error", (err) => {
      console.error("[push] APNs request error:", err?.message || err);
      finish(false);
    });
    req.end(
      JSON.stringify({
        aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
        ...(payload.data ?? {}),
      }),
    );
  });
}

// ---------------------------------------------------------------- public API
export const isPushConfigured = (): boolean => getFcmAccount() !== null || getApnsConfig() !== null;

// Sends to every registered device of the user over the channel that matches
// its platform. Tokens the provider reports as gone are deleted so we stop
// retrying them.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const fcm = getFcmAccount();
  const apns = getApnsConfig();
  if (!fcm && !apns) return;
  const tokens = await storage.getPushTokens(userId);
  if (tokens.length === 0) return;

  await Promise.all(
    tokens.map(async (t) => {
      let gone = false;
      if (t.platform === "ios") {
        if (!apns) return;
        gone = await sendApns(apns, t.token, payload);
      } else {
        if (!fcm) return;
        gone = await sendFcm(fcm, t.token, payload);
      }
      if (gone) await storage.deletePushToken(t.token).catch(() => {});
    }),
  );
}
