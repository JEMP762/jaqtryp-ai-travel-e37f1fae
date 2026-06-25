import * as React from "react";
import { Download, FileText, FileSpreadsheet, Presentation, FileCode, Loader2, FileType } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  fetchMarkdown,
  exportDocx,
  exportXlsx,
  exportPptx,
  exportMarkdown,
  openPrintWindow,
  renderPdfInWindow,
} from "@/lib/translation-exports";

type Props = {
  /** Display title (used as document title). */
  title: string;
  /** Base filename without extension. */
  baseName: string;
  /** Either pre-loaded markdown OR a URL to fetch markdown from. */
  markdown?: string;
  markdownUrl?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline" | "ghost" | "secondary";
  label?: string;
};

export function TranslationExportMenu({
  title,
  baseName,
  markdown,
  markdownUrl,
  size = "default",
  variant = "default",
  label = "Exportar",
}: Props) {
  const [busy, setBusy] = React.useState<null | "pdf" | "docx" | "xlsx" | "pptx" | "md">(null);

  async function loadMd(): Promise<string> {
    if (markdown) return markdown;
    if (!markdownUrl) throw new Error("Conteúdo indisponível.");
    return await fetchMarkdown(markdownUrl);
  }

  const onPdf = async () => {
    // Open the print window SYNCHRONOUSLY so the browser doesn't treat
    // the later document.write as a popup.
    const w = openPrintWindow();
    if (!w) {
      toast.error("Permita pop-ups para exportar em PDF.");
      return;
    }
    setBusy("pdf");
    try {
      const md = await loadMd();
      renderPdfInWindow(w, title, md);
    } catch (e: any) {
      try { w.close(); } catch {}
      toast.error(e?.message ?? "Falha ao gerar PDF.");
    } finally {
      setBusy(null);
    }
  };

  const wrap = (kind: "docx" | "xlsx" | "pptx" | "md", fn: (md: string) => Promise<void> | void) => async () => {
    setBusy(kind);
    try {
      const md = await loadMd();
      await fn(md);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} variant={variant} disabled={busy !== null}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Exportar como</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onPdf} disabled={busy !== null}>
          <FileType className="mr-2 h-4 w-4 text-red-500" /> PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={wrap("docx", (md) => exportDocx(title, md, baseName))}
          disabled={busy !== null}
        >
          <FileText className="mr-2 h-4 w-4 text-blue-600" /> Word (.docx)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={wrap("xlsx", (md) => exportXlsx(title, md, baseName))}
          disabled={busy !== null}
        >
          <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600" /> Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={wrap("pptx", (md) => exportPptx(title, md, baseName))}
          disabled={busy !== null}
        >
          <Presentation className="mr-2 h-4 w-4 text-orange-500" /> PowerPoint (.pptx)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={wrap("md", (md) => exportMarkdown(md, baseName))}
          disabled={busy !== null}
        >
          <FileCode className="mr-2 h-4 w-4 text-muted-foreground" /> Markdown (.md)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
