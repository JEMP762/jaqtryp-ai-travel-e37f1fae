import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
});

const SENDER = "contact@jaqtryp.com";
const RESEND_SECONDS = 60;

type Mode = "reset" | "magic";

function friendlyAuthError(message?: string | null) {
  const m = (message || "").toLowerCase();
  if (m.includes("rate limit") || m.includes("too many") || m.includes("429")) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (m.includes("invalid") && m.includes("email")) {
    return "E-mail inválido. Confira o endereço digitado.";
  }
  if (m.includes("smtp") || m.includes("send") || m.includes("email")) {
    return "Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.";
  }
  return message || "Não foi possível enviar o e-mail. Tente novamente.";
}

function ForgotPasswordPage() {
  const [mode, setMode] = React.useState<Mode>("reset");
  const [email, setEmail] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const qs = new URLSearchParams(window.location.search);
    if (qs.get("mode") === "magic") setMode("magic");
  }, []);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const send = async () => {
    if (!email) return;
    setLoading(true);
    let errorMessage: string | null = null;

    if (mode === "reset") {
      // Garante que não há sessão antiga interferindo com o link de recuperação
      await supabase.auth.signOut().catch(() => {});
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      errorMessage = error?.message ?? null;
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/reset-password`,
          shouldCreateUser: false,
        },
      });
      errorMessage = error?.message ?? null;
    }

    setLoading(false);
    if (errorMessage) {
      toast.error(friendlyAuthError(errorMessage));
      return;
    }
    setSent(true);
    setCooldown(RESEND_SECONDS);
    toast.success(mode === "reset" ? "E-mail de recuperação enviado!" : "Link de acesso enviado!");
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void send();
  };

  return (
    <AuthShell
      title="Recuperar acesso"
      footer={
        <>
          Lembrou?{" "}
          <Link to="/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enviamos um link para <strong>{email}</strong>. O remetente é{" "}
            <strong>{SENDER}</strong> — verifique a caixa de entrada e também a pasta de{" "}
            <strong>spam / promoções</strong>. O link vale por 1 hora.
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={loading || cooldown > 0}
            onClick={() => void send()}
          >
            {cooldown > 0 ? `Reenviar link em ${cooldown}s` : "Reenviar link"}
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link to="/login">Voltar para login</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("reset")}
              className={`rounded-md px-3 py-2 transition ${
                mode === "reset" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
              }`}
            >
              Redefinir senha
            </button>
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`rounded-md px-3 py-2 transition ${
                mode === "magic" ? "bg-background shadow-sm font-medium" : "text-muted-foreground"
              }`}
            >
              Link mágico
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            {mode === "reset"
              ? "Informe seu e-mail e enviaremos um link para você criar uma nova senha."
              : "Informe seu e-mail e enviaremos um link de acesso direto — depois você pode definir uma nova senha nas configurações."}
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            O e-mail chega de <strong>{SENDER}</strong>. Se não aparecer em alguns minutos, confira o
            spam.
          </p>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-primary shadow-glow"
          >
            {loading ? "Enviando..." : mode === "reset" ? "Enviar link de recuperação" : "Enviar link de acesso"}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
