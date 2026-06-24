import * as React from "react";
import { Bluetooth, Loader2, Play, Square, Timer, Coins } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { spendForFeature } from "@/lib/credits.functions";

const TIERS = [
  { minutes: 5,  credits: 5,  key: "bt_translate_5min"  },
  { minutes: 15, credits: 12, key: "bt_translate_15min" },
  { minutes: 30, credits: 20, key: "bt_translate_30min" },
  { minutes: 60, credits: 35, key: "bt_translate_60min" },
] as const;

type Tier = (typeof TIERS)[number];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function BluetoothTranslatorSession({ open, onClose }: Props) {
  const [phase, setPhase] = React.useState<"choose" | "running" | "ended">("choose");
  const [tier, setTier] = React.useState<Tier | null>(null);
  const [remaining, setRemaining] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [balance, setBalance] = React.useState<number | null>(null);
  const startRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!open) {
      setPhase("choose");
      setTier(null);
      setRemaining(0);
    }
  }, [open]);

  React.useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      setRemaining((r) => {
        const n = r - 1;
        if (n === 60) toast.message("⏱️ Restando 1 minuto", { description: "A sessão será encerrada em breve." });
        if (n <= 0) {
          clearInterval(id);
          setPhase("ended");
          return 0;
        }
        return n;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const start = async (t: Tier) => {
    setBusy(true);
    try {
      const res = await spendForFeature({ data: { featureKey: t.key } });
      if (!res.ok) {
        if (res.reason === "insufficient") {
          toast.error(`Créditos insuficientes`, {
            description: `Precisa de ${(res as any).needed} cr, você tem ${(res as any).have}.`,
          });
        } else {
          toast.error("Não foi possível iniciar a sessão");
        }
        return;
      }
      setTier(t);
      setBalance((res as any).balance);
      setRemaining(t.minutes * 60);
      startRef.current = Date.now();
      setPhase("running");
      toast.success(`Sessão iniciada · ${t.minutes} min`, { description: `${t.credits} créditos debitados` });
    } catch (e: any) {
      toast.error(e?.message || "Erro ao iniciar");
    } finally {
      setBusy(false);
    }
  };

  const stop = () => {
    setPhase("ended");
  };

  const elapsedSec = tier ? tier.minutes * 60 - remaining : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        {phase === "choose" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Bluetooth className="h-5 w-5 text-primary" /> Tradução Bluetooth ao vivo
              </DialogTitle>
              <DialogDescription>
                Escolha a duração da sessão. A cobrança é feita por bloco no início.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              {TIERS.map((t) => (
                <button
                  key={t.key}
                  disabled={busy}
                  onClick={() => start(t)}
                  className="rounded-xl border border-border bg-card/60 p-4 text-left transition hover:border-primary/60 hover:bg-primary/5 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">{t.minutes} min</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                      <Coins className="h-3 w-3" /> {t.credits}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    ≈ {(t.credits / t.minutes).toFixed(2)} cr/min
                  </p>
                </button>
              ))}
            </div>
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Debitando créditos…
              </div>
            )}
          </>
        )}

        {phase === "running" && tier && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-primary" /> Sessão em andamento
              </DialogTitle>
              <DialogDescription>
                Tradução ao vivo ativa. {tier.credits} créditos já debitados.
              </DialogDescription>
            </DialogHeader>
            <div className="my-4 text-center">
              <div className="text-5xl font-black tabular-nums text-gradient">
                {formatTime(remaining)}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">restantes</div>
            </div>
            <Button onClick={stop} variant="destructive" className="w-full gap-2">
              <Square className="h-4 w-4" /> Encerrar sessão
            </Button>
          </>
        )}

        {phase === "ended" && tier && (
          <>
            <DialogHeader>
              <DialogTitle>Sessão encerrada</DialogTitle>
              <DialogDescription>Resumo do consumo:</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-xl border border-border bg-card/60 p-4 text-sm">
              <Row label="Tempo contratado" value={`${tier.minutes} min`} />
              <Row label="Tempo utilizado" value={formatTime(elapsedSec)} />
              <Row label="Créditos consumidos" value={`${tier.credits} cr`} />
              {balance !== null && <Row label="Saldo restante" value={`${balance} cr`} />}
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPhase("choose")}>
                Nova sessão
              </Button>
              <Button className="flex-1" onClick={onClose}>
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function BluetoothTranslatorButton() {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline" className="gap-2">
        <Bluetooth className="h-4 w-4" /> Tradução Bluetooth ao vivo
      </Button>
      <BluetoothTranslatorSession open={open} onClose={() => setOpen(false)} />
    </>
  );
}
