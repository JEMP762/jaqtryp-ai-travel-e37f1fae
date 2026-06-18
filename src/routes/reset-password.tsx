import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

type Status = "checking" | "ready" | "invalid";

function authParams() {
  if (typeof window === "undefined") return null;
  const qs = new URLSearchParams(window.location.search);
  const hs = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return {
    error: qs.get("error_description") || hs.get("error_description") || qs.get("error") || hs.get("error"),
    code: qs.get("code"),
    tokenHash: qs.get("token_hash") || hs.get("token_hash"),
    token: qs.get("token") || hs.get("token"),
    accessToken: hs.get("access_token") || qs.get("access_token"),
    refreshToken: hs.get("refresh_token") || qs.get("refresh_token"),
    type: hs.get("type") || qs.get("type"),
  };
}

function recoveryErrorMessage(message?: string | null) {
  const normalized = (message || "").toLowerCase();
  if (normalized.includes("expired") || normalized.includes("invalid") || normalized.includes("otp")) {
    return "Esse link de recuperação expirou, já foi usado ou é inválido. Solicite um novo link.";
  }
  return "Não foi possível validar esse link de recuperação. Solicite um novo link.";
}

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>("checking");
  const [invalidMsg, setInvalidMsg] = React.useState<string>(
    "Esse link de recuperação é inválido ou já foi usado. Solicite um novo.",
  );

  React.useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const markReady = () => {
      if (cancelled) return;
      setStatus("ready");
      if (window.location.search || window.location.hash) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    };

    const markInvalid = (message?: string | null) => {
      if (cancelled) return;
      setInvalidMsg(recoveryErrorMessage(message));
      setStatus("invalid");
    };

    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        markReady();
      }
    });

    const validateRecoveryLink = async () => {
      if (cancelled) return;
      const params = authParams();
      if (params?.error) {
        markInvalid(params.error);
        return;
      }

      if (params?.accessToken && params.refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        });
        if (sessionError) {
          markInvalid(sessionError.message);
          return;
        }
        markReady();
        return;
      }

      if ((params?.tokenHash || params?.token) && params.type === "recovery") {
        const { error: verifyError } = await supabase.auth.verifyOtp(
          params.tokenHash
            ? { token_hash: params.tokenHash, type: "recovery" }
            : { token: params.token!, type: "recovery" },
        );
        if (verifyError) {
          markInvalid(verifyError.message);
          return;
        }
        markReady();
        return;
      }

      if (params?.code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (exchangeError) {
          const { data } = await supabase.auth.getSession();
          if (data.session) markReady();
          else markInvalid(exchangeError.message);
          return;
        }
        markReady();
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) markReady();
    };

    validateRecoveryLink().catch((err) => markInvalid(err instanceof Error ? err.message : null));

    timer = setTimeout(() => {
      if (cancelled) return;
      setStatus((s) => {
        if (s !== "checking") return s;
        setInvalidMsg("Esse link de recuperação não contém uma sessão válida. Solicite um novo link.");
        return "invalid";
      });
    }, 8000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      sub.data.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      toast.success("Senha atualizada com sucesso!");
      nav({ to: "/dashboard" });
    }
  };

  return (
    <AuthShell
      title="Redefinir senha"
      footer={
        <Link to="/login" className="text-primary hover:underline">
          Voltar para login
        </Link>
      }
    >
      {status === "checking" ? (
        <p className="text-sm text-muted-foreground">Validando link...</p>
      ) : status === "invalid" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{invalidMsg}</p>
          <p className="text-sm">
            Solicite um novo link em{" "}
            <Link
              to="/forgot-password"
              className="text-primary hover:underline"
            >
              recuperar senha
            </Link>
            .
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="password">Nova senha</Label>
            <PasswordInput
              id="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm">Confirmar senha</Label>
            <PasswordInput
              id="confirm"
              required
              minLength={8}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-primary shadow-glow"
          >
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
