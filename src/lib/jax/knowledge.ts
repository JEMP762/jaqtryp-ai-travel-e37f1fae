/**
 * Base de conhecimento do JAX — o assistente oficial da JAQTRYP.
 * Usada tanto no servidor (system prompt) quanto no cliente (sugestões contextuais).
 */

export type JaxTopic = {
  path: string;
  name: string;
  what: string;
  steps: string[];
  credits?: string;
  suggestions: string[];
};

export const JAX_TOPICS: JaxTopic[] = [
  {
    path: "/dashboard",
    name: "Painel (Dashboard)",
    what: "Tela inicial com resumo da conta, saldo de créditos, atalhos para todos os recursos e ativação de notificações.",
    steps: [
      "Veja seu saldo de créditos no card superior.",
      "Use os atalhos para abrir Planejador, Tradutor, Voos, Hospedagem e Carteira.",
      "Ative as notificações para receber avisos de promoções e alertas.",
    ],
    suggestions: ["O que posso fazer no painel?", "Como ativar notificações?"],
  },
  {
    path: "/planner",
    name: "Planejador de Viagem (roteiro com IA)",
    what: "Cria um roteiro completo de viagem com IA: destino, datas, número de viajantes, orçamento e estilo. Pode gerar o roteiro com a logo da sua empresa.",
    steps: [
      "Preencha origem, destino, data de início e quantidade de dias.",
      "Escolha o estilo de viagem e o orçamento.",
      "Escolha entre roteiro padrão (15 créditos) ou roteiro com sua marca (25 créditos).",
      "Para usar a marca, envie sua logo no bloco de identidade visual antes de gerar.",
      "Clique em gerar e depois exporte em PDF se quiser.",
    ],
    credits: "15 créditos (padrão) ou 25 créditos (com logo da sua marca).",
    suggestions: [
      "Como criar meu roteiro?",
      "Como colocar minha logo no roteiro?",
      "Quantos créditos custa um roteiro?",
    ],
  },
  {
    path: "/chat",
    name: "Chat de viagem (JAQ Price)",
    what: "Consultor de viagem com IA. Analisa se preços de hotéis, restaurantes, táxis e passeios estão caros, justos ou econômicos, e sugere alternativas.",
    steps: [
      "Escolha seu perfil de viagem (econômico, mochileiro, conforto, premium ou luxo).",
      "Descreva o preço ou a dúvida (ex.: café da manhã €28 perto da Torre Eiffel).",
      "Receba o selo 🟢 Econômico / 🟡 Justo / 🔴 Caro com alternativas.",
    ],
    credits: "Consome créditos por mensagem.",
    suggestions: ["Para que serve o JAQ Price?", "Como analisar se um preço está caro?"],
  },
  {
    path: "/translator",
    name: "Tradutor",
    what: "Traduz textos, imagens, cardápios e placas em vários idiomas, com áudio da tradução.",
    steps: [
      "Escolha o idioma de destino.",
      "Digite o texto ou envie a foto do cardápio/placa.",
      "Toque em traduzir e use o botão de áudio para ouvir a pronúncia.",
    ],
    credits: "Consome créditos por tradução (texto é mais barato que imagem).",
    suggestions: ["Como traduzir uma foto de cardápio?", "Como ouvir a tradução em áudio?"],
  },
  {
    path: "/live-translator",
    name: "Live Translator (sala ao vivo)",
    what: "Conversa traduzida em tempo real entre duas pessoas, por texto e áudio, com opção de chamada de vídeo HD.",
    steps: [
      "Crie a sala e compartilhe o código de convite com a outra pessoa.",
      "Cada participante escolhe o próprio idioma.",
      "Use o botão redondo de microfone (walkie-talkie): segure para falar, solte para enviar.",
      "A tradução aparece na tela e o áudio traduzido é reproduzido.",
      "Para vídeo, o anfitrião inicia a chamada e o convidado entra pelo mesmo código.",
    ],
    credits: "Apenas o anfitrião paga os créditos da sala; o convidado não é cobrado.",
    suggestions: [
      "Como convidar alguém para a sala?",
      "Como funciona o botão de microfone?",
      "Como iniciar a chamada de vídeo?",
    ],
  },
  {
    path: "/file-translator",
    name: "Tradutor de Arquivos",
    what: "Traduz documentos inteiros (PDF, textos e outros arquivos) mantendo o conteúdo organizado.",
    steps: [
      "Envie o arquivo.",
      "Escolha o idioma de destino.",
      "Aguarde o processamento e baixe o arquivo traduzido.",
    ],
    credits: "Consome créditos conforme o tamanho do arquivo.",
    suggestions: ["Quais arquivos posso traduzir?", "Como baixar o arquivo traduzido?"],
  },
  {
    path: "/flights",
    name: "Voos",
    what: "Busca de passagens aéreas. A reserva é finalizada em parceiros públicos (Skyscanner e Google Flights).",
    steps: [
      "Informe origem, destino e datas.",
      "Veja as opções encontradas.",
      "Toque em um dos botões de parceiro para concluir a compra no site oficial.",
    ],
    suggestions: ["Como buscar passagens?", "Posso reservar o voo dentro do app?"],
  },
  {
    path: "/stays",
    name: "Hospedagem",
    what: "Busca de hotéis e acomodações, com redirecionamento para Booking.com, Hotels.com e Airbnb.",
    steps: [
      "Informe destino, datas, hóspedes e quartos.",
      "Veja as opções e compare.",
      "Toque no parceiro desejado para reservar no site oficial.",
    ],
    suggestions: ["Como procurar hotel?", "Por que a reserva abre em outro site?"],
  },
  {
    path: "/wallet",
    name: "Carteira IA (controle financeiro)",
    what: "Controla os gastos da viagem por categoria e moeda, com orçamento diário, reserva de emergência, conversão automática e alertas.",
    steps: [
      "Crie uma carteira e defina a moeda principal.",
      "Defina o orçamento total e o diário.",
      "Registre gastos manualmente ou pela foto do recibo.",
      "Acompanhe os alertas quando estiver perto do limite.",
    ],
    suggestions: ["Como controlar meus gastos?", "Como registrar um gasto por foto?"],
  },
  {
    path: "/deals",
    name: "Promoções",
    what: "Ofertas e oportunidades de viagem selecionadas.",
    steps: ["Abra a aba Promoções e veja as ofertas disponíveis."],
    suggestions: ["Onde vejo as promoções?"],
  },
  {
    path: "/credits",
    name: "Créditos",
    what: "Mostra seu saldo, o histórico de consumo e permite comprar pacotes de créditos.",
    steps: [
      "Veja o saldo atual e o extrato de consumo.",
      "Escolha um pacote para recarregar.",
      "O saldo é atualizado logo após o pagamento.",
    ],
    suggestions: ["Como comprar créditos?", "Onde vejo meu consumo?"],
  },
  {
    path: "/billing",
    name: "Minha Assinatura",
    what: "Gerencia o plano assinado, renovação e créditos mensais.",
    steps: ["Veja o plano ativo.", "Assine, troque ou cancele o plano por aqui."],
    suggestions: ["Como assinar um plano?", "Como cancelar minha assinatura?"],
  },
  {
    path: "/referrals",
    name: "Indique e ganhe",
    what: "Programa de indicações: você ganha 10% dos créditos comprados por quem indicou, 100 créditos por assinatura Pro e 200 por assinatura Ultra.",
    steps: [
      "Copie seu código ou link de indicação.",
      "Compartilhe com amigos.",
      "Quando a pessoa comprar créditos ou assinar, seu bônus entra automaticamente.",
    ],
    suggestions: ["Como funciona a indicação?", "Quantos créditos eu ganho por indicação?"],
  },
  {
    path: "/shield",
    name: "JAQ Shield",
    what: "Recursos de segurança e apoio ao viajante.",
    steps: ["Abra o JAQ Shield para ver as orientações de segurança disponíveis."],
    suggestions: ["O que é o JAQ Shield?"],
  },
  {
    path: "/settings/appearance",
    name: "Aparência",
    what: "Escolha entre modo claro e escuro e troque a paleta de cores do aplicativo.",
    steps: ["Selecione o modo (claro/escuro).", "Escolha o tema de cores preferido."],
    suggestions: ["Como mudar para o modo escuro?", "Como trocar as cores do app?"],
  },
];

