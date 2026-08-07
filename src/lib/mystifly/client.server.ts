/**
 * Cliente central da API Mystifly (MystiflyApiService).
 *
 * Responsabilidades:
 *  - resolver credenciais (somente de variáveis de ambiente do servidor)
 *  - carregar configurações não sensíveis do banco
 *  - aplicar timeout, retry com backoff e limite de taxa
 *  - validar JSON de resposta e padronizar erros
 *  - registrar cada chamada em mystifly_api_logs
 *
 * NUNCA importe este arquivo no cliente: o sufixo `.server` bloqueia o bundle.
 */
import {
  MYSTIFLY_ENDPOINT_PATHS,
  type MystiflyCallResult,
  type MystiflyCredentialStatus,
  type MystiflyEndpointKey,
  type MystiflyEnvironment,
  type MystiflySettings,
} from "./types";
import {
  backoffDelay,
  extractMystiflyError,
  normalizeBaseUrl,
  redact,
  sleep,
  truncateForLog,
} from "./utils";

export interface MystiflyCredentials {
  baseUrl: string;
  username: string;
  password: string;
  apiKey: string | null;
  accountNumber: string | null;
}

const DEFAULT_SETTINGS: MystiflySettings = {
  environment: "sandbox",
  timeoutMs: 30000,
  maxRetries: 2,
  cacheTtlSeconds: 900,
  connectionStatus: "unknown",
  connectionMessage: null,
  lastSyncAt: null,
};

/** Erro de negócio/transporte padronizado da integração. */
export class MystiflyError extends Error {
  httpStatus: number | null;
  retryable: boolean;
  constructor(message: string, httpStatus: number | null = null, retryable = false) {
    super(message);
    this.name = "MystiflyError";
    this.httpStatus = httpStatus;
    this.retryable = retryable;
  }
}

/* ------------------------------------------------------------------ */
/* Credenciais                                                         */
/* ------------------------------------------------------------------ */

/**
 * Lê as credenciais das variáveis de ambiente. O ambiente ativo decide
 * qual Base URL usar (sandbox ou produção).
 */
export function getCredentials(environment: MystiflyEnvironment): MystiflyCredentials | null {
  const baseUrl =
    environment === "production"
      ? process.env["MYSTIFLY_BASE_URL_PRODUCTION"] || process.env["MYSTIFLY_BASE_URL"]
      : process.env["MYSTIFLY_BASE_URL_SANDBOX"] || process.env["MYSTIFLY_BASE_URL"];
  const username = process.env["MYSTIFLY_USERNAME"];
  const password = process.env["MYSTIFLY_PASSWORD"];
  if (!baseUrl || !username || !password) return null;
  return {
    baseUrl: normalizeBaseUrl(baseUrl),
    username,
    password,
    apiKey: process.env["MYSTIFLY_API_KEY"] || null,
    accountNumber: process.env["MYSTIFLY_ACCOUNT_NUMBER"] || null,
  };
}

/** Diz apenas se cada credencial está presente — nunca o valor. */
export function getCredentialStatus(environment: MystiflyEnvironment): MystiflyCredentialStatus {
  const baseUrl =
    environment === "production"
      ? process.env["MYSTIFLY_BASE_URL_PRODUCTION"] || process.env["MYSTIFLY_BASE_URL"]
      : process.env["MYSTIFLY_BASE_URL_SANDBOX"] || process.env["MYSTIFLY_BASE_URL"];
  return {
    baseUrl: Boolean(baseUrl),
    username: Boolean(process.env["MYSTIFLY_USERNAME"]),
    password: Boolean(process.env["MYSTIFLY_PASSWORD"]),
    apiKey: Boolean(process.env["MYSTIFLY_API_KEY"]),
  };
}

/* ------------------------------------------------------------------ */
/* Configurações                                                       */
/* ------------------------------------------------------------------ */

let settingsCache: { value: MystiflySettings; ts: number } | null = null;
const SETTINGS_CACHE_MS = 30_000;

