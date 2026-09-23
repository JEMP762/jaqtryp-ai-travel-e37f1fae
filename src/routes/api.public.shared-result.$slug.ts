import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/shared-result/$slug")({
  server: { handlers: { GET: async ({ params }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return new Response(JSON.stringify({ error: "unavailable" }), { status: 500 });
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await client.from("shared_results").select("slug,kind,title,summary,public_payload,created_at").eq("slug", params.slug).eq("active", true).maybeSingle();
    if (error || !data) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { "content-type": "application/json" } });
    return new Response(JSON.stringify(data), { headers: { "content-type": "application/json", "cache-control": "public, max-age=60" } });
  } } },
});