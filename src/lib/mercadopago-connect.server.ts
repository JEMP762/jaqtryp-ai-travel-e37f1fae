import { createHmac, createHash, randomBytes, timingSafeEqual } from "crypto";

const MP_API = "https://api.mercadopago.com";

function encryptionSecret() {
  const value = process.env["MERCADOPAGO_WIDGET_ENCRYPTION_KEY"];
  if (!value) throw new Error("Conexão Mercado Pago indisponível.");
  return value;
}

function encryptionKey() {
  return createHash("sha256").update(encryptionSecret()).digest();
}

export function createMercadoPagoState(userId: string) {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + 10 * 60 * 1000, nonce: randomBytes(12).toString("hex") })).toString("base64url");
  const signature = createHmac("sha256", encryptionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readMercadoPagoState(state: string) {
  const [payload, signature] = state.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", encryptionSecret()).update(payload).digest();
  const received = Buffer.from(signature, "base64url");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { userId?: string; exp?: number };
  if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
  return parsed;
}

export async function encryptMercadoPagoToken(value: string) {
  const iv = randomBytes(12);
  const key = await crypto.subtle.importKey("raw", encryptionKey(), "AES-GCM", false, ["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value));
  return `${iv.toString("base64url")}.${Buffer.from(encrypted).toString("base64url")}`;
}

export async function decryptMercadoPagoToken(value: string) {
  const [ivValue, encryptedValue] = value.split(".");
  if (!ivValue || !encryptedValue) throw new Error("Conexão Mercado Pago inválida.");
  const key = await crypto.subtle.importKey("raw", encryptionKey(), "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: Buffer.from(ivValue, "base64url") },
    key,
    Buffer.from(encryptedValue, "base64url"),
  );
  return new TextDecoder().decode(decrypted);
}

export async function connectedMpFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || data?.error || `Mercado Pago ${response.status}`);
  return data;
}