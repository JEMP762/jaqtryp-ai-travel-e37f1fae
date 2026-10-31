import * as React from "react";
import { authedJsonHeaders } from "@/lib/authed-fetch";

/** Split text into <=170 char chunks at sentence/word boundaries for /api/tts. */
function chunkText(text: string, max = 170): string[] {
  const clean = text
    .replace(/[*_#`>|\[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const out: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    let cut = Math.max(
      rest.lastIndexOf(". ", max),
      rest.lastIndexOf("? ", max),
      rest.lastIndexOf("! ", max),
      rest.lastIndexOf(", ", max),
    );
    if (cut < 40) cut = rest.lastIndexOf(" ", max);
    if (cut < 1) cut = max;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) out.push(rest);
  return out;
}

let currentAudio: HTMLAudioElement | null = null;
let playToken = 0;

export function stopSpeaking() {
  playToken++;
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

/** Speak text aloud using the app's TTS endpoint. Resolves when finished or stopped. */
export async function speak(text: string, lang = "pt-BR", rate = 1): Promise<void> {
  stopSpeaking();
  const token = playToken;
  for (const part of chunkText(text)) {
    if (token !== playToken) return;
    await new Promise<void>((resolve) => {
      const audio = new Audio(`/api/tts?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(part)}`);
      audio.playbackRate = rate;
      currentAudio = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
  }
  if (token === playToken) currentAudio = null;
}

/** Record from the microphone and transcribe via /api/public/stt. */
export function useVoiceRecorder(lang: string, onText: (text: string) => void) {
  const [recording, setRecording] = React.useState(false);
  const [transcribing, setTranscribing] = React.useState(false);
  const recRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const onTextRef = React.useRef(onText);
  onTextRef.current = onText;

  const start = async (): Promise<string | null> => {
    if (recording) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = rec.mimeType || mime || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1200) return;
        setTranscribing(true);
        try {
          const fd = new FormData();
          const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          fd.append("audio", blob, `audio.${ext}`);
          fd.append("lang", lang);
          const headers = await authedJsonHeaders();
          delete headers["Content-Type"];
          const resp = await fetch("/api/public/stt", { method: "POST", body: fd, headers });
          const data = (await resp.json().catch(() => ({}))) as { text?: string; error?: string };
          if (resp.ok && data.text) onTextRef.current(data.text);
          else if (!resp.ok) throw new Error(data.error || "Não foi possível transcrever o áudio.");
        } finally {
          setTranscribing(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      return null;
    } catch (e) {
      return (e as Error).message || "Microfone indisponível.";
    }
  };

  const stop = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  };

  React.useEffect(() => () => recRef.current?.stop(), []);

  return { recording, transcribing, start, stop };
}
