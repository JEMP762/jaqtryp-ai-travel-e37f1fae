import * as React from "react";
import DailyIframe, { type DailyCall } from "@daily-co/daily-js";
import { Loader2, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { createDailyRoom } from "@/lib/daily.functions";
import { Button } from "@/components/ui/button";

interface Props {
  code: string;
  userName: string;
  onLeave: () => void;
  isHost: boolean;
  sharedUrl?: string | null;
  onUrlReady?: (url: string) => void;
}

export function DailyVideoCall({ code, userName, onLeave, isHost, sharedUrl, onUrlReady }: Props) {
  const ref = React.useRef<HTMLDivElement>(null);
  const callRef = React.useRef<DailyCall | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [retryNonce, setRetryNonce] = React.useState(0);
  const createRoom = useServerFn(createDailyRoom);

  React.useEffect(() => {
    let disposed = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    setLoading(true);
    setError(null);

    const boot = async (url: string) => {
      if (disposed || !ref.current) return;
      try {
        if (callRef.current) {
          try {
            callRef.current.destroy();
          } catch {
            /* ignore */
          }
          callRef.current = null;
        }
        const call = DailyIframe.createFrame(ref.current, {
          iframeStyle: {
            width: "100%",
            height: "100%",
            border: "0",
            borderRadius: "12px",
          },
          showLeaveButton: true,
          showFullscreenButton: true,
        });
        callRef.current = call;
        call.on("left-meeting", () => onLeave());
        call.on("error", (ev) => {
          const msg =
            (ev as { errorMsg?: string; error?: { msg?: string } })?.errorMsg ||
            (ev as { error?: { msg?: string } })?.error?.msg ||
            "Erro na chamada de vídeo";
          setError(msg);
        });
        await call.join({ url, userName: userName || "Convidado" });
        setLoading(false);
      } catch (e) {
        setError("Erro ao entrar na chamada: " + (e as Error).message);
        setLoading(false);
      }
    };

    const createAndBoot = async () => {
      try {
        const res = await createRoom({ data: { code } });
        if (disposed) return;
        if (!res.ok || !res.url) {
          if (res.reason === "no_api_key") {
            setError(
              "Chamadas de vídeo ainda não estão configuradas. O administrador precisa adicionar a chave DAILY_API_KEY.",
            );
          } else {
            setError(
              "Não foi possível criar a sala de vídeo: " + (res.error || res.reason || "erro"),
            );
          }
          setLoading(false);
          return;
        }
        onUrlReady?.(res.url);
        await boot(res.url);
      } catch (e) {
        setError("Erro ao iniciar chamada: " + (e as Error).message);
        setLoading(false);
      }
    };

    if (sharedUrl) {
      void boot(sharedUrl);
    } else if (isHost) {
      void createAndBoot();
    } else {
      // Guest: wait up to 4s for the host's URL; fallback = create it ourselves
      fallbackTimer = setTimeout(() => {
        if (!disposed && !callRef.current) void createAndBoot();
      }, 4000);
    }

    return () => {
      disposed = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      const c = callRef.current;
      callRef.current = null;
      if (c) {
        try {
          c.leave();
        } catch {
          /* ignore */
        }
        try {
          c.destroy();
        } catch {
          /* ignore */
        }
      }
    };
    // Retry explicitly remounts the Daily frame; sharedUrl arriving later is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNonce]);

  // Guest received the URL after mount → boot now
  React.useEffect(() => {
    if (!sharedUrl || callRef.current) return;
    let disposed = false;
    (async () => {
      if (!ref.current || disposed) return;
      try {
        setError(null);
        setLoading(true);
        const call = DailyIframe.createFrame(ref.current, {
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "12px" },
          showLeaveButton: true,
          showFullscreenButton: true,
        });
        callRef.current = call;
        call.on("left-meeting", () => onLeave());
        call.on("error", (ev) => {
          const msg =
            (ev as { errorMsg?: string })?.errorMsg || "Erro na chamada de vídeo";
          setError(msg);
        });
        await call.join({ url: sharedUrl, userName: userName || "Convidado" });
        setLoading(false);
      } catch (e) {
        setError("Erro ao entrar na chamada: " + (e as Error).message);
        setLoading(false);
      }
    })();
    return () => {
      disposed = true;
    };
  }, [sharedUrl, onLeave, userName]);

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
        <div className="mb-2 flex items-center gap-2 font-semibold text-destructive">
          <VideoOff className="h-4 w-4" /> Vídeo indisponível
        </div>
        <p className="text-muted-foreground">{error}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setRetryNonce((n) => n + 1)}>
            Tentar novamente
          </Button>
          <Button size="sm" variant="outline" onClick={onLeave}>
            Fechar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black">
      {loading && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/60 text-white">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Iniciando vídeo…
          </div>
        </div>
      )}
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}

// ---------- WebRTC audio-only P2P (2 peers) ----------

