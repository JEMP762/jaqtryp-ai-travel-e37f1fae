import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const LogSchema = z.object({
  partner: z.string().min(1).max(40),
  kind: z.enum(["flight", "stay"]),
  payload: z.record(z.any()).default({}),
  estimated_value: z.number().nullable().optional(),
  currency: z.string().max(6).nullable().optional(),
});

export const logAffiliateClick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => LogSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("affiliate_clicks").insert({
      user_id: context.userId,
      partner: data.partner,
      kind: data.kind,
      payload: data.payload,
      estimated_value: data.estimated_value ?? null,
      currency: data.currency ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
