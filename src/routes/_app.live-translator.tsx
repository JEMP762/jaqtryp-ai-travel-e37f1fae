import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import {
  Mic,
  MicOff,
  Volume2,
  Camera,
  ArrowLeftRight,
  Star,
  Trash2,
  Loader2,
  Languages,
  Users,
  Megaphone,
  Ship,
  Bluetooth,
  Glasses,
  Sparkles,
  Send,
  Headphones,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { authedJsonHeaders } from "@/lib/authed-fetch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { BluetoothTranslatorButton } from "@/components/BluetoothTranslatorSession";

export const Route = createFileRoute("/_app/live-translator")({
  component: LiveTranslatorPage,
});

const LANGS = [
  { code: "pt-BR", label: "Português (BR)", short: "pt" },
  { code: "en-US", label: "English (US)", short: "en" },
  { code: "es-ES", label: "Español", short: "es" },
  { code: "fr-FR", label: "Français", short: "fr" },
  { code: "it-IT", label: "Italiano", short: "it" },
  { code: "de-DE", label: "Deutsch", short: "de" },
  { code: "ja-JP", label: "日本語", short: "ja" },
  { code: "zh-CN", label: "中文 (简体)", short: "zh" },
  { code: "ko-KR", label: "한국어", short: "ko" },
  { code: "ar-SA", label: "العربية", short: "ar" },
  { code: "ru-RU", label: "Русский", short: "ru" },
  { code: "nl-NL", label: "Nederlands", short: "nl" },
  { code: "tr-TR", label: "Türkçe", short: "tr" },
  { code: "hi-IN", label: "हिन्दी", short: "hi" },
];

type HistoryItem = {
  id: string;
  source: string;
  translated: string;
  from: string;
  to: string;
  ts: number;
  favorite?: boolean;
};

type Mode = "conversation" | "guide" | "cruise";

const HISTORY_KEY = "jaq-live-translator-history-v1";
const CACHE_KEY = "jaq-live-translator-cache-v1";

type TranslationCache = Record<string, string>;
const cacheKey = (f: string, t: string, text: string) =>
  `${f}|${t}|${text.trim().toLowerCase()}`;

function loadCache(): TranslationCache {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}
function getCached(f: string, t: string, text: string): string | null {
  return loadCache()[cacheKey(f, t, text)] ?? null;
}
function setCached(f: string, t: string, text: string, translated: string) {
  if (typeof window === "undefined") return;
  try {
    const c = loadCache();
    c[cacheKey(f, t, text)] = translated;
    const entries = Object.entries(c).slice(-500);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* quota */
  }
}
function isOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 200)));
}

function langLabel(code: string) {
  return LANGS.find((l) => l.code === code)?.label ?? code;
}

async function translateText(
  text: string,
  fromCode: string,
  toCode: string,
): Promise<string> {
  const cached = getCached(fromCode, toCode, text);
  if (cached) return cached;
  if (!isOnline()) {
    throw new Error(
      "Offline: tradução não disponível para este texto. Conecte-se à internet.",
    );
  }
  const from = langLabel(fromCode);
  const to = langLabel(toCode);
  const system = `You are a professional simultaneous interpreter. Translate the user's text from ${from} to ${to}. Output ONLY the translation, with no quotes, no explanations, no transliteration. Preserve names, numbers and punctuation. Use natural, conversational tone suitable for spoken delivery.`;
  const resp = await fetch("/api/ai", {
    method: "POST",
    headers: await authedJsonHeaders(),
    body: JSON.stringify({ system, prompt: text, featureKey: "translate_voice" }),
  });
  const data = await resp.json();
  if (resp.status === 402) throw new Error(data.error || "Créditos insuficientes.");
  if (!resp.ok) throw new Error(data.error || "Erro de tradução");
  const out = (data.text as string).trim();
  setCached(fromCode, toCode, text, out);
  return out;
}

async function ocrAndTranslate(
  dataUrl: string,
  toCode: string,
): Promise<{ original: string; translated: string }> {
  const to = langLabel(toCode);
  const system = `You read text from images (signs, menus, documents, billboards). Return a JSON object with two fields: "original" (the text exactly as it appears, preserving line breaks) and "translated" (the same text translated to ${to}, natural and idiomatic). Output ONLY valid JSON, no markdown fences.`;
  const resp = await fetch("/api/ai", {
    method: "POST",
    headers: await authedJsonHeaders(),
    body: JSON.stringify({
      system,
      prompt: "Extract and translate all visible text.",
      image: dataUrl,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Erro OCR");
  const raw = (data.text as string).trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(raw);
    return {
      original: String(parsed.original || ""),
      translated: String(parsed.translated || ""),
    };
  } catch {
    return { original: "", translated: raw };
  }
}

// Cache loaded voices once
let _voicesLoaded = false;
function ensureVoicesLoaded(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      _voicesLoaded = true;
      resolve(existing);
      return;
    }
    const handler = () => {
      _voicesLoaded = true;
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", handler);
    // Safety timeout
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices());
    }, 1500);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const exact = voices.find((v) => v.lang?.toLowerCase() === lang.toLowerCase());
  if (exact) return exact;
  const short = lang.split("-")[0].toLowerCase();
  const partial = voices.find((v) => v.lang?.toLowerCase().startsWith(short));
  return partial || null;
}

