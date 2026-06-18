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

function readUrlError(): string | null {
  if (typeof window === "undefined") return null;
  const qs = new URLSearchParams(window.location.search);
  const hs = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const desc =
    qs.get("error_description") ||
    hs.get("error_description") ||
    qs.get("error") ||
    hs.get("error");
  return desc ? decodeURIComponent(desc).replace(/\+/g, " ") : null;
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

    // Erro vindo do Supabase (ex.: otp_expired) no query/hash
    const urlErr = readUrlError();
    if (urlErr) {
      setInvalidMsg(urlErr);
      setStatus("invalid");
      return;
    }

    // O cliente Supabase tem detectSessionInUrl=true e processa
    // automaticamente ?code=... (PKCE) e #access_token=... (hash).
    // Aqui só ouvimos o resultado para liberar o formulário.
    const sub = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setStatus("ready");
        // Limpa a URL para evitar reuso ao recarregar
        if (window.location.search || window.location.hash) {
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    });

    // Se já existe sessão (usuário voltou para a aba), libera direto.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setStatus("ready");
      }
    });

    // Janela maior para o detectSessionInUrl concluir o exchange
    timer = setTimeout(() => {
      if (cancelled) return;
      setStatus((s) => (s === "checking" ? "invalid" : s));
    }, 4000);

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
