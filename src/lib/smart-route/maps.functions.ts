// Source: Google Maps Platform Code Assist
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coordinateSchema, languageSchema, modeSchema, parseJourney } from "./model";

export const listSmartRouteItineraries = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.from("user_results").select("id,title,payload").eq("user_id", context.userId).eq("kind", "itinerary").order("occurred_at", { ascending: false }).limit(30);
  if (error) throw new Error("Não foi possível carregar seus roteiros.");
  return (data ?? []).map(row => {
    const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
    return { id: row.id, title: row.title, markdown: typeof payload.markdown === "string" ? payload.markdown.slice(0, 100000) : "", destination: typeof payload.destination === "string" ? payload.destination : "" };
  });
});

export const searchSmartRoutePlaces = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ query: z.string().trim().min(3).max(200), language: languageSchema, bias: coordinateSchema.optional() }).parse(input))
  .handler(async ({ data }) => {
    const appKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!appKey || !connectionKey) throw new Error("Google Maps ainda não está configurado.");
    const { mapsRequest } = await import("./maps.server");
    const body = await mapsRequest(appKey, connectionKey, "/places/v1/places:searchText", { textQuery: data.query, languageCode: data.language, pageSize: 5, ...(data.bias ? { locationBias: { circle: { center: data.bias, radius: 20000 } } } : {}) }, "places.id,places.displayName,places.formattedAddress,places.location,places.attributions");
    const parsed = z.object({ places: z.array(z.object({ id: z.string(), displayName: z.object({ text: z.string() }), formattedAddress: z.string(), location: coordinateSchema, attributions: z.array(z.object({ provider: z.string().optional(), providerUri: z.string().optional() })).default([]) })).default([]) }).parse(body);
    return parsed.places.map(place => ({ id: place.id, name: place.displayName.text, address: place.formattedAddress, ...place.location, attributions: place.attributions }));
  });

export const calculateSmartRoute = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: coordinateSchema, destination: coordinateSchema, mode: modeSchema, language: languageSchema, departureTime: z.string().datetime().optional() }).parse(input))
  .handler(async ({ data }) => {
    const appKey = process.env["LOVABLE_API_KEY"];
    const connectionKey = process.env["GOOGLE_MAPS_API_KEY"];
    if (!appKey || !connectionKey) throw new Error("Google Maps ainda não está configurado.");
    const { mapsRequest } = await import("./maps.server");
    const response = await mapsRequest(appKey, connectionKey, "/routes/directions/v2:computeRoutes", { origin: { location: { latLng: data.origin } }, destination: { location: { latLng: data.destination } }, travelMode: data.mode, languageCode: data.language, units: "METRIC", computeAlternativeRoutes: false, ...(data.mode === "DRIVE" ? { routingPreference: "TRAFFIC_AWARE" } : {}), ...(data.mode === "TRANSIT" && data.departureTime ? { departureTime: data.departureTime } : {}) }, "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.warnings,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters,routes.legs.steps.startLocation,routes.legs.steps.endLocation,routes.legs.steps.transitDetails");
    return parseJourney(response);
  });