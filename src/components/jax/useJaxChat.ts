import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { contextualSuggestions } from "@/lib/jax/knowledge";

export type JaxMsg = { role: "user" | "assistant"; content: string };

const CONV_KEY = "jax_conversation_id";

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const period = h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
  return name ? `${period}, ${name}! Como posso ajudar você hoje?` : `${period}! Como posso ajudar você hoje?`;
}

async function authHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

export function useJaxChat(pagePath: string, userName?: string | null) {
  const [messages, setMessages] = React.useState<JaxMsg[]>([]);
  const [typing, setTyping] = React.useState(false);
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const convRef = React.useRef<string | null>(null);
  const loadedRef = React.useRef(false);

  // Carrega (ou cria) a conversa persistida do usuário.
  React.useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const stored = typeof window !== "undefined" ? window.localStorage.getItem(CONV_KEY) : null;
        let convId = stored;

        if (convId) {
          const { data } = await supabase
            .from("jax_conversations")
            .select("id")
            .eq("id", convId)
            .maybeSingle();
          if (!data) convId = null;
        }

        if (!convId) {
          const { data: userRes } = await supabase.auth.getUser();
          const uid = userRes.user?.id;
          if (!uid) throw new Error("no user");
          const { data, error: insErr } = await supabase
            .from("jax_conversations")
            .insert({ user_id: uid, title: "Conversa com JAX" })
            .select("id")
            .single();
          if (insErr) throw insErr;
          convId = data.id;
          if (typeof window !== "undefined") window.localStorage.setItem(CONV_KEY, convId);
        }

        convRef.current = convId;

        const { data: rows } = await supabase
          .from("jax_messages")
          .select("role, content")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true })
          .limit(60);

        if (cancelled) return;
        const history = (rows ?? []).map((r) => ({
          role: r.role as "user" | "assistant",
          content: r.content,
        }));
        setMessages(
          history.length
            ? history
            : [{ role: "assistant", content: greeting(userName ?? undefined) }],
        );
      } catch {
        if (!cancelled)
          setMessages([{ role: "assistant", content: greeting(userName ?? undefined) }]);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userName]);

  const send = React.useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming || typing) return;
      setError(null);
      const next: JaxMsg[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setTyping(true);

      // Humanização: pequena pausa variável antes de começar a responder.
      await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

      try {
        const resp = await fetch("/api/jax", {
          method: "POST",
          headers: await authHeaders(),
          body: JSON.stringify({
            messages: next.filter((_, i) => i > 0 || next[0]?.role === "user"),
            conversationId: convRef.current,
            pagePath,
            userName: userName ?? undefined,
          }),
        });

        const ct = resp.headers.get("content-type") || "";

        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}) as { error?: string });
          setTyping(false);
          setError(data.error || "Não consegui responder agora. Tente novamente.");
          return;
        }

        if (ct.includes("application/json")) {
          const data = (await resp.json()) as { text?: string };
          setTyping(false);
          setMessages((prev) => [...prev, { role: "assistant", content: data.text || "" }]);
          return;
        }

        if (!resp.body) {
          setTyping(false);
          setError("Resposta vazia. Tente novamente.");
          return;
        }

        setTyping(false);
        setStreaming(true);
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let done = false;
        const append = (chunk: string) =>
          setMessages((prev) => {
            const copy = [...prev];
            const lastIdx = copy.length - 1;
            if (lastIdx >= 0 && copy[lastIdx].role === "assistant") {
              copy[lastIdx] = { role: "assistant", content: copy[lastIdx].content + chunk };
            }
            return copy;
          });

        while (!done) {
          const r = await reader.read();
          if (r.done) break;
          buffer += decoder.decode(r.value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line || line.startsWith(":") || !line.startsWith("data: ")) continue;
            const json = line.slice(6).trim();
            if (json === "[DONE]") {
              done = true;
              break;
            }
            try {
              const parsed = JSON.parse(json);
              const c = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (c) append(c);
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }
      } catch (e) {
        console.error(e);
        setError("Falha de conexão. Tente novamente.");
      } finally {
        setTyping(false);
        setStreaming(false);
      }
    },
    [messages, pagePath, streaming, typing, userName],
  );

  const clear = React.useCallback(async () => {
    const convId = convRef.current;
    setMessages([{ role: "assistant", content: greeting(userName ?? undefined) }]);
    setError(null);
    if (convId) {
      await supabase.from("jax_messages").delete().eq("conversation_id", convId);
    }
  }, [userName]);

  const suggestions = React.useMemo(() => contextualSuggestions(pagePath), [pagePath]);

  return { messages, typing, streaming, error, ready, send, clear, suggestions };
}
