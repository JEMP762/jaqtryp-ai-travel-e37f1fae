import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { unzipSync, strFromU8 } from "fflate";

// ---------- CONFIG ----------
const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_PDF_INLINE_BYTES = 4 * 1024 * 1024; // 4MB para PDF sem texto extraível
const MAX_TEXT_CHARS = 120_000;
const CHUNK_CHARS = 6000;
const CHUNK_CONCURRENCY = 3;
const SUPPORTED_TYPES = ["pdf", "docx", "xlsx", "csv", "pptx", "txt", "md"] as const;
type FileKind = (typeof SUPPORTED_TYPES)[number];

function detectKind(name: string, mime?: string): FileKind | null {
  const lower = name.toLowerCase();
  for (const ext of SUPPORTED_TYPES) {
    if (lower.endsWith("." + ext)) return ext;
  }
  if (mime?.includes("pdf")) return "pdf";
  if (mime?.includes("wordprocessingml")) return "docx";
  if (mime?.includes("spreadsheetml") || mime?.includes("excel")) return "xlsx";
  if (mime?.includes("presentationml")) return "pptx";
  if (mime?.includes("csv")) return "csv";
  if (mime?.startsWith("text/")) return "txt";
  return null;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function stripXml(xml: string): string {
  // Convert common tags to line breaks before stripping
  return xml
    .replace(/<w:p[^>]*\/>/g, "\n")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<\/a:p>/g, "\n")
    .replace(/<\/text:p>/g, "\n")
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#xA;/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractFromZip(bytes: Uint8Array, kind: FileKind): string {
  const entries = unzipSync(bytes);
  const parts: string[] = [];
  if (kind === "docx") {
    const doc = entries["word/document.xml"];
    if (doc) parts.push(stripXml(strFromU8(doc)));
  } else if (kind === "pptx") {
    const slideKeys = Object.keys(entries)
      .filter((k) => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => {
        const ai = parseInt(a.match(/slide(\d+)/)?.[1] ?? "0", 10);
        const bi = parseInt(b.match(/slide(\d+)/)?.[1] ?? "0", 10);
        return ai - bi;
      });
    for (const k of slideKeys) {
      parts.push(`# Slide ${k.match(/slide(\d+)/)?.[1]}\n` + stripXml(strFromU8(entries[k])));
    }
  } else if (kind === "xlsx") {
    // Read sharedStrings + each sheet
    const sst = entries["xl/sharedStrings.xml"];
    const strings: string[] = [];
    if (sst) {
      const xml = strFromU8(sst);
      const matches = xml.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
      for (const m of matches) {
        const s = m.replace(/<t[^>]*>/, "").replace(/<\/t>/, "");
        strings.push(s);
      }
    }
    const sheetKeys = Object.keys(entries)
      .filter((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
      .sort();
    for (const k of sheetKeys) {
      const xml = strFromU8(entries[k]);
      const rows = xml.match(/<row[\s\S]*?<\/row>/g) || [];
      const out: string[] = [];
      for (const row of rows) {
        const cells = row.match(/<c[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) || [];
        const vals: string[] = [];
        for (const c of cells) {
          const isShared = /t="s"/.test(c);
          const v = c.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
          const inline = c.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/)?.[1];
          if (inline) vals.push(inline);
          else if (isShared && v) vals.push(strings[parseInt(v, 10)] ?? "");
          else vals.push(v);
        }
        out.push(vals.join("\t"));
      }
      parts.push(`# ${k}\n` + out.join("\n"));
    }
  }
  return parts.join("\n\n");
}

async function extractText(bytes: Uint8Array, kind: FileKind): Promise<string> {
  if (kind === "txt" || kind === "csv" || kind === "md") {
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
  if (kind === "docx" || kind === "pptx" || kind === "xlsx") {
    return extractFromZip(bytes, kind);
  }
  if (kind === "pdf") {
    // Best-effort: scan for visible text in the PDF stream. Heuristic.
    const text = new TextDecoder("latin1").decode(bytes);
    const blocks = text.match(/\(([^()\\\n]{2,})\)\s*Tj/g) || [];
    const joined = blocks
      .map((b) => b.replace(/\)\s*Tj$/, "").replace(/^\(/, ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (joined.length > 50) return joined;
    // Fallback: send to AI as PDF inline
    return "";
  }
  return "";
}

// ---------- AI ----------
async function callAI(opts: { system: string; prompt: string; pdfBase64?: string }): Promise<string> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("IA não configurada");
  const userContent: any = opts.pdfBase64
    ? [
        { type: "text", text: opts.prompt },
        {
          type: "file",
          file: {
            filename: "document.pdf",
            file_data: `data:application/pdf;base64,${opts.pdfBase64}`,
          },
        },
      ]
    : opts.prompt;
  const body: any = {
    model: opts.pdfBase64 ? "google/gemini-2.5-flash" : "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: userContent },
    ],
  };
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => "");
    console.error("[file-translator] AI gateway error", resp.status, errBody.slice(0, 500));
    if (resp.status === 429) throw new Error("Limite de IA atingido. Tente novamente em instantes.");
    if (resp.status === 402) throw new Error("Créditos de IA esgotados.");
    throw new Error(`Falha ao consultar IA (${resp.status}): ${errBody.slice(0, 200) || "sem detalhes"}`);
  }
  const json: any = await resp.json();
  return json?.choices?.[0]?.message?.content ?? "";
}

const LANG_NAME: Record<string, string> = {
  pt: "Português (Brasil)",
  en: "English",
  es: "Español",
  fr: "Français",
  it: "Italiano",
  de: "Deutsch",
  ja: "日本語",
  zh: "中文 (Simplificado)",
  ko: "한국어",
  ar: "العربية",
  ru: "Русский",
  nl: "Nederlands",
  hi: "हिन्दी",
  tr: "Türkçe",
  pl: "Polski",
};

async function detectLanguage(text: string): Promise<string> {
  const sample = text.slice(0, 1500);
  if (!sample.trim()) return "unknown";
  const out = await callAI({
    system:
      "Detecte o idioma do texto fornecido. Responda SOMENTE com o código ISO 639-1 em minúsculas (ex: pt, en, es, fr, de, ja).",
    prompt: sample,
  });
  return out.trim().toLowerCase().slice(0, 5) || "unknown";
}

async function translateChunks(text: string, targetCode: string): Promise<string> {
  const target = LANG_NAME[targetCode] ?? targetCode;
  const system = `Você é um tradutor profissional. Traduza o conteúdo a seguir para ${target}.
Regras:
- Preserve TODA a estrutura: títulos (#, ##), listas (-, 1.), tabelas em markdown, quebras de linha, parágrafos.
- Não adicione comentários, prefácios ou conclusões — devolva APENAS o conteúdo traduzido.
- Mantenha nomes próprios, códigos, números, URLs e e-mails inalterados.
- Se houver tabulações (\\t) entre colunas, mantenha-as.`;
  if (text.length <= CHUNK_CHARS) {
    return await callAI({ system, prompt: text });
  }
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + CHUNK_CHARS, text.length);
    // Try to break at paragraph
    if (end < text.length) {
      const bp = text.lastIndexOf("\n\n", end);
      if (bp > i + CHUNK_CHARS / 2) end = bp;
    }
    chunks.push(text.slice(i, end));
    i = end;
  }
  // Processar com limite de concorrência para acelerar e evitar timeout do Worker
  const out: string[] = new Array(chunks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next++;
      if (idx >= chunks.length) return;
      out[idx] = await callAI({ system, prompt: chunks[idx] });
    }
  }
  const workers = Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, () => worker());
  await Promise.all(workers);
  return out.join("\n\n");
}

