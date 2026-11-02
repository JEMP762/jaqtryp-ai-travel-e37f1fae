import { useCallback, useEffect, useRef, useState } from "react";
import { withinArrival, type Coordinate } from "./model";

export function useRouteNavigation(target: Coordinate | null, onArrival: () => void) {
  const [position, setPosition] = useState<Coordinate | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "active" | "paused">("idle");
  const [error, setError] = useState("");
  const watch = useRef<number | null>(null);
  const targetRef = useRef(target); targetRef.current = target;
  const arrivalRef = useRef(onArrival); arrivalRef.current = onArrival;
  const alerted = useRef(false);
  useEffect(() => { alerted.current = false; }, [target?.latitude, target?.longitude]);
  const clear = useCallback(() => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); watch.current = null; }, []);
  const start = useCallback(() => {
    clear(); setError("");
    if (!navigator.geolocation) { setError("GPS indisponível neste navegador."); return; }
    setStatus("locating");
    watch.current = navigator.geolocation.watchPosition(p => {
      const next = { latitude: p.coords.latitude, longitude: p.coords.longitude };
      setPosition(next); setAccuracy(p.coords.accuracy); setStatus("active"); setError("");
      if (targetRef.current && !alerted.current && withinArrival(next, targetRef.current, p.coords.accuracy)) { alerted.current = true; arrivalRef.current(); }
    }, e => { clear(); setStatus("paused"); setError(e.code === 1 ? "Localização bloqueada. Você pode escolher a origem manualmente." : e.code === 3 ? "O GPS demorou para responder. Tente novamente." : "Não foi possível obter sua localização."); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
  }, [clear]);
  const pause = useCallback(() => { clear(); setStatus("paused"); }, [clear]);
  const stop = useCallback(() => { clear(); setStatus("idle"); setPosition(null); setAccuracy(null); setError(""); alerted.current = false; }, [clear]);
  useEffect(() => { const hidden = () => { if (document.hidden && watch.current !== null) pause(); }; document.addEventListener("visibilitychange", hidden); return () => { clear(); document.removeEventListener("visibilitychange", hidden); }; }, [clear, pause]);
  return { position, accuracy, status, error, start, pause, stop };
}