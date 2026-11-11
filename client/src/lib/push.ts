// Native push registration (Capacitor). Opt-in and guarded twice: it runs only
// inside the native app AND only when the build enables it
// (VITE_PUSH_ENABLED=true), because the Android build needs Firebase's
// google-services.json and iOS the Push capability before registering can
// work. Until then the app relies on the in-app notification center.
import { isNative } from "./config";
import { apiRequest } from "./queryClient";

export const PUSH_ENABLED =
  isNative && String(import.meta.env.VITE_PUSH_ENABLED ?? "").toLowerCase() === "true";

type Platform = "ios" | "android" | "web";

let listenersInstalled = false;

const platformName = (): Platform => {
  const cap = (window as any).Capacitor;
  const p = cap?.getPlatform?.();
  return p === "ios" || p === "android" ? p : "web";
};

// Asks permission and registers the device token with the backend. Resolves
// to the permission outcome so the Settings page can explain what happened.
export async function enablePush(
  onOpen?: (data: Record<string, string>) => void,
): Promise<"granted" | "denied" | "unavailable"> {
  if (!PUSH_ENABLED) return "unavailable";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    let status = await PushNotifications.checkPermissions();
    if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive !== "granted") return "denied";

    if (!listenersInstalled) {
      listenersInstalled = true;
      await PushNotifications.addListener("registration", async (token) => {
        try {
          await apiRequest("POST", "/api/push-tokens", { token: token.value, platform: platformName() });
        } catch (err) {
          console.error("push token registration failed", err);
        }
      });
      await PushNotifications.addListener("registrationError", (err) => {
        console.error("push registration error", err);
      });
      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = (action.notification.data ?? {}) as Record<string, string>;
        onOpen?.(data);
      });
    }
    await PushNotifications.register();
    return "granted";
  } catch (err) {
    console.error("push unavailable", err);
    return "unavailable";
  }
}

export async function disablePush(): Promise<void> {
  try {
    await apiRequest("DELETE", "/api/push-tokens", {});
  } catch (err) {
    console.error("push token removal failed", err);
  }
}

// Where to navigate when the user taps a push
export function pushTargetPath(data: Record<string, string>): string {
  switch (data.type) {
    case "message":
    case "match":
      return data.relatedId ? `/chat/${data.relatedId}` : "/messages";
    case "connection_request":
      return "/matches";
    case "event_approved":
    case "event_rsvp":
      return "/events";
    default:
      return "/notifications";
  }
}
