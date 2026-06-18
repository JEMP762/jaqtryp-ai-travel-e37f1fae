import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { applyPricing, DEFAULT_COMMISSION_SETTINGS, type CommissionSettings } from "./pricing";

const DUFFEL_BASE = "https://api.duffel.com";
const DUFFEL_VERSION = "v2";

const withSupabaseAuthHeader = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    if (typeof window === "undefined") return next();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return next(
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    );
  },
);

async function duffelFetch(path: string, init: RequestInit = {}) {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) throw new Error("DUFFEL_API_KEY não configurada");
  const res = await fetch(`${DUFFEL_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Duffel-Version": DUFFEL_VERSION,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Accept-Encoding": "gzip",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const msg =
      json?.errors?.[0]?.message ||
      json?.errors?.[0]?.title ||
      `Duffel API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

const SearchSchema = z.object({
  origin: z.string().length(3).toUpperCase(),
  destination: z.string().length(3).toUpperCase(),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  return_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  adults: z.number().int().min(1).max(9).default(1),
  cabin_class: z
    .enum(["economy", "premium_economy", "business", "first"])
    .default("economy"),
});

export const searchFlights = createServerFn({ method: "POST" })
  .middleware([withSupabaseAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchSchema.parse(input))
  .handler(async ({ data }) => {
    const slices: any[] = [
      {
        origin: data.origin,
        destination: data.destination,
        departure_date: data.departure_date,
      },
    ];
    if (data.return_date) {
      slices.push({
        origin: data.destination,
        destination: data.origin,
        departure_date: data.return_date,
      });
    }
    const passengers = Array.from({ length: data.adults }).map(() => ({
      type: "adult",
    }));

    const result = await duffelFetch(
      "/air/offer_requests?return_offers=true",
      {
        method: "POST",
        body: JSON.stringify({
          data: {
            slices,
            passengers,
            cabin_class: data.cabin_class,
          },
        }),
      }
    );

    const offers = (result?.data?.offers || []).slice(0, 30).map((o: any) => ({
      id: o.id,
      total_amount: o.total_amount,
      total_currency: o.total_currency,
      tax_amount: o.tax_amount,
      owner: { name: o.owner?.name, iata_code: o.owner?.iata_code, logo: o.owner?.logo_symbol_url },
      expires_at: o.expires_at,
      slices: (o.slices || []).map((s: any) => ({
        origin: s.origin?.iata_code,
        destination: s.destination?.iata_code,
        duration: s.duration,
        segments: (s.segments || []).map((seg: any) => ({
          origin: seg.origin?.iata_code,
          destination: seg.destination?.iata_code,
          departing_at: seg.departing_at,
          arriving_at: seg.arriving_at,
          marketing_carrier: seg.marketing_carrier?.name,
          marketing_carrier_iata: seg.marketing_carrier?.iata_code,
          flight_number: seg.marketing_carrier_flight_number,
          duration: seg.duration,
        })),
      })),
      passenger_ids: (o.passengers || []).map((p: any) => p.id),
    }));

    return { offers };
  });

const PassengerSchema = z.object({
  id: z.string(),
  given_name: z.string().min(1),
  family_name: z.string().min(1),
  born_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["m", "f"]),
  title: z.enum(["mr", "ms", "mrs", "miss", "dr"]),
  email: z.string().email(),
  phone_number: z.string().min(5),
});

const CreateOrderSchema = z.object({
  offer_id: z.string(),
  passengers: z.array(PassengerSchema).min(1),
});

export const createFlightOrder = createServerFn({ method: "POST" })
  .middleware([withSupabaseAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateOrderSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Re-fetch offer to know amount/currency
    const offerRes = await duffelFetch(`/air/offers/${data.offer_id}?return_available_services=false`);
    const offer = offerRes?.data;
    if (!offer) throw new Error("Oferta não encontrada ou expirada");

    const orderRes = await duffelFetch("/air/orders", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "instant",
          selected_offers: [data.offer_id],
          passengers: data.passengers,
          payments: [
            {
              type: "balance",
              amount: offer.total_amount,
              currency: offer.total_currency,
            },
          ],
        },
      }),
    });

    const order = orderRes?.data;
    const { supabase, userId } = context;

    await supabase.from("flight_orders").insert({
      user_id: userId,
      duffel_order_id: order.id,
      booking_reference: order.booking_reference,
      total_amount: order.total_amount,
      total_currency: order.total_currency,
      passengers: order.passengers || [],
      slices: order.slices || [],
      status: "confirmed",
      raw: order,
    });

    // Monetization: record commission breakdown (non-blocking)
    try {
      const { data: cs } = await supabase
        .from("commission_settings")
        .select("markup_type, markup_value, service_fee_type, service_fee_value, default_currency, upsells_enabled")
        .limit(1)
        .maybeSingle();
      const settings = (cs as CommissionSettings) || DEFAULT_COMMISSION_SETTINGS;
      const b = applyPricing(order.total_amount, order.total_currency, settings);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("booking_commissions").insert({
        user_id: userId,
        order_kind: "flight",
        order_id: order.id,
        original_amount: b.original,
        markup_amount: b.markup,
        service_fee_amount: b.serviceFee,
        final_amount: b.final,
        currency: b.currency,
        net_profit: b.netProfit,
        upsells: [],
      });
    } catch (e) {
      console.error("commission record failed", e);
    }

    return {
      id: order.id,
      booking_reference: order.booking_reference,
      total_amount: order.total_amount,
      total_currency: order.total_currency,
    };
  });

export const listFlightOrders = createServerFn({ method: "GET" })
  .middleware([withSupabaseAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("flight_orders")
      .select("id, duffel_order_id, booking_reference, total_amount, total_currency, slices, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { orders: data || [] };
  });
