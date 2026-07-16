import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  canRegisterPush,
  disablePushNotifications,
  enablePushNotifications,
  getCurrentPushPermission,
  getExistingSubscription,
  isPushSupported,
} from "@/lib/push-client";

type Status = "loading" | "unsupported" | "denied" | "off" | "on";

export function PushOptIn({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!isPushSupported() || !canRegisterPush()) {
        setStatus("unsupported");
        return;
      }
      const perm = await getCurrentPushPermission();
      if (perm === "denied") return setStatus("denied");
      const sub = await getExistingSubscription();
      setStatus(sub ? "on" : "off");
    })();
  }, []);

  async function enable() {
    setBusy(true);
    try {
      const res = await enablePushNotifications();
      if (res.ok) {
        setStatus("on");
        toast.success("Notificações ativadas");
      } else {
        toast.error(
          res.reason === "denied"
            ? "Permissão negada no navegador"
            : "Não foi possível ativar",
        );
      }
    } catch (e) {
      toast.error("Erro ao ativar notificações");
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      await disablePushNotifications();
      setStatus("off");
      toast.success("Notificações desativadas");
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading" || status === "unsupported") return null;

  if (compact) {
    if (status === "on") {
      return (
        <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
          <BellRing className="mr-2 h-4 w-4" /> Ativadas
        </Button>
      );
    }
    return (
      <Button variant="outline" size="sm" onClick={enable} disabled={busy || status === "denied"}>
        <Bell className="mr-2 h-4 w-4" />
        {status === "denied" ? "Bloqueadas" : "Ativar notificações"}
      </Button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      <div className="flex items-center gap-3">
        {status === "on" ? (
          <BellRing className="h-5 w-5 text-primary" />
        ) : status === "denied" ? (
          <BellOff className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Bell className="h-5 w-5 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">Notificações push</p>
          <p className="text-xs text-muted-foreground">
            {status === "on"
              ? "Você receberá alertas de tradução, roteiros e recompensas."
              : status === "denied"
                ? "Você bloqueou as notificações no navegador."
                : "Receba alertas quando algo importante acontecer."}
          </p>
        </div>
      </div>
      {status === "on" ? (
        <Button variant="ghost" size="sm" onClick={disable} disabled={busy}>
          Desativar
        </Button>
      ) : (
        <Button size="sm" onClick={enable} disabled={busy || status === "denied"}>
          Ativar
        </Button>
      )}
    </div>
  );
}
