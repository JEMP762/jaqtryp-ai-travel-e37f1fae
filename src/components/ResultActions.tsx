import * as React from "react";
import { Copy, MessageCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { shareUserResult, trackActivation } from "@/lib/activation.functions";

export function ResultActions({ resultId, title }: { resultId: string; title: string }) {
  const [busy, setBusy] = React.useState(false);
  const [url, setUrl] = React.useState("");

  const getUrl = async () => {
    if (url) return url;
    const result = await shareUserResult({ data: { resultId } });
    const next = `${window.location.origin}${result.path}`;
    setUrl(next);
    return next;
  };

  const track = () => trackActivation({ data: { event: "share_clicked", properties: {} } }).catch(() => {});
  const share = async () => {
    setBusy(true);
    try {
      const link = await getUrl();
      const nativeShare = typeof navigator.share === "function";
      if (nativeShare) await navigator.share({ title, text: "Confira este resultado criado com JAQTRYP AI", url: link });
      else await navigator.clipboard.writeText(link);
      track();
      toast.success(nativeShare ? "Compartilhado!" : "Link copiado!");
    } catch (error) {
      if ((error as Error).name !== "AbortError") toast.error("Não foi possível compartilhar.");
    } finally {
      setBusy(false);
    }
  };

  const whatsapp = async () => {
    setBusy(true);
    try {
      const link = await getUrl();
      track();
      window.open(`https://wa.me/?text=${encodeURIComponent(`Confira este resultado criado com JAQTRYP AI: ${link}`)}`, "_blank");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    setBusy(true);
    try {
      await navigator.clipboard.writeText(await getUrl());
      track();
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6 border-t border-border pt-5">
      <p className="font-semibold">Seu resultado está pronto.</p>
      <p className="mt-1 text-sm text-muted-foreground">Compartilhe com quem vai viajar com você.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={whatsapp} disabled={busy}><MessageCircle /> WhatsApp</Button>
        <Button variant="outline" onClick={share} disabled={busy}><Share2 /> Compartilhar</Button>
        <Button variant="outline" onClick={copy} disabled={busy}><Copy /> Copiar link</Button>
      </div>
    </div>
  );
}