// Client-side exporters for translated markdown documents.
// Generates PDF (print-window, planner style), DOCX, XLSX and PPTX
// from a markdown string. All conversions run in the browser.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table as DxTable,
  TableRow as DxRow,
  TableCell as DxCell,
  WidthType,
  BorderStyle,
} from "docx";
import * as XLSX from "xlsx";
import PptxGenJS from "pptxgenjs";

// ---------- Markdown parsing ----------

export type MdBlock =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; runs: InlineRun[] }
  | { type: "ul"; items: InlineRun[][] }
  | { type: "ol"; items: InlineRun[][] }
  | { type: "table"; header: string[]; rows: string[][] }
  | { type: "hr" };

export type InlineRun = { text: string; bold?: boolean; italic?: boolean };

function parseInline(line: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|__([^_]+)__|_([^_]+)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) runs.push({ text: line.slice(last, m.index) });
    if (m[1]) runs.push({ text: m[1], bold: true });
    else if (m[2]) runs.push({ text: m[2], italic: true });
    else if (m[3]) runs.push({ text: m[3], bold: true });
    else if (m[4]) runs.push({ text: m[4], italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) runs.push({ text: line.slice(last) });
  return runs.length ? runs : [{ text: line }];
}

function runsToPlain(runs: InlineRun[]): string {
  return runs.map((r) => r.text).join("");
}

export function parseMarkdown(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const blocks: MdBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // table
    if (/^\|.+\|/.test(trimmed) && /^\|.+\|/.test((lines[i + 1] ?? "").trim()) && /^\|?\s*:?-+:?\s*\|/.test((lines[i + 1] ?? "").trim())) {
      const header = trimmed.replace(/^\||\|$/g, "").split("|").map((s) => s.trim());
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\|.+\|/.test(lines[i].trim())) {
        rows.push(lines[i].trim().replace(/^\||\|$/g, "").split("|").map((s) => s.trim()));
        i++;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    if (/^#\s+/.test(trimmed)) { blocks.push({ type: "h1", text: trimmed.replace(/^#\s+/, "") }); i++; continue; }
    if (/^##\s+/.test(trimmed)) { blocks.push({ type: "h2", text: trimmed.replace(/^##\s+/, "") }); i++; continue; }
    if (/^###+\s+/.test(trimmed)) { blocks.push({ type: "h3", text: trimmed.replace(/^###+\s+/, "") }); i++; continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { blocks.push({ type: "hr" }); i++; continue; }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: InlineRun[][] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(/^[-*]\s+/, "")));
        i++;
      }
      blocks.push({ type: "ul", items });
      continue;
    }
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: InlineRun[][] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(parseInline(lines[i].trim().replace(/^\d+\.\s+/, "")));
        i++;
      }
      blocks.push({ type: "ol", items });
      continue;
    }

    // paragraph (may span until blank line)
    const buf: string[] = [trimmed];
    i++;
    while (i < lines.length && lines[i].trim() && !/^(#|##|###|\*|-|\d+\.|\|)/.test(lines[i].trim())) {
      buf.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "p", runs: parseInline(buf.join(" ")) });
  }
  return blocks;
}

// ---------- Fetch helper ----------

export async function fetchMarkdown(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error("Não foi possível baixar o conteúdo traduzido.");
  return await r.text();
}

// ---------- File save ----------

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inlineToHtml(runs: InlineRun[]): string {
  return runs
    .map((r) => {
      let t = escapeHtml(r.text);
      if (r.bold) t = `<strong>${t}</strong>`;
      if (r.italic) t = `<em>${t}</em>`;
      return t;
    })
    .join("");
}