function audioTestPhrase(lang: string, slot?: string) {
  const suffix = slot ? ` ${slot}` : "";
  if (lang.startsWith("en")) return `Bluetooth audio test${suffix}.`;
  if (lang.startsWith("es")) return `Prueba de audio Bluetooth${suffix}.`;
  if (lang.startsWith("fr")) return `Test audio Bluetooth${suffix}.`;
  if (lang.startsWith("it")) return `Test audio Bluetooth${suffix}.`;
  if (lang.startsWith("de")) return `Bluetooth Audiotest${suffix}.`;
  return `Teste de áudio Bluetooth${suffix}.`;
}

// Chrome bug workaround: speechSynthesis pauses itself after ~15s of inactivity
// or stops mid-utterance. Keep it alive by resuming periodically while speaking.
let _keepAliveTimer: number | null = null;
function startKeepAlive() {
  if (typeof window === "undefined") return;
  if (_keepAliveTimer !== null) return;
  _keepAliveTimer = window.setInterval(() => {
    const s = window.speechSynthesis;
    if (s.speaking && !s.paused) {
      // Touch resume to prevent Chrome from silently pausing the queue
      s.pause();
      s.resume();
    }
  }, 8000);
}
function stopKeepAlive() {
  if (_keepAliveTimer !== null) {
    clearInterval(_keepAliveTimer);
    _keepAliveTimer = null;
  }
}

// Detect mobile — on Android/iOS the native speechSynthesis often routes audio
// through the system/notification stream which Bluetooth headsets ignore.
// We force the MP3 path (<audio> via /api/tts), which goes through the media
// stream — the same path YouTube uses — so it routes to the BT headset.
function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Audio unlock: Chrome/Android requires a user gesture before audio plays.
let _audioUnlocked = false;
let _fallbackAudio: HTMLAudioElement | null = null;

// 1-frame silent MP3 used to unlock the <audio> element inside a user gesture.
const SILENT_MP3 =
  "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//FJAhDQHIIAIBAEAAA//8AAAA=";

function unlockAudio() {
  if (_audioUnlocked) return;
  if (typeof window === "undefined") return;
  try {
    // Unlock <audio> element (the path used on mobile for Bluetooth routing).
    if (!_fallbackAudio) {
      _fallbackAudio = new Audio();
      _fallbackAudio.preload = "auto";
    }
    _fallbackAudio.src = SILENT_MP3;
    const p = _fallbackAudio.play();
    if (p && typeof p.then === "function") p.catch(() => {});
    // Unlock speechSynthesis too (used on desktop).
    if ("speechSynthesis" in window) {
      const synth = window.speechSynthesis;
      if (synth.paused) synth.resume();
    }
    _audioUnlocked = true;
  } catch {
    /* ignore */
  }
}

async function playAudioFallback(text: string, lang: string) {
  if (typeof window === "undefined") return;
  const clean = text.trim().slice(0, 180);
  if (!clean) return;
  let objectUrl: string | null = null;
  try {
    const url = `/api/public/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(clean)}`;
    const resp = await fetch(url, { credentials: "same-origin" });
    if (!resp.ok) {
      throw new Error(`TTS ${resp.status}`);
    }
    const blob = await resp.blob();
    if (!blob.size) {
      throw new Error("TTS empty audio");
    }
    objectUrl = URL.createObjectURL(blob);
    // Reuse a single Audio element — Android Chrome throttles new Audio() spam.
    if (!_fallbackAudio) {
      _fallbackAudio = new Audio();
      _fallbackAudio.preload = "auto";
      _fallbackAudio.setAttribute("playsinline", "true");
    }
    const audio = _fallbackAudio;
    try {
      audio.pause();
    } catch {
      /* ignore */
    }
    audio.src = objectUrl;
    audio.onerror = () => {
      const code = audio.error?.code;
      console.warn("audio element error code:", code);
      toast.error(
        "Não foi possível tocar o áudio. Verifique se o fone Bluetooth está conectado ao celular e que o volume de mídia está alto.",
      );
    };
    await audio.play();
  } catch (err) {
    console.warn("audio fallback failed:", err);
    toast.error(
      "Áudio bloqueado pelo navegador. Toque em Testar áudio novamente e confirme volume/saída Bluetooth do celular.",
    );
  } finally {
    if (objectUrl) {
      const urlToRevoke = objectUrl;
      window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 5000);
    }
  }
}


