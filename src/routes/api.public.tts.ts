import { createFileRoute } from "@tanstack/react-router";
import { requireAuthFromRequest } from "@/lib/auth-route.server";

const SUPPORTED_LANGS = new Set([
  "pt-BR",
  "en-US",
  "es-ES",
  "fr-FR",
  "it-IT",
  "de-DE",
  "ja-JP",
  "zh-CN",
  "ko-KR",
  "ar-SA",
  "ru-RU",
  "nl-NL",
  "tr-TR",
  "hi-IN",
]);

export const Route = createFileRoute("/api/public/tts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = await requireAuthFromRequest(request);
        if (!auth.ok) return auth.response;

        const url = new URL(request.url);
        const text = (url.searchParams.get("text") || "").trim().slice(0, 260);
        const lang = url.searchParams.get("lang") || "pt-BR";
        const apiKey = process.env.LOVABLE_API_KEY;

        if (!text) return new Response("Missing text", { status: 400 });
        if (!SUPPORTED_LANGS.has(lang)) return new Response("Unsupported language", { status: 400 });
        if (!apiKey) return new Response("AI voice not configured", { status: 500 });

        const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "openai/gpt-4o-mini-tts",
            input: text,
            voice: "alloy",
            response_format: "mp3",
            speed: 1,
            instructions: `Speak naturally in ${lang}. Clear travel interpreter voice.`,
          }),
        });

        if (!resp.ok || !resp.body) {
          const err = await resp.text().catch(() => "");
          return new Response(err || "TTS unavailable", { status: resp.status === 402 ? 402 : 502 });
        }

        return new Response(resp.body, {
          headers: {
            "content-type": resp.headers.get("content-type") || "audio/mpeg",
            "cache-control": "private, max-age=3600",
          },
        });
      },
    },
  },
});