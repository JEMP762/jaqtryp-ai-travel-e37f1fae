import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Navigation, MapPin, Footprints, Car, TrainFront, LocateFixed, Play, Pause, Square, Volume2, Bell, ArrowUp, ArrowDown, Trash2, Plus, Loader2, Check, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PlaceSearch } from "./PlaceSearch";
import { RouteMap } from "./RouteMap";
import { calculateSmartRoute } from "@/lib/smart-route/maps.functions";
import { smartItineraryOptions } from "@/lib/smart-route/queries";
import { distanceBetween, languageSchema, mapsJourneyUrl, splitItineraryDays, type Coordinate, type Journey, type Place, type TravelMode } from "@/lib/smart-route/model";
import { useRouteNavigation } from "@/lib/smart-route/use-navigation";
import { speak, stopSpeaking } from "@/lib/voice";
import { canRegisterPush, enablePushNotifications } from "@/lib/push-client";

const languages = [{ value: "pt-BR", label: "Português" }, { value: "en", label: "English" }, { value: "es", label: "Español" }, { value: "fr", label: "Français" }, { value: "de", label: "Deutsch" }, { value: "it", label: "Italiano" }, { value: "ja", label: "日本語" }, { value: "zh-CN", label: "中文" }];
const distanceLabel = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
function timeLabel(time: string) { const date = new Date(time); return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

export function SmartRoutePanel() {
  const { data: saved } = useSuspenseQuery(smartItineraryOptions);
  const calculate = useServerFn(calculateSmartRoute);
  const [tab, setTab] = useState("free");
  const [language, setLanguage] = useState<ReturnType<typeof languageSchema.parse>>("pt-BR");
  const [mode, setMode] = useState<TravelMode>("WALK");
  const [origin, setOrigin] = useState<Place | null>(null);
  const [useGps, setUseGps] = useState(false);
  const [destination, setDestination] = useState<Place | null>(null);
  const [stops, setStops] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [day, setDay] = useState("0");
  const [nextIndex, setNextIndex] = useState(0);
  const [candidate, setCandidate] = useState<Place | null>(null);
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audio, setAudio] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const request = useRef(0);
  const lastQuery = useRef<{ key: string; at: number; journey: Journey | null } | null>(null);
  const spoken = useRef(new Set<number>());
  const target = tab === "free" ? destination : stops[nextIndex] ?? null;
  const notifyArrival = useCallback(() => {
    toast.success("Você está próximo da parada selecionada.");
    if (notifications && "Notification" in window && Notification.permission === "granted") void navigator.serviceWorker.getRegistration().then(reg => reg?.showNotification("JAQTRYP SMART ROUTE", { body: target?.name ?? "Próxima parada", tag: "smart-route-arrival" })).catch(() => {});
    const finalStep = journey?.steps[journey.steps.length - 1];
    if (audio && finalStep?.instruction) void speak(finalStep.instruction, language);
  }, [audio, notifications, language, target, journey]);
  const gps = useRouteNavigation(target, notifyArrival);
  const from: Coordinate | null = useGps ? gps.position : origin;
  const itinerary = saved.find(row => row.id === selectedId);
  const days = useMemo(() => itinerary ? splitItineraryDays(itinerary.markdown) : [], [itinerary]);
  const mapStops = useMemo(() => tab === "free" ? destination ? [destination] : [] : stops, [tab, destination, stops]);
  const invalidate = useCallback(() => { request.current++; setJourney(null); setError(""); setBusy(false); setStepIndex(0); spoken.current.clear(); stopSpeaking(); }, []);
  useEffect(() => { invalidate(); }, [origin, destination, mode, language, tab, nextIndex, stops, useGps, invalidate]);
  useEffect(() => () => { stopSpeaking(); request.current++; }, []);
  useEffect(() => { if (gps.status !== "active") { stopSpeaking(); setSpeaking(false); } }, [gps.status]);
  useEffect(() => {
    if (!journey || !gps.position || gps.status !== "active" || (gps.accuracy ?? Infinity) > 50) return;
    const step = journey.steps[stepIndex];
    if (step?.end && distanceBetween(gps.position, step.end) < 30 && stepIndex < journey.steps.length - 1) setStepIndex(i => i + 1);
    if (audio && step?.instruction && !spoken.current.has(stepIndex)) { spoken.current.add(stepIndex); void speak(step.instruction, language); }
  }, [journey, gps.position, gps.status, gps.accuracy, stepIndex, audio, language]);
  async function route() {
    if (!from || !target || busy) return;
    const id = ++request.current, key = JSON.stringify([from, target.id, mode, language]);
    setBusy(true); setError("");
    try {
      const result = lastQuery.current?.key === key && Date.now() - lastQuery.current.at < 30000 ? lastQuery.current.journey : await calculate({ data: { origin: from, destination: target, mode, language } });
      if (id !== request.current) return;
      lastQuery.current = { key, at: Date.now(), journey: result }; setJourney(result); setStepIndex(0); spoken.current.clear();
      if (!result) setError(mode === "TRANSIT" ? "Nenhum trajeto de transporte público disponível para esta origem e destino." : "Nenhum trajeto encontrado para estes locais.");
    } catch (e) { if (id === request.current) { setJourney(null); setError(e instanceof Error ? e.message : "Não foi possível calcular o trajeto."); } }
    finally { if (id === request.current) setBusy(false); }
  }
  async function toggleNotifications(enabled: boolean) {
    if (!enabled) { setNotifications(false); return; }
    if (!canRegisterPush()) { toast.error("Notificações não estão disponíveis neste navegador ou nesta prévia."); return; }
    try { const result = await enablePushNotifications(); if (!result.ok) { toast.error("Não foi possível autorizar notificações."); return; } setNotifications(true); } catch { toast.error("Não foi possível ativar notificações."); }
  }
  async function readSteps() { if (!journey) return; setSpeaking(true); await speak(journey.steps.slice(stepIndex).map(s => s.instruction).join(". "), language); setSpeaking(false); }
  function stop() { gps.stop(); stopSpeaking(); setSpeaking(false); }
  function reorder(index: number, direction: number) { setStops(current => { const next = [...current], a = next[index], b = next[index + direction]; if (!a || !b) return current; next[index] = b; next[index + direction] = a; return next; }); setNextIndex(0); }

  return <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5"><div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"><Navigation className="h-6 w-6" /></div><div><h1 className="text-2xl font-bold sm:text-3xl">JAQTRYP SMART ROUTE</h1><p className="mt-1 text-sm text-muted-foreground">Seu trajeto, uma parada de cada vez.</p></div></div><div className="w-40"><Label className="mb-2 block text-xs text-muted-foreground">Idioma das instruções</Label><Select value={language} onValueChange={v => setLanguage(languageSchema.parse(v))}><SelectTrigger aria-label="Idioma das instruções"><SelectValue /></SelectTrigger><SelectContent>{languages.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent></Select></div></header>
    <Tabs value={tab} onValueChange={v => { stop(); setTab(v); setNextIndex(0); }}><TabsList className="grid w-full max-w-md grid-cols-2"><TabsTrigger value="free"><Navigation className="mr-2 h-4 w-4" />Buscar trajeto</TabsTrigger><TabsTrigger value="itinerary"><MapPin className="mr-2 h-4 w-4" />Atrações do roteiro</TabsTrigger></TabsList></Tabs>
    <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <section className="min-w-0 space-y-5" aria-label="Configurar trajeto">
        {tab === "itinerary" && <><div className="space-y-2"><Label>Roteiro salvo</Label><Select value={selectedId} onValueChange={v => { stop(); setSelectedId(v); setDay("0"); setStops([]); setNextIndex(0); }}><SelectTrigger aria-label="Roteiro salvo"><SelectValue placeholder="Escolher roteiro" /></SelectTrigger><SelectContent>{saved.map(r => <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>)}</SelectContent></Select>{!saved.length && <p className="text-sm text-muted-foreground">Você ainda não tem roteiros salvos.</p>}</div>{!!days.length && <div className="space-y-2"><Label>Dia da viagem</Label><Select value={day} onValueChange={v => { stop(); setDay(v); setStops([]); setNextIndex(0); }}><SelectTrigger aria-label="Dia da viagem"><SelectValue /></SelectTrigger><SelectContent>{days.map((d, i) => <SelectItem key={i} value={String(i)}>{d.label}</SelectItem>)}</SelectContent></Select><details className="rounded-lg border border-border p-3"><summary className="cursor-pointer text-sm font-medium">Consultar roteiro original</summary><div className="mt-3 max-h-64 overflow-y-auto break-words text-sm leading-relaxed"><ReactMarkdown>{days[Number(day)]?.text ?? ""}</ReactMarkdown></div></details></div>}</>}
        <div className="flex items-center justify-between gap-3"><Label htmlFor="smart-gps">Usar minha localização</Label><Switch id="smart-gps" checked={useGps} onCheckedChange={v => { setUseGps(v); if (v) gps.start(); else gps.stop(); }} /></div>
        {!useGps ? <PlaceSearch label="Origem" value={origin} onSelect={setOrigin} language={language} /> : <div className="flex items-center gap-2 text-sm text-muted-foreground"><LocateFixed className="h-4 w-4" />{gps.status === "locating" ? "Buscando localização…" : gps.position ? `GPS · precisão de ${Math.round(gps.accuracy ?? 0)} m` : "Localização não disponível"}<Button size="icon" variant="ghost" aria-label="Atualizar localização" onClick={gps.start}><LocateFixed className="h-4 w-4" /></Button></div>}
        {gps.error && <p role="alert" className="text-sm text-destructive">{gps.error}</p>}
        {tab === "free" ? <PlaceSearch label="Destino" value={destination} onSelect={setDestination} language={language} bias={from ?? undefined} /> : <><PlaceSearch key={`${selectedId}-${day}-${stops.length}`} label="Adicionar atração" value={candidate} onSelect={setCandidate} language={language} bias={from ?? undefined} initialQuery={itinerary?.destination ?? ""} /><Button variant="outline" className="w-full" disabled={!candidate || stops.length >= 10} onClick={() => { if (!candidate) return; if (stops.some(s => s.id === candidate.id)) { toast.error("Esta parada já está na lista."); return; } setStops(s => [...s, candidate]); setCandidate(null); }}><Plus className="mr-2 h-4 w-4" />Adicionar parada ({stops.length}/10)</Button>
          <ol className="divide-y divide-border">{stops.map((s, i) => <li key={s.id} className="flex items-start gap-2 py-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{i < nextIndex ? <Check className="h-3 w-3" /> : i + 1}</span><div className="min-w-0 flex-1"><p className="break-words text-sm font-medium">{s.name}</p><p className="break-words text-xs text-muted-foreground">{s.address}</p></div><div className="flex shrink-0"><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Subir parada ${i + 1}`} disabled={!i} onClick={() => reorder(i, -1)}><ArrowUp className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Descer parada ${i + 1}`} disabled={i === stops.length - 1} onClick={() => reorder(i, 1)}><ArrowDown className="h-3 w-3" /></Button><Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remover parada ${i + 1}`} onClick={() => { setStops(current => current.filter((_, idx) => i !== idx)); setNextIndex(0); }}><Trash2 className="h-3 w-3" /></Button></div></li>)}</ol></>}
        <div className="space-y-2"><Label>Como você vai?</Label><div className="grid grid-cols-3 gap-2">{([{ value: "WALK", icon: Footprints, label: "A pé" }, { value: "DRIVE", icon: Car, label: "Carro" }, { value: "TRANSIT", icon: TrainFront, label: "Ônibus / metrô" }] as const).map(m => <Button key={m.value} variant={mode === m.value ? "default" : "outline"} aria-pressed={mode === m.value} className="h-auto min-h-16 flex-col gap-2 whitespace-normal px-1 text-xs" onClick={() => setMode(m.value)}><m.icon className="h-5 w-5" />{m.label}</Button>)}</div></div>
        <Button className="w-full" disabled={!from || !target || busy} onClick={() => void route()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Navigation className="mr-2 h-4 w-4" />}{journey ? "Recalcular trajeto" : "Calcular trajeto"}</Button>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      </section>
      <div className="min-w-0 space-y-4"><RouteMap stops={mapStops} position={gps.position} origin={from} polyline={journey?.polyline} />
        {journey && target && <section className="space-y-4 border-t border-border pt-4" aria-label="Instruções do trajeto"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="break-words text-lg font-semibold">{target.name}</h2><p className="text-sm text-muted-foreground">{distanceLabel(journey.distance)} · {Math.max(1, Math.ceil(journey.seconds / 60))} min{gps.position ? ` · ${distanceLabel(distanceBetween(gps.position, target))} em linha reta` : ""}</p><p className="text-xs text-muted-foreground">Google Maps</p></div><Button variant="outline" asChild><a href={mapsJourneyUrl(from, target, mode)}><ExternalLink className="mr-2 h-4 w-4" />Continuar no Google Maps</a></Button></div>
          <div className="flex flex-wrap gap-2"><Button size="sm" disabled={!useGps} onClick={gps.start}><Play className="mr-2 h-4 w-4" />{gps.status === "paused" ? "Retomar GPS" : "Iniciar GPS"}</Button><Button variant="outline" size="sm" disabled={gps.status !== "active" && gps.status !== "locating"} onClick={gps.pause}><Pause className="mr-2 h-4 w-4" />Pausar</Button><Button variant="outline" size="sm" onClick={stop}><Square className="mr-2 h-4 w-4" />Encerrar</Button><Button variant="outline" size="sm" disabled={!journey.steps.length} onClick={() => { if (speaking) { stopSpeaking(); setSpeaking(false); } else void readSteps(); }}><Volume2 className="mr-2 h-4 w-4" />{speaking ? "Parar áudio" : "Ouvir instruções"}</Button></div>
          <div className="flex flex-wrap items-center gap-5"><div className="flex items-center gap-2"><Volume2 className="h-4 w-4 text-muted-foreground" /><Label htmlFor="smart-audio">Avisos em áudio</Label><Switch id="smart-audio" checked={audio} onCheckedChange={v => { setAudio(v); if (!v) stopSpeaking(); }} /></div><div className="flex items-center gap-2"><Bell className="h-4 w-4 text-muted-foreground" /><Label htmlFor="smart-notify">Notificar chegada</Label><Switch id="smart-notify" checked={notifications} onCheckedChange={v => void toggleNotifications(v)} /></div></div>
          {!!journey.warnings.length && <div role="status" className="text-sm text-muted-foreground">{journey.warnings.map((w, i) => <p key={i}>{w}</p>)}</div>}
          <ol className="divide-y divide-border">{journey.steps.map((s, i) => <li key={i} className={`flex gap-3 py-3 ${i === stepIndex ? "text-primary" : "text-foreground"}`}><span className="mt-0.5 text-xs text-muted-foreground">{i + 1}</span><div className="min-w-0"><p className="break-words text-sm">{s.instruction || (s.transit ? "Trecho de transporte público" : "Continue pelo trajeto indicado")}</p>{s.transit && <div className="mt-1 space-y-1 text-xs text-muted-foreground"><p>{s.transit.line} {s.transit.headsign}</p><p>{s.transit.departure} {timeLabel(s.transit.departureTime)} → {s.transit.arrival} {timeLabel(s.transit.arrivalTime)}</p>{s.transit.stops !== null && <p>{s.transit.stops} paradas</p>}</div>}<p className="mt-1 text-xs text-muted-foreground">{distanceLabel(s.distance)}</p></div></li>)}</ol>
          {tab === "itinerary" && <Button variant="outline" onClick={() => { if (nextIndex < stops.length - 1) setNextIndex(i => i + 1); else { stop(); setJourney(null); toast.success("Sequência de visitas concluída."); } }}><Check className="mr-2 h-4 w-4" />{nextIndex < stops.length - 1 ? "Concluir parada e seguir para a próxima" : "Concluir visitas"}</Button>}
        </section>}
        <p className="text-xs leading-relaxed text-muted-foreground">O GPS acompanha enquanto esta página está ativa. Ao bloquear a tela, continue no aplicativo de mapas. Horários e disponibilidade do transporte dependem da cidade.</p>
        <p className="text-xs text-muted-foreground">Google Maps · <a className="underline" href="https://maps.google.com/help/terms_maps/" target="_blank" rel="noopener noreferrer">Termos</a> · <a className="underline" href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacidade</a></p>
      </div>
    </div>
  </div>;
}