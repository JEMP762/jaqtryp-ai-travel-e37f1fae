/**
 * Server functions da integração Mystifly.
 *
 * Este arquivo é apenas um invólucro fino: nenhuma lógica ou constante
 * vive no escopo do módulo — tudo é importado dentro dos handlers para
 * garantir que nada do servidor vaze para o bundle do cliente.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Garante que o chamador possui o papel admin. */
async function assertAdmin(context: any): Promise<string> {
  const { data } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Acesso negado: somente administradores.");
  return context.userId as string;
}

export const mystiflyDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { buildDashboard } = await import("./mystifly/admin.server");
    return buildDashboard();
  });

export const mystiflyLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { limit?: number; endpoint?: string }) => input ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { listLogs } = await import("./mystifly/admin.server");
    return { rows: await listLogs(data.limit ?? 50, data.endpoint) };
  });

export const mystiflySaveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input)
  .handler(async ({ data, context }) => {
    const userId = await assertAdmin(context);
    const { settingsSchema } = await import("./mystifly/validators");
    const { saveSettings } = await import("./mystifly/admin.server");
    const parsed = settingsSchema.parse(data);
    await saveSettings({ ...parsed, userId });
    return { ok: true };
  });

export const mystiflyTestConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { testConnection } = await import("./mystifly/admin.server");
    return testConnection();
  });

/**
 * Executa qualquer endpoint da Mystifly a partir da tela de testes.
 * Somente administradores; a resposta traz request, response, tempo e status.
 */
export const mystiflyRunEndpoint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { endpoint: string; payload?: unknown }) => input)
  .handler(async ({ data, context }) => {
    const userId = await assertAdmin(context);
    const { runEndpoint } = await import("./mystifly/runner.server");
    return runEndpoint(data.endpoint, data.payload, { userId });
  });
