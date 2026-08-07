/**
 * Consultas administrativas da integração Mystifly: dashboard e logs.
 */
import { getCredentialStatus, loadSettings, recordConnectionStatus } from "./client.server";
import { createSession, getSessionState } from "./session.server";
import type { MystiflyEnvironment } from "./types";

/** Testa a conexão criando uma sessão real e registra o resultado. */
export async function testConnection(): Promise<{
  ok: boolean;
  message: string;
  durationMs: number;
}> {
  const started = Date.now();
  try {
    await createSession();
    const durationMs = Date.now() - started;
    await recordConnectionStatus("ok", null);
    return { ok: true, message: "Sessão criada com sucesso.", durationMs };
  } catch (e: any) {
    const durationMs = Date.now() - started;
    const message = e?.message || "Falha ao conectar na Mystifly";
    await recordConnectionStatus("error", message);
    return { ok: false, message, durationMs };
  }
}

/** Grava as configurações não sensíveis. */
export async function saveSettings(input: {
  environment: MystiflyEnvironment;
  timeoutMs: number;
  maxRetries: number;
  cacheTtlSeconds: number;
  userId: string;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("mystifly_settings")
    .update({
      environment: input.environment,
      timeout_ms: input.timeoutMs,
      max_retries: input.maxRetries,
      cache_ttl_seconds: input.cacheTtlSeconds,
      updated_by: input.userId,
    })
    .eq("singleton", true);
  if (error) throw new Error(error.message);
  const { invalidateSettingsCache } = await import("./client.server");
  invalidateSettingsCache();
}

/** Reúne todos os indicadores exibidos no dashboard da integração. */
export async function buildDashboard() {
  const settings = await loadSettings(true);
  const credentials = getCredentialStatus(settings.environment);
  const session = getSessionState();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recent } = await supabaseAdmin
    .from("mystifly_api_logs")
    .select("endpoint, success, duration_ms, created_at, error, mf_reference, booking_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);

  const rows = recent || [];
  const errors24h = rows.filter((r) => !r.success).length;
  const durations = rows.map((r) => r.duration_ms || 0).filter((d) => d > 0);
  const avgMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  const lastOf = (endpoint: string) =>
    rows.find((r) => r.endpoint === endpoint && r.success) || null;

  return {
    environment: settings.environment,
    credentials,
    connectionStatus: settings.connectionStatus,
    connectionMessage: settings.connectionMessage,
    lastSyncAt: settings.lastSyncAt,
    settings: {
      timeoutMs: settings.timeoutMs,
      maxRetries: settings.maxRetries,
      cacheTtlSeconds: settings.cacheTtlSeconds,
    },
    session,
    stats: {
      requests24h: rows.length,
      errors24h,
      avgResponseMs: avgMs,
    },
    lastSearch: lastOf("searchLowestFare"),
    lastBooking: lastOf("bookFlight"),
    lastTicket: lastOf("orderTicket"),
  };
}

/** Lista os últimos registros de chamada para a tela administrativa. */
export async function listLogs(limit = 50, endpoint?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("mystifly_api_logs")
    .select(
      "id, endpoint, http_status, success, duration_ms, error, mf_reference, booking_id, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  if (endpoint) query = query.eq("endpoint", endpoint);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}
