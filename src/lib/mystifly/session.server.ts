/**
 * Gestão de sessão da Mystifly (CreateSession).
 * A sessão fica em cache no processo do servidor e é renovada automaticamente.
 */
import { getCredentials, loadSettings, mystiflyRequest, MystiflyError } from "./client.server";

interface SessionState {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}

let session: SessionState | null = null;
let inFlight: Promise<string> | null = null;

/** Extrai o identificador de sessão de diferentes formatos de resposta. */
function pickSessionId(payload: any): string | null {
  const candidates = [
    payload?.Data?.SessionId,
    payload?.SessionId,
    payload?.Data?.sessionId,
    payload?.sessionId,
    payload?.Data?.Token,
    payload?.Token,
    payload?.access_token,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

/** Cria uma nova sessão na Mystifly e guarda em cache. */
export async function createSession(): Promise<string> {
  const settings = await loadSettings();
  const credentials = getCredentials(settings.environment);
  if (!credentials) {
    throw new MystiflyError("Credenciais da Mystifly não configuradas.", null, false);
  }

  const result = await mystiflyRequest<any>(
    "createSession",
    {
      UserName: credentials.username,
      Password: credentials.password,
      ...(credentials.accountNumber ? { AccountNumber: credentials.accountNumber } : {}),
    },
    { skipSession: true },
  );

  if (!result.ok) {
    throw new MystiflyError(result.error || "Falha ao criar sessão", result.httpStatus, false);
  }

  const sessionId = pickSessionId(result.data);
  if (!sessionId) {
    throw new MystiflyError("Resposta de sessão sem identificador", result.httpStatus, false);
  }

  const ttlMs = Math.max(60, settings.cacheTtlSeconds) * 1000;
  session = { sessionId, createdAt: Date.now(), expiresAt: Date.now() + ttlMs };
  return sessionId;
}

/** Retorna uma sessão válida, reutilizando a que estiver em cache. */
export async function getSessionId(): Promise<string> {
  if (session && Date.now() < session.expiresAt - 30_000) return session.sessionId;
  if (inFlight) return inFlight;
  inFlight = createSession().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Força a criação de uma nova sessão (usado quando a atual expira). */
export async function refreshSessionId(): Promise<string> {
  session = null;
  return getSessionId();
}

/** Estado da sessão para o dashboard administrativo. */
export function getSessionState(): {
  active: boolean;
  createdAt: string | null;
  expiresAt: string | null;
  remainingSeconds: number;
} {
  if (!session) {
    return { active: false, createdAt: null, expiresAt: null, remainingSeconds: 0 };
  }
  const remaining = Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000));
  return {
    active: remaining > 0,
    createdAt: new Date(session.createdAt).toISOString(),
    expiresAt: new Date(session.expiresAt).toISOString(),
    remainingSeconds: remaining,
  };
}
