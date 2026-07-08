import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { Mic, Square, Copy, Share2, Users, Volume2, Loader2, ArrowLeft, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CallPanel, CallModeSelector, type CallMode } from "@/components/live-room/CallPanel";

export const Route = createFileRoute("/live-room/$code")({
  component: LiveRoomPage,
});

const LANGS = [
  { code: "pt-BR", label: "Português (BR)", flag: "🇧🇷" },
  { code: "en-US", label: "English (US)", flag: "🇺🇸" },
  { code: "es-ES", label: "Español", flag: "🇪🇸" },
  { code: "fr-FR", label: "Français", flag: "🇫🇷" },
  { code: "it-IT", label: "Italiano", flag: "🇮🇹" },
  { code: "de-DE", label: "Deutsch", flag: "🇩🇪" },
  { code: "ja-JP", label: "日本語", flag: "🇯🇵" },
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "ko-KR", label: "한국어", flag: "🇰🇷" },
  { code: "ar-SA", label: "العربية", flag: "🇸🇦" },
  { code: "ru-RU", label: "Русский", flag: "🇷🇺" },
];

function langFlag(c: string) {
  return LANGS.find((l) => l.code === c)?.flag ?? "🌐";
}

type Presence = { userId: string; lang: string; name: string; liveOn?: boolean };
type PerRecipientMap = Record<string, { text: string; audio?: string; lang: string }>;
type MessageRow = {
  id: string;
  room_code: string;
  from_user_id: string;
  from_name: string;
  from_lang: string;
  original_text: string;
  per_recipient: PerRecipientMap;
  created_at: string;
};
type RenderedMessage = {
  id: string;
  fromUserId: string;
  fromName: string;
  fromLang: string;
  originalText: string;
  translatedText: string;
  audio?: string;
  ts: number;
  mine: boolean;
};
type RoomStateRow = {
  room_code: string;
  call_mode: CallMode;
  video_host_id: string | null;
  daily_url: string | null;
  updated_at?: string;
};

function getOrCreateUserId() {
  if (typeof window === "undefined") return "anon";
  const k = "jaq-live-room-uid";
  let id = localStorage.getItem(k) || sessionStorage.getItem(k);
  if (!id) {
    id = crypto.randomUUID();
  }
  localStorage.setItem(k, id);
  sessionStorage.setItem(k, id);
  return id;
}
function getOrCreateName() {
  if (typeof window === "undefined") return "Convidado";
  const k = "jaq-live-room-name";
  return localStorage.getItem(k) || "";
}
function saveName(n: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("jaq-live-room-name", n);
}

