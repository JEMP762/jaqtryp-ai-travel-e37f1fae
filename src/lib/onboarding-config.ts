import type { EntryIntent } from "./onboarding-context";

export const ONBOARDING_OPTIONS: Array<{
  intent: EntryIntent;
  title: string;
  description: string;
  cta: string;
  path: "/planner" | "/flights" | "/translator" | "/file-translator" | "/wallet";
}> = [
  { intent: "itinerary", title: "Criar um roteiro", description: "Organize sua viagem dia a dia.", cta: "Criar meu roteiro", path: "/planner" },
  { intent: "flight_search", title: "Encontrar um voo", description: "Pesquise sua próxima rota.", cta: "Encontrar meu voo", path: "/flights" },
  { intent: "image_translation", title: "Traduzir uma imagem", description: "Fotografe uma placa ou cardápio.", cta: "Traduzir minha imagem", path: "/translator" },
  { intent: "document_translation", title: "Traduzir um documento", description: "Envie seu primeiro arquivo.", cta: "Traduzir meu documento", path: "/file-translator" },
  { intent: "travel_budget", title: "Calcular uma viagem", description: "Comece um orçamento simples.", cta: "Calcular minha viagem", path: "/wallet" },
];

export function optionFor(intent: EntryIntent) {
  return ONBOARDING_OPTIONS.find((option) => option.intent === intent) ?? ONBOARDING_OPTIONS[0];
}