function blocksToHtml(blocks: MdBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === "h1") out.push(`<h1>${escapeHtml(b.text)}</h1>`);
    else if (b.type === "h2") out.push(`<h2>${escapeHtml(b.text)}</h2>`);
    else if (b.type === "h3") out.push(`<h3>${escapeHtml(b.text)}</h3>`);
    else if (b.type === "hr") out.push(`<hr/>`);
    else if (b.type === "p") out.push(`<p>${inlineToHtml(b.runs)}</p>`);
    else if (b.type === "ul") out.push(`<ul>${b.items.map((it) => `<li>${inlineToHtml(it)}</li>`).join("")}</ul>`);
    else if (b.type === "ol") out.push(`<ol>${b.items.map((it) => `<li>${inlineToHtml(it)}</li>`).join("")}</ol>`);
    else if (b.type === "table") {
      out.push(
        `<table><thead><tr>${b.header.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${b.rows
          .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`,
      );
    }
  }
  return out.join("\n");
}

// ---------- PDF (print window, planner style) ----------

const PRINT_CSS = `
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;max-width:780px;margin:40px auto;padding:0 24px;color:#111;line-height:1.55}
  h1{font-size:26px;margin:0 0 8px;border-bottom:2px solid #eee;padding-bottom:8px}
  h2{font-size:20px;margin:24px 0 8px;color:#1e40af}
  h3{font-size:16px;margin:18px 0 6px}
  p{margin:6px 0}
  ul,ol{margin:6px 0 12px 22px}
  li{margin:3px 0}
  hr{border:none;border-top:1px solid #e5e7eb;margin:18px 0}
  table{border-collapse:collapse;margin:12px 0;width:100%;font-size:14px}
  th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}
  th{background:#f3f4f6;color:#1f2937}
  @media print { body { margin: 0; } }
`;

export function openPrintWindow(): Window | null {
  const w = window.open("", "_blank");
  if (!w) return null;
  w.document.open();
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>Preparando…</title>
<style>body{font-family:-apple-system,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#555}</style>
</head><body><div>Preparando exportação…</div></body></html>`,
  );
  w.document.close();
  return w;
}

export function renderPdfInWindow(w: Window, title: string, markdown: string) {
  const html = blocksToHtml(parseMarkdown(markdown));
  w.document.open();
  w.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${PRINT_CSS}</style></head><body>
<h1>${escapeHtml(title)}</h1>
${html}
<script>setTimeout(()=>window.print(),300);</script>
</body></html>`,
  );
  w.document.close();
}

// ---------- DOCX ----------

function runsToDocx(runs: InlineRun[]): TextRun[] {
  return runs.map(
    (r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic, font: "Calibri", size: 22 }),
  );
}

