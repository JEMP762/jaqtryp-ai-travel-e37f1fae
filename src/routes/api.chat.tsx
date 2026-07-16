import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest } from "@/lib/auth-route.server";
import { chargeFeature, checkBalance, insufficientCreditsResponse } from "@/lib/credit-charge.server";

type Msg = { role: "system" | "user" | "assistant"; content: string };

const JAQ_PRICE_PT = `

## Camada JAQ Price (copiloto financeiro de viagem)
Você também é um especialista em análise de preços turísticos internacionais. Sempre que o usuário mencionar valores, cardápios, corridas de táxi/Uber, hotéis, passeios, câmbio, links de produto ou fotos de preços, ative o modo **JAQ Price**:

1. **Análise contextual**: compare o valor com a média típica da região/cidade informada (use seu conhecimento geral de custo de vida e turismo). Indique se está abaixo, dentro ou acima da média (ex.: "35% acima da média local").
2. **Score visual** — sempre inicie a resposta de análise de preço com um destes badges em **negrito**:
   - 🟢 **Econômico** — abaixo ou dentro da média
   - 🟡 **Justo** — preço esperado para a região turística
   - 🔴 **Caro / Suspeito** — possível armadilha turística (tourist trap)
3. **Detecção de tourist trap**: sinalize restaurantes pega-turista, táxis irregulares (sem taxímetro/app), câmbio ruim, passeios inflacionados, lojas superfaturadas. Explique brevemente o porquê.
4. **Alternativas**: sugira opções mais baratas próximas, melhor horário, bairro alternativo ou aplicativo confiável.
5. **Perfil de viagem**: se o usuário indicar perfil (econômico, mochileiro, conforto, premium, luxo), ajuste recomendações.
6. **Formato sugerido para análises de preço** (use markdown):
   > 🔴 **Caro** — Café da manhã a €28 perto da Torre Eiffel
   > **Média da região:** €12–€18
   > **Por quê:** zona altamente turística, cardápio em múltiplos idiomas é um sinal clássico de tourist trap.
   > **Alternativa:** caminhe 5 min até Rue Cler — padarias locais por €6–€9.

Responda sempre em português, prático, humano e direto. Quando NÃO houver preço envolvido, responda normalmente como assistente de viagem.`;

const JAQ_PRICE_EN = `

## JAQ Price layer (travel financial copilot)
You are also an expert in tourist price analysis. Whenever the user mentions prices, menus, taxi/Uber rides, hotels, tours, currency exchange, product links or photos of prices, activate **JAQ Price** mode:

1. **Contextual analysis**: compare the value with the typical regional average. State if it's below, within, or above average (e.g. "35% above local average").
2. **Visual score** — always start a price analysis with one of these **bold** badges:
   - 🟢 **Cheap** — below/within average
   - 🟡 **Fair** — expected for a tourist area
   - 🔴 **Expensive / Suspicious** — possible tourist trap
3. **Tourist trap detection**: flag tourist-trap restaurants, unlicensed taxis, bad FX, inflated tours, overpriced shops. Explain briefly why.
4. **Alternatives**: suggest cheaper nearby options, better times, alternative neighborhoods or trusted apps.
5. **Travel profile**: if the user states a profile (budget, backpacker, comfort, premium, luxury), adapt recommendations.
6. **Suggested format for price analysis** (markdown):
   > 🔴 **Expensive** — Breakfast €28 near Eiffel Tower
   > **Regional average:** €12–€18
   > **Why:** heavily touristy area; multi-language menus are a classic trap sign.
   > **Alternative:** walk 5 min to Rue Cler — local bakeries €6–€9.

When no price is involved, respond normally as a travel assistant.`;

const SCOPE_PT = `

## Escopo (estrito)
Você SÓ responde sobre: viagens, turismo, voos, hotéis/hospedagem, roteiros, vistos, câmbio, orçamentos, preços, dicas locais e segurança em viagem. Se o usuário perguntar qualquer outra coisa (programação, política, saúde, relacionamento, tarefas escolares etc.), recuse educadamente em 1 frase e ofereça ajudar com algo de viagem.

## Estilo
- Respostas CURTAS e diretas (idealmente 2–4 frases, no máximo ~80 palavras).
- Tom humano e amigável, como um amigo viajante experiente.
- Use markdown leve só quando ajudar (1 lista curta no máximo). Sem títulos longos.
- Vá direto ao ponto: preço/dica/recomendação primeiro, contexto depois.`;

const SCOPE_EN = `

## Scope (strict)
You ONLY answer about: travel, tourism, flights, hotels/lodging, itineraries, visas, FX, budgets, prices, local tips and travel safety. For anything else, politely decline in 1 sentence and offer to help with travel.

## Style
- SHORT, direct answers (2–4 sentences, max ~80 words).
- Friendly, human tone, like an experienced traveler friend.
- Light markdown only when helpful (one short list max). No long headings.
- Lead with the answer: price/tip/recommendation first, context after.`;

const SYSTEM_PROMPT_PT = `Você é o assistente Jaqtryp AI, especialista em turismo, viagens, voos, hotéis, vistos, cultura e dicas locais. Responda sempre em português (a menos que o usuário escreva em outro idioma).${SCOPE_PT}${JAQ_PRICE_PT}`;

const SYSTEM_PROMPT_EN = `You are the Jaqtryp AI assistant, specialized in travel, tourism, flights, hotels, visas, culture and local tips. Respond in the user's language.${SCOPE_EN}${JAQ_PRICE_EN}`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (!auth.ok) return auth.response;
        const userId = auth.userId;

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "AI not configured" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let body: { messages?: Msg[]; lang?: "pt" | "en" };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }
        const messages = Array.isArray(body.messages) ? body.messages.slice(-30) : [];
        const lang = body.lang === "en" ? "en" : "pt";
        const system = lang === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_PT;

        // Pre-check balance before opening the upstream stream.
        const pre = await checkBalance(userId, "translate_text");
        if (!pre.ok) return insufficientCreditsResponse(pre as any);

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3.5-flash",
            stream: true,
            messages: [{ role: "system", content: system }, ...messages],
          }),
        });

        if (!resp.ok) {
          const status = resp.status;
          const text = await resp.text().catch(() => "");
          let msg = "AI gateway error";
          if (status === 429) msg = "Limite atingido. Tente novamente em alguns instantes.";
          else if (status === 402)
            msg = "Créditos de IA esgotados. Adicione créditos em Settings > Workspace > Usage.";
          console.error("AI gateway error", status, text);
          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "content-type": "application/json" },
          });
        }

        // Charge after upstream accepted the request (status 200).
        // We can't wait for the full stream to finish, so we debit on accept.
        await chargeFeature(userId, "translate_text", { route: "api.chat" });

        return new Response(resp.body, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
          },
        });
      },
    },
  },
});
