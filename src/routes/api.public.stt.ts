import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest } from "@/lib/auth-route.server";
import { checkBalance, insufficientCreditsResponse } from "@/lib/credit-charge.server";

// ElevenLabs Scribe language codes (ISO 639-3). Map our BCP-47 codes to them.
const LANG_MAP: Record<string, string> = {
  "pt-BR": "por",
  "en-US": "eng",
  "es-ES": "spa",
  "fr-FR": "fra",
  "it-IT": "ita",
  "de-DE": "deu",
  "ja-JP": "jpn",
  "zh-CN": "zho",
  "ko-KR": "kor",
  "ar-SA": "ara",
  "ru-RU": "rus",
  "nl-NL": "nld",
  "tr-TR": "tur",
  "hi-IN": "hin",
};

export const Route = createFileRoute("/api/public/stt")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (!auth.ok) return auth.response;

        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          return new Response(JSON.stringify({ error: "ElevenLabs not configured" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        let inForm: FormData;
        try {
          inForm = await request.formData();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid form data" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const audio = inForm.get("audio") as unknown;
        if (!(audio instanceof Blob)) {
          return new Response(JSON.stringify({ error: "Missing audio" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (audio.size < 1200) {
          return new Response(JSON.stringify({ error: "Audio too short" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const balance = await checkBalance(auth.userId, "translate_voice");
        if (!balance.ok) return insufficientCreditsResponse(balance as any);

        const langRaw = (inForm.get("lang") as string) || "";
        const langCode = LANG_MAP[langRaw];

        const apiForm = new FormData();
        const filename = audio instanceof File && audio.name ? audio.name : "audio.webm";
        apiForm.append("file", audio, filename);
        apiForm.append("model_id", "scribe_v2");
        apiForm.append("tag_audio_events", "false");
        apiForm.append("diarize", "false");
        if (langCode) apiForm.append("language_code", langCode);

        const resp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
          method: "POST",
          headers: { "xi-api-key": apiKey },
          body: apiForm,
        });

        if (!resp.ok) {
          const err = await resp.text();
          return new Response(JSON.stringify({ error: err || `STT failed: ${resp.status}` }), {
            status: 502,
            headers: { "content-type": "application/json" },
          });
        }

        const data = (await resp.json()) as { text?: string };
        return new Response(JSON.stringify({ text: (data.text || "").trim() }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
