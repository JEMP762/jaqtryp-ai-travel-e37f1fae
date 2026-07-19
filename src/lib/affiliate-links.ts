// Público-first: usa link genérico e, se houver ID de afiliado configurado
// (via VITE_ env), acopla os parâmetros de comissão. Trocar de "redirect"
// para "direct" reativa checkout interno sem tocar em UI.

export type BookingMode = "redirect" | "direct";
export const FLIGHTS_BOOKING_MODE: BookingMode =
  ((import.meta as any).env?.VITE_FLIGHTS_BOOKING_MODE as BookingMode) || "redirect";
export const STAYS_BOOKING_MODE: BookingMode =
  ((import.meta as any).env?.VITE_STAYS_BOOKING_MODE as BookingMode) || "redirect";

export type FlightLinkInput = {
  origin: string;
  destination: string;
  departure_date: string;
  return_date?: string;
  adults?: number;
  cabin_class?: "economy" | "premium_economy" | "business" | "first";
};

const CABIN_SKY: Record<string, string> = {
  economy: "economy",
  premium_economy: "premiumeconomy",
  business: "business",
  first: "first",
};

function ymdCompact(iso: string) {
  return iso.replace(/-/g, "").slice(2); // YYYY-MM-DD → YYMMDD
}

export function buildFlightLink(inp: FlightLinkInput, partner: "skyscanner" | "google" = "skyscanner") {
  const o = inp.origin.toUpperCase();
  const d = inp.destination.toUpperCase();
  const adults = Math.max(1, inp.adults || 1);

  if (partner === "google") {
    // Google Flights aceita URL de busca padrão
    const q = `Passagens de ${o} para ${d} em ${inp.departure_date}${
      inp.return_date ? ` volta ${inp.return_date}` : ""
    }`;
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
  }

  // Skyscanner: /transport/flights/ORIG/DEST/YYMMDD[/YYMMDD]/
  const cabin = CABIN_SKY[inp.cabin_class || "economy"];
  const dep = ymdCompact(inp.departure_date);
  const ret = inp.return_date ? `/${ymdCompact(inp.return_date)}` : "";
  const qs = new URLSearchParams({
    adults: String(adults),
    cabinclass: cabin,
    rtn: inp.return_date ? "1" : "0",
    preferdirects: "false",
    outboundaltsenabled: "false",
    inboundaltsenabled: "false",
    currency: "BRL",
  });
  return `https://www.skyscanner.com.br/transport/flights/${o}/${d}/${dep}${ret}/?${qs.toString()}`;
}

export type StayLinkInput = {
  query: string;
  check_in_date: string;
  check_out_date: string;
  guests?: number;
  rooms?: number;
};

export function buildStayLink(inp: StayLinkInput, partner: "booking" | "hotels" | "airbnb" = "booking") {
  const q = encodeURIComponent(inp.query || "");
  const guests = Math.max(1, inp.guests || 2);
  const rooms = Math.max(1, inp.rooms || 1);

  if (partner === "hotels") {
    const qs = new URLSearchParams({
      "q-destination": inp.query,
      "q-check-in": inp.check_in_date,
      "q-check-out": inp.check_out_date,
      "q-rooms": String(rooms),
      "q-room-0-adults": String(guests),
    });
    return `https://www.hotels.com/search.do?${qs.toString()}`;
  }

  if (partner === "airbnb") {
    const qs = new URLSearchParams({
      query: inp.query,
      checkin: inp.check_in_date,
      checkout: inp.check_out_date,
      adults: String(guests),
    });
    return `https://www.airbnb.com.br/s/${encodeURIComponent(inp.query)}/homes?${qs.toString()}`;
  }

  // Booking (com afiliado opcional via env pública)
  const aid = (import.meta as any).env?.VITE_BOOKING_AFFILIATE_ID;
  const aidQs = aid ? `&aid=${encodeURIComponent(aid)}` : "";
  return `https://www.booking.com/searchresults.html?ss=${q}&checkin=${inp.check_in_date}&checkout=${inp.check_out_date}&group_adults=${guests}&no_rooms=${rooms}${aidQs}`;
}

export const PARTNER_LABEL: Record<string, string> = {
  skyscanner: "Skyscanner",
  google: "Google Flights",
  booking: "Booking.com",
  hotels: "Hotels.com",
  airbnb: "Airbnb",
};