export const JAX_ACCOUNT_HELP = `
### Conta e acesso
- **Cadastro**: e-mail e senha (mínimo 8 caracteres) ou entrar com Google. Novos usuários ganham 100 créditos grátis.
- **Login**: /login, com e-mail e senha, Google ou link mágico ("Entrar sem senha").
- **Esqueci a senha**: em /forgot-password é possível pedir um link de redefinição ou um link mágico. O e-mail chega de contact@jaqtryp.com — se não aparecer, checar spam/promoções. O link vale 1 hora e há reenvio após 60 segundos.
- **Notificações**: podem ser ativadas no painel; o app também pode ser instalado como aplicativo (PWA) pelo navegador.
- **Créditos**: cada recurso de IA consome créditos. Quando acabam, aparece o aviso com o botão para recarregar em /credits.
`;

export function topicForPath(path: string): JaxTopic | undefined {
  return JAX_TOPICS.find((t) => path === t.path || path.startsWith(t.path + "/"));
}

export function contextualSuggestions(path: string): string[] {
  const topic = topicForPath(path);
  if (topic) return topic.suggestions.slice(0, 3);
  return ["O que a JAQTRYP faz?", "Como funcionam os créditos?", "Como criar um roteiro?"];
}

export function contextualGreetingHint(path: string): string | null {
  const topic = topicForPath(path);
  if (!topic) return null;
  return `Posso te ensinar a usar **${topic.name}**.`;
}

/** Resumo compacto usado no system prompt do modelo. */
export function knowledgeSummary(): string {
  const lines = JAX_TOPICS.map((t) => {
    const steps = t.steps.map((s) => `  - ${s}`).join("\n");
    return `### ${t.name} (${t.path})\n${t.what}\n${steps}${t.credits ? `\n  - Créditos: ${t.credits}` : ""}`;
  });
  return `# Mapa da plataforma JAQTRYP\n\n${lines.join("\n\n")}\n${JAX_ACCOUNT_HELP}`;
}