/** Carrega as configurações não sensíveis (com cache curto). */
export async function loadSettings(force = false): Promise<MystiflySettings> {
  if (!force && settingsCache && Date.now() - settingsCache.ts < SETTINGS_CACHE_MS) {
    return settingsCache.value;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("mystifly_settings")
      .select(
        "environment, timeout_ms, max_retries, cache_ttl_seconds, connection_status, connection_message, last_sync_at",
      )
      .limit(1)
      .maybeSingle();
    const value: MystiflySettings = data
      ? {
          environment: (data.environment as MystiflyEnvironment) || "sandbox",
          timeoutMs: data.timeout_ms ?? DEFAULT_SETTINGS.timeoutMs,
          maxRetries: data.max_retries ?? DEFAULT_SETTINGS.maxRetries,
          cacheTtlSeconds: data.cache_ttl_seconds ?? DEFAULT_SETTINGS.cacheTtlSeconds,
          connectionStatus: data.connection_status || "unknown",
          connectionMessage: data.connection_message ?? null,
          lastSyncAt: data.last_sync_at ?? null,
        }
      : DEFAULT_SETTINGS;
    settingsCache = { value, ts: Date.now() };
    return value;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Invalida o cache local de configurações (após uma alteração). */
export function invalidateSettingsCache(): void {
  settingsCache = null;
}

/* ------------------------------------------------------------------ */
/* Limite de taxa (janela deslizante em memória)                       */
/* ------------------------------------------------------------------ */

const RATE_WINDOW_MS = 60_000;
const RATE_MAX_CALLS = 120;
let rateHits: number[] = [];

function enforceRateLimit(): void {
  const now = Date.now();
  rateHits = rateHits.filter((t) => now - t < RATE_WINDOW_MS);
  if (rateHits.length >= RATE_MAX_CALLS) {
    throw new MystiflyError(
      "Limite de requisições por minuto atingido. Tente novamente em instantes.",
      429,
      false,
    );
  }
  rateHits.push(now);
}

/* ------------------------------------------------------------------ */
/* Log                                                                 */
/* ------------------------------------------------------------------ */

export interface LogContext {
  userId?: string | null;
  tripId?: string | null;
  bookingId?: string | null;
  mfReference?: string | null;
}

async function writeLog(entry: {
  endpoint: string;
  request: unknown;
  response: unknown;
  durationMs: number;
  httpStatus: number | null;
  success: boolean;
  error: string | null;
  environment: string;
  context: LogContext;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("mystifly_api_logs").insert({
      endpoint: entry.endpoint,
      method: "POST",
      request: truncateForLog(redact(entry.request)) as any,
      response: truncateForLog(redact(entry.response)) as any,
      duration_ms: entry.durationMs,
      http_status: entry.httpStatus,
      success: entry.success,
      error: entry.error,
      user_id: entry.context.userId ?? null,
      trip_id: entry.context.tripId ?? null,
      booking_id: entry.context.bookingId ?? null,
      mf_reference: entry.context.mfReference ?? null,
      environment: entry.environment,
    });
  } catch (e) {
    // Log nunca pode derrubar a chamada principal.
    console.error("[mystifly] falha ao gravar log", e);
  }
}

/* ------------------------------------------------------------------ */
/* Chamada HTTP                                                        */
/* ------------------------------------------------------------------ */

async function doFetch(
  url: string,
  body: unknown,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<{ status: number; json: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", ...headers },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: unknown = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text.slice(0, 2000) };
      }
    }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

export interface RequestOptions {
  /** Não anexa SessionId automaticamente (usado pelo CreateSession). */
  skipSession?: boolean;
  context?: LogContext;
  /** Sobrescreve o token de sessão (usado na renovação). */
  sessionId?: string | null;
}

/**
 * Executa uma chamada à Mystifly com timeout, retry, limite de taxa,
 * validação de JSON e log completo.
 */
export async function mystiflyRequest<T = any>(
  endpoint: MystiflyEndpointKey,
  payload: Record<string, unknown>,
  options: RequestOptions = {},
): Promise<MystiflyCallResult<T>> {
  const started = Date.now();
  const settings = await loadSettings();
  const context = options.context ?? {};

  const finish = async (
    ok: boolean,
    httpStatus: number | null,
    data: T | null,
    error: string | null,
    responseForLog: unknown,
  ): Promise<MystiflyCallResult<T>> => {
    const durationMs = Date.now() - started;
    await writeLog({
      endpoint,
      request: payload,
      response: responseForLog,
      durationMs,
      httpStatus,
      success: ok,
      error,
      environment: settings.environment,
      context,
    });
    return { ok, endpoint, httpStatus, durationMs, data, error, request: redact(payload) };
  };

  const credentials = getCredentials(settings.environment);
  if (!credentials) {
    return finish(
      false,
      null,
      null,
      "Credenciais da Mystifly não configuradas para o ambiente atual.",
      null,
    );
  }

  let sessionId = options.sessionId ?? null;
  if (!options.skipSession && !sessionId) {
    const { getSessionId } = await import("./session.server");
    try {
      sessionId = await getSessionId();
    } catch (e: any) {
      return finish(false, null, null, e?.message || "Falha ao criar sessão Mystifly", null);
    }
  }

  const url = `${credentials.baseUrl}${MYSTIFLY_ENDPOINT_PATHS[endpoint]}`;
  const headers: Record<string, string> = {};
  if (credentials.apiKey) headers["api-key"] = credentials.apiKey;
  if (sessionId) headers["Authorization"] = `Bearer ${sessionId}`;

  const body: Record<string, unknown> = { ...payload };
  if (sessionId && !("SessionId" in body)) body["SessionId"] = sessionId;

  let lastError: MystiflyError | null = null;

  for (let attempt = 0; attempt <= settings.maxRetries; attempt++) {
    try {
      enforceRateLimit();
      const { status, json } = await doFetch(url, body, headers, settings.timeoutMs);

      // Sessão expirada: renova uma vez e repete.
      const apiError = extractMystiflyError(json);
      const sessionExpired =
        status === 401 ||
        (typeof apiError === "string" && /session|token/i.test(apiError) && /expir|invalid/i.test(apiError));

      if (sessionExpired && !options.skipSession && attempt < settings.maxRetries) {
        const { refreshSessionId } = await import("./session.server");
        const fresh = await refreshSessionId();
        headers["Authorization"] = `Bearer ${fresh}`;
        body["SessionId"] = fresh;
        lastError = new MystiflyError("Sessão expirada — renovada", status, true);
        continue;
      }

      if (status >= 500 || status === 408 || status === 429) {
        lastError = new MystiflyError(`Mystifly HTTP ${status}`, status, true);
        if (attempt < settings.maxRetries) {
          await sleep(backoffDelay(attempt));
          continue;
        }
        return finish(false, status, null, lastError.message, json);
      }

      if (status >= 400) {
        return finish(false, status, null, apiError || `Mystifly HTTP ${status}`, json);
      }

      if (json === null || typeof json !== "object") {
        return finish(false, status, null, "Resposta inválida (JSON esperado)", json);
      }

      if (apiError) {
        return finish(false, status, json as T, apiError, json);
      }

      return finish(true, status, json as T, null, json);
    } catch (e: any) {
      const aborted = e?.name === "AbortError";
      lastError = new MystiflyError(
        aborted ? `Tempo limite de ${settings.timeoutMs}ms excedido` : e?.message || "Falha de rede",
        e?.httpStatus ?? null,
        aborted || !(e instanceof MystiflyError) || e.retryable,
      );
      if (attempt < settings.maxRetries && lastError.retryable) {
        await sleep(backoffDelay(attempt));
        continue;
      }
      return finish(false, lastError.httpStatus, null, lastError.message, null);
    }
  }

  return finish(false, null, null, lastError?.message || "Falha desconhecida", null);
}

/** Atualiza status de conexão e data da última sincronização. */
export async function recordConnectionStatus(
  status: "ok" | "error",
  message: string | null,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("mystifly_settings")
      .update({
        connection_status: status,
        connection_message: message,
        last_sync_at: new Date().toISOString(),
      })
      .eq("singleton", true);
    invalidateSettingsCache();
  } catch (e) {
    console.error("[mystifly] falha ao atualizar status", e);
  }
}