function LiveRoomPage() {
  const { code } = Route.useParams();
  const [myId] = React.useState(getOrCreateUserId);
  const [myName, setMyName] = React.useState(getOrCreateName);
  const [myLang, setMyLang] = React.useState("pt-BR");
  const [joined, setJoined] = React.useState(false);
  const [participants, setParticipants] = React.useState<Presence[]>([]);
  const [messages, setMessages] = React.useState<RenderedMessage[]>([]);
  const [listening, setListening] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [channelStatus, setChannelStatus] = React.useState<"connecting" | "connected" | "error">("connecting");
  const [callMode, setCallMode] = React.useState<CallMode>("none");
  const [videoHostId, setVideoHostId] = React.useState<string | null>(null);
  const [sharedVideoUrl, setSharedVideoUrl] = React.useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = React.useState(false);
  const [liveTranslateOn, setLiveTranslateOn] = React.useState(false);

  const channelRef = React.useRef<RealtimeChannel | null>(null);
  const signalListenersRef = React.useRef<Set<(p: unknown) => void>>(new Set());
  const recRef = React.useRef<MediaRecorder | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const mimeRef = React.useRef("");
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const participantsRef = React.useRef<Presence[]>([]);
  const seenIdsRef = React.useRef<Set<string>>(new Set());
  const pendingAudioRef = React.useRef<string | null>(null);
  const pendingTextAudioRef = React.useRef<{ text: string; lang: string } | null>(null);
  // VAD (voice activity detection) refs
  const vadCtxRef = React.useRef<AudioContext | null>(null);
  const vadAnalyserRef = React.useRef<AnalyserNode | null>(null);
  const vadRafRef = React.useRef<number | null>(null);
  const vadSpokeRef = React.useRef(false);
  const vadSilenceStartRef = React.useRef<number | null>(null);
  const vadMaxTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveTranslateOnRef = React.useRef(false);
  const audioPlayingRef = React.useRef(false);
  const restartTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const discardNextRecordingRef = React.useRef(false);

  React.useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  React.useEffect(() => {
    liveTranslateOnRef.current = liveTranslateOn;
  }, [liveTranslateOn]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const unlockAudio = React.useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute("playsinline", "true");
    }
    // Prime with a silent MP3 during user gesture so future .play() calls succeed on iOS/Android
    try {
      audioRef.current.muted = true;
      audioRef.current.src =
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQxAADB8AhSmxhIIEVCSiJrDCQBTcu3UrAIwUdkRgQbFAZC1CQEwTJ9mjRvBA4UOLD8nKVOWfh+UlK3z/177OXrfOdKl7pyn3Xf//FJAhDQHIIAIBAEAAA//8AAAA=";
      const p = audioRef.current.play();
      if (p && typeof p.then === "function") p.then(() => {
        if (audioRef.current) audioRef.current.muted = false;
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }, []);

  const playBase64 = React.useCallback((b64: string) => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute("playsinline", "true");
    }
    audioRef.current.muted = false;
    audioRef.current.src = `data:audio/mpeg;base64,${b64}`;
    audioPlayingRef.current = true;
    audioRef.current.onended = () => {
      audioPlayingRef.current = false;
    };
    audioRef.current.onerror = () => {
      audioPlayingRef.current = false;
    };
    audioRef.current.play().then(() => {
      setAudioBlocked(false);
      pendingAudioRef.current = null;
    }).catch(() => {
      audioPlayingRef.current = false;
      pendingAudioRef.current = b64;
      setAudioBlocked(true);
    });
  }, []);

  const playTranslatedText = React.useCallback(async (text: string, lang: string) => {
    const clean = text.trim().slice(0, 220);
    if (!clean) return;
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute("playsinline", "true");
    }
    let objectUrl: string | null = null;
    try {
      audioPlayingRef.current = true;
      const resp = await fetch(
        `/api/public/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(clean)}`,
        { credentials: "same-origin" },
      );
      if (!resp.ok) throw new Error(`TTS ${resp.status}`);
      const blob = await resp.blob();
      if (!blob.size) throw new Error("TTS vazio");
      objectUrl = URL.createObjectURL(blob);
      audioRef.current.muted = false;
      audioRef.current.src = objectUrl;
      audioRef.current.onended = () => {
        audioPlayingRef.current = false;
      };
      audioRef.current.onerror = () => {
        audioPlayingRef.current = false;
      };
      await audioRef.current.play();
      setAudioBlocked(false);
      pendingAudioRef.current = null;
      pendingTextAudioRef.current = null;
    } catch {
      audioPlayingRef.current = false;
      pendingTextAudioRef.current = { text: clean, lang };
      setAudioBlocked(true);
    } finally {
      if (objectUrl) {
        const urlToRevoke = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 5000);
      }
    }
  }, []);

  const persistRoomState = React.useCallback(
    async (state: Partial<RoomStateRow>) => {
      try {
        const payload = {
          room_code: code,
          call_mode: state.call_mode ?? callMode,
          video_host_id: state.video_host_id === undefined ? videoHostId : state.video_host_id,
          daily_url: state.daily_url === undefined ? sharedVideoUrl : state.daily_url,
        };
        await (supabase as any)
          .from("live_room_state")
          .upsert(payload, { onConflict: "room_code" });
      } catch {
        /* best effort */
      }
    },
    [callMode, code, sharedVideoUrl, videoHostId],
  );

  const applyRoomState = React.useCallback(
    (row: RoomStateRow) => {
      if (!row || row.room_code !== code) return;
      const nextMode = row.call_mode || "none";
      setCallMode(nextMode);
      setVideoHostId(row.video_host_id ?? null);
      setSharedVideoUrl(row.daily_url ?? null);
    },
    [code],
  );

  const handleIncomingRow = React.useCallback(
    (row: MessageRow) => {
      if (!row || row.room_code !== code || seenIdsRef.current.has(row.id)) return;
      seenIdsRef.current.add(row.id);
      const forMe = row.per_recipient?.[myId];
      const isMine = row.from_user_id === myId;
      const translated = forMe?.text ?? row.original_text;
      const audio = forMe?.audio;
      setMessages((prev) => [
        ...prev,
        {
          id: row.id,
          fromUserId: row.from_user_id,
          fromName: row.from_name,
          fromLang: row.from_lang,
          originalText: row.original_text,
          translatedText: translated,
          audio,
          ts: new Date(row.created_at).getTime(),
          mine: isMine,
        },
      ]);
      if (!isMine && (audio || translated)) {
        // Only pause playback when a new message arrives; DO NOT stop the
        // receiver's own recording — otherwise their speech gets discarded
        // whenever they talk at the same time as the sender.
        if (audio) playBase64(audio);
        else void playTranslatedText(translated, forMe?.lang ?? myLang);
      }
    },
    [code, myId, myLang, playBase64, playTranslatedText],
  );

  React.useEffect(() => {
    if (!joined) return;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("live_room_state")
          .select("room_code, call_mode, video_host_id, daily_url, updated_at")
          .eq("room_code", code)
          .maybeSingle();
        if (data) applyRoomState(data as RoomStateRow);
      } catch {
        /* best effort */
      }
    })();
  }, [applyRoomState, code, joined]);

  const manualPlayPending = React.useCallback(() => {
    const b64 = pendingAudioRef.current;
    const pendingText = pendingTextAudioRef.current;
    if (!b64) {
      if (pendingText) {
        unlockAudio();
        setTimeout(() => void playTranslatedText(pendingText.text, pendingText.lang), 50);
      } else {
        setAudioBlocked(false);
      }
      return;
    }
    unlockAudio();
    setTimeout(() => playBase64(b64), 50);
  }, [playBase64, playTranslatedText, unlockAudio]);

  // Join the realtime channel
  React.useEffect(() => {
    if (!joined) return;
    const channel = supabase.channel(`live-room:${code}`, {
      config: { presence: { key: myId }, broadcast: { self: false, ack: false } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState() as Record<string, Array<Presence>>;
      const list: Presence[] = [];
      for (const arr of Object.values(state)) {
        if (arr[0]) list.push(arr[0]);
      }
      setParticipants(list);
    });

    // WebRTC / call-mode signaling
    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      signalListenersRef.current.forEach((cb) => cb(payload));
    });
    channel.on("broadcast", { event: "callmode" }, ({ payload }) => {
      const p = payload as { mode?: CallMode; from?: string };
      if (p?.mode && p.from !== myId) {
        if (p.mode === "video" && p.from) setVideoHostId(p.from);
        toast.info(`Anfitrião iniciou ${p.mode === "video" ? "vídeo" : "áudio ao vivo"}`, {
          action: {
            label: "Entrar",
            onClick: () => setCallMode(p.mode!),
          },
        });
      }
    });
    channel.on("broadcast", { event: "daily-url" }, ({ payload }) => {
      const p = payload as { url?: string; from?: string };
      if (p?.url && p.from !== myId) {
        setSharedVideoUrl(p.url);
        if (p.from) setVideoHostId(p.from);
      }
    });
    channel.on("broadcast", { event: "translated-message" }, ({ payload }) => {
      handleIncomingRow(payload as MessageRow);
    });
    channel.on("broadcast", { event: "nudge-live" }, ({ payload }) => {
      const p = payload as { from?: string; fromName?: string; to?: string };
      if (p?.to && p.to !== myId) return;
      if (p?.from === myId) return;
      toast.info(`${p?.fromName || "Anfitrião"} pediu para você ligar a tradução ao vivo`, {
        duration: 8000,
      });
    });

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "live_room_state", filter: `room_code=eq.${code}` },
      (payload) => applyRoomState(payload.new as RoomStateRow),
    );

    // Postgres_changes on live_room_messages — reliable transport
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "live_room_messages", filter: `room_code=eq.${code}` },
      (payload) => {
        const row = payload.new as MessageRow;
        handleIncomingRow(row);
      },
    );

    channel.subscribe(async (st) => {
      if (st === "SUBSCRIBED") {
        setChannelStatus("connected");
        await channel.track({ userId: myId, lang: myLang, name: myName || "Convidado", liveOn: liveTranslateOnRef.current });
      } else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
        setChannelStatus("error");
      } else {
        setChannelStatus("connecting");
      }
    });
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
      seenIdsRef.current.clear();
    };
  }, [joined, code, myId, myLang, myName, applyRoomState, handleIncomingRow]);

  // Update presence when language/name/liveOn changes
  React.useEffect(() => {
    if (!joined || !channelRef.current) return;
    channelRef.current.track({ userId: myId, lang: myLang, name: myName || "Convidado", liveOn: liveTranslateOn });
  }, [joined, myId, myLang, myName, liveTranslateOn]);

  const nudgePeer = React.useCallback(
    (peerId: string) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "nudge-live",
        payload: { from: myId, fromName: myName || "Anfitrião", to: peerId },
      });
      toast.success("Lembrete enviado");
    },
    [myId, myName],
  );

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/live-room/${code}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };
  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Tradução ao vivo Jaqtryp",
          text: `Entra na minha sala de tradução ao vivo. Código: ${code}`,
          url: inviteUrl,
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copyLink();
    }
  };

  const stopTracks = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopVad = React.useCallback(() => {
    if (vadRafRef.current != null) {
      cancelAnimationFrame(vadRafRef.current);
      vadRafRef.current = null;
    }
    if (vadMaxTimerRef.current) {
      clearTimeout(vadMaxTimerRef.current);
      vadMaxTimerRef.current = null;
    }
    vadAnalyserRef.current = null;
    const ctx = vadCtxRef.current;
    vadCtxRef.current = null;
    if (ctx && ctx.state !== "closed") {
      ctx.close().catch(() => {});
    }
    vadSpokeRef.current = false;
    vadSilenceStartRef.current = null;
  }, []);

  const others = participants.filter((p) => p.userId !== myId);
  const canRecord = others.length > 0;

  function clearRestartTimer() {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }

  function scheduleNextListening(delay = 650) {
    clearRestartTimer();
    if (!liveTranslateOnRef.current) return;
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (!liveTranslateOnRef.current) return;
      if (audioPlayingRef.current) {
        scheduleNextListening(500);
        return;
      }
      if (participantsRef.current.filter((p) => p.userId !== myId).length === 0) return;
      if (!recRef.current || recRef.current.state === "inactive") void startRecording();
    }, delay);
  }

  const startRecording = async () => {
    unlockAudio();
    if (!canRecord) {
      toast.info("Aguardando alguém entrar com o link…");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      let mime = "";
      for (const c of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c)) {
          mime = c;
          break;
        }
      }
      mimeRef.current = mime;
      chunksRef.current = [];
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        toast.error("Erro no microfone");
        stopVad();
        stopTracks();
        setListening(false);
      };
      rec.onstop = async () => {
        setListening(false);
        stopVad();
        stopTracks();
        const blobType = mimeRef.current || rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        chunksRef.current = [];
        recRef.current = null;
        if (discardNextRecordingRef.current) {
          discardNextRecordingRef.current = false;
          setStatus(liveTranslateOnRef.current ? "Ouvindo tradução recebida…" : "");
          scheduleNextListening(900);
          return;
        }
        if (blob.size < 1200) {
          setStatus("");
          scheduleNextListening();
          return;
        }
        await processAudio(blob, blobType);
      };
      recRef.current = rec;
      rec.start();
      setListening(true);
      setStatus("Gravando… (pare de falar para enviar)");

      // ---- VAD: auto-stop on silence ----
      try {
        const AC =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          const ctx = new AC();
          const src = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 1024;
          src.connect(analyser);
          vadCtxRef.current = ctx;
          vadAnalyserRef.current = analyser;
          const buf = new Uint8Array(analyser.fftSize);
          const SPEECH_THRESHOLD = 0.025; // RMS above this = speech
          const SILENCE_MS = 1200; // stop after this much silence
          const MIN_SPEECH_MS = 350; // require some speech first
          let speechStart: number | null = null;

          const tick = () => {
            const a = vadAnalyserRef.current;
            if (!a || !recRef.current || recRef.current.state !== "recording") return;
            a.getByteTimeDomainData(buf);
            let sumSq = 0;
            for (let i = 0; i < buf.length; i++) {
              const v = (buf[i] - 128) / 128;
              sumSq += v * v;
            }
            const rms = Math.sqrt(sumSq / buf.length);
            const now = performance.now();
            if (rms > SPEECH_THRESHOLD) {
              if (speechStart == null) speechStart = now;
              if (!vadSpokeRef.current && now - speechStart >= MIN_SPEECH_MS) {
                vadSpokeRef.current = true;
              }
              vadSilenceStartRef.current = null;
            } else if (vadSpokeRef.current) {
              if (vadSilenceStartRef.current == null) vadSilenceStartRef.current = now;
              else if (now - vadSilenceStartRef.current >= SILENCE_MS) {
                stopRecording();
                return;
              }
            }
            vadRafRef.current = requestAnimationFrame(tick);
          };
          vadRafRef.current = requestAnimationFrame(tick);

          // Safety cap: never record more than 30s
          vadMaxTimerRef.current = setTimeout(() => {
            if (recRef.current && recRef.current.state === "recording") stopRecording();
          }, 30_000);
        }
      } catch {
        /* VAD is best-effort; manual stop still works */
      }
    } catch (e) {
      const err = e as DOMException;
      if (err.name === "NotAllowedError") toast.error("Permissão de microfone negada");
      else toast.error(`Microfone indisponível: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (recRef.current && recRef.current.state !== "inactive") {
      setStatus("Finalizando…");
      try {
        recRef.current.requestData();
      } catch {
        /* ignore */
      }
      recRef.current.stop();
    }
  };

  const stopLiveTranslation = () => {
    liveTranslateOnRef.current = false;
    setLiveTranslateOn(false);
    clearRestartTimer();
    setStatus("");
    if (recRef.current && recRef.current.state !== "inactive") {
      discardNextRecordingRef.current = true;
      stopRecording();
    } else {
      stopVad();
      stopTracks();
      setListening(false);
    }
  };

  const startLiveTranslation = () => {
    unlockAudio();
    if (!canRecord) {
      toast.info("Aguardando alguém entrar com o link…");
      return;
    }
    liveTranslateOnRef.current = true;
    setLiveTranslateOn(true);
    setStatus("Tradução ao vivo ligada…");
    scheduleNextListening(50);
  };

  React.useEffect(() => {
    if (!liveTranslateOn) return;
    if (!canRecord) {
      if (recRef.current && recRef.current.state !== "inactive") {
        discardNextRecordingRef.current = true;
        stopRecording();
      }
      setStatus("Aguardando convidado…");
      return;
    }
    if (!listening && !busy) scheduleNextListening(250);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveTranslateOn, canRecord, listening, busy]);

  const processAudio = async (blob: Blob, blobType: string) => {
    setBusy(true);
    setStatus("Transcrevendo…");
    try {
      const fd = new FormData();
      const ext = blobType.includes("mp4") ? "m4a" : blobType.includes("ogg") ? "ogg" : "webm";
      fd.append("audio", blob, `audio.${ext}`);
      fd.append("lang", myLang);
      const sttResp = await fetch("/api/public/stt", { method: "POST", body: fd });
      if (!sttResp.ok) {
        const e = await sttResp.text();
        throw new Error(`STT: ${e.slice(0, 120)}`);
      }
      const { text } = (await sttResp.json()) as { text?: string };
      const original = (text || "").trim();
      if (!original) {
        setStatus("");
        toast.info("Nada foi captado");
        return;
      }

      const currentOthers = participantsRef.current.filter((p) => p.userId !== myId);
      if (currentOthers.length === 0) {
        setStatus("Aguardando convidado entrar para traduzir…");
        toast.info("Compartilhe o link para começar a traduzir");
        return;
      }

      setStatus("Traduzindo e gerando voz…");
      const tResp = await fetch("/api/public/translate-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromLang: myLang,
          text: original,
          withAudio: true,
          roomCode: code,
          fromUserId: myId,
          fromName: myName || "Eu",
          targets: currentOthers.map((p) => ({ userId: p.userId, lang: p.lang })),
        }),
      });
      if (!tResp.ok) {
        const e = await tResp.text();
        throw new Error(`Translate: ${e.slice(0, 120)}`);
      }
      const result = (await tResp.json()) as {
        originalText?: string;
        fromLang?: string;
        perRecipient?: PerRecipientMap;
        messageId?: string | null;
      };
      const row: MessageRow = {
        id: result.messageId || crypto.randomUUID(),
        room_code: code,
        from_user_id: myId,
        from_name: myName || "Eu",
        from_lang: result.fromLang || myLang,
        original_text: result.originalText || original,
        per_recipient: result.perRecipient || {},
        created_at: new Date().toISOString(),
      };
      handleIncomingRow(row);
      channelRef.current?.send({ type: "broadcast", event: "translated-message", payload: row });
      setStatus("");
    } catch (e) {
      toast.error((e as Error).message);
      setStatus("");
    } finally {
      setBusy(false);
      scheduleNextListening();
    }
  };

  // Signaling bridge for WebRTC P2P
  const callChannel = React.useMemo(
    () => ({
      send: (payload: unknown) => {
        channelRef.current?.send({ type: "broadcast", event: "signal", payload });
      },
      onSignal: (cb: (p: unknown) => void) => {
        signalListenersRef.current.add(cb as (p: unknown) => void);
        return () => {
          signalListenersRef.current.delete(cb as (p: unknown) => void);
        };
      },
    }),
    [],
  );

  const changeCallMode = (m: CallMode) => {
    unlockAudio();
    setCallMode(m);
    let nextHost = videoHostId;
    if (m === "video") {
      // Only set self as host if nobody else claimed it yet
      nextHost = videoHostId ?? myId;
      setVideoHostId(nextHost);
    }
    if (m === "none") {
      nextHost = null;
      setSharedVideoUrl(null);
      setVideoHostId(null);
    }
    void persistRoomState({
      call_mode: m,
      video_host_id: nextHost,
      daily_url: m === "none" ? null : sharedVideoUrl,
    });
    if (m !== "none") {
      channelRef.current?.send({
        type: "broadcast",
        event: "callmode",
        payload: { mode: m, from: myId },
      });
    }
  };

  const broadcastDailyUrl = React.useCallback(
    (url: string) => {
      setSharedVideoUrl(url);
      void persistRoomState({ call_mode: "video", video_host_id: videoHostId ?? myId, daily_url: url });
      channelRef.current?.send({
        type: "broadcast",
        event: "daily-url",
        payload: { url, from: myId },
      });
    },
    [myId, persistRoomState, videoHostId],
  );

  // Join screen
  if (!joined) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-glow">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">
              <ArrowLeft className="inline h-4 w-4" /> Início
            </Link>
          </div>
          <h1 className="text-2xl font-bold">Entrar na sala</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Código: <span className="font-mono font-semibold text-foreground">{code}</span>
          </p>

          <div className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Seu nome</label>
              <input
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="Ex.: Jose"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Idioma que você fala
              </label>
              <Select value={myLang} onValueChange={setMyLang}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l.code} value={l.code}>
                      {l.flag} {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full bg-gradient-primary shadow-glow"
              onClick={() => {
                if (myName.trim()) saveName(myName.trim());
                unlockAudio();
                setJoined(true);
              }}
            >
              Entrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[100dvh] max-w-3xl flex-col bg-background px-4 py-4">
      {/* Header */}
      <div className="rounded-2xl border border-border bg-card/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Sala
              {channelStatus === "connected" ? (
                <Wifi className="h-3 w-3 text-emerald-500" />
              ) : channelStatus === "error" ? (
                <WifiOff className="h-3 w-3 text-red-500" />
              ) : (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
            </div>
            <div className="font-mono text-lg font-bold tracking-wider">{code}</div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copiar link
            </Button>
            <Button size="sm" className="bg-gradient-primary" onClick={share}>
              <Share2 className="mr-1 h-3.5 w-3.5" /> Convidar
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Users className="h-3.5 w-3.5 text-muted-foreground" />
          {participants.length === 0 ? (
            <span className="text-muted-foreground">Conectando…</span>
          ) : (
            participants.map((p) => (
              <span
                key={p.userId}
                className={cn(
                  "rounded-full border px-2 py-0.5",
                  p.userId === myId
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {langFlag(p.lang)} {p.name}
                {p.userId === myId ? " (você)" : ""}
              </span>
            ))
          )}
        </div>
        {others.length === 0 && (
          <div className="mt-2 text-xs text-amber-500">
            Aguardando alguém entrar com o link…
          </div>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Select value={myLang} onValueChange={setMyLang}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGS.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  {l.flag} {l.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="mt-3">
          <CallModeSelector mode={callMode} onChange={changeCallMode} disabled={!canRecord} />
        </div>
      </div>

      {/* Call panel */}
      {callMode !== "none" && (
        <div className="mt-3">
          <CallPanel
            mode={callMode}
            code={code}
            myId={myId}
            userName={myName || "Convidado"}
            peers={others.map((o) => o.userId)}
            onLeave={() => {
              setCallMode("none");
            }}
            channel={callChannel as never}
            isHost={videoHostId === null || videoHostId === myId}
            sharedVideoUrl={sharedVideoUrl}
            onVideoUrlReady={broadcastDailyUrl}
          />
        </div>
      )}

      {audioBlocked && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <span>Áudio bloqueado pelo navegador. Toque para tocar.</span>
          <Button size="sm" onClick={manualPlayPending}>
            <Volume2 className="mr-1 h-3 w-3" /> Tocar áudio
          </Button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto py-4">
        {messages.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div>
              <Volume2 className="mx-auto mb-2 h-8 w-8 opacity-50" />
              Aperte o microfone e fale no seu idioma.
              <br />A outra pessoa vai ouvir e ler na língua dela.
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex flex-col gap-1 rounded-2xl border p-3",
              m.mine ? "ml-8 border-primary/30 bg-primary/10" : "mr-8 border-border bg-card",
            )}
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {langFlag(m.fromLang)} <span className="font-medium">{m.fromName}</span>
              </span>
              {m.audio && (
                <button
                  className="text-primary hover:underline"
                  onClick={() => playBase64(m.audio!)}
                >
                  <Volume2 className="inline h-3 w-3" /> Reouvir
                </button>
              )}
            </div>
            {!m.mine && m.originalText !== m.translatedText && (
              <div className="text-xs italic text-muted-foreground">{m.originalText}</div>
            )}
            <div className="text-sm">{m.translatedText}</div>
          </div>
        ))}
      </div>

      {/* Mic */}
      <div className="border-t border-border pt-4">
        {status && (
          <div className="mb-2 text-center text-xs text-muted-foreground">{status}</div>
        )}
        <div className="flex justify-center">
          <Button
            size="lg"
            disabled={!liveTranslateOn && !canRecord}
            onClick={liveTranslateOn ? stopLiveTranslation : startLiveTranslation}
            className={cn(
              "h-16 w-16 rounded-full shadow-glow",
              liveTranslateOn ? "bg-red-500 hover:bg-red-600" : "bg-gradient-primary",
            )}
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : liveTranslateOn ? (
              <Square className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </Button>
        </div>
        <div className="mt-2 text-center text-xs text-muted-foreground">
          {!canRecord
            ? "Aguardando convidado…"
            : liveTranslateOn
              ? listening
                ? "Traduzindo ao vivo — toque para desligar"
                : "Tradução ao vivo ligada"
              : "Toque para ligar tradução ao vivo"}
        </div>
      </div>
    </div>
  );
}
