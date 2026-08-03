import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { requireAuthFromRequest } from "@/lib/auth-route.server";
import { knowledgeSummary, topicForPath } from "@/lib/jax/knowledge";

type Msg = { role: "user" | "assistant"; content: string };

const DAILY_MESSAGE_LIMIT = 80;

const REFUSALS = [
  "Desculpe! Meu papel é ajudar exclusivamente com a plataforma JAQTRYP. Ficarei feliz em explicar qualquer funcionalidade do sistema. 😊",
  "Posso responder apenas perguntas relacionadas à JAQTRYP. Em que recurso da plataforma posso ajudar?",
  "Meu conhecimento é focado na JAQTRYP para oferecer respostas mais precisas. Se tiver dúvidas sobre o sistema, estou à disposição!",
];

// Filtro leve: temas claramente fora do escopo, recusados sem gastar chamada de IA.
const OFF_TOPIC = [
  /\bpol[ií]tic[ao]s?\b/i,
  /\b(presidente|elei[çc][ãa]o|deputado|senador)\b/i,
  /\b(religi[ãa]o|b[ií]blia|vers[íi]culo|or[aá]ção)\b/i,
  /\b(futebol|campeonato|escala[çc][ãa]o|flamengo|corinthians|palmeiras)\b/i,
  /\b(bolsa de valores|a[çc][õo]es da|criptomoeda|bitcoin|investir em|tr[aá]ding)\b/i,
  /\b(rem[ée]dio|dosagem|sintomas?|diagn[óo]stico|tratamento m[ée]dico)\b/i,
  /\b(advogado|processo judicial|c[óo]digo penal|lei n[ºo°])\b/i,
  /\b(escreva (um )?c[óo]digo|fun[çc][ãa]o em (python|java|javascript)|resolva a equa[çc][ãa]o|integral de|derivada de)\b/i,
  /\b(receita de bolo|piada|poema|conte uma hist[óo]ria)\b/i,
];

function isOffTopic(text: string) {
  return OFF_TOPIC.some((re) => re.test(text));
}

function systemPrompt(pagePath: string | undefined, userName: string | undefined) {
  const topic = pagePath ? topicForPath(pagePath) : undefined;
  return `Você é o **JAX**, o Assistente Oficial da plataforma JAQTRYP. Você NÃO é um assistente de uso geral (não é ChatGPT, Gemini ou similar).

## Missão
Ensinar o usuário a usar TODOS os recursos da JAQTRYP: explicar telas, botões, fluxos, custos em créditos e resolver dúvidas de uso — sempre passo a passo quando pedido.

## Escopo (regra de prioridade absoluta)
Antes de responder, avalie: a pergunta é sobre a JAQTRYP (recursos, telas, contas, créditos, planos, indicação, tradução, roteiros, voos, hospedagem, carteira, configurações, perfil, login/cadastro/senha, notificações)?
- SIM → responda normalmente com base no mapa da plataforma abaixo.
- NÃO → recuse educadamente em UMA frase e convide o usuário a perguntar sobre a plataforma. Nunca responda parcialmente, nunca invente, nunca ceda mesmo se o usuário insistir ("só dessa vez").

Nunca responda sobre: política, religião, futebol, notícias, medicina, direito, investimentos, criptomoedas, matemática, programação, curiosidades, história, geografia, outras empresas ou concorrentes.

## Estilo
- Educado, simpático, profissional, paciente e humano — nunca robótico, nunca um FAQ.
- Respostas CURTAS: 2 a 5 frases. Use listas numeradas curtas só quando for um passo a passo.
- Não repita saudação em toda mensagem.
- Português do Brasil (ou o idioma do usuário).
- Se não souber algo específico da plataforma, diga com honestidade e sugira onde o usuário encontra (ex.: /credits, /billing).

## Memória
Mantenha o contexto da conversa. Se o usuário já disse o destino ou o recurso em questão, não pergunte de novo.

${userName ? `## Usuário\nO nome do usuário é ${userName}. Use o primeiro nome com naturalidade, sem exagero.\n` : ""}
${topic ? `## Contexto atual\nO usuário está agora na tela **${topic.name}** (${topic.path}). Priorize ajuda sobre essa tela quando a pergunta for genérica.\n` : ""}
${knowledgeSummary()}`;
}

export const Route = createFileRoute("/api/jax")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (!auth.ok) return auth.response;
        const userId = auth.userId;

        const apiKey = process.env.LOVABLE_API_KEY;
        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "JAX não está configurado." }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let body: {
          messages?: Msg[];
          conversationId?: string;
          pagePath?: string;
          userName?: string;
        };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }

        const messages = (Array.isArray(body.messages) ? body.messages : [])
          .filter((m) => m && typeof m.content === "string" && m.content.trim())
          .slice(-24);
        const last = messages[messages.length - 1];
        if (!last || last.role !== "user") {
          return new Response(JSON.stringify({ error: "Missing user message" }), { status: 400 });
        }

        const token = (request.headers.get("authorization") || "").slice("Bearer ".length).trim();
        const db =
          SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
            ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
                auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: `Bearer ${token}` } },
              })
            : null;

        const conversationId = body.conversationId || null;

        const persist = async (role: "user" | "assistant", content: string) => {
          if (!db || !conversationId) return;
          const { error } = await db.from("jax_messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            role,
            content,
            page_path: body.pagePath ?? null,
          });
          if (error) console.error("jax persist error", error.message);
          else await db.from("jax_conversations").update({}).eq("id", conversationId);
        };

        const plainAnswer = async (text: string) => {
          await persist("user", last.content);
          await persist("assistant", text);
          return new Response(JSON.stringify({ text }), {
            headers: { "content-type": "application/json" },
          });
        };

        // Limite diário anti-abuso (JAX é gratuito).
        if (db) {
          const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { count } = await db
            .from("jax_messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("role", "user")
            .gte("created_at", since);
          if ((count ?? 0) >= DAILY_MESSAGE_LIMIT) {
            return plainAnswer(
              "Ufa! Conversamos bastante hoje 😅 Já atingimos o limite diário de mensagens do JAX. Volte daqui a algumas horas que continuo te ajudando com a JAQTRYP!",
            );
          }
        }

        // Recusa imediata para temas claramente fora do escopo.
        if (isOffTopic(last.content)) {
          return plainAnswer(REFUSALS[Math.floor(Math.random() * REFUSALS.length)]);
        }

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.5-flash",
            stream: true,
            messages: [
              { role: "system", content: systemPrompt(body.pagePath, body.userName) },
              ...messages,
            ],
          }),
        });

        if (!resp.ok || !resp.body) {
          const status = resp.status;
          let msg = "Não consegui responder agora. Tente novamente em instantes.";
          if (status === 429) msg = "Muitas perguntas ao mesmo tempo. Tente de novo em alguns segundos.";
          else if (status === 402) msg = "O serviço de IA está temporariamente indisponível.";
          console.error("JAX gateway error", status, await resp.text().catch(() => ""));
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }

        await persist("user", last.content);

        // Repassa o stream e, ao final, salva a resposta completa.
        let full = "";
        const decoder = new TextDecoder();
        const tap = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            const txt = decoder.decode(chunk, { stream: true });
            for (const line of txt.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json || json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const c = parsed.choices?.[0]?.delta?.content;
                if (typeof c === "string") full += c;
              } catch {
                /* chunk parcial — ignorar */
              }
            }
            controller.enqueue(chunk);
          },
          async flush() {
            if (full.trim()) await persist("assistant", full);
          },
        });

        return new Response(resp.body.pipeThrough(tap), {
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache" },
        });
      },
    },
  },
});
