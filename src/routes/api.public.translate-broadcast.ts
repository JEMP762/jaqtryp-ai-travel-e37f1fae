import { createFileRoute } from "@tanstack/react-router";

// Multilingual ElevenLabs voice (works across the languages we support).
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

const LANG_NAME: Record<string, string> = {
  "pt-BR": "Portuguese (Brazil)",
  "en-US": "English (US)",
  "es-ES": "Spanish",
  "fr-FR": "French",
  "it-IT": "Italian",
  "de-DE": "German",
  "ja-JP": "Japanese",
  "zh-CN": "Chinese (Simplified)",
  "ko-KR": "Korean",
  "ar-SA": "Arabic",
  "ru-RU": "Russian",
  "nl-NL": "Dutch",
  "tr-TR": "Turkish",
  "hi-IN": "Hindi",
};

type Body = {
  fromLang?: string;
  text?: string;
  targets?: Array<{ userId?: string; lang?: string }>;
  withAudio?: boolean;
  voiceId?: string;
  roomCode?: string;
  fromUserId?: string;
  fromName?: string;
};


async function translate(text: string, fromLang: string, toLang: string, apiKey: string) {
  if (fromLang === toLang) return text;
  const from = LANG_NAME[fromLang] ?? fromLang;
  const to = LANG_NAME[toLang] ?? toLang;
  const system = `You are a professional simultaneous interpreter. Translate from ${from} to ${to}. Output ONLY the translation, no quotes, no explanations. Preserve names, numbers and punctuation. Natural, conversational spoken tone.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        { role: "user", content: text },
      ],
    }),
  });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Translate failed ${resp.status}: ${err.slice(0, 200)}`);
  }
  const data = (await resp.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (data.choices?.[0]?.message?.content || "").trim();
}

async function tts(text: string, voiceId: string, apiKey: string): Promise<string> {
  const resp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.2, use_speaker_boost: true },
      }),
    },
  );
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`TTS failed ${resp.status}: ${err.slice(0, 200)}`);
  }
  const buf = await resp.arrayBuffer();
  return Buffer.from(buf).toString("base64");
}

export const Route = createFileRoute("/api/public/translate-broadcast")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const aiKey = process.env.LOVABLE_API_KEY;
        const elKey = process.env.ELEVENLABS_API_KEY;
        if (!aiKey || !elKey) {
          return new Response(JSON.stringify({ error: "AI/ElevenLabs not configured" }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        let body: Body;
        try {
          body = (await request.json()) as Body;
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
        }
        const text = (body.text || "").trim();
        const fromLang = body.fromLang || "";
        const targets = Array.isArray(body.targets) ? body.targets : [];
        const withAudio = body.withAudio !== false;
        const voiceId = body.voiceId || DEFAULT_VOICE_ID;

        if (!text || !fromLang || targets.length === 0) {
          return new Response(JSON.stringify({ error: "Missing text/fromLang/targets" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (text.length > 1200) {
          return new Response(JSON.stringify({ error: "Text too long" }), { status: 400 });
        }
        if (targets.length > 6) {
          return new Response(JSON.stringify({ error: "Too many targets" }), { status: 400 });
        }

        // Dedupe by target language
        const uniqueLangs = Array.from(
          new Set(targets.map((t) => t.lang).filter((l): l is string => typeof l === "string")),
        );

        try {
          const perLang: Record<string, { text: string; audio?: string }> = {};
          await Promise.all(
            uniqueLangs.map(async (lang) => {
              const tr = await translate(text, fromLang, lang, aiKey);
              const audio = withAudio && tr ? await tts(tr, voiceId, elKey) : undefined;
              perLang[lang] = { text: tr, audio };
            }),
          );

          const perRecipient: Record<string, { text: string; audio?: string; lang: string }> = {};
          for (const t of targets) {
            if (!t.userId || !t.lang) continue;
            const r = perLang[t.lang];
            if (!r) continue;
            perRecipient[t.userId] = { text: r.text, audio: r.audio, lang: t.lang };
          }

          // Persist to live_room_messages so all participants receive via realtime
          let messageId: string | null = null;
          if (body.roomCode && body.fromUserId) {
            try {
              const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
              const { data: inserted, error: insErr } = await (supabaseAdmin as any)
                .from("live_room_messages")
                .insert({
                  room_code: body.roomCode,
                  from_user_id: body.fromUserId,
                  from_name: body.fromName || "Convidado",
                  from_lang: fromLang,
                  original_text: text,
                  per_recipient: perRecipient,
                })
                .select("id")
                .single();
              if (insErr) console.error("live_room_messages insert failed:", insErr);
              else messageId = (inserted as { id?: string } | null)?.id ?? null;

            } catch (e) {
              console.error("live_room_messages insert exception:", e);
            }
          }

          return new Response(
            JSON.stringify({ originalText: text, fromLang, perRecipient, messageId }),
            { headers: { "content-type": "application/json" } },
          );
        } catch (e) {
          return new Response(JSON.stringify({ error: (e as Error).message }), {
            status: 502,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});

