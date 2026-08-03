## JAX — Assistente Oficial da JAQTRYP

Assistente novo e separado do chat de viagem (`/chat`), focado 100% em ensinar o usuário a usar a plataforma. Gratuito (sem débito de créditos) e com histórico salvo no banco do projeto.

### 1. Banco de dados
Duas tabelas novas com RLS por usuário:
- `jax_conversations` — id, user_id, title, created_at, updated_at
- `jax_messages` — id, conversation_id, user_id, role (user/assistant), content, page_path, created_at

Regras de acesso: cada usuário só vê, cria e apaga as próprias conversas e mensagens. GRANTs para `authenticated` e `service_role`.

Anti-abuso (JAX é grátis): limite de mensagens por usuário por dia (ex.: 80), validado no servidor contando `jax_messages` das últimas 24h. Ao estourar, o JAX responde educadamente pedindo para tentar novamente mais tarde.

### 2. Cérebro do JAX (base de conhecimento da plataforma)
Novo arquivo `src/lib/jax/knowledge.ts` com um mapa de cada tela real do app e o que ela faz:
- `/dashboard`, `/planner` (roteiro + logo/marca 15 ou 25 créditos), `/flights` (busca + redirecionamento Skyscanner/Google Flights), `/stays` (Booking/Hotels/Airbnb), `/translator`, `/live-translator` e sala ao vivo, `/file-translator`, `/wallet`, `/deals`, `/credits`, `/billing`, `/referrals` (10% de indicação, 100/200 créditos recorrentes), `/shield`, `/settings/appearance`, login/cadastro/recuperação de senha, notificações push/PWA.
- Cada entrada tem: nome, o que faz, passo a passo curto, custo em créditos quando aplicável e perguntas frequentes.

### 3. Rota de IA `/api/jax` (streaming)
Nova rota TanStack (`src/routes/api.jax.tsx`), separada de `/api/chat`:
- Exige usuário autenticado; **não** chama `chargeFeature` (grátis).
- System prompt em PT/EN com: identidade JAX, escopo estrito (só JAQTRYP), lista de assuntos proibidos, recusa educada em 1 frase + convite para perguntar sobre a plataforma, tom humano e respostas curtas (2–5 frases).
- Injeta o resumo da base de conhecimento + a rota atual do usuário no contexto, para respostas contextuais.
- Envia o histórico da conversa (últimas ~24 mensagens) para manter memória (ex.: "Paris" continua valendo na pergunta seguinte).
- Trata 429/402 do gateway com mensagens amigáveis; salva a mensagem do usuário e a resposta completa em `jax_messages`.

Blindagem extra de escopo: um filtro leve no servidor detecta temas claramente proibidos e responde a recusa padrão sem gastar chamada de IA.

### 4. Botão flutuante (todas as páginas)
Novo `src/components/jax/JaxLauncher.tsx`, montado uma vez em `src/routes/_app.tsx` (área logada):
- Fixo no canto inferior direito, acima da navegação mobile, com animação discreta (pulso suave).
- Balão de chamada que alterna frases a cada ~8s: "💬 Precisa de ajuda?", "✈️ Tire suas dúvidas com o JAX.", "🌍 Posso ajudar você.", "🤖 Fale comigo.", "💡 Posso ensinar como usar esta tela.", "✨ Precisa de ajuda com esta função?".
- Clique abre o painel na hora, sem recarregar, com transição suave.

### 5. Painel de chat `JaxPanel.tsx`
- Desktop: janela flutuante 400×620; mobile: folha em tela cheia.
- Cabeçalho com identidade JAX (ícone próprio, não genérico), botões **minimizar**, **limpar conversa** e **fechar**.
- Saudação inicial pelo horário + primeiro nome do perfil: "Bom dia, João! Como posso ajudar você hoje?".
- Sugestões contextuais conforme a rota atual (ex.: em `/planner` → "Como criar meu roteiro?", "Como colocar minha logo?").
- Campo de mensagem fixo no rodapé, rolagem automática, markdown nas respostas, streaming token a token.
- Humanização: ao enviar, mostra "JAX está digitando…" com três pontos animados por 800–2000 ms (variando conforme o tamanho previsto) antes de exibir o texto.
- Tema claro/escuro pelos tokens semânticos existentes; sem cores fixas.
- Área de anexos já prevista no layout (desabilitada nesta versão).

### 6. Proatividade discreta
Se o usuário ficar parado numa tela por ~45s sem interagir, o balão exibe uma dica contextual uma única vez por sessão/rota. Nunca abre o chat sozinho e nunca bloqueia a interface.

### Detalhes técnicos
- Rota: `src/routes/api.jax.tsx` com `createFileRoute` + `server.handlers.POST`, autenticação via `requireAuthFromRequest`, gateway Lovable AI em streaming (mesmo padrão de `api.chat.tsx`), modelo `google/gemini-3.5-flash`.
- Persistência via server functions em `src/lib/jax.functions.ts` (listar/criar conversa, carregar mensagens, apagar conversa), respeitando RLS do usuário.
- Componentes: `JaxLauncher.tsx`, `JaxPanel.tsx`, `JaxMessage.tsx`, hook `useJaxChat.ts`; montagem única em `_app.tsx` para não duplicar em cada rota.
- `/chat` (consultor de viagem + JAQ Price) permanece intacto, inclusive a cobrança de créditos dele.