// ---------- SERVER FUNCTIONS ----------
export const translateFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        file_base64: z.string().min(8),
        file_name: z.string().min(1).max(255),
        file_type: z.string().optional(),
        target_lang: z.string().min(2).max(5),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;

    // 1) Premium gate (assina OU tem créditos avulsos)
    const { data: hasAccess } = await supabase.rpc("has_premium_access", { user_uuid: userId });
    if (hasAccess !== true) {
      return {
        ok: false as const,
        reason: "no_access" as const,
        message: "Recurso premium. Assine um plano ou adquira créditos avulsos.",
      };
    }

    // 2) Saldo
    const { data: costRow } = await supabase
      .from("credit_costs")
      .select("cost")
      .eq("feature_key", "file_translation")
      .maybeSingle();
    const cost = costRow?.cost ?? 10;
    const { data: credits } = await supabase
      .from("user_credits")
      .select("free_balance,monthly_balance,topup_balance")
      .eq("user_id", userId)
      .maybeSingle();
    const totalBalance =
      (credits?.free_balance ?? 0) + (credits?.monthly_balance ?? 0) + (credits?.topup_balance ?? 0);
    if (totalBalance < cost) {
      return {
        ok: false as const,
        reason: "insufficient" as const,
        needed: cost,
        have: totalBalance,
        message: "Você não possui créditos suficientes para realizar esta tradução.",
      };
    }

    // 3) Validar arquivo
    const kind = detectKind(data.file_name, data.file_type);
    if (!kind) {
      return {
        ok: false as const,
        reason: "unsupported" as const,
        message: "Formato não suportado. Use PDF, DOCX, XLSX, CSV, PPTX ou TXT.",
      };
    }
    const bytes = base64ToBytes(data.file_base64);
    if (bytes.length > MAX_BYTES) {
      return {
        ok: false as const,
        reason: "too_large" as const,
        message: "Arquivo excede 10MB.",
      };
    }

    // 4) Criar registro processing
    const { data: rec, error: insErr } = await supabase
      .from("file_translations")
      .insert({
        user_id: userId,
        file_name: data.file_name,
        file_type: kind,
        file_size_bytes: bytes.length,
        target_lang: data.target_lang,
        status: "processing",
      })
      .select("id")
      .single();
    if (insErr || !rec) {
      return { ok: false as const, reason: "db_error" as const, message: "Erro ao iniciar tradução." };
    }
    const recId = rec.id as string;

    try {
      // 5) Extrair texto
      let extracted = await extractText(bytes, kind);
      const isPdfFallback = kind === "pdf" && extracted.length < 50;

      if (!extracted.trim() && !isPdfFallback) {
        throw new Error("Não foi possível extrair conteúdo do arquivo.");
      }

      // Guardas para evitar timeout do Worker
      if (isPdfFallback && bytes.length > MAX_PDF_INLINE_BYTES) {
        throw new Error(
          "PDF muito grande sem texto extraível. Envie um PDF com texto selecionável ou um arquivo até 4MB.",
        );
      }
      if (!isPdfFallback && extracted.length > MAX_TEXT_CHARS) {
        throw new Error(
          `Conteúdo muito extenso (${extracted.length.toLocaleString("pt-BR")} caracteres). Divida o arquivo e tente novamente (limite ${MAX_TEXT_CHARS.toLocaleString("pt-BR")}).`,
        );
      }

      // 6) Detectar idioma
      const sourceLang = isPdfFallback ? "auto" : await detectLanguage(extracted);

      // 7) Traduzir
      let translated: string;
      if (isPdfFallback) {
        // PDF sem texto extraível: enviar como arquivo inline para Gemini
        translated = await callAI({
          system: `Você é um tradutor profissional. Extraia TODO o conteúdo do PDF anexo e traduza para ${LANG_NAME[data.target_lang] ?? data.target_lang}. Preserve a estrutura (títulos, listas, tabelas como markdown). Responda apenas com o conteúdo traduzido em markdown.`,
          prompt: "Traduza este documento.",
          pdfBase64: bytesToBase64(bytes),
        });
      } else {
        translated = await translateChunks(extracted, data.target_lang);
      }

      if (!translated.trim()) throw new Error("Tradução vazia.");

      // 8) Upload do resultado (sempre .md para preservar estrutura)
      const baseName = data.file_name.replace(/\.[^.]+$/, "");
      const friendlyName = `${baseName}__${data.target_lang}.md`;
      // Sanitiza para chave de Storage (ASCII safe): sem acentos, sem símbolos,
      // apenas [a-zA-Z0-9._-]. Evita "Invalid key" do bucket.
      const safeBase = (baseName
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-.]+|[-.]+$/g, "")
        .slice(0, 80)) || "arquivo";
      const safeName = `${safeBase}__${data.target_lang}.md`;
      const outPath = `${userId}/${recId}/${safeName}`;
      const outBytes = new TextEncoder().encode(translated);
      const { error: upErr } = await supabase.storage
        .from("file-translations")
        .upload(outPath, outBytes, {
          contentType: "text/markdown; charset=utf-8",
          upsert: true,
        });
      if (upErr) {
        console.error("[translateFile] storage upload failed", { outPath, message: upErr.message });
        throw new Error("Falha ao salvar arquivo traduzido: " + upErr.message);
      }

      // 9) Cobrar créditos (apenas após sucesso)
      const { data: spendRes, error: spendErr } = await supabase.rpc("spend_for_feature", {
        _user: userId,
        _feature: "file_translation",
        _meta: { translation_id: recId, target_lang: data.target_lang, source_lang: sourceLang },
      });
      if (spendErr || (spendRes && (spendRes as any).ok === false)) {
        throw new Error("Falha ao debitar créditos.");
      }
      const spent = (spendRes as any)?.spent ?? cost;

      // 10) Atualizar registro
      await supabase
        .from("file_translations")
        .update({
          status: "success",
          source_lang: sourceLang,
          credits_spent: spent,
          storage_path_translated: outPath,
        })
        .eq("id", recId);

      // 11) Signed URL
      const { data: signed } = await supabase.storage
        .from("file-translations")
        .createSignedUrl(outPath, 3600);

      return {
        ok: true as const,
        id: recId,
        source_lang: sourceLang,
        target_lang: data.target_lang,
        credits_spent: spent,
        download_url: signed?.signedUrl ?? null,
        file_name: outName,
      };
    } catch (e: any) {
      console.error("[translateFile] failure", {
        recId,
        kind,
        size: bytes.length,
        message: String(e?.message ?? e),
      });
      await supabase
        .from("file_translations")
        .update({ status: "error", error_message: String(e?.message ?? e).slice(0, 500) })
        .eq("id", recId);
      return {
        ok: false as const,
        reason: "process_error" as const,
        message: String(e?.message ?? "Erro ao processar arquivo."),
      };
    }
  });

export const listFileTranslations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ range: z.enum(["today", "7d", "30d", "all"]).default("all") })
      .parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    let since: string | null = null;
    const now = Date.now();
    if (data.range === "today") since = new Date(now - 24 * 3600 * 1000).toISOString();
    else if (data.range === "7d") since = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    else if (data.range === "30d") since = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

    let q = supabase
      .from("file_translations")
      .select("id,file_name,file_type,source_lang,target_lang,credits_spent,status,created_at,storage_path_translated")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (since) q = q.gte("created_at", since);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const getFileTranslationDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { data: row } = await supabase
      .from("file_translations")
      .select("storage_path_translated,user_id,file_name,target_lang")
      .eq("id", data.id)
      .maybeSingle();
    if (!row || row.user_id !== userId || !row.storage_path_translated) {
      throw new Error("Arquivo não encontrado.");
    }
    const { data: signed, error } = await supabase.storage
      .from("file-translations")
      .createSignedUrl(row.storage_path_translated, 3600);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl ?? null, file_name: row.file_name };
  });
