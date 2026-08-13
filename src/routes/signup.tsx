import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { applyReferralCode } from "@/lib/referrals.functions";

export const Route = createFileRoute("/signup")({
  component: SignupPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { intent?: string; ref?: string } => ({
    intent: typeof search.intent === "string" ? search.intent : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
});

const REF_STORAGE_KEY = "jq_pending_ref";

function SignupPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const nav = useNavigate();
  const search = Route.useSearch();
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [googleLoading, setGoogleLoading] = React.useState(false);

  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Persist ?ref= for signup flows that pass through Google OAuth
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (search.ref) {
      window.sessionStorage.setItem(REF_STORAGE_KEY, search.ref);
    }
  }, [search.ref]);

  const consumeRefAndApply = React.useCallback(async () => {
    if (typeof window === "undefined") return;
    const code = window.sessionStorage.getItem(REF_STORAGE_KEY);
    if (!code) return;
    try {
      const res = await applyReferralCode({ data: { code } });
      if ((res as any)?.ok) toast.success("Código de indicação aplicado!");
    } catch {
      /* ignore */
    } finally {
      window.sessionStorage.removeItem(REF_STORAGE_KEY);
    }
  }, []);

  React.useEffect(() => {
    if (user) {
      consumeRefAndApply().finally(() => nav({ to: "/dashboard" }));
    }
  }, [user, nav, consumeRefAndApply]);

  const friendlyError = (err: any): string => {
    const code = err?.code || err?.error_code;
    const msg = err?.message || "";
    if (code === "weak_password" || /weak|pwned|leaked/i.test(msg))
      return "Esta senha é muito fraca ou apareceu em vazamentos públicos. Use uma senha forte com letras, números e símbolos (mín. 8 caracteres).";
    if (code === "user_already_exists" || /already registered|already exists/i.test(msg))
      return "Já existe uma conta com este e-mail. Tente entrar.";
    if (/invalid.*email/i.test(msg)) return "E-mail inválido.";
    if (/password.*should be at least/i.test(msg)) return "Senha muito curta — use no mínimo 8 caracteres.";
    if (code === "unexpected_failure" || /database error saving new user|database error/i.test(msg))
      return "Não foi possível concluir o cadastro agora. Aguarde alguns segundos e tente novamente, ou use outro e-mail.";
    return msg || "Não foi possível criar sua conta. Tente novamente.";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (password.length < 8) {
      setErrorMsg("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: name },
      },
    });
    setLoading(false);
    if (error) {
      const msg = friendlyError(error);
      setErrorMsg(msg);
      toast.error(msg);
    } else {
      toast.success("Conta criada com sucesso!");
      await consumeRefAndApply();
      nav({ to: "/dashboard" });
    }
  };


  const onGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.redirected) return;
      if (result.error) {
        toast.error("Não foi possível entrar com o Google. Tente novamente.");
        return;
      }
      nav({ to: "/dashboard" });
    } catch {
      toast.error("Não foi possível entrar com o Google. Tente novamente.");
    } finally {
      setGoogleLoading(false);
    }
  };


  return (
    <AuthShell
      title={t("auth.signup.title")}
      footer={
        <div className="space-y-1 text-center">
          <div>
            {t("auth.have")}{" "}
            <Link to="/login" className="text-primary hover:underline">
              {t("auth.signin")}
            </Link>
          </div>
          <div className="text-xs text-muted-foreground">
            <Link to="/forgot-password" className="hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
        </div>
      }
    >
      <Button onClick={onGoogle} variant="outline" className="w-full">
        {t("auth.google")}
      </Button>
      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" /> {t("auth.or")}
        <div className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{t("auth.fullname")}</Label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <PasswordInput
            id="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Mínimo 8 caracteres. Evite senhas comuns ou já vazadas.
          </p>
        </div>
        {errorMsg && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-primary shadow-glow"
        >
          {loading ? t("common.loading") : t("auth.signup")}
        </Button>
      </form>
    </AuthShell>
  );
}
