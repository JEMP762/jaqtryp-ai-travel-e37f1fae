export const ITINERARY_INTERESTS = [
  { id: "culture", label: "Cultura e história", prompt: "cultura, história, museus, monumentos e patrimônio local" },
  { id: "gastronomy", label: "Gastronomia", prompt: "gastronomia local, mercados, cafés e restaurantes típicos" },
  { id: "nature", label: "Natureza", prompt: "parques, paisagens, praias, trilhas leves e contato com a natureza" },
  { id: "adventure", label: "Aventura", prompt: "aventura, esportes, trilhas e experiências ao ar livre" },
  { id: "family", label: "Família", prompt: "atrações para família e atividades adequadas para crianças" },
  { id: "romance", label: "Romance", prompt: "experiências românticas, mirantes, passeios a dois e jantares especiais" },
  { id: "nightlife", label: "Vida noturna", prompt: "bares, música, espetáculos e vida noturna" },
  { id: "shopping", label: "Compras", prompt: "compras, feiras, artesanato, lojas locais e centros comerciais" },
  { id: "wellness", label: "Bem-estar", prompt: "bem-estar, descanso, spas e experiências tranquilas" },
  { id: "photography", label: "Fotografia", prompt: "lugares fotogênicos, arquitetura, paisagens e melhores horários para fotos" },
] as const;

export const ITINERARY_INTEREST_IDS = ITINERARY_INTERESTS.map((interest) => interest.id);

export function itineraryInterestPrompt(ids: string[], custom = "") {
  const selected = ITINERARY_INTERESTS
    .filter((interest) => ids.includes(interest.id))
    .map((interest) => interest.prompt);
  if (custom.trim()) selected.push(custom.trim());
  return selected.join("; ");
}