import { z } from "zod";

export const coordinateSchema = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
export const languageSchema = z.enum(["pt-BR", "en", "es", "fr", "de", "it", "ja", "zh-CN"]);
export const modeSchema = z.enum(["WALK", "DRIVE", "TRANSIT"]);
export type Coordinate = z.infer<typeof coordinateSchema>;
export type Place = Coordinate & { id: string; name: string; address: string };
export type TravelMode = z.infer<typeof modeSchema>;
export type RouteStep = { instruction: string; start: Coordinate | null; end: Coordinate | null; distance: number; transit: { line: string; headsign: string; departure: string; arrival: string; departureTime: string; arrivalTime: string; stops: number | null } | null };
export type Journey = { distance: number; seconds: number; polyline: string; steps: RouteStep[]; warnings: string[] };

export function distanceBetween(a: Coordinate, b: Coordinate) {
  const rad = Math.PI / 180;
  const q = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(q), Math.sqrt(Math.max(0, 1 - q)));
}

export function withinArrival(position: Coordinate, target: Coordinate, accuracy: number) {
  return Number.isFinite(accuracy) && accuracy <= 50 && distanceBetween(position, target) <= 40;
}

export function splitItineraryDays(markdown: string) {
  const sections: { label: string; text: string }[] = [];
  for (const line of markdown.split("\n")) {
    if (/^\s*(?:#{1,6}\s*|\*\*)?(?:dia|day|jour|día)\s+\d+\b/i.test(line)) sections.push({ label: line.replace(/[#*]/g, "").trim(), text: "" });
    const section = sections[sections.length - 1];
    if (section) section.text += `${line}\n`;
  }
  return sections.length ? sections : [{ label: "Roteiro completo", text: markdown }];
}

export function mapsJourneyUrl(origin: Coordinate | null, destination: Place, mode: TravelMode) {
  const p = new URLSearchParams({ api: "1", destination: `${destination.latitude},${destination.longitude}`, destination_place_id: destination.id, travelmode: mode === "DRIVE" ? "driving" : mode === "TRANSIT" ? "transit" : "walking" });
  if (origin) p.set("origin", `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${p}`;
}

const rawStep = z.object({
  navigationInstruction: z.object({ instructions: z.string().optional() }).optional(),
  startLocation: z.object({ latLng: coordinateSchema }).optional(), endLocation: z.object({ latLng: coordinateSchema }).optional(), distanceMeters: z.number().nonnegative().default(0),
  transitDetails: z.object({ headsign: z.string().optional(), stopCount: z.number().int().nonnegative().optional(),
    transitLine: z.object({ name: z.string().optional(), nameShort: z.string().optional() }).optional(),
    stopDetails: z.object({ departureStop: z.object({ name: z.string().optional() }).optional(), arrivalStop: z.object({ name: z.string().optional() }).optional(), departureTime: z.string().optional(), arrivalTime: z.string().optional() }).optional(),
  }).optional(),
});
export function parseJourney(input: unknown): Journey | null {
  const parsed = z.object({ routes: z.array(z.object({ distanceMeters: z.number().nonnegative().default(0), duration: z.string().regex(/^\d+(?:\.\d+)?s$/), polyline: z.object({ encodedPolyline: z.string().min(1) }), legs: z.array(z.object({ steps: z.array(rawStep).default([]) })).default([]), warnings: z.array(z.string()).default([]) })).default([]) }).parse(input);
  const route = parsed.routes[0];
  if (!route) return null;
  return { distance: route.distanceMeters, seconds: Number(route.duration.slice(0, -1)), polyline: route.polyline.encodedPolyline, warnings: route.warnings,
    steps: route.legs.flatMap(leg => leg.steps).map(step => ({ instruction: step.navigationInstruction?.instructions ?? "", start: step.startLocation?.latLng ?? null, end: step.endLocation?.latLng ?? null, distance: step.distanceMeters,
      transit: step.transitDetails ? { line: step.transitDetails.transitLine?.nameShort ?? step.transitDetails.transitLine?.name ?? "", headsign: step.transitDetails.headsign ?? "", departure: step.transitDetails.stopDetails?.departureStop?.name ?? "", arrival: step.transitDetails.stopDetails?.arrivalStop?.name ?? "", departureTime: step.transitDetails.stopDetails?.departureTime ?? "", arrivalTime: step.transitDetails.stopDetails?.arrivalTime ?? "", stops: step.transitDetails.stopCount ?? null } : null,
    })),
  };
}