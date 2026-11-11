// One entry point for "tell this user something happened": writes the in-app
// notification row and, for the few event types that justify interrupting
// someone, sends a native push with the same text in her language.
//
// Push policy (deliberately narrow — notification spam is one of the top
// complaints users level at comparable apps): a request received, a request
// accepted, a new message, an event approved. Everything else is in-app only.
import { storage } from "./storage";
import { sendPushToUser } from "./push";

export type NotificationType =
  | "connection_request"
  | "match"
  | "message"
  | "event_approved"
  | "event_rejected"
  | "event_rsvp"
  | "new_mom_nearby";

type Lang = "it" | "en";

interface TextParams {
  name: string;
  extra?: string;
}

const TEXTS: Record<Lang, Record<NotificationType, (p: TextParams) => { title: string; body: string }>> = {
  it: {
    connection_request: ({ name }) => ({ title: "Nuova richiesta di connessione", body: `${name} vuole connettersi con te` }),
    match: ({ name }) => ({ title: "Richiesta accettata!", body: `${name} ha accettato la tua richiesta: puoi scriverle` }),
    message: ({ name }) => ({ title: name, body: "Ti ha scritto un messaggio" }),
    event_approved: ({ extra }) => ({ title: "Evento approvato", body: `Il tuo evento "${extra ?? ""}" è online` }),
    event_rejected: ({ extra }) => ({ title: "Evento non approvato", body: `Il tuo evento "${extra ?? ""}" non è stato approvato` }),
    event_rsvp: ({ name, extra }) => ({ title: "Qualcuno parteciperà", body: `${name} parteciperà a "${extra ?? ""}"` }),
    new_mom_nearby: ({ name, extra }) => ({ title: "Nuova mamma vicino a te", body: `${name} si è appena iscritta a ${extra ?? "HeyMama"}` }),
  },
  en: {
    connection_request: ({ name }) => ({ title: "New connection request", body: `${name} wants to connect with you` }),
    match: ({ name }) => ({ title: "Request accepted!", body: `${name} accepted your request: you can message her` }),
    message: ({ name }) => ({ title: name, body: "Sent you a message" }),
    event_approved: ({ extra }) => ({ title: "Event approved", body: `Your event "${extra ?? ""}" is live` }),
    event_rejected: ({ extra }) => ({ title: "Event not approved", body: `Your event "${extra ?? ""}" was not approved` }),
    event_rsvp: ({ name, extra }) => ({ title: "Someone is coming", body: `${name} will attend "${extra ?? ""}"` }),
    new_mom_nearby: ({ name, extra }) => ({ title: "New mom near you", body: `${name} just joined in ${extra ?? "HeyMama"}` }),
  },
};

const PUSH_TYPES = new Set<NotificationType>(["connection_request", "match", "message", "event_approved"]);

// At most one message push per sender->recipient pair every 2 minutes, so a
// quick back-and-forth doesn't buzz the phone on every line.
const MESSAGE_PUSH_THROTTLE_MS = 2 * 60 * 1000;
const lastMessagePush = new Map<string, number>();

export interface NotifyOptions {
  recipientId: string;
  senderId: string;
  type: NotificationType;
  // Id the client navigates to: match id for request/accept/message, event id for events
  relatedId?: string | null;
  // Display name of the actor; looked up from the sender's profile when omitted
  senderName?: string;
  // Free text for event titles / province names
  extra?: string;
}

export async function notifyUser(opts: NotifyOptions): Promise<void> {
  let name = opts.senderName;
  if (!name) {
    const senderProfile = await storage.getProfile(opts.senderId).catch(() => undefined);
    name = senderProfile
      ? (senderProfile.businessName || senderProfile.firstName || "").trim() || "HeyMama"
      : "HeyMama";
  }
  const recipient = await storage.getUserById(opts.recipientId).catch(() => undefined);
  const lang: Lang = recipient?.language === "en" ? "en" : "it";
  const text = TEXTS[lang][opts.type]({ name, extra: opts.extra });

  // In-app row (always). The stored message is the Italian text for legacy
  // readers; the client renders its own localized copy from type + sender.
  try {
    await storage.createNotification({
      type: opts.type,
      senderId: opts.senderId,
      recipientId: opts.recipientId,
      message: TEXTS.it[opts.type]({ name, extra: opts.extra }).body,
      relatedId: opts.relatedId ?? null,
      isRead: false,
    });
  } catch (err: any) {
    console.error("createNotification failed:", err?.message || err);
  }

  if (!PUSH_TYPES.has(opts.type)) return;
  if (opts.type === "message") {
    const key = `${opts.senderId}>${opts.recipientId}`;
    const last = lastMessagePush.get(key) ?? 0;
    if (Date.now() - last < MESSAGE_PUSH_THROTTLE_MS) return;
    lastMessagePush.set(key, Date.now());
  }
  // Fire and forget: a push outage must never fail the user's action
  sendPushToUser(opts.recipientId, {
    title: text.title,
    body: text.body,
    data: { type: opts.type, relatedId: opts.relatedId ?? "" },
  }).catch((err) => console.error("push failed:", err?.message || err));
}