type SignalPayload =
  | { kind: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { kind: "ice"; from: string; to: string; candidate: RTCIceCandidateInit }
  | { kind: "hello"; from: string };

interface AudioP2PProps {
  myId: string;
  peers: string[]; // other participant userIds
  onLeave: () => void;
  channel: {
    send: (payload: SignalPayload) => void;
    onSignal: (cb: (p: SignalPayload) => void) => () => void;
  };
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function AudioCallP2P({ myId, peers, onLeave, channel }: AudioP2PProps) {
  const [muted, setMuted] = React.useState(false);
  const [connected, setConnected] = React.useState<Set<string>>(new Set());
  const localStreamRef = React.useRef<MediaStream | null>(null);
  const pcsRef = React.useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = React.useRef<Map<string, HTMLAudioElement>>(new Map());

  const ensurePc = React.useCallback(
    (peerId: string) => {
      let pc = pcsRef.current.get(peerId);
      if (pc) return pc;
      pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcsRef.current.set(peerId, pc);
      const local = localStreamRef.current;
      if (local) local.getTracks().forEach((t) => pc!.addTrack(t, local));
      pc.onicecandidate = (e) => {
        if (e.candidate)
          channel.send({ kind: "ice", from: myId, to: peerId, candidate: e.candidate.toJSON() });
      };
      pc.ontrack = (e) => {
        let audio = audioElsRef.current.get(peerId);
        if (!audio) {
          audio = new Audio();
          audio.autoplay = true;
          audio.setAttribute("playsinline", "true");
          audioElsRef.current.set(peerId, audio);
        }
        audio.srcObject = e.streams[0];
        audio.play().catch(() => {});
      };
      pc.onconnectionstatechange = () => {
        setConnected((prev) => {
          const next = new Set(prev);
          if (pc!.connectionState === "connected") next.add(peerId);
          else if (["failed", "disconnected", "closed"].includes(pc!.connectionState))
            next.delete(peerId);
          return next;
        });
      };
      return pc;
    },
    [channel, myId],
  );

  const callPeer = React.useCallback(
    async (peerId: string) => {
      const pc = ensurePc(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      channel.send({ kind: "offer", from: myId, to: peerId, sdp: offer });
    },
    [channel, ensurePc, myId],
  );

  // Init: get mic, say hello, initiate offers to peers whose id > mine (deterministic)
  React.useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        localStreamRef.current = stream;
        channel.send({ kind: "hello", from: myId });
        for (const p of peers) {
          if (myId < p) {
            void callPeer(p);
          } else {
            ensurePc(p);
          }
        }
      } catch (e) {
        toast.error("Microfone bloqueado: " + (e as Error).message);
        onLeave();
      }
    })();

    const off = channel.onSignal(async (p) => {
      if (p.kind === "hello") {
        if (p.from === myId) return;
        if (myId < p.from) void callPeer(p.from);
        else ensurePc(p.from);
        return;
      }
      if (p.to !== myId) return;
      const pc = ensurePc(p.from);
      if (p.kind === "offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({ kind: "answer", from: myId, to: p.from, sdp: answer });
      } else if (p.kind === "answer") {
        await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
      } else if (p.kind === "ice") {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(p.candidate));
        } catch {
          /* ignore */
        }
      }
    });

    return () => {
      disposed = true;
      off();
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      audioElsRef.current.forEach((a) => {
        try {
          a.pause();
          a.srcObject = null;
        } catch {
          /* ignore */
        }
      });
      audioElsRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = () => {
    const s = localStreamRef.current;
    if (!s) return;
    const enabled = !muted;
    s.getAudioTracks().forEach((t) => (t.enabled = !enabled));
    setMuted(enabled);
  };

  return (
    <div className="rounded-2xl border border-primary/30 bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">
          🎙 Chamada de áudio ao vivo
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {connected.size}/{peers.length} conectados
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={toggleMute}>
            {muted ? "Ativar mic" : "Silenciar"}
          </Button>
          <Button size="sm" variant="destructive" onClick={onLeave}>
            Encerrar
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Áudio ao vivo entre participantes. A tradução falada continua tocando em paralelo.
      </p>
    </div>
  );
}

// ---------- Combined call panel ----------

export type CallMode = "none" | "audio" | "video";

interface CallPanelProps {
  mode: CallMode;
  code: string;
  myId: string;
  userName: string;
  peers: string[];
  onLeave: () => void;
  channel: AudioP2PProps["channel"];
  isHost?: boolean;
  sharedVideoUrl?: string | null;
  onVideoUrlReady?: (url: string) => void;
}

export function CallPanel(props: CallPanelProps) {
  if (props.mode === "none") return null;
  if (props.mode === "video") {
    return (
      <DailyVideoCall
        code={props.code}
        userName={props.userName}
        onLeave={props.onLeave}
        isHost={props.isHost ?? true}
        sharedUrl={props.sharedVideoUrl ?? null}
        onUrlReady={props.onVideoUrlReady}
      />
    );
  }
  return (
    <AudioCallP2P
      myId={props.myId}
      peers={props.peers}
      onLeave={props.onLeave}
      channel={props.channel}
    />
  );
}

export function CallModeSelector({
  mode,
  onChange,
  disabled,
}: {
  mode: CallMode;
  onChange: (m: CallMode) => void;
  disabled?: boolean;
}) {
  const opts: Array<{ id: CallMode; label: string; hint: string }> = [
    { id: "none", label: "Sem chamada", hint: "Só tradução por microfone" },
    { id: "audio", label: "🎙 Só áudio", hint: "Grátis · P2P" },
    { id: "video", label: "📹 Vídeo HD", hint: "Daily.co" },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => (
        <button
          key={o.id}
          disabled={disabled}
          onClick={() => onChange(o.id)}
          className={
            "flex-1 min-w-[110px] rounded-lg border px-3 py-2 text-left text-xs transition disabled:opacity-50 " +
            (mode === o.id
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background hover:border-primary/40")
          }
        >
          <div className="font-semibold">{o.label}</div>
          <div className="text-[10px] text-muted-foreground">{o.hint}</div>
        </button>
      ))}
    </div>
  );
}
