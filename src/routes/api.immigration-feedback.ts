import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest } from "@/lib/auth-route.server";
import { chargeFeature, checkBalance, insufficientCreditsResponse } from "@/lib/credit-charge.server";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const SYSTEM = `Você é um instrutor experiente que prepara viajantes brasileiros para a entrevista na imigração de aeroportos (CBP dos EUA, UK Border Force, Schengen, Canadá).
Avalie a resposta do viajante, em inglês, a uma pergunta do oficial.
Responda SOMENTE em JSON válido com as chaves:
- "score": número de 0 a 10 (clareza, objetividade, segurança e coerência com o motivo da viagem);
- "verdict": "ok" | "attention" | "risk";
- "feedback": 1 a 3 frases em português explicando o que melhorar;
- "risk_words": lista de palavras/frases arriscadas usadas (ex.: work, job, study, volunteer, "I don't know", "maybe" para turista) ou lista vazia;
- "improved": uma resposta modelo curta e natural em inglês, coerente com o cenário;
- "improved_pt": tradução da resposta modelo para português.
Nunca incentive mentir; oriente a responder com a verdade de forma curta e segura.`;

export const Route = createFileRoute("/api/immigration-feedback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (!auth.ok) return auth.response;
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "IA não configurada" }, 500);

        let body: { question?: string; answer?: string; destination?: string; purpose?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "Requisição inválida" }, 400);
        }
        const question = String(body.question || "").slice(0, 300);
        const answer = String(body.answer || "").trim().slice(0, 800);
        const destination = String(body.destination || "").slice(0, 60);
        const purpose = String(body.purpose || "").slice(0, 60);
        if (!question || !answer) return json({ error: "Responda à pergunta primeiro." }, 400);

        const pre = await checkBalance(auth.userId, "translate_text");
        if (!pre.ok) return insufficientCreditsResponse(pre as any);

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.5-flash",
            response_format: { type: "json_object" },
            messages: [
              { role: "system", content: SYSTEM },
              {
                role: "user",
                content: `Destino: ${destination}\nMotivo da viagem: ${purpose}\nPergunta do oficial: ${question}\nResposta do viajante: ${answer}\nRetorne o JSON.`,
              },
            ],
          }),
        });
        if (!resp.ok) {
          const status = resp.status;
          const msg =
            status === 429
              ? "Muitas tentativas. Aguarde alguns instantes."
              : status === 402
                ? "Créditos de IA esgotados no momento."
                : "Não foi possível avaliar agora.";
          console.error("immigration feedback error", status, await resp.text().catch(() => ""));
          return json({ error: msg }, status);
        }
        const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
        const raw = data.choices?.[0]?.message?.content || "";
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw.replace(/^```(json)?|```$/g, "").trim());
        } catch {
          return json({ error: "Avaliação indisponível. Tente novamente." }, 502);
        }
        await chargeFeature(auth.userId, "translate_text", { route: "api.immigration-feedback" });
        return json(parsed);
      },
    },
  },
});
