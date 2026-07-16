import webpush from "web-push";

type PushPayload = {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
};

let configured = false;
function ensureConfigured() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:contato@jaqtryp.com";
  if (!pub || !priv) {
    throw new Error("VAPID keys missing (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  ensureConfigured();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: subs, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!subs || subs.length === 0) return 0;

  const body = JSON.stringify(payload);
  let delivered = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        delivered += 1;
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          stale.push(s.endpoint);
        } else {
          console.error("[push] send failed", statusCode, err);
        }
      }
    }),
  );

  if (stale.length > 0) {
    await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return delivered;
}
