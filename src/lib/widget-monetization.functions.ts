import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const httpsUrl = z.string().trim().url("Informe um link válido.").max(1000).refine(
  (value) => new URL(value).protocol === "https:",
  "O link precisa começar com https://",
);

const settingsSchema = z.discriminatedUnion("enabled", [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    paymentUrl: httpsUrl,
    price: z.number().finite().positive().max(999999.99),
    password: z.string().trim().min(6, "Use uma senha com pelo menos 6 caracteres.").max(100).optional(),
  }),
]);

export const getWidgetMonetization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("trip_widgets")
      .select("monetization_enabled, payment_url, itinerary_price, unlock_password_hash")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error("Não foi possível carregar a configuração de venda.");
    return {
      enabled: data?.monetization_enabled === true,
      paymentUrl: data?.payment_url ?? "",
      price: data?.itinerary_price == null ? "" : String(data.itinerary_price),
      hasPassword: Boolean(data?.unlock_password_hash),
    };
  });

export const saveWidgetMonetization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: widget, error: widgetError } = await context.supabase
      .from("trip_widgets")
      .select("id, unlock_password_hash, unlock_password_salt")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (widgetError || !widget) throw new Error("Salve seu link antes de configurar a venda.");

    if (!data.enabled) {
      const { error } = await context.supabase.from("trip_widgets").update({
        monetization_enabled: false,
        payment_url: null,
        itinerary_price: null,
        unlock_password_hash: null,
        unlock_password_salt: null,
      }).eq("id", widget.id).eq("owner_id", context.userId);
      if (error) throw new Error("Não foi possível desativar a venda.");
      return { enabled: false, hasPassword: false };
    }

    let passwordHash = widget.unlock_password_hash;
    let passwordSalt = widget.unlock_password_salt;
    if (data.password) {
      const security = await import("@/lib/widget-monetization.server");
      passwordSalt = security.createPasswordSalt();
      passwordHash = await security.hashWidgetPassword(data.password, passwordSalt);
    }
    if (!passwordHash || !passwordSalt) throw new Error("Defina uma senha de desbloqueio.");

    const { error } = await context.supabase.from("trip_widgets").update({
      monetization_enabled: true,
      payment_url: data.paymentUrl,
      itinerary_price: data.price,
      unlock_password_hash: passwordHash,
      unlock_password_salt: passwordSalt,
    }).eq("id", widget.id).eq("owner_id", context.userId);
    if (error) throw new Error("Não foi possível salvar a configuração de venda.");
    return { enabled: true, hasPassword: true };
  });