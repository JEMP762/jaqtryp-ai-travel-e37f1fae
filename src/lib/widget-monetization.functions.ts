import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const settingsSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({ enabled: z.literal(true), price: z.number().finite().positive().max(999999.99) }),
]);

export const getWidgetMonetization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trip_widgets")
      .select("monetization_enabled, itinerary_price, mercadopago_connected")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a configuração de venda.");
    return {
      enabled: data?.monetization_enabled === true,
      price: data?.itinerary_price == null ? "" : String(data.itinerary_price),
      connected: data?.mercadopago_connected === true,
    };
  });

export const getMercadoPagoConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    const clientId = process.env["MERCADOPAGO_CLIENT_ID"];
    if (!clientId) throw new Error("A conexão com Mercado Pago precisa ser ativada pelo JAQTRYP.");
    const { createMercadoPagoState } = await import("@/lib/mercadopago-connect.server");
    const redirectUri = `${new URL(data.origin).origin}/api/public/mercadopago/callback`;
    const state = createMercadoPagoState(context.userId);
    return { url: `https://auth.mercadopago.com.br/authorization?client_id=${encodeURIComponent(clientId)}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}` };
  });

export const disconnectMercadoPago = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("mercadopago_connections").delete().eq("owner_id", context.userId);
    await supabaseAdmin.from("trip_widgets").update({ mercadopago_connected: false, monetization_enabled: false }).eq("owner_id", context.userId);
    return { ok: true };
  });

export const saveWidgetMonetization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: widget, error: widgetError } = await context.supabase
      .from("trip_widgets")
      .select("id, mercadopago_connected")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (widgetError || !widget) throw new Error("Salve seu link antes de configurar a venda.");
    if (data.enabled && !widget.mercadopago_connected) throw new Error("Conecte sua conta Mercado Pago antes de ativar a venda.");
    const update = data.enabled
      ? { monetization_enabled: true, itinerary_price: data.price, payment_url: null, unlock_password_hash: null, unlock_password_salt: null }
      : { monetization_enabled: false, itinerary_price: null, payment_url: null, unlock_password_hash: null, unlock_password_salt: null };
    const { error } = await context.supabase.from("trip_widgets").update(update).eq("id", widget.id).eq("owner_id", context.userId);
    if (error) throw new Error("Não foi possível salvar a configuração de venda.");
    return { enabled: data.enabled };
  });