export async function exportDocx(title: string, markdown: string, filename: string) {
  const blocks = parseMarkdown(markdown);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: title, bold: true, font: "Calibri", size: 40, color: "1E40AF" })],
      spacing: { after: 200 },
    }),
  );

  for (const b of blocks) {
    if (b.type === "h1") {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: b.text, bold: true, font: "Calibri", size: 32 })],
          spacing: { before: 240, after: 120 },
        }),
      );
    } else if (b.type === "h2") {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: b.text, bold: true, font: "Calibri", size: 28, color: "1E40AF" })],
          spacing: { before: 200, after: 100 },
        }),
      );
    } else if (b.type === "h3") {
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          children: [new TextRun({ text: b.text, bold: true, font: "Calibri", size: 24 })],
          spacing: { before: 160, after: 80 },
        }),
      );
    } else if (b.type === "p") {
      children.push(new Paragraph({ children: runsToDocx(b.runs), spacing: { after: 100 } }));
    } else if (b.type === "ul" || b.type === "ol") {
      b.items.forEach((it) => {
        children.push(
          new Paragraph({
            children: runsToDocx(it),
            bullet: b.type === "ul" ? { level: 0 } : undefined,
            numbering: b.type === "ol" ? { reference: "ordered", level: 0 } : undefined,
            spacing: { after: 60 },
          }),
        );
      });
    } else if (b.type === "hr") {
      children.push(
        new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } },
          spacing: { before: 120, after: 120 },
        }),
      );
    } else if (b.type === "table") {
      const widthPct = Math.floor(9000 / Math.max(b.header.length, 1));
      const tbl = new DxTable({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new DxRow({
            tableHeader: true,
            children: b.header.map(
              (h) =>
                new DxCell({
                  width: { size: widthPct, type: WidthType.DXA },
                  shading: { fill: "F3F4F6" },
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: h, bold: true, font: "Calibri", size: 22 })],
                    }),
                  ],
                }),
            ),
          }),
          ...b.rows.map(
            (r) =>
              new DxRow({
                children: b.header.map((_, idx) => {
                  const txt = r[idx] ?? "";
                  return new DxCell({
                    width: { size: widthPct, type: WidthType.DXA },
                    children: [
                      new Paragraph({
                        children: [new TextRun({ text: txt, font: "Calibri", size: 22 })],
                      }),
                    ],
                  });
                }),
              }),
          ),
        ],
      });
      children.push(new Paragraph({ spacing: { before: 100 } }));
      // docx requires Table inside section children; push by widening type
      (children as any).push(tbl);
    }
  }

  const doc = new Document({
    creator: "Jaqtryp",
    title,
    numbering: {
      config: [
        {
          reference: "ordered",
          levels: [
            {
              level: 0,
              format: "decimal" as any,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
        children: children as any,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveBlob(blob, filename.endsWith(".docx") ? filename : filename + ".docx");
}

// ---------- XLSX ----------

export function exportXlsx(title: string, markdown: string, filename: string) {
  const blocks = parseMarkdown(markdown);
  const wb = XLSX.utils.book_new();

  // If there are tables, each table becomes a sheet. Otherwise dump as content.
  const tables = blocks.filter((b) => b.type === "table") as Extract<MdBlock, { type: "table" }>[];

  // Always include a "Conteúdo" sheet with the full text laid out by section.
  const rows: (string | number)[][] = [[title]];
  rows.push([]);
  for (const b of blocks) {
    if (b.type === "h1" || b.type === "h2" || b.type === "h3") {
      rows.push([b.text]);
    } else if (b.type === "p") {
      rows.push([runsToPlain(b.runs)]);
    } else if (b.type === "ul" || b.type === "ol") {
      b.items.forEach((it, idx) =>
        rows.push([(b.type === "ol" ? `${idx + 1}. ` : "• ") + runsToPlain(it)]),
      );
    } else if (b.type === "hr") {
      rows.push([""]);
    } else if (b.type === "table") {
      rows.push(b.header);
      b.rows.forEach((r) => rows.push(r));
      rows.push([]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Width: derive from longest cell
  const maxLen = rows.reduce((m, r) => {
    const l = Math.max(...r.map((c) => String(c ?? "").length), 0);
    return Math.max(m, l);
  }, 10);
  ws["!cols"] = [{ wch: Math.min(Math.max(maxLen, 30), 100) }];
  // Bold title
  if (ws["A1"]) ws["A1"].s = { font: { bold: true, sz: 14 } };
  ws["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
  XLSX.utils.book_append_sheet(wb, ws, "Conteúdo");

  // One sheet per markdown table
  tables.forEach((t, idx) => {
    const tws = XLSX.utils.aoa_to_sheet([t.header, ...t.rows]);
    const widths = t.header.map((_, c) => {
      const cells = [t.header[c], ...t.rows.map((r) => r[c] ?? "")];
      const l = Math.max(...cells.map((s) => String(s ?? "").length), 10);
      return { wch: Math.min(Math.max(l + 2, 12), 60) };
    });
    tws["!cols"] = widths;
    tws["!freeze"] = { xSplit: 0, ySplit: 1 } as any;
    XLSX.utils.book_append_sheet(wb, tws, `Tabela ${idx + 1}`);
  });

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  saveBlob(
    new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    filename.endsWith(".xlsx") ? filename : filename + ".xlsx",
  );
}

// ---------- PPTX ----------

export async function exportPptx(title: string, markdown: string, filename: string) {
  const blocks = parseMarkdown(markdown);
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
  pres.title = title;

  const PRIMARY = "1E40AF";
  const BG = "FFFFFF";
  const INK = "111827";
  const MUTED = "6B7280";

  // Cover
  const cover = pres.addSlide();
  cover.background = { color: PRIMARY };
  cover.addText(title, {
    x: 0.6, y: 2.8, w: 12.1, h: 1.8,
    fontFace: "Calibri", fontSize: 44, bold: true, color: "FFFFFF",
    align: "left", valign: "middle",
  });
  cover.addText("Tradução gerada por Jaqtryp", {
    x: 0.6, y: 4.6, w: 12.1, h: 0.5,
    fontFace: "Calibri", fontSize: 16, color: "CADCFC",
  });

  // Split blocks into sections by H1/H2
  type Section = { title: string; blocks: MdBlock[] };
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const b of blocks) {
    if (b.type === "h1" || b.type === "h2") {
      if (current) sections.push(current);
      current = { title: b.text, blocks: [] };
    } else {
      if (!current) current = { title: title, blocks: [] };
      current.blocks.push(b);
    }
  }
  if (current) sections.push(current);
  if (sections.length === 0) sections.push({ title, blocks });

  for (const sec of sections) {
    const slide = pres.addSlide();
    slide.background = { color: BG };
    // Header bar
    slide.addShape("rect", { x: 0, y: 0, w: 13.33, h: 0.9, fill: { color: PRIMARY } });
    slide.addText(sec.title, {
      x: 0.5, y: 0.05, w: 12.3, h: 0.8,
      fontFace: "Calibri", fontSize: 24, bold: true, color: "FFFFFF", valign: "middle",
    });

    const bodyItems: { text: string; options?: any }[] = [];
    for (const b of sec.blocks) {
      if (b.type === "h3") {
        bodyItems.push({ text: b.text, options: { bold: true, fontSize: 18, color: PRIMARY, paraSpaceBefore: 8 } });
      } else if (b.type === "p") {
        bodyItems.push({ text: runsToPlain(b.runs), options: { fontSize: 14, color: INK } });
      } else if (b.type === "ul") {
        b.items.forEach((it) =>
          bodyItems.push({ text: runsToPlain(it), options: { fontSize: 14, color: INK, bullet: true } }),
        );
      } else if (b.type === "ol") {
        b.items.forEach((it, i) =>
          bodyItems.push({ text: `${i + 1}. ${runsToPlain(it)}`, options: { fontSize: 14, color: INK } }),
        );
      } else if (b.type === "hr") {
        bodyItems.push({ text: " ", options: { fontSize: 6, color: MUTED } });
      } else if (b.type === "table") {
        const rows = [
          b.header.map((h) => ({ text: h, options: { bold: true, fill: { color: "F3F4F6" }, color: INK } })),
          ...b.rows.map((r) => r.map((c) => ({ text: String(c ?? ""), options: { color: INK } }))),
        ];
        slide.addTable(rows as any, {
          x: 0.5, y: 1.2, w: 12.3,
          fontFace: "Calibri", fontSize: 12,
          border: { type: "solid", pt: 0.5, color: "E5E7EB" },
        });
      }
    }
    if (bodyItems.length) {
      slide.addText(bodyItems as any, {
        x: 0.5, y: 1.1, w: 12.3, h: 6.0,
        fontFace: "Calibri", fontSize: 14, color: INK, valign: "top",
      });
    }
  }

  const blob = (await pres.write({ outputType: "blob" })) as Blob;
  saveBlob(blob, filename.endsWith(".pptx") ? filename : filename + ".pptx");
}

// ---------- Markdown raw ----------
export function exportMarkdown(markdown: string, filename: string) {
  saveBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), filename.endsWith(".md") ? filename : filename + ".md");
}
