import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { applyPricing, DEFAULT_COMMISSION_SETTINGS, type CommissionSettings } from "./pricing";

export const getCommissionSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      // Use the caller's RLS-scoped client so the
      // `commission_settings_read_admin` policy gates access.
      const { data } = await context.supabase
        .from("commission_settings")
        .select("markup_type, markup_value, service_fee_type, service_fee_value, default_currency, upsells_enabled")
        .limit(1)
        .maybeSingle();
      return (data as CommissionSettings) || DEFAULT_COMMISSION_SETTINGS;
    } catch (e) {
      console.error("getCommissionSettings failed", e);
      return DEFAULT_COMMISSION_SETTINGS;
    }
  });

const UpdateSchema = z.object({
  markup_type: z.enum(["percent", "fixed"]),
  markup_value: z.number().min(0).max(1000),
  service_fee_type: z.enum(["percent", "fixed"]),
  service_fee_value: z.number().min(0).max(1000),
  default_currency: z.string().min(3).max(4),
  upsells_enabled: z.boolean(),
});

export const updateCommissionSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Verify admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Acesso negado: somente administradores.");

    const { data: existing } = await supabase
      .from("commission_settings")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await supabase
        .from("commission_settings")
        .update({ ...data, updated_at: new Date().toISOString(), updated_by: userId })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("commission_settings").insert({ ...data, updated_by: userId });
      if (error) throw error;
    }
    return { ok: true };
  });

const PreviewSchema = z.object({
  original_amount: z.number().nonnegative(),
  currency: z.string().min(3).max(4),
});

export const previewPricing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PreviewSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("commission_settings")
      .select("markup_type, markup_value, service_fee_type, service_fee_value, default_currency, upsells_enabled")
      .limit(1)
      .maybeSingle();
    return applyPricing(data.original_amount, data.currency, (settings as CommissionSettings) || DEFAULT_COMMISSION_SETTINGS);
  });

