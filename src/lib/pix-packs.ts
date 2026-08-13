// Preços PIX (BRL) — client-safe. Independentes dos preços em USD do Stripe.
export const PIX_PRICES_BRL: Record<string, number> = {
  credits_700: 49.9,
  credits_2000: 125.9,
  credits_4000: 296.9,
};

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
