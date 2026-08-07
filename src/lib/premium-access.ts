import { supabase } from "@/integrations/supabase/client";

/**
 * Verificação de acesso premium no navegador.
 *
 * A função `has_premium_access` só pode ser executada pelo papel
 * `authenticated`. Se a sessão estiver ausente ou expirada, a chamada chega ao
 * banco como `anon` e retorna "permission denied", poluindo os logs e fazendo
 * as telas tratarem o usuário como não-premium.
 *
 * Aqui garantimos que existe um token válido antes de chamar a RPC e, se o
 * token estiver vencido, tentamos renovar uma única vez.
 *
 * Retorna `null` quando não foi possível determinar (sem sessão ou erro),
 * para que a UI possa manter o estado anterior em vez de negar acesso.
 */
export async function checkPremiumAccessClient(userId?: string): Promise<boolean | null> {
  try {
    let { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;

    const expired =
      !!session?.expires_at && session.expires_at * 1000 <= Date.now() + 5_000;

    if (!session || expired) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      session = refreshed.session ?? null;
    }

    if (!session?.user) return null;

    const uid = userId ?? session.user.id;
    const { data, error } = await supabase.rpc("has_premium_access", { user_uuid: uid });
    if (error) return null;
    return data === true;
  } catch {
    return null;
  }
}
