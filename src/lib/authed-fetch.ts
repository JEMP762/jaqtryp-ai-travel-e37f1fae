import { supabase } from "@/integrations/supabase/client";

/**
 * Build headers including the current Supabase session bearer token for
 * authenticated calls to our own /api/* server routes.
 */
export async function authedJsonHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}
