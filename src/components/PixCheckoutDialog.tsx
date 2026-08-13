import * as React from "react";
import { Loader2, Copy, Check, CheckCircle2, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { createPixPayment, getPixPaymentStatus } from "@/lib/pix.functions";
import { formatBrl } from "@/lib/pix-packs";

interface Props {
  lookupKey: string | null;
  onClose: () => void;
  onPaid: () => void;
}

type Payment = Extract<Awaited<ReturnType<typeof createPixPayment>>, { qrCode: string }>;

export function PixCheckoutDialog({ lookupKey, onClose, onPaid }: Props) {
  const open = !!lookupKey;
  const [loading, setLoading] = React.useState(false);
  const [payment, setPayment] = React.useState<Payment | null>(null);
  const [status, setStatus] = React.useState<string>("pending");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!lookupKey) {
      setPayment(null);
      setStatus("pending");
      return;
    }
    let cancelled = false;
    setLoading(true);
    createPixPayment({ data: { lookupKey } })
      .then((res) => {
        if (cancelled) return;
        if ("error" in res) {
          toast.error(res.error);
          onClose();
          return;
        }
        setPayment(res);
      })
      .catch((e: any) => {
        if (!cancelled) {
          toast.error(e?.message || "Falha ao gerar o PIX");
          onClose();
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  React.useEffect(() => {
    if (!payment || status === "approved") return;
    const timer = setInterval(async () => {
      try {
        const res = await getPixPaymentStatus({ data: { id: payment.id } });
        if (res.status === "approved") {
          setStatus("approved");
          toast.success(`Pagamento confirmado! +${payment.credits} créditos`);
          onPaid();
        } else if (res.status === "rejected" || res.status === "cancelled") {
          setStatus(res.status);
        }
      } catch {
        /* silencioso */
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [payment, status, onPaid]);

  const copy = async () => {
    if (!payment) return;
    await navigator.clipboard.writeText(payment.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-emerald-400" /> Pagamento via PIX
          </DialogTitle>
        </DialogHeader>

        {loading || !payment ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Gerando código PIX…
          </div>
        ) : status === "approved" ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            <p className="text-lg font-bold">Pagamento aprovado!</p>
            <p className="text-sm text-muted-foreground">+{payment.credits} créditos adicionados à sua conta.</p>
            <Button className="mt-2" onClick={onClose}>
              Fechar
            </Button>
          </div>
        ) : status === "rejected" || status === "cancelled" ? (
          <div className="py-8 text-center text-sm text-rose-400">
            Pagamento {status === "rejected" ? "recusado" : "cancelado"}. Tente novamente.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">{formatBrl(payment.amountBrl)}</div>
              <div className="text-xs text-muted-foreground">{payment.credits} créditos</div>
            </div>

            {payment.qrCodeBase64 && (
              <img
                src={`data:image/png;base64,${payment.qrCodeBase64}`}
                alt="QR Code PIX para pagamento da recarga de créditos"
                className="mx-auto h-56 w-56 rounded-xl bg-white p-2"
              />
            )}

            <div>
              <p className="mb-1 text-xs text-muted-foreground">PIX copia e cola</p>
              <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3">
                <code className="max-h-20 flex-1 overflow-y-auto break-all text-[11px]">{payment.qrCode}</code>
                <Button size="sm" variant="outline" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação do pagamento…
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