type SpeakOptions = {
  useVoice?: boolean;
  _retry?: boolean;
};

function prepareUtterance(text: string, lang: string, options: SpeakOptions = {}) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null as SpeechSynthesisUtterance | null;
  }
  const clean = (text || "").trim();
  const u = new SpeechSynthesisUtterance(clean || ".");
  u.lang = lang;
  u.rate = 1;
  u.volume = 1;
  u.pitch = 1;
  if (options.useVoice && _voicesLoaded) {
    const v = pickVoice(window.speechSynthesis.getVoices(), lang);
    if (v) u.voice = v;
  }
  return u;
}

function speak(
  text: string,
  lang: string,
  _prepared?: SpeechSynthesisUtterance | null,
  _options: SpeakOptions = {},
) {
  const clean = (text || "").trim();
  if (!clean) return;
  // ALWAYS use the MP3 path (/api/tts) via <audio>. The native
  // speechSynthesis API routes through the system/notification stream on
  // many devices, which Bluetooth headsets ignore. <audio> uses the media
  // stream — the same path YouTube uses — so it works on every device and
  // routes correctly to Bluetooth.
  void playAudioFallback(clean, lang);
}


// High-accuracy STT via ElevenLabs Scribe.
// We record the user's voice with MediaRecorder and POST it to /api/public/stt,
// which calls ElevenLabs scribe_v2 server-side and returns the transcript.
// This is far more precise than the browser's native SpeechRecognition.
// VAD tuning. Adjust SILENCE_MS or RMS_THRESHOLD if mic gain varies.
const VAD_SILENCE_MS = 1200;
const VAD_MIN_SPEECH_MS = 350;
const VAD_RMS_THRESHOLD = 0.015;
const VAD_MAX_RECORDING_MS = 20000;

