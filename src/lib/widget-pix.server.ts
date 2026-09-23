import { connectedMpFetch, decryptMercadoPagoToken } from "@/lib/mercadopago-connect.server";

export async function syncWidgetPixPayment(supabaseAdmin: any, providerPaymentId: string) {
  const { data: purchase, error } = await supabaseAdmin
    .from("widget_itinerary_purchases")
    .select("id, generation_id, owner_id, amount_brl, status")
    .eq("provider_payment_id", providerPaymentId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!purchase) return { found: false, status: "unknown", unlocked: false };
  if (purchase.status === "approved") return { found: true, status: "approved", unlocked: true };

  const { data: connection } = await supabaseAdmin
    .from("mercadopago_connections")
    .select("access_token_encrypted")
    .eq("owner_id", purchase.owner_id)
    .maybeSingle();
  if (!connection) return { found: true, status: "pending", unlocked: false };

  const token = await decryptMercadoPagoToken(connection.access_token_encrypted);
  const payment = await connectedMpFetch(token, `/v1/payments/${providerPaymentId}`);
  const amountMatches = Math.abs(Number(payment?.transaction_amount ?? 0) - Number(purchase.amount_brl)) <= 0.01;
  const referenceMatches = String(payment?.external_reference ?? "") === String(purchase.generation_id);
  const approved = payment?.status === "approved" && amountMatches && referenceMatches;
  const mapped = approved ? "approved" : payment?.status === "rejected" ? "rejected" : ["cancelled", "expired"].includes(payment?.status) ? "cancelled" : "pending";

  const now = new Date().toISOString();
  await supabaseAdmin.from("widget_itinerary_purchases").update({
    status: mapped,
    paid_at: approved ? now : null,
    unlocked_at: approved ? now : null,
  }).eq("id", purchase.id).neq("status", "approved");
  if (approved) {
    await supabaseAdmin.from("trip_widget_generations").update({ payment_unlocked_at: now }).eq("id", purchase.generation_id).is("payment_unlocked_at", null);
  }
  return { found: true, status: mapped, unlocked: approved };
}