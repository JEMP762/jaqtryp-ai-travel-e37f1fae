import { useEffect, useRef, useState } from "react";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { coordinateSchema, type Coordinate, type Place } from "@/lib/smart-route/model";

// Scoped Maps JS surface avoids coupling unrelated pages to Google types.
type LatLng = { lat: number; lng: number };
type MapInstance = { fitBounds: (bounds: unknown) => void; panTo: (p: LatLng) => void };
type Overlay = { setMap: (map: MapInstance | null) => void };
type MapsApi = { Map: new (el: HTMLElement, options: object) => MapInstance; Marker: new (options: object) => Overlay; Polyline: new (options: object) => Overlay; LatLngBounds: new () => { extend: (p: LatLng) => void }; };
declare global { interface Window { google?: { maps: MapsApi }; initJaqSmartRouteMap?: () => void; } }
let mapsPromise: Promise<MapsApi> | null = null;
function loadMap(): Promise<MapsApi> {
  if (window.google?.maps.Map) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"];
    if (!key) { reject(new Error("Google Maps ainda não está configurado.")); return; }
    const timer = window.setTimeout(() => reject(new Error("O mapa não respondeu. Verifique a conexão e a autorização do site.")), 20000);
    window.initJaqSmartRouteMap = () => { window.clearTimeout(timer); if (window.google?.maps.Map) resolve(window.google.maps); else reject(new Error("Mapa indisponível.")); };
    const script = document.createElement("script");
    const p = new URLSearchParams({ key, loading: "async", callback: "initJaqSmartRouteMap", channel: import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] ?? "", language: "pt-BR", region: "BR" });
    script.src = `https://maps.googleapis.com/maps/api/js?${p}`; script.async = true;
    script.onerror = () => { window.clearTimeout(timer); reject(new Error("Não foi possível carregar o mapa.")); }; document.head.appendChild(script);
  });
  return mapsPromise;
}
function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = []; let index = 0, lat = 0, lng = 0;
  while (index < encoded.length) {
    const next = () => { let result = 0, shift = 0, b = 0; do { if (index >= encoded.length || shift > 30) throw new Error("Caminho inválido."); b = encoded.charCodeAt(index++) - 63; result |= (b & 31) << shift; shift += 5; } while (b >= 32); return result & 1 ? ~(result >> 1) : result >> 1; };
    lat += next(); lng += next(); coordinateSchema.parse({ latitude: lat / 1e5, longitude: lng / 1e5 }); points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  } return points;
}
export function RouteMap({ stops, position, origin, polyline }: { stops: Place[]; position: Coordinate | null; origin: Coordinate | null; polyline?: string }) {
  const element = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const api = useRef<MapsApi | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  async function activate() {
    const host = window.location.hostname;
    if (!(host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) || host.includes("-devserver-")) { setError("Este endereço ainda não está autorizado para o mapa. A autorização de jaqtryp.com precisa ser configurada pelo JAQTRYP."); setState("error"); return; }
    setState("loading");
    try { const maps = await loadMap(); if (!element.current) return; api.current = maps; map.current = new maps.Map(element.current, { center: { lat: origin?.latitude ?? -15.78, lng: origin?.longitude ?? -47.93 }, zoom: origin ? 13 : 3, clickableIcons: false, mapTypeControl: false, streetViewControl: false, fullscreenControl: true }); setState("ready"); }
    catch (e) { setError(e instanceof Error ? e.message : "Mapa indisponível."); setState("error"); }
  }
  useEffect(() => {
    const maps = api.current, instance = map.current;
    if (!maps || !instance || state !== "ready") return;
    const overlays: Overlay[] = [], bounds = new maps.LatLngBounds(); let count = 0;
    const add = (p: Coordinate, title: string, label?: string) => { const location = { lat: p.latitude, lng: p.longitude }; overlays.push(new maps.Marker({ position: location, map: instance, title, ...(label ? { label } : {}) })); bounds.extend(location); count++; };
    if (origin) add(origin, "Origem");
    stops.forEach((stop, i) => add(stop, stop.name, String(i + 1)));
    if (polyline) { try { const path = decodePolyline(polyline); path.forEach(p => bounds.extend(p)); count += path.length; overlays.push(new maps.Polyline({ path, map: instance, strokeWeight: 5, strokeColor: getComputedStyle(document.documentElement).getPropertyValue("--primary").trim() })); } catch { setError("Não foi possível exibir o caminho recebido."); } }
    if (count > 1) instance.fitBounds(bounds); else if (origin) instance.panTo({ lat: origin.latitude, lng: origin.longitude });
    return () => overlays.forEach(o => o.setMap(null));
  }, [stops, origin, polyline, state]);
  useEffect(() => { if (!position || state !== "ready" || !map.current || !api.current) return; const marker = new api.current.Marker({ position: { lat: position.latitude, lng: position.longitude }, map: map.current, title: "Minha localização", label: "●" }); return () => marker.setMap(null); }, [position, state]);
  return <section aria-label="Mapa do trajeto" className="relative min-h-[340px] overflow-hidden rounded-lg border border-border bg-muted/30 lg:min-h-[520px]">
    <div ref={element} className="h-[340px] w-full lg:h-[520px]" />
    {state !== "ready" && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/95 p-6 text-center">{state === "error" ? <AlertTriangle className="h-10 w-10 text-destructive" /> : <MapPin className="h-12 w-12 text-primary" />}<h2 className="text-lg font-semibold">Mapa do trajeto</h2>{error ? <p role="alert" className="max-w-md text-sm text-muted-foreground">{error}</p> : <Button disabled={state === "loading"} onClick={() => void activate()}>{state === "loading" ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando mapa</> : "Abrir mapa"}</Button>}</div>}
    {state === "ready" && error && <p role="alert" className="absolute left-3 right-3 top-3 rounded-lg bg-background p-3 text-sm text-destructive">{error}</p>}
  </section>;
}