import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient } from "@/lib/stripe.server";

// Mirror of CREDIT_PACKS — inlined to avoid pulling createServerFn into route module
const CREDIT_PACK_BY_CENTS: Record<number, { credits: number; lookupKey: string; label: string }> = {
  999:  { credits: 700,  lookupKey: "credits_700",  label: "Starter" },
  2499: { credits: 2000, lookupKey: "credits_2000", label: "Explorer" },
  5999: { credits: 4000, lookupKey: "credits_4000", label: "Global" },
};

const DUFFEL_BASE = "https://api.duffel.com";

async function duffel(path: string, init: RequestInit = {}) {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) throw new Error("DUFFEL_API_KEY ausente");
  const res = await fetch(`${DUFFEL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const j: any = await res.json().catch(() => null);
  if (!res.ok) throw new Error(j?.errors?.[0]?.message || `Duffel ${res.status}`);
  return j;
}

function verifySig(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const a = Buffer.from(signature.replace(/^sha256=/, ""), "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function fulfillPending(pendingId: string, sessionId: string) {
  const { data: pending, error } = await supabaseAdmin
    .from("pending_flight_bookings")
    .select("*")
    .eq("id", pendingId)
    .maybeSingle();
  if (error || !pending) throw new Error("Reserva pendente não encontrada");
  if (pending.duffel_order_id) return { already: true };

  // Fetch offer
  const offerRes = await duffel(`/air/offers/${pending.offer_id}?return_available_services=false`);
  const offer = offerRes?.data;
  if (!offer) throw new Error("Oferta expirou — pagamento será reembolsado");

  const orderRes = await duffel("/air/orders", {
    method: "POST",
    body: JSON.stringify({
      data: {
        type: "instant",
        selected_offers: [pending.offer_id],
        passengers: pending.passengers,
        payments: [{ type: "balance", amount: offer.total_amount, currency: offer.total_currency }],
      },
    }),
  });
  const order = orderRes.data;

  await supabaseAdmin.from("flight_orders").insert({
    user_id: pending.user_id,
    duffel_order_id: order.id,
    booking_reference: order.booking_reference,
    total_amount: order.total_amount,
    total_currency: order.total_currency,
    passengers: order.passengers || [],
    slices: order.slices || [],
    status: "confirmed",
    raw: order,
  });

  await supabaseAdmin.from("booking_commissions").insert({
    user_id: pending.user_id,
    order_kind: "flight",
    order_id: order.id,
    original_amount: pending.original_amount,
    markup_amount: (pending.breakdown as any)?.markup ?? 0,
    service_fee_amount: (pending.breakdown as any)?.serviceFee ?? 0,
    final_amount: pending.final_amount,
    currency: pending.final_currency,
    net_profit: (pending.breakdown as any)?.netProfit ?? 0,
    upsells: [],
    provider: "stripe",
    payment_session_id: sessionId,
  });

  await supabaseAdmin
    .from("pending_flight_bookings")
    .update({ payment_status: "paid", duffel_order_id: order.id })
    .eq("id", pendingId);

  return { ok: true, booking_reference: order.booking_reference };
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as "sandbox" | "live";

        const body = await request.text();
        const stripeSig = request.headers.get("stripe-signature");

        // === Stripe-format webhook (subscriptions) ===
        if (stripeSig) {
          const secret =
            env === "live"
              ? process.env.PAYMENTS_LIVE_WEBHOOK_SECRET
              : process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET;
          if (!secret) {
            console.error("[payments/webhook] missing stripe webhook secret");
            return new Response("Misconfigured", { status: 500 });
          }
          try {
            await verifyStripe(body, stripeSig, secret);
          } catch (e: any) {
            console.warn("[payments/webhook] invalid stripe signature", e?.message);
            return new Response("Invalid signature", { status: 401 });
          }
          let event: any;
          try { event = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }
          try {
            await handleSubscriptionEvent(event, env);
            await handleCreditPackEvent(event);
          } catch (e: any) {
            console.error("[payments/webhook] subscription error", e?.message || e);
            return new Response(JSON.stringify({ ok: false, error: e?.message }), { status: 500 });
          }
          return new Response("ok", { status: 200 });
        }

        // === Lovable gateway format (flight bookings) ===
        const secret =
          env === "live"
            ? process.env.PAYMENTS_WEBHOOK_SECRET
            : process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET || process.env.PAYMENTS_WEBHOOK_SECRET;

        const sig =
          request.headers.get("x-lovable-signature") ||
          request.headers.get("lovable-signature") ||
          request.headers.get("x-webhook-signature");

        if (!secret) {
          console.error("[payments/webhook] missing PAYMENTS_WEBHOOK_SECRET for env", env);
          return new Response("Webhook not configured", { status: 500 });
        }
        if (!verifySig(body, sig, secret)) {
          console.warn("[payments/webhook] invalid signature");
          return new Response("Invalid signature", { status: 401 });
        }

        let event: any;
        try { event = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }

        const type: string = event?.type || event?.event || "";
        const data = event?.data?.object || event?.data || event;

        try {
          if (type === "transaction.completed" || type === "checkout.session.completed") {
            const sessionId = data?.session_id || data?.id;
            const pendingId =
              data?.metadata?.pending_id ||
              event?.metadata?.pending_id ||
              null;
            if (pendingId) await fulfillPending(pendingId, sessionId);
          } else if (type === "transaction.payment_failed") {
            const pendingId = data?.metadata?.pending_id;
            if (pendingId)
              await supabaseAdmin
                .from("pending_flight_bookings")
                .update({ payment_status: "failed", error: data?.failure_message || "payment_failed" })
                .eq("id", pendingId);
          }
        } catch (e: any) {
          console.error("[payments/webhook] fulfill error", e?.message || e);
          return new Response(JSON.stringify({ ok: false, error: e?.message }), { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});

async function verifyStripe(body: string, signature: string, secret: string) {
  let timestamp: string | undefined;
  const v1: string[] = [];
  for (const part of signature.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v;
    if (k === "v1") v1.push(v);
  }
  if (!timestamp || v1.length === 0) throw new Error("Invalid signature format");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new Error("Timestamp too old");
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = Buffer.from(new Uint8Array(signed)).toString("hex");
  if (!v1.includes(expected)) throw new Error("Invalid webhook signature");
}

async function handleSubscriptionEvent(event: any, env: "sandbox" | "live") {
  const type = event?.type;
  const obj = event?.data?.object;
  if (!obj) return;

  if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
    const userId = obj.metadata?.userId;
    if (!userId) { console.warn("[subscription] missing userId"); return; }
    const item = obj.items?.data?.[0];
    const priceId =
      item?.price?.lookup_key ||
      item?.price?.metadata?.lovable_external_id ||
      item?.price?.id;
    const productId = item?.price?.product;
    const periodStart = item?.current_period_start ?? obj.current_period_start;
    const periodEnd = item?.current_period_end ?? obj.current_period_end;

    await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_subscription_id: obj.id,
        stripe_customer_id: obj.customer,
        product_id: productId,
        price_id: priceId,
        status: obj.status,
        current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        cancel_at_period_end: obj.cancel_at_period_end || false,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "stripe_subscription_id" }
    );

    // Promote user_role based on price
    const ULTRA_PRICES = new Set(["price_1TdX4XF2249riykh3ja7kaHB", "price_1TdXSYF2249riykhv8DaMEYx"]);
    const PRO_PRICES = new Set(["price_1TdX3QF2249riykhAAlqarhW", "price_1TdXZNF2249riykhwvbz6EWl"]);
    const role: "ultra" | "premium" | null =
      ULTRA_PRICES.has(priceId) ? "ultra" :
      PRO_PRICES.has(priceId) ? "premium" :
      priceId?.startsWith("jaqtryp_ultra") ? "ultra" :
      priceId?.startsWith("jaqtryp_pro") ? "premium" : null;
    if (role && (obj.status === "active" || obj.status === "trialing")) {
      await supabaseAdmin.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
    }

    // === Créditos mensais por plano ===
    // Pro/Premium = 600 cr/mês · Ultra = 1500 cr/mês
    if (obj.status === "active" || obj.status === "trialing") {
      const monthlyGrant = role === "ultra" ? 1500 : role === "premium" ? 600 : 0;
      if (monthlyGrant > 0) {
        // Marca o grant atual e credita imediatamente o saldo do ciclo corrente.
        // Idempotente via stripe_session_id = "sub_grant:<sub_id>:<period_start>"
        const grantKey = `sub_grant:${obj.id}:${periodStart ?? "now"}`;
        const { data: alreadyGranted } = await supabaseAdmin
          .from("credit_ledger")
          .select("id")
          .eq("stripe_session_id", grantKey)
          .maybeSingle();
        if (!alreadyGranted) {
          // Atualiza o monthly_grant e a próxima data de reset = period_end
          await supabaseAdmin
            .from("user_credits")
            .upsert({
              user_id: userId,
              monthly_grant: monthlyGrant,
              monthly_balance: monthlyGrant,
              monthly_reset_at: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });
          await supabaseAdmin.from("credit_ledger").insert({
            user_id: userId,
            delta: monthlyGrant,
            reason: "monthly_grant",
            stripe_session_id: grantKey,
            metadata: { bucket: "monthly", subscription_id: obj.id, price_id: priceId } as any,
          });
        }
      }
    }
  } else if (type === "customer.subscription.deleted") {
    await supabaseAdmin.from("subscriptions").update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    }).eq("stripe_subscription_id", obj.id).eq("environment", env);
  }
}

// =====================================================================
// Compra de pacote avulso de créditos
// Suporta dois eventos: checkout.session.completed e payment_intent.succeeded
// Idempotência sempre pelo PaymentIntent id (pi_…) → mesmo se Stripe enviar
// ambos os eventos, só credita uma vez.
// Fallback: se metadata estiver ausente, resolve via Customer.metadata.userId
// e mapeia valor pago → pacote.
// =====================================================================
async function handleCreditPackEvent(event: any, env: "sandbox" | "live") {
  const type = event?.type;
  if (type !== "checkout.session.completed" && type !== "payment_intent.succeeded") return;
  const obj = event?.data?.object;
  if (!obj) return;

  // checkout.session.completed → obj is Checkout Session (mode=payment)
  // payment_intent.succeeded   → obj is PaymentIntent
  if (type === "checkout.session.completed" && obj.mode !== "payment") return;

  // Sempre usa pi_id como chave de idempotência
  const paymentIntentId: string | null =
    type === "payment_intent.succeeded"
      ? obj.id
      : (typeof obj.payment_intent === "string" ? obj.payment_intent : obj.payment_intent?.id) ?? null;

  if (!paymentIntentId) {
    console.warn("[credit_pack] no payment_intent id on event", { type, id: obj.id });
    return;
  }

  const meta = obj.metadata || {};
  const amountPaid: number | null =
    obj.amount_total ?? obj.amount_received ?? obj.amount ?? null;

  console.log("[credit_pack] received", {
    type,
    id: obj.id,
    pi: paymentIntentId,
    kind: meta.kind ?? null,
    hasUserId: Boolean(meta.userId),
    amount: amountPaid,
  });

  let userId: string | null = null;
  let credits: number | null = null;
  let lookupKey: string | null = null;
  let resolvedVia: "metadata" | "customer_fallback" = "metadata";

  // Caminho 1: metadata direta
  if (meta.kind === "credit_pack" && meta.userId && meta.credits) {
    userId = String(meta.userId);
    credits = parseInt(String(meta.credits), 10);
    lookupKey = meta.lookup_key ?? null;
  } else {
    // Caminho 2: fallback via Customer + mapeamento por valor
    const customerId: string | null =
      typeof obj.customer === "string" ? obj.customer : obj.customer?.id ?? null;

    if (!customerId || !amountPaid) {
      console.warn("[credit_pack] skipped", {
        reason: "no_metadata_and_no_customer_or_amount",
        type,
        pi: paymentIntentId,
      });
      return;
    }

    const pack = CREDIT_PACK_BY_CENTS[amountPaid];
    if (!pack) {
      console.warn("[credit_pack] skipped", {
        reason: "unknown_amount",
        amount: amountPaid,
        pi: paymentIntentId,
      });
      return;
    }

    try {
      const stripe = createStripeClient(env);
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        console.warn("[credit_pack] skipped", { reason: "customer_deleted", customerId });
        return;
      }
      const customerUserId = (customer as any).metadata?.userId;
      if (!customerUserId) {
        console.warn("[credit_pack] skipped", {
          reason: "customer_missing_userId",
          customerId,
          pi: paymentIntentId,
        });
        return;
      }
      userId = String(customerUserId);
      credits = pack.credits;
      lookupKey = pack.lookupKey;
      resolvedVia = "customer_fallback";
      console.log("[credit_pack] fallback_used", { userId, pack: pack.label, pi: paymentIntentId });
    } catch (e: any) {
      console.error("[credit_pack] customer lookup failed", e?.message || e);
      throw e;
    }
  }

  if (!userId || !credits || credits <= 0) {
    console.warn("[credit_pack] skipped", { reason: "invalid_resolved_data", userId, credits });
    return;
  }

  const { error } = await supabaseAdmin.rpc("add_credits", {
    _user: userId,
    _amount: credits,
    _reason: "purchase",
    _bucket: "topup",
    _session: paymentIntentId,
    _meta: {
      lookup_key: lookupKey,
      amount_paid: amountPaid,
      source: type,
      resolved_via: resolvedVia,
    } as any,
  });
  if (error) {
    console.error("[credit_pack] add_credits error", error.message);
    throw new Error(error.message);
  }
  console.log("[credit_pack] credited", { userId, credits, pi: paymentIntentId, via: resolvedVia });
}



