import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/mercadopago/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) return Response.redirect(`${url.origin}/planner?mercadopago=error`, 302);
        try {
          const { readMercadoPagoState, encryptMercadoPagoToken } = await import("@/lib/mercadopago-connect.server");
          const parsed = readMercadoPagoState(state);
          const clientId = process.env["MERCADOPAGO_CLIENT_ID"];
          const clientSecret = process.env["MERCADOPAGO_CLIENT_SECRET"];
          if (!parsed || !clientId || !clientSecret) throw new Error("invalid connection");
          const ownerId = parsed.userId;
          const redirectUri = `${url.origin}/api/public/mercadopago/callback`;
          const response = await fetch("https://api.mercadopago.com/oauth/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri }),
          });
          const token = await response.json();
          if (!response.ok || !token?.access_token || !token?.user_id) throw new Error("token exchange failed");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await supabaseAdmin.from("mercadopago_connections").upsert({
            owner_id: ownerId,
            mp_user_id: String(token.user_id),
            access_token_encrypted: await encryptMercadoPagoToken(token.access_token),
            refresh_token_encrypted: token.refresh_token ? await encryptMercadoPagoToken(token.refresh_token) : null,
            token_expires_at: token.expires_in ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString() : null,
          }, { onConflict: "owner_id" });
          await supabaseAdmin.from("trip_widgets").update({ mercadopago_connected: true }).eq("owner_id", ownerId);
          return Response.redirect(`${url.origin}/planner?mercadopago=connected`, 302);
        } catch (error) {
          console.error("[mercadopago/connect]", error);
          return Response.redirect(`${url.origin}/planner?mercadopago=error`, 302);
        }
      },
    },
  },
});