import { VAPID_PUBLIC_KEY } from "./push-config";
import { subscribeToPush, unsubscribeFromPush } from "./push.functions";

const SW_URL = "/push-sw.js";

function isLovablePreviewHost(host: string) {
  return (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function canRegisterPush(): boolean {
  if (!isPushSupported()) return false;
  if (typeof window === "undefined") return false;
  if (window.self !== window.top) return false; // inside preview iframe
  if (isLovablePreviewHost(window.location.hostname)) return false;
  return true;
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  if (existing) return existing;
  return navigator.serviceWorker.register(SW_URL, { scope: "/" });
}

export async function getCurrentPushPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  return Notification.permission;
}

export async function enablePushNotifications(): Promise<
  { ok: true } | { ok: false; reason: string }
> {
  if (!canRegisterPush()) {
    return { ok: false, reason: "not_supported" };
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, reason: permission };
  }
  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  const raw = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    return { ok: false, reason: "invalid_subscription" };
  }
  await subscribeToPush({
    data: {
      endpoint: raw.endpoint,
      keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
      userAgent: navigator.userAgent,
    },
  });
  return { ok: true };
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    try {
      await unsubscribeFromPush({ data: { endpoint: sub.endpoint } });
    } catch (_) {}
    await sub.unsubscribe();
  }
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}
