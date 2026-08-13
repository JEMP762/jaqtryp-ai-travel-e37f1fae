// Helpers de servidor para pagamentos PIX via Mercado Pago.
// NÃO é importado pelo cliente (bloqueado por *.server.ts).

export const MP_API = "https://api.mercadopago.com";

export type PixPackKey = "credits_700" | "credits_2000" | "credits_4000";

/** Preços PIX em BRL — independentes dos preços em USD do Stripe. */
export const PIX_PACKS: Record<PixPackKey, { credits: number; amountBrl: number; label: string }> = {
  credits_700: { credits: 700, amountBrl: 49.9, label: "Starter" },
  credits_2000: { credits: 2000, amountBrl: 125.9, label: "Explorer" },
  credits_4000: { credits: 4000, amountBrl: 296.9, label: "Global" },
};

export function getMpToken(): string {
  const token = process.env["MERCADOPAGO_ACCESS_TOKEN"];
  if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  return token;
}

export async function mpFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getMpToken()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(json?.message || json?.error || `Mercado Pago ${res.status}`);
  }
  return json;
}

/**
 * Libera créditos de um pagamento PIX de forma idempotente.
 * Só credita se o UPDATE condicional (status <> 'approved') afetar a linha.
 */
export async function creditApprovedPixPayment(
  supabaseAdmin: any,
  mpPaymentId: string,
  paidAmount: number,
): Promise<{ credited: boolean; reason?: string }> {
  const { data: row, error } = await supabaseAdmin
    .from("pix_payments")
    .select("id, user_id, lookup_key, credits, amount_brl, status")
    .eq("mp_payment_id", mpPaymentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return { credited: false, reason: "unknown_payment" };
  if (row.status === "approved") return { credited: false, reason: "already_credited" };

  const pack = PIX_PACKS[row.lookup_key as PixPackKey];
  if (!pack) return { credited: false, reason: "unknown_pack" };
  if (Math.abs(Number(paidAmount) - pack.amountBrl) > 0.01) {
    return { credited: false, reason: "amount_mismatch" };
  }

  // Trava de idempotência
  const { data: updated, error: upErr } = await supabaseAdmin
    .from("pix_payments")
    .update({ status: "approved", credited_at: new Date().toISOString() })
    .eq("id", row.id)
    .neq("status", "approved")
    .select("id");
  if (upErr) throw new Error(upErr.message);
  if (!updated || updated.length === 0) return { credited: false, reason: "already_credited" };

  const { error: rpcErr } = await supabaseAdmin.rpc("add_credits", {
    _user: row.user_id,
    _amount: pack.credits,
    _reason: "purchase_pix",
    _bucket: "topup",
    _session: `mp:${mpPaymentId}`,
    _meta: {
      payment_method: "pix",
      payment_provider: "mercado_pago",
      mp_payment_id: mpPaymentId,
      lookup_key: row.lookup_key,
      amount_brl: pack.amountBrl,
      currency: "BRL",
      label: pack.label,
    },
  });
  if (rpcErr) throw new Error(rpcErr.message);

  // Bônus de indicação (mesma regra dos pacotes Stripe)
  try {
    await supabaseAdmin.rpc("reward_referrer", {
      _paid_user: row.user_id,
      _kind: "pack",
      _pack_credits: pack.credits,
      _stripe_ref: `mp:${mpPaymentId}`,
    });
  } catch (e: any) {
    console.warn("[pix] reward_referrer falhou", e?.message);
  }

  return { credited: true };
}

/** Consulta o pagamento no Mercado Pago e sincroniza o status local. */
export async function syncPixPaymentStatus(
  supabaseAdmin: any,
  mpPaymentId: string,
): Promise<{ status: string; credited: boolean }> {
  const payment = await mpFetch(`/v1/payments/${mpPaymentId}`);
  const status: string = payment?.status ?? "pending";

  if (status === "approved") {
    const res = await creditApprovedPixPayment(
      supabaseAdmin,
      String(mpPaymentId),
      Number(payment?.transaction_amount ?? 0),
    );
    return { status: "approved", credited: res.credited };
  }

  const mapped =
    status === "rejected" ? "rejected" : status === "cancelled" || status === "expired" ? "cancelled" : "pending";

  await supabaseAdmin
    .from("pix_payments")
    .update({ status: mapped })
    .eq("mp_payment_id", String(mpPaymentId))
    .neq("status", "approved");

  return { status: mapped, credited: false };
}
