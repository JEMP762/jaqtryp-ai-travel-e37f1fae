/**
 * Utilidades puras da integração Mystifly (sem I/O e sem segredos).
 */
import type { CabinClass } from "./types";

/** Espera assíncrona simples usada no backoff. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Backoff exponencial com teto, em milissegundos. */
export function backoffDelay(attempt: number): number {
  return Math.min(4000, 400 * Math.pow(2, attempt));
}

const SENSITIVE_KEYS = [
  "password",
  "pwd",
  "username",
  "userid",
  "user_id",
  "accountnumber",
  "apikey",
  "api_key",
  "sessionid",
  "session_id",
  "token",
  "authorization",
];

/**
 * Remove credenciais e tokens de qualquer objeto antes de gravar em log
 * ou devolver para a interface administrativa.
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 8 || value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value !== "object") return value;

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.includes(key.toLowerCase())) {
      out[key] = "***";
    } else {
      out[key] = redact(val, depth + 1);
    }
  }
  return out;
}

/** Limita o tamanho do JSON gravado no log para não inflar o banco. */
export function truncateForLog(value: unknown, maxChars = 40000): unknown {
  try {
    const json = JSON.stringify(value);
    if (!json) return value ?? null;
    if (json.length <= maxChars) return value;
    return { truncated: true, size: json.length, preview: json.slice(0, maxChars) };
  } catch {
    return { unserializable: true };
  }
}

/** Converte a cabine interna para o código aceito pela Mystifly. */
export function toMystiflyCabin(cabin: CabinClass): string {
  switch (cabin) {
    case "PremiumEconomy":
      return "PremiumEconomy";
    case "Business":
      return "Business";
    case "First":
      return "First";
    default:
      return "Economy";
  }
}

/** Extrai a primeira mensagem de erro reconhecível de uma resposta Mystifly. */
export function extractMystiflyError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, any>;
  const candidates = [
    p.Errors?.[0]?.Message,
    p.Errors?.[0]?.ErrorMessage,
    p.Error?.Message,
    p.ErrorMessage,
    p.Message,
    p.error_description,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  if (p.Success === false || p.Status === "Failed") return "Requisição recusada pela Mystifly";
  return null;
}

/** Normaliza a Base URL removendo barra final. */
export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