function useSpeechRecognition(lang: string, onFinal: (text: string) => void) {
  const [listening, setListening] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const recRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const cancelledRef = React.useRef(false);
  const mimeRef = React.useRef("");
  // VAD state
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const sourceRef = React.useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const maxTimeoutRef = React.useRef<number | null>(null);
  const speechStartedAtRef = React.useRef<number | null>(null);
  const lastVoiceAtRef = React.useRef<number>(0);
  const stoppingRef = React.useRef(false);
  const supported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined";

  const teardownVad = React.useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (maxTimeoutRef.current !== null) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
    try {
      sourceRef.current?.disconnect();
    } catch {
      /* noop */
    }
    try {
      analyserRef.current?.disconnect();
    } catch {
      /* noop */
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close().catch(() => {});
    }
    sourceRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current = null;
    speechStartedAtRef.current = null;
    lastVoiceAtRef.current = 0;
  }, []);

  const stopTracks = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const autoStop = React.useCallback((reason: "vad" | "timeout") => {
    if (stoppingRef.current) return;
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return;
    stoppingRef.current = true;
    try {
      setInterim(reason === "timeout" ? "Tempo máximo atingido…" : "Processando…");
      rec.requestData();
      rec.stop();
    } catch {
      /* noop */
    }
  }, []);

  const setupVad = React.useCallback(
    (stream: MediaStream) => {
      try {
        const Ctor: typeof AudioContext =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        sourceRef.current = source;
        analyserRef.current = analyser;
        const buf = new Float32Array(analyser.fftSize);

        const startedAt = performance.now();
        lastVoiceAtRef.current = startedAt;
        speechStartedAtRef.current = null;

        maxTimeoutRef.current = window.setTimeout(() => {
          autoStop("timeout");
        }, VAD_MAX_RECORDING_MS);

        const tick = () => {
          const a = analyserRef.current;
          if (!a) return;
          a.getFloatTimeDomainData(buf);
          // RMS
          let sum = 0;
          for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
          const rms = Math.sqrt(sum / buf.length);
          const now = performance.now();
          if (rms > VAD_RMS_THRESHOLD) {
            lastVoiceAtRef.current = now;
            if (speechStartedAtRef.current === null) {
              speechStartedAtRef.current = now;
              setInterim("Gravando… solte que paro sozinho");
            }
          } else if (
            speechStartedAtRef.current !== null &&
            now - speechStartedAtRef.current > VAD_MIN_SPEECH_MS &&
            now - lastVoiceAtRef.current > VAD_SILENCE_MS
          ) {
            autoStop("vad");
            return;
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // VAD opcional — sem ele, o usuário ainda pode tocar para parar.
      }
    },
    [autoStop],
  );

  const start = React.useCallback(async () => {
    if (!supported) {
      toast.error("Gravação de voz não suportada neste navegador.");
      return;
    }
    if (recRef.current && recRef.current.state !== "inactive") return;
    try {
      cancelledRef.current = false;
      stoppingRef.current = false;
      chunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];
      let mime = "";
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
          mime = c;
          break;
        }
      }
      mimeRef.current = mime;

      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recRef.current = rec;

      rec.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      rec.onerror = () => {
        toast.error("Falha ao gravar áudio do microfone.");
        cancelledRef.current = true;
        teardownVad();
        stopTracks();
        setListening(false);
        setInterim("");
      };

      rec.onstop = async () => {
        setListening(false);
        teardownVad();
        const hadSpeech = speechStartedAtRef.current !== null;
        setInterim(hadSpeech ? "Preparando áudio completo…" : "");
        stopTracks();
        recRef.current = null;

        if (cancelledRef.current) {
          chunksRef.current = [];
          setInterim("");
          return;
        }

        const blobType = mimeRef.current || rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];

        if (blob.size < 1200) {
          setInterim("");
          return;
        }

        try {
          setInterim("Transcrevendo…");
          const fd = new FormData();
          const ext = blobType.includes("mp4") ? "m4a" : blobType.includes("ogg") ? "ogg" : "webm";
          fd.append("audio", blob, `audio.${ext}`);
          fd.append("lang", lang);
          const resp = await fetch("/api/public/stt", { method: "POST", body: fd });
          setInterim("");
          if (!resp.ok) {
            const err = await resp.text();
            toast.error(`Transcrição falhou: ${err.slice(0, 120)}`);
            return;
          }
          const data = (await resp.json()) as { text?: string };
          const text = (data.text || "").trim();
          if (text) onFinal(text);
        } catch (err) {
          setInterim("");
          toast.error(`Erro de rede na transcrição: ${(err as Error).message}`);
        }
      };

      rec.start();
      setListening(true);
      setInterim("Ouvindo… pode falar");
      setupVad(stream);
    } catch (err) {
      const error = err as DOMException;
      const msg =
        error.name === "NotAllowedError"
          ? "Permissão negada. Libere o microfone no navegador."
          : error.name === "NotFoundError"
            ? "Nenhum microfone encontrado."
            : error.name === "NotReadableError"
              ? "Microfone em uso por outro app."
              : error.message || "Permissão de microfone negada";
      toast.error(`Microfone: ${msg}`);
      teardownVad();
      stopTracks();
      recRef.current = null;
      setListening(false);
      setInterim("");
    }
  }, [lang, onFinal, supported, stopTracks, setupVad, teardownVad]);

  const stop = React.useCallback(() => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        setInterim("Finalizando gravação…");
        rec.requestData();
        rec.stop();
      } catch {
        /* noop */
      }
    } else {
      setListening(false);
      setInterim("");
      teardownVad();
      stopTracks();
    }
  }, [stopTracks, teardownVad]);

  React.useEffect(
    () => () => {
      cancelledRef.current = true;
      const rec = recRef.current;
      if (rec && rec.state !== "inactive") {
        try {
          rec.requestData();
          rec.stop();
        } catch {
          /* noop */
        }
      }
      teardownVad();
      stopTracks();
    },
    [stopTracks, teardownVad],
  );

  return { listening, interim, start, stop, supported };
}

