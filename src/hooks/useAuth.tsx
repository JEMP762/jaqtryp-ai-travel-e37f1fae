import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  user: User | null;
  session: Session | null;
  /** true enquanto a sessão ainda não foi lida do armazenamento local */
  loading: boolean;
  /** alias explícito de `loading` — "ainda não sabemos se há sessão" */
  initializing: boolean;
};

const Ctx = React.createContext<AuthState>({
  user: null,
  session: null,
  loading: true,
  initializing: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [initializing, setInitializing] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!mounted) return;
      // Nunca zeramos a sessão por falha transitória de renovação de token.
      // Só saímos quando o Supabase confirma o logout.
      if (!next && event !== "SIGNED_OUT" && event !== "USER_UPDATED") {
        if (event === "INITIAL_SESSION") setInitializing(false);
        return;
      }
      setSession(next);
      setInitializing(false);
    });

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session) setSession(data.session);
        setInitializing(false);
      })
      .catch(() => {
        if (mounted) setInitializing(false);
      });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = React.useMemo<AuthState>(
    () => ({
      user: session?.user ?? null,
      session,
      loading: initializing,
      initializing,
    }),
    [session, initializing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return React.useContext(Ctx);
}
