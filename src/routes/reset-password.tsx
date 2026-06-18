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

function ResetPasswordPage() {
  const nav = useNavigate();
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>("checking");
  const [invalidMsg, setInvalidMsg] = React.useState<string>(
    "Link inválido ou expirado.",
  );

  React.useEffect(() => {
    let cancelled = false;

    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (!cancelled) setStatus("ready");
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errDesc =
          url.searchParams.get("error_description") ||
          new URLSearchParams(window.location.hash.replace(/^#/, "")).get(
            "error_description",
          );

        if (errDesc) {
          if (!cancelled) {
            setInvalidMsg(decodeURIComponent(errDesc));
            setStatus("invalid");
          }
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          // Limpa o code da URL (evita reuso ao recarregar)
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.pathname + url.search);
          if (cancelled) return;
          if (error) {
            setInvalidMsg(error.message || "Link inválido ou expirado.");
            setStatus("invalid");
          } else {
            setStatus("ready");
          }
          return;
        }

        // Fallback: link antigo via hash (#access_token=...) ou sessão já ativa
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          setStatus("ready");
        } else {
          // Pequena janela para o onAuthStateChange disparar (hash flow)
          setTimeout(() => {
            if (cancelled) return;
            setStatus((s) => (s === "checking" ? "invalid" : s));
          }, 1500);
        }
      } catch (e: any) {
        if (!cancelled) {
          setInvalidMsg(e?.message || "Link inválido ou expirado.");
          setStatus("invalid");
        }
      }
    })();

    return () => {
      cancelled = true;
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
