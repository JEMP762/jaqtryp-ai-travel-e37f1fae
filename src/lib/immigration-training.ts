export type Destination = "usa" | "uk" | "schengen" | "canada";
export type Purpose = "tourism" | "business" | "family" | "transit";

export const DESTINATIONS: { id: Destination; label: string; flag: string; officer: string }[] = [
  { id: "usa", label: "Estados Unidos", flag: "🇺🇸", officer: "CBP Officer" },
  { id: "uk", label: "Reino Unido", flag: "🇬🇧", officer: "Border Force Officer" },
  { id: "schengen", label: "Europa (Schengen)", flag: "🇪🇺", officer: "Border Officer" },
  { id: "canada", label: "Canadá", flag: "🇨🇦", officer: "CBSA Officer" },
];

export const PURPOSES: { id: Purpose; label: string }[] = [
  { id: "tourism", label: "Turismo / Férias" },
  { id: "business", label: "Negócios / Feira" },
  { id: "family", label: "Visitar família ou amigos" },
  { id: "transit", label: "Conexão / Trânsito" },
];

export type Question = { en: string; pt: string; tip: string; sample: string };

const COMMON: Question[] = [
  { en: "Good morning. May I see your passport, please?", pt: "Bom dia. Posso ver seu passaporte, por favor?", tip: "Entregue o passaporte aberto na página da foto e cumprimente.", sample: "Good morning. Here you go." },
  { en: "What is the purpose of your visit?", pt: "Qual é o motivo da sua visita?", tip: "Responda em poucas palavras e de forma coerente com seu visto.", sample: "Tourism. I'm here on vacation." },
  { en: "How long are you planning to stay?", pt: "Quanto tempo pretende ficar?", tip: "Diga o número exato de dias e tenha a passagem de volta.", sample: "Ten days. I return on the twentieth." },
  { en: "Where will you be staying?", pt: "Onde você vai se hospedar?", tip: "Diga o nome do hotel ou endereço; tenha a reserva impressa ou no celular.", sample: "At the Hilton hotel, downtown." },
  { en: "Do you have a return ticket?", pt: "Você tem passagem de volta?", tip: "Mostre a passagem quando pedirem.", sample: "Yes, here is my return ticket." },
  { en: "Are you traveling alone?", pt: "Você está viajando sozinho?", tip: "Seja direto: sozinho, com família ou amigos.", sample: "No, I'm traveling with my wife." },
  { en: "What do you do for a living?", pt: "Qual é a sua profissão?", tip: "Diga sua profissão no Brasil — mostra vínculo com o país.", sample: "I'm an accountant in São Paulo." },
  { en: "How much money are you carrying?", pt: "Quanto dinheiro você está levando?", tip: "Informe o valor aproximado e os cartões; acima de US$10 mil deve ser declarado.", sample: "About one thousand dollars and my credit cards." },
  { en: "Have you been here before?", pt: "Você já esteve aqui antes?", tip: "Responda a verdade; se sim, diga quando.", sample: "Yes, once, in 2023." },
  { en: "Do you have anything to declare?", pt: "Você tem algo a declarar?", tip: "Comidas, sementes e grandes valores precisam ser declarados.", sample: "No, nothing to declare." },
];

const BY_PURPOSE: Record<Purpose, Question[]> = {
  tourism: [
    { en: "What places are you planning to visit?", pt: "Quais lugares pretende visitar?", tip: "Cite 2 ou 3 atrações do seu roteiro.", sample: "Times Square, Central Park and the Statue of Liberty." },
  ],
  business: [
    { en: "What company do you work for, and what meetings do you have?", pt: "Para qual empresa trabalha e quais reuniões terá?", tip: "Negócios ≠ trabalho. Diga reuniões, feira ou conferência; nunca que vai trabalhar.", sample: "I work for ABC Brazil. I'm attending a trade show and client meetings." },
  ],
  family: [
    { en: "Who are you visiting and what is their status here?", pt: "Quem você vai visitar e qual a situação dessa pessoa aqui?", tip: "Diga o grau de parentesco e a situação legal da pessoa.", sample: "My sister. She is a permanent resident." },
  ],
  transit: [
    { en: "What is your final destination?", pt: "Qual é o seu destino final?", tip: "Mostre o cartão de embarque do próximo voo.", sample: "Lisbon. My connection leaves in three hours." },
  ],
};

export function buildQuestions(dest: Destination, purpose: Purpose): Question[] {
  const extra = BY_PURPOSE[purpose];
  const base = [...COMMON];
  if (dest === "uk" || dest === "schengen") {
    base.push({ en: "Do you have travel insurance?", pt: "Você tem seguro viagem?", tip: "Obrigatório no Schengen; tenha a apólice à mão.", sample: "Yes, here is my travel insurance." });
  }
  base.splice(2, 0, ...extra);
  return purpose === "transit" ? [base[0], base[1], extra[0], base[4], base[9]] : base;
}

export const CHECKLIST = [
  "Passaporte válido (mínimo 6 meses)",
  "Visto ou autorização eletrônica (ESTA, eTA, ETIAS/ETA UK) quando exigido",
  "Passagem de volta ou de saída do país",
  "Reserva de hospedagem ou endereço de quem vai receber você",
  "Seguro viagem (obrigatório no Espaço Schengen)",
  "Comprovante de meios financeiros (cartões, extrato)",
  "Comprovante de vínculo no Brasil (trabalho, estudo)",
  "Carta-convite ou de feira/empresa, se for negócios ou visita",
];

export const RISK_WORDS = ["work", "job", "study", "volunteer", "live here", "move", "stay forever", "I don't know"];
