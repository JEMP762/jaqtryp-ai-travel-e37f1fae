import { createFileRoute } from "@tanstack/react-router";

// Webhook isolado do Mercado Pago (recargas de crédito via PIX).
// NÃO interfere no webhook do Stripe.
export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any = null;
        try {
          body = await request.json();
        } catch {
          body = null;
        }

        const url = new URL(request.url);
        const paymentId =
          body?.data?.id ??
          body?.resource?.toString?.().split("/").pop() ??
          url.searchParams.get("data.id") ??
          url.searchParams.get("id");

        const topic = body?.type ?? body?.topic ?? url.searchParams.get("topic") ?? "";

        if (!paymentId || (topic && !String(topic).includes("payment"))) {
          return new Response("ignored", { status: 200 });
        }

        try {
          // A verdade vem sempre da API do Mercado Pago, nunca do corpo recebido.
          const { syncPixPaymentStatus } = await import("@/lib/pix.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const res = await syncPixPaymentStatus(supabaseAdmin, String(paymentId));
          console.log("[mp/webhook] payment", paymentId, res);
        } catch (e: any) {
          console.error("[mp/webhook] error", e?.message || e);
          return new Response("error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
