import * as React from "react";
import { CreditCard, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PIX_PRICES_BRL, formatBrl } from "@/lib/pix-packs";

interface Props {
  pack: { lookupKey: string; label: string; credits: number; priceUsd: number } | null;
  onClose: () => void;
  onSelect: (method: "stripe" | "pix") => void;
}

export function PaymentMethodDialog({ pack, onClose, onSelect }: Props) {
  const brl = pack ? PIX_PRICES_BRL[pack.lookupKey] : undefined;

  return (
    <Dialog open={!!pack} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Como você deseja pagar?</DialogTitle>
        </DialogHeader>

        {pack && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {pack.label} · <span className="font-semibold text-foreground">{pack.credits} créditos</span>
            </p>

            <button
              type="button"
              onClick={() => onSelect("stripe")}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card/60 p-4 text-left transition hover:border-primary/60"
            >
              <CreditCard className="h-5 w-5 text-primary" />
              <div className="flex-1">
                <div className="font-semibold">Cartão / Stripe</div>
                <div className="text-xs text-muted-foreground">Pagamento em dólar</div>
              </div>
              <div className="text-right font-bold">US$ {pack.priceUsd.toFixed(2)}</div>
            </button>

            {brl !== undefined && (
              <button
                type="button"
                onClick={() => onSelect("pix")}
                className="relative flex w-full items-center gap-3 rounded-xl border border-emerald-500/50 bg-emerald-500/5 p-4 text-left transition hover:border-emerald-400"
              >
                <QrCode className="h-5 w-5 text-emerald-400" />
                <div className="flex-1">
                  <div className="font-semibold">🇧🇷 PIX</div>
                  <div className="text-xs text-muted-foreground">Pagamento em reais · 10% de desconto</div>
                </div>
                <div className="text-right font-bold text-emerald-400">{formatBrl(brl)}</div>
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
