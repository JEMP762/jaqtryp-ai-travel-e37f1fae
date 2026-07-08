import { createServerFn } from "@tanstack/react-start";

type DailyRoomInfo = {
  ok: boolean;
  url?: string;
  reason?: "no_api_key" | "provider_error";
  error?: string;
};

const roomCache = new Map<string, { url: string; expiresAt: number }>();

export const createDailyRoom = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => {
    if (!input?.code || typeof input.code !== "string") {
      throw new Error("code required");
    }
    const code = input.code.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (code.length < 4 || code.length > 24) throw new Error("invalid code");
    return { code };
  })
  .handler(async ({ data }): Promise<DailyRoomInfo> => {
    const apiKey = process.env.DAILY_API_KEY;
    if (!apiKey) {
      return { ok: false, reason: "no_api_key" };
    }

    const cached = roomCache.get(data.code);
    if (cached && cached.expiresAt > Date.now() + 60_000) {
      return { ok: true, url: cached.url };
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2; // 2h
    const body = {
      name: `jaq-${data.code}`,
      privacy: "public",
      properties: {
        exp,
        enable_prejoin_ui: false,
        enable_screenshare: true,
        enable_chat: false,
        max_participants: 8,
        start_video_off: false,
        start_audio_off: false,
      },
    };

    try {
      let resp = await fetch("https://api.daily.co/v1/rooms", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      // Room may already exist — Daily returns 409 in some cases and 400
      // (invalid-request-error "a room named ... already exists") in others.
      let alreadyExists = resp.status === 409;
      let errText = "";
      if (!alreadyExists && resp.status === 400) {
        errText = await resp.clone().text();
        if (/already exists/i.test(errText)) alreadyExists = true;
      }
      if (alreadyExists) {
        resp = await fetch(`https://api.daily.co/v1/rooms/jaq-${data.code}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
      }

      if (!resp.ok) {
        const err = errText || (await resp.text());
        console.error("Daily createRoom failed:", resp.status, err);
        return { ok: false, reason: "provider_error", error: `${resp.status}` };
      }
      const json = (await resp.json()) as { url?: string };
      if (!json.url) return { ok: false, reason: "provider_error", error: "no url" };
      roomCache.set(data.code, { url: json.url, expiresAt: exp * 1000 });
      return { ok: true, url: json.url };
    } catch (e) {
      console.error("Daily createRoom exception:", e);
      return { ok: false, reason: "provider_error", error: (e as Error).message };
    }
  });