function LiveTranslatorPage() {
  const [from, setFrom] = React.useState("pt-BR");
  const [to, setTo] = React.useState("en-US");
  const [text, setText] = React.useState("");
  const [translated, setTranslated] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryItem[]>([]);
  const [mode, setMode] = React.useState<Mode>("conversation");
  const [autoSpeak, setAutoSpeak] = React.useState(true);
  const [autoTranslate, setAutoTranslate] = React.useState(true);
  const [ocrLoading, setOcrLoading] = React.useState(false);
  type Slot = "A" | "B";
  const [btDeviceA, setBtDeviceA] = React.useState<string | null>(null);
  const [btDeviceB, setBtDeviceB] = React.useState<string | null>(null);
  const [btConnecting, setBtConnecting] = React.useState<Slot | null>(null);
  const nextSpeakRef = React.useRef<SpeechSynthesisUtterance | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [voiceCount, setVoiceCount] = React.useState(0);
  const [audioReady, setAudioReady] = React.useState(false);
  const ttsSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Online/offline status for limited offline mode
  const [online, setOnline] = React.useState<boolean>(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  React.useEffect(() => {
    const on = () => {
      setOnline(true);
      toast.success("Online — traduções completas disponíveis");
    };
    const off = () => {
      setOnline(false);
      toast.info("Offline — apenas voz local e traduções em cache");
    };
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Persist paired Bluetooth device names so the user sees them again
  const [btHistory, setBtHistory] = React.useState<string[]>([]);
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("jaq-bt-history-v1");
      if (raw) setBtHistory(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);
  const saveBtHistory = React.useCallback((names: string[]) => {
    const uniq = Array.from(new Set(names.filter(Boolean)));
    setBtHistory(uniq);
    localStorage.setItem("jaq-bt-history-v1", JSON.stringify(uniq.slice(0, 10)));
  }, []);

  const setupSystemBluetooth = React.useCallback((slot: Slot) => {
    try {
      setBtConnecting(slot);
      unlockAudio();
      setAudioReady(true);
      const lang = slot === "A" ? from : to;
      const testText = audioTestPhrase(lang, slot);
      const suggested = slot === "A" ? "Bluetooth do smartphone" : "Segundo fone Bluetooth";
      const typed =
        typeof window !== "undefined"
          ? window.prompt(
              "Conecte o fone nas configurações Bluetooth do smartphone e informe o nome para identificação:",
              suggested,
            )
          : null;
      const name = (typed && typed.trim()) || suggested;
      const setter = slot === "A" ? setBtDeviceA : setBtDeviceB;
      setter(name);
      saveBtHistory([name, ...btHistory]);
      speak(testText, lang);
      toast.success(`Áudio ${slot} pronto pelo Bluetooth do smartphone`);
    } catch (e) {
      const msg = (e as Error).message || "Configuração cancelada";
      if (!/cancel/i.test(msg)) toast.error(msg);
    } finally {
      setBtConnecting(null);
    }
  }, [btHistory, from, saveBtHistory, to]);



  React.useEffect(() => {
    setHistory(loadHistory());
    // Pre-load TTS voices so the first speak() call is not silent
    ensureVoicesLoaded().then((v) => setVoiceCount(v.length));
  }, []);



  const persist = (next: HistoryItem[]) => {
    setHistory(next);
    saveHistory(next);
  };

  const addHistory = React.useCallback(
    (source: string, translatedText: string, f: string, t: string) => {
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        source,
        translated: translatedText,
        from: f,
        to: t,
        ts: Date.now(),
      };
      persist([item, ...loadHistory()]);
    },
    [],
  );

  const doTranslate = React.useCallback(
    async (
      input: string,
      f = from,
      t = to,
      speakOut = autoSpeak,
      prepared?: SpeechSynthesisUtterance | null,
    ) => {
      if (!input.trim()) return;
      setLoading(true);
      try {
        const out = await translateText(input, f, t);
        setTranslated(out);
        addHistory(input, out, f, t);
        if (speakOut) speak(out, t, prepared);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [from, to, autoSpeak, addHistory],
  );

  // STT — handle final transcription
  const onFinalA = React.useCallback(
    (txt: string) => {
      setText(txt);
      const prepared = nextSpeakRef.current;
      nextSpeakRef.current = null;
      doTranslate(txt, from, to, true, prepared);
    },
    [doTranslate, from, to],
  );

  const onFinalB = React.useCallback(
    (txt: string) => {
      // In conversation mode, B speaks in `to` lang and we translate back to `from`
      setText(txt);
      const prepared = nextSpeakRef.current;
      nextSpeakRef.current = null;
      doTranslate(txt, to, from, true, prepared);
    },
    [doTranslate, from, to],
  );

  const srA = useSpeechRecognition(from, onFinalA);
  const srB = useSpeechRecognition(to, onFinalB);

  // Debounced auto-translate while typing
  React.useEffect(() => {
    if (!autoTranslate) return;
    const t = text.trim();
    if (!t) return;
    if (srA.listening || srB.listening) return;
    const id = setTimeout(() => {
      doTranslate(t, from, to, false);
    }, 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoTranslate, from, to]);

  const swap = () => {
    const f = from;
    setFrom(to);
    setTo(f);
    setText("");
    setTranslated("");
  };

  const handleImage = async (file: File) => {
    if (!online) {
      toast.error("OCR de imagem requer internet");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setOcrLoading(true);
      try {
        const { original, translated: tr } = await ocrAndTranslate(dataUrl, to);
        setText(original);
        setTranslated(tr);
        addHistory(original || "[imagem]", tr, from, to);
        if (autoSpeak && tr) speak(tr, to);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const toggleFavorite = (id: string) => {
    const next = history.map((h) =>
      h.id === id ? { ...h, favorite: !h.favorite } : h,
    );
    persist(next);
  };

  const removeItem = (id: string) => {
    persist(history.filter((h) => h.id !== id));
  };

  const clearHistory = () => {
    if (confirm("Limpar todo o histórico?")) persist([]);
  };

  // Quick phrases per destination via AI
  const [destination, setDestination] = React.useState("");
  const [phrases, setPhrases] = React.useState<string[]>([]);
  const [phrasesLoading, setPhrasesLoading] = React.useState(false);

  const suggestPhrases = async () => {
    if (!destination.trim()) {
      toast.error("Informe um destino");
      return;
    }
    if (!online) {
      toast.error("Sugestões de frases requerem internet");
      return;
    }
    setPhrasesLoading(true);
    setPhrases([]);
    try {
      const system = `You are a travel concierge. Return ONLY a JSON array of 8 short, highly useful phrases a tourist would say in ${langLabel(to)} when visiting ${destination}. No numbering, no commentary, no markdown fences. Example: ["...","..."].`;
      const resp = await fetch("/api/ai", {
        method: "POST",
        headers: await authedJsonHeaders(),
        body: JSON.stringify({ system, prompt: `Destination: ${destination}` }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Erro");
      const raw = (data.text as string).trim().replace(/^```json\s*|\s*```$/g, "");
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) setPhrases(arr.slice(0, 12).map(String));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPhrasesLoading(false);
    }
  };

  const navigate = useNavigate();
  const createLiveRoom = () => {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
    navigate({ to: "/live-room/$code", params: { code } });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-10">
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-primary" /> Sala ao vivo (2 ou mais pessoas)
          </div>
          <p className="text-xs text-muted-foreground">
            Crie uma sala, envie o link e cada um fala no seu idioma — o outro ouve traduzido.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BluetoothTranslatorButton />
          <Button onClick={createLiveRoom} className="bg-gradient-primary shadow-glow">
            <Users className="mr-2 h-4 w-4" /> Criar sala ao vivo
          </Button>
        </div>
      </div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Languages className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Live Translator & Smart Glasses</h1>
            <p className="text-sm text-muted-foreground">
              Tradução simultânea por voz, texto e imagem
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {(["A", "B"] as const).map((slot) => {
              const dev = slot === "A" ? btDeviceA : btDeviceB;
              const setDev = slot === "A" ? setBtDeviceA : setBtDeviceB;
              const lang = slot === "A" ? from : to;
              return (
                <div key={slot} className="flex items-center gap-1">
                  <Button
                    variant={dev ? "default" : "outline"}
                    size="sm"
                    onClick={() => setupSystemBluetooth(slot)}
                    disabled={btConnecting === slot}
                    className="gap-1"
                  >
                    {btConnecting === slot ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : dev ? (
                      <Headphones className="h-3.5 w-3.5" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5" />
                    )}
                    {dev
                      ? `Pessoa ${slot}: ${dev}`
                      : `Usar Bluetooth ${slot} (${langLabel(lang)})`}
                  </Button>
                  {dev && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDev(null);
                        toast.info(`Pessoa ${slot} desvinculada`);
                      }}
                    >
                      ✕
                    </Button>
                  )}
                </div>
              );
            })}
            <Badge variant="outline" className="gap-1">
              <Glasses className="h-3 w-3" /> AR Glasses em breve
            </Badge>
            <Badge
              variant={online ? "default" : "secondary"}
              className={cn(
                "gap-1",
                online
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                  : "bg-amber-500/15 text-amber-600 border-amber-500/30",
              )}
              title={
                online
                  ? "Online — tradução completa"
                  : "Offline — voz local + cache; tradução nova exige internet"
              }
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  online ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              {online ? "Online" : "Offline (limitado)"}
            </Badge>
          </div>

          {/* Connected devices cards */}
          {(btDeviceA || btDeviceB) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {(["A", "B"] as const).map((slot) => {
                const dev = slot === "A" ? btDeviceA : btDeviceB;
                if (!dev) return null;
                const lang = slot === "A" ? from : to;
                return (
                  <div
                    key={slot}
                    className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2"
                  >
                    <Headphones className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-primary">
                        Pessoa {slot} · {langLabel(lang)}
                      </p>
                      <p className="text-sm font-semibold">{dev}</p>
                    </div>
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => speak(audioTestPhrase(lang, slot), lang)}
                    >
                      Testar
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {(btDeviceA || btDeviceB) && (
            <p className="text-[11px] text-muted-foreground">
              Conecte o fone direto no Bluetooth do smartphone; o app reproduz
              pela saída de áudio ativa do aparelho.
            </p>
          )}

          {/* Paired devices history */}
          {btHistory.length > 0 && !btDeviceA && !btDeviceB && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Pareados:</span>
              {btHistory.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground"
                  title={name}
                >
                  <Bluetooth className="h-3 w-3" />
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Language bar */}
      <div className="mb-4 grid grid-cols-1 items-end gap-3 rounded-2xl border border-border bg-card/60 p-4 sm:grid-cols-[1fr_auto_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">De</label>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="ghost" size="icon" onClick={swap} aria-label="Inverter idiomas">
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Para</label>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={autoSpeak ? "default" : "outline"}
          onClick={() => setAutoSpeak((v) => !v)}
          className={autoSpeak ? "bg-gradient-primary" : ""}
        >
          <Volume2 className="h-4 w-4" /> Auto-falar
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-end">
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => setAutoTranslate(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          Traduzir automaticamente enquanto digito
        </label>
      </div>


      {/* Audio diagnostics */}
      <div className="mb-4 rounded-2xl border border-border bg-card/60 p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Diagnóstico de áudio:</span>
          <Badge variant={ttsSupported ? "default" : "destructive"}>
            {ttsSupported ? "Voz suportada" : "Sem suporte de voz"}
          </Badge>
          <Badge variant={voiceCount > 0 ? "default" : "secondary"}>
            {voiceCount} vozes carregadas
          </Badge>
          <Badge variant={audioReady ? "default" : "secondary"}>
            {audioReady ? "Áudio desbloqueado" : "Áudio bloqueado"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              unlockAudio();
              setAudioReady(true);
              speak(audioTestPhrase(to), to);
            }}
          >
            <Volume2 className="h-3.5 w-3.5" /> Testar áudio do Chrome
          </Button>
        </div>
        <p className="mt-2 text-muted-foreground">
          O Chrome reproduz o áudio na saída ativa do smartphone. Se o teste
          tocar no celular mas não no fone, conecte o Bluetooth nas configurações
          do Android e reproduza um vídeo no Chrome para confirmar o roteamento
          — o app não controla qual fone recebe o som.
        </p>
      </div>


      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conversation" className="gap-1">
            <Users className="h-4 w-4" /> Conversação
          </TabsTrigger>
          <TabsTrigger value="guide" className="gap-1">
            <Megaphone className="h-4 w-4" /> Guia
          </TabsTrigger>
          <TabsTrigger value="cruise" className="gap-1">
            <Ship className="h-4 w-4" /> Cruzeiro
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conversation" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <SpeakerCard
              title={`Pessoa A — ${langLabel(from)}`}
              listening={srA.listening}
              interim={srA.interim}
              onStart={() => {
                srB.stop();
                nextSpeakRef.current = prepareUtterance("", to, { useVoice: false });
                srA.start();
              }}
              onStop={srA.stop}
            />
            <SpeakerCard
              title={`Pessoa B — ${langLabel(to)}`}
              listening={srB.listening}
              interim={srB.interim}
              onStart={() => {
                srA.stop();
                nextSpeakRef.current = prepareUtterance("", from, { useVoice: false });
                srB.start();
              }}
              onStop={srB.stop}
              accent
            />
          </div>
        </TabsContent>

        <TabsContent value="guide" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <p className="mb-3 text-sm text-muted-foreground">
              Modo guia turístico: você fala em <strong>{langLabel(from)}</strong> e a
              tradução para <strong>{langLabel(to)}</strong> é exibida e falada para os
              ouvintes conectados ao mesmo dispositivo de saída.
            </p>
            <SpeakerCard
              title={`Locutor — ${langLabel(from)}`}
              listening={srA.listening}
              interim={srA.interim}
              onStart={() => {
                nextSpeakRef.current = prepareUtterance("", to, { useVoice: false });
                srA.start();
              }}
              onStop={srA.stop}
            />
          </div>
        </TabsContent>

        <TabsContent value="cruise" className="space-y-4">
          <div className="rounded-2xl border border-border bg-card/60 p-6">
            <p className="mb-4 text-sm text-muted-foreground">
              Frases rápidas para excursões, recepção e restaurantes do navio.
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                "Onde fica o restaurante principal?",
                "A que horas começa a excursão?",
                "Tem opção sem glúten?",
                "Quanto custa essa lembrança?",
                "Pode chamar o gerente, por favor?",
                "Qual o Wi-Fi do quarto?",
              ].map((q) => (
                <Button
                  key={q}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setText(q);
                    const prepared = autoSpeak ? prepareUtterance("", to, { useVoice: false }) : null;
                    doTranslate(q, from, to, autoSpeak, prepared);
                  }}
                >
                  {q}
                </Button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Manual input + image */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-2xl border border-border bg-card/60 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Texto / Voz</h3>
            <div className="flex gap-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImage(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={ocrLoading}
              >
                {ocrLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                Foto
              </Button>
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const prepared = autoSpeak ? prepareUtterance("", to, { useVoice: false }) : null;
                doTranslate(text, from, to, autoSpeak, prepared);
              }
            }}
            placeholder={`Digite em ${langLabel(from)} e pressione Enter (Shift+Enter = nova linha)...`}
            rows={3}
            autoFocus
            autoComplete="off"
            autoCorrect="on"
            spellCheck
            className="text-base"
          />
          <div className="flex gap-2">
            <Button
              variant={srA.listening ? "destructive" : "outline"}
              onClick={
                srA.listening
                  ? srA.stop
                  : () => {
                      nextSpeakRef.current = prepareUtterance("", to, { useVoice: false });
                      srA.start();
                    }
              }
              disabled={!srA.supported}
            >
              {srA.listening ? (
                <>
                  <MicOff className="h-4 w-4" /> Parar
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" /> Gravar
                </>
              )}
            </Button>
            <Button
              onClick={() => {
                const prepared = autoSpeak ? prepareUtterance("", to, { useVoice: false }) : null;
                doTranslate(text, from, to, autoSpeak, prepared);
              }}
              disabled={loading || !text.trim()}
              className="flex-1 bg-gradient-primary shadow-glow"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Traduzir
            </Button>
          </div>
          {srA.interim && (
            <p className="text-xs italic text-muted-foreground">{srA.interim}</p>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-primary/30 bg-gradient-card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tradução — {langLabel(to)}</h3>
            {translated && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => speak(translated, to)}
              >
                <Volume2 className="h-4 w-4" /> Ouvir
              </Button>
            )}
          </div>
          <div className="min-h-[140px] whitespace-pre-wrap rounded-lg bg-background/40 p-3 text-base">
            {translated || (
              <span className="text-muted-foreground">
                A tradução aparecerá aqui...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Phrases by destination */}
      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Frases úteis por destino</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Ex: Tóquio, Paris, Cancún..."
            className="flex-1 min-w-[200px] rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button onClick={suggestPhrases} disabled={phrasesLoading}>
            {phrasesLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Sugerir
          </Button>
        </div>
        {phrases.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {phrases.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background/40 p-2 text-sm"
              >
                <span>{p}</span>
                <Button size="icon" variant="ghost" onClick={() => speak(p, to)}>
                  <Volume2 className="h-3.5 w-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* History */}
      <div className="mt-6 rounded-2xl border border-border bg-card/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Histórico & Favoritos</h3>
          {history.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearHistory}>
              <Trash2 className="h-3.5 w-3.5" /> Limpar
            </Button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Suas traduções aparecerão aqui.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.slice(0, 30).map((h) => (
              <li
                key={h.id}
                className="rounded-lg border border-border bg-background/40 p-3 text-sm"
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    {langLabel(h.from)} → {langLabel(h.to)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleFavorite(h.id)}
                      aria-label="Favoritar"
                    >
                      <Star
                        className={cn(
                          "h-3.5 w-3.5",
                          h.favorite && "fill-primary text-primary",
                        )}
                      />
                    </button>
                    <button onClick={() => speak(h.translated, h.to)} aria-label="Ouvir">
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeItem(h.id)} aria-label="Excluir">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-muted-foreground">{h.source}</p>
                <p className="font-medium">{h.translated}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type SpeakerCardProps = {
  title: string;
  listening: boolean;
  interim: string;
  onStart: () => void;
  onStop: () => void;
  accent?: boolean;
};

function SpeakerCard({
  title,
  listening,
  interim,
  onStart,
  onStop,
  accent,
}: SpeakerCardProps) {

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 transition-colors",
        accent
          ? "border-primary/40 bg-gradient-card"
          : "border-border bg-card/60",
      )}
    >
      <h4 className="mb-3 text-sm font-semibold">{title}</h4>
      <Button
        size="lg"
        variant={listening ? "destructive" : "default"}
        onClick={listening ? onStop : onStart}
        className={cn(
          "w-full",
          !listening && "bg-gradient-primary shadow-glow",
        )}
      >
        {listening ? (
          <>
            <MicOff className="h-5 w-5" /> Parar
          </>
        ) : (
          <>
            <Mic className="h-5 w-5" /> Falar
          </>
        )}
      </Button>
      <div className="mt-3 min-h-[40px] rounded-lg bg-background/40 p-2 text-xs italic text-muted-foreground">
        {listening ? interim || "Ouvindo… pode falar" : "Toque em Falar — paro sozinho quando você terminar."}
      </div>
    </div>
  );
}

export default LiveTranslatorPage;
