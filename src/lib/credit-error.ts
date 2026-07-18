import { toast } from "sonner";

// Detects credit-exhaustion / spend-permission errors coming from server fns,
// server routes and RPC responses, and shows a standardized toast with a CTA
// to the /credits page. Returns true if the error was handled here.
export function handleCreditError(err: unknown): boolean {
  const anyErr = err as any;
  const msg =
    (typeof err === "string" && err) ||
    anyErr?.message ||
    anyErr?.error ||
    "";
  const reason = anyErr?.reason || anyErr?.code || "";
  const status = anyErr?.status || anyErr?.statusCode;

  const isInsufficient =
    reason === "insufficient" ||
    status === 402 ||
    /cr[eé]ditos?\s+(insuficientes|esgotados)/i.test(String(msg)) ||
    /falha ao debitar cr[eé]ditos/i.test(String(msg)) ||
    /insufficient/i.test(String(msg));

  if (!isInsufficient) return false;

  toast.error("Créditos esgotados", {
    description: "Faça uma recarga para continuar usando este recurso.",
    action: {
      label: "Comprar",
      onClick: () => {
        if (typeof window !== "undefined") window.location.href = "/credits";
      },
    },
    duration: 8000,
  });
  return true;
}

// Convenience: check RPC-style result objects like
// `{ ok:false, reason:"insufficient", needed, have }`.
export function handleCreditResult(result: any): boolean {
  if (result && result.ok === false) {
    return handleCreditError(result);
  }
  return false;
}
