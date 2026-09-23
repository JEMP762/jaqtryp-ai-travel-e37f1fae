import { Link } from "@tanstack/react-router";
import { Plane, Wallet, FileText, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = {
  itinerary: [
    { to: "/flights", label: "Buscar voos", icon: Plane },
    { to: "/wallet", label: "Calcular orçamento", icon: Wallet },
  ],
  translation: [
    { to: "/file-translator", label: "Traduzir documento", icon: FileText },
    { to: "/translator", label: "Traduzir outra imagem", icon: Camera },
  ],
} as const;

export function NextSteps({ kind }: { kind: keyof typeof steps }) {
  return (
    <div className="mt-5">
      <p className="mb-3 text-sm font-semibold">O que você quer fazer agora?</p>
      <div className="flex flex-wrap gap-2">
        {steps[kind].map(({ to, label, icon: Icon }) => (
          <Button key={to} asChild variant="outline"><Link to={to}><Icon /> {label}</Link></Button>
        ))}
      </div>
    </div>
  );
}