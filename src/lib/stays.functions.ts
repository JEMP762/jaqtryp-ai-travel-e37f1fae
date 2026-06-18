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
      `Duffel Stays API ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

const SearchSchema = z.object({
  // Free-text destination (city / hotel name). We geocode via Duffel suggestions.
  query: z.string().min(2),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(10).default(2),
  rooms: z.number().int().min(1).max(5).default(1),
});

export const searchStays = createServerFn({ method: "POST" })
  .middleware([withSupabaseAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => SearchSchema.parse(input))
  .handler(async ({ data }) => {
    // Resolve location via Duffel suggestions
    const suggestRes = await duffelFetch(
      `/stays/accommodation/suggestions?query=${encodeURIComponent(data.query)}`,
    );
    const suggestion = suggestRes?.data?.[0];
    if (!suggestion) {
      return { results: [], location: null };
    }

    const body: any = {
      data: {
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date,
        rooms: data.rooms,
        guests: Array.from({ length: data.guests }).map(() => ({ type: "adult" })),
      },
    };

    if (suggestion.accommodation?.id) {
      body.data.accommodation_ids = [suggestion.accommodation.id];
    } else if (suggestion.location?.geographic_coordinates) {
      body.data.location = {
        radius: 10,
        geographic_coordinates: suggestion.location.geographic_coordinates,
      };
    } else {
      return { results: [], location: suggestion };
    }

    const result = await duffelFetch("/stays/search", {
      method: "POST",
      body: JSON.stringify(body),
    });

    const results = (result?.data?.results || []).slice(0, 30).map((r: any) => ({
      id: r.id,
      accommodation: {
        id: r.accommodation?.id,
        name: r.accommodation?.name,
        rating: r.accommodation?.rating,
        review_score: r.accommodation?.review_score,
        photos: (r.accommodation?.photos || []).slice(0, 5).map((p: any) => p.url),
        location: {
          address: r.accommodation?.location?.address,
        },
        amenities: (r.accommodation?.amenities || []).map((a: any) => a.type),
      },
      cheapest_rate_total_amount: r.cheapest_rate_total_amount,
      cheapest_rate_currency: r.cheapest_rate_currency,
    }));

    return { results, location: suggestion };
  });

const RatesSchema = z.object({ search_result_id: z.string() });

export const getStayRates = createServerFn({ method: "POST" })
  .middleware([withSupabaseAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => RatesSchema.parse(input))
  .handler(async ({ data }) => {
    const res = await duffelFetch(
      `/stays/search_results/${data.search_result_id}/actions/fetch_all_rates`,
      { method: "POST" },
    );
    const acc = res?.data?.accommodation;
    const rates = (acc?.rooms || []).flatMap((room: any) =>
      (room.rates || []).map((rate: any) => ({
        id: rate.id,
        room_name: room.name,
        board_type: rate.board_type,
        cancellation_timeline: rate.cancellation_timeline,
        total_amount: rate.total_amount,
        total_currency: rate.total_currency,
        payment_type: rate.payment_type,
        photos: (room.photos || []).slice(0, 3).map((p: any) => p.url),
      })),
    );
    return {
      accommodation: {
        name: acc?.name,
        rating: acc?.rating,
        description: acc?.description,
        photos: (acc?.photos || []).slice(0, 8).map((p: any) => p.url),
        location: acc?.location,
        check_in_information: acc?.check_in_information,
      },
      rates,
    };
  });

const GuestSchema = z.object({
  given_name: z.string().min(1),
  family_name: z.string().min(1),
});

const BookSchema = z.object({
  rate_id: z.string(),
  guests: z.array(GuestSchema).min(1),
  email: z.string().email(),
  phone_number: z.string().min(5),
});

export const createStayBooking = createServerFn({ method: "POST" })
  .middleware([withSupabaseAuthHeader, requireSupabaseAuth])
  .inputValidator((input: unknown) => BookSchema.parse(input))
  .handler(async ({ data, context }) => {
    // 1) Quote the rate to lock price and get a quote_id
    const quoteRes = await duffelFetch("/stays/quotes", {
      method: "POST",
      body: JSON.stringify({ data: { rate_id: data.rate_id } }),
    });
    const quote = quoteRes?.data;
    if (!quote?.id) throw new Error("Não foi possível cotar a tarifa");

    // 2) Create booking, paying with Duffel balance (same as voos)
    const bookingRes = await duffelFetch("/stays/bookings", {
      method: "POST",
      body: JSON.stringify({
        data: {
          quote_id: quote.id,
          guests: data.guests,
          email: data.email,
          phone_number: data.phone_number,
          payment: {
            type: "balance",
            amount: quote.total_amount,
            currency: quote.total_currency,
          },
        },
      }),
    });
    const booking = bookingRes?.data;
    const { supabase, userId } = context;

    await supabase.from("stay_orders").insert({
      user_id: userId,
      duffel_booking_id: booking.id,
      reference: booking.reference || booking.confirmation_code || null,
      accommodation_name: booking.accommodation?.name || null,
      check_in_date: booking.check_in_date || null,
      check_out_date: booking.check_out_date || null,
      guests: (booking.guests || []).length || null,
      rooms: booking.rooms || null,
      total_amount: booking.total_amount,
      total_currency: booking.total_currency,
      status: booking.status || "confirmed",
      raw: booking,
    });

    try {
      const { data: cs } = await supabase
        .from("commission_settings")
        .select("markup_type, markup_value, service_fee_type, service_fee_value, default_currency, upsells_enabled")
        .limit(1)
        .maybeSingle();
      const settings = (cs as CommissionSettings) || DEFAULT_COMMISSION_SETTINGS;
      const b = applyPricing(booking.total_amount, booking.total_currency, settings);
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("booking_commissions").insert({
        user_id: userId,
        order_kind: "stay",
        order_id: booking.id,
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
      id: booking.id,
      reference: booking.reference || booking.confirmation_code,
      total_amount: booking.total_amount,
      total_currency: booking.total_currency,
    };
  });

export const listStayOrders = createServerFn({ method: "GET" })
  .middleware([withSupabaseAuthHeader, requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("stay_orders")
      .select(
        "id, duffel_booking_id, reference, accommodation_name, check_in_date, check_out_date, total_amount, total_currency, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return { orders: data || [] };
  });
