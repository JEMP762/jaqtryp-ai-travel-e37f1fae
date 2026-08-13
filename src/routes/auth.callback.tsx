import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallback,
  head: () => ({
    meta: [
      { title: "Entrando… — Jaqtryp AI" },
      { name: "description", content: "Finalizando o seu acesso ao Jaqtryp AI." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Entrando… — Jaqtryp AI" },
      { property: "og:description", content: "Finalizando o seu acesso ao Jaqtryp AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const DEST_KEY = "jq_post_login_dest";

function AuthCallback() {
  const nav = useNavigate();
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let done = false;

    const go = () => {
      if (done) return;
      done = true;
      let dest = "/dashboard";
      try {
        const saved = window.sessionStorage.getItem(DEST_KEY);
        if (saved && saved.startsWith("/") && !saved.startsWith("//")) dest = saved;
        window.sessionStorage.removeItem(DEST_KEY);
      } catch {
        /* ignore */
      }
      nav({ to: dest, replace: true });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) go();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) go();
    });

    const timeout = window.setTimeout(async () => {
      if (done) return;
      const { data } = await supabase.auth.getSession();
      if (data.session) go();
      else setFailed(true);
    }, 6000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, [nav]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-6 text-center">
      {failed ? (
        <div className="space-y-3">
          <h1 className="text-lg font-semibold">Não conseguimos concluir o login</h1>
          <p className="text-sm text-muted-foreground">
            Tente novamente pela tela de entrada.
          </p>
          <button
            onClick={() => nav({ to: "/login", replace: true })}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Voltar para o login
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Entrando…</p>
        </div>
      )}
    </div>
  );
}
