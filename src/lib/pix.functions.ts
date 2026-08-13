import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type CreatePixResult =
  | {
      id: string;
      mpPaymentId: string;
      qrCode: string;
      qrCodeBase64: string | null;
      ticketUrl: string | null;
      amountBrl: number;
      credits: number;
      expiresAt: string | null;
    }
  | { error: string };

export const createPixPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lookupKey: string }) => {
    if (!/^credits_(700|2000|4000)$/.test(data?.lookupKey ?? "")) throw new Error("Pacote inválido");
    return { lookupKey: data.lookupKey };
  })
  .handler(async ({ data, context }): Promise<CreatePixResult> => {
    try {
      const { userId, claims } = context as any;
      const email = (claims?.email as string | undefined) ?? undefined;

      const { PIX_PACKS, mpFetch } = await import("@/lib/pix.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      const pack = PIX_PACKS[data.lookupKey as keyof typeof PIX_PACKS];
      if (!pack) return { error: "Pacote desconhecido" };

      const expiration = new Date(Date.now() + 30 * 60 * 1000);
      const idempotencyKey = `${userId}:${data.lookupKey}:${Date.now()}`;

      const payment = await mpFetch("/v1/payments", {
        method: "POST",
        headers: { "X-Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          transaction_amount: pack.amountBrl,
          description: `JAQTRYP · ${pack.label} · ${pack.credits} créditos`,
          payment_method_id: "pix",
          date_of_expiration: expiration.toISOString().replace("Z", "-00:00"),
          payer: { email: email || `user-${userId}@jaqtryp.com` },
          metadata: {
            user_id: userId,
            lookup_key: data.lookupKey,
            credits: pack.credits,
            kind: "credit_pack_pix",
          },
        }),
      });

      const tx = payment?.point_of_interaction?.transaction_data ?? {};
      const mpPaymentId = String(payment?.id ?? "");
      if (!mpPaymentId || !tx.qr_code) return { error: "Não foi possível gerar o PIX. Tente novamente." };

      const { data: row, error } = await supabaseAdmin
        .from("pix_payments")
        .insert({
          user_id: userId,
          provider: "mercado_pago",
          payment_method: "pix",
          mp_payment_id: mpPaymentId,
          lookup_key: data.lookupKey,
          credits: pack.credits,
          amount_brl: pack.amountBrl,
          status: "pending",
          qr_code: tx.qr_code,
          qr_code_base64: tx.qr_code_base64 ?? null,
          ticket_url: tx.ticket_url ?? null,
          expires_at: expiration.toISOString(),
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      return {
        id: row.id,
        mpPaymentId,
        qrCode: tx.qr_code,
        qrCodeBase64: tx.qr_code_base64 ?? null,
        ticketUrl: tx.ticket_url ?? null,
        amountBrl: pack.amountBrl,
        credits: pack.credits,
        expiresAt: expiration.toISOString(),
      };
    } catch (e: any) {
      console.error("[pix] createPixPayment", e?.message || e);
      return { error: e?.message || "Falha ao criar pagamento PIX" };
    }
  });

export const getPixPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => {
    if (!data?.id) throw new Error("id obrigatório");
    return { id: data.id };
  })
  .handler(async ({ data, context }): Promise<{ status: string; credited?: boolean; error?: string }> => {
    try {
      const { userId, supabase } = context as any;

      const { data: row, error } = await supabase
        .from("pix_payments")
        .select("mp_payment_id, status, user_id")
        .eq("id", data.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row || row.user_id !== userId) return { status: "unknown", error: "Pagamento não encontrado" };
      if (row.status === "approved") return { status: "approved", credited: true };
      if (!row.mp_payment_id) return { status: row.status };

      const { syncPixPaymentStatus } = await import("@/lib/pix.server");
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const res = await syncPixPaymentStatus(supabaseAdmin, row.mp_payment_id);
      return res;
    } catch (e: any) {
      console.error("[pix] getPixPaymentStatus", e?.message || e);
      return { status: "pending", error: e?.message };
    }
  });
