// Server-only helper: validate the request's Authorization: Bearer <jwt>
// against Supabase Auth. Use in server routes (createFileRoute server handlers)
// where you can't attach the `requireSupabaseAuth` server-fn middleware.
import { createClient } from "@supabase/supabase-js";

export async function requireAuthFromRequest(
  request: Request,
): Promise<{ ok: true; userId: string } | { ok: false; response: Response }> {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Auth not configured" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    };
  }

  const authHeader = request.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    };
  }
  return { ok: true, userId: String(data.claims.sub) };
}
