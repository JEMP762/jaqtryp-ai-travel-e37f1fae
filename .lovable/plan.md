# JAX menos intrusivo no celular + Roteiro na página do usuário

## 1. Botão do JAX no mobile

Hoje o botão flutua grande (56px) no canto inferior direito, com balão de texto, e cobre botões de outras telas (gravar áudio, enviar, ações do rodapé).

Mudanças, apenas no celular (no desktop fica como está):

- Botão menor (40px) e mais discreto, encostado na borda direita, um pouco mais acima do rodapé para não cobrir barras de ação.
- Recolhe ao rolar: ao rolar a página para baixo o botão vira uma meia-pastilha semitransparente colada na borda; ao parar de rolar ou rolar para cima ele volta ao normal.
- Balão de frases rotativas e as dicas contextuais deixam de aparecer no celular (só desktop). Sem o balão, nada mais cobre o conteúdo.
- Fica arrastável verticalmente: o usuário pode subir/descer o botão e a posição é lembrada no aparelho.
- Some automaticamente enquanto o teclado/campo de texto estiver em foco e nas telas de gravação ao vivo (sala ao vivo), voltando depois.

## 2. Gerador de roteiro na página do usuário

Duas entregas, conforme escolhido:

### a) Página pública própria
- Nova rota pública `/r/<slug>` (ex.: `jaqtryp.com/r/minhamarca`), sem login para o visitante.
- Usa a logo, nome e cores já cadastrados em "Identidade visual" do planejador.
- Formulário simplificado: destino, data de início, dias, viajantes, estilo, orçamento → gera o roteiro com a marca e permite baixar em PDF.
- O dono escolhe o slug em uma nova aba "Meu link / Widget" dentro do Planejador, com botão de copiar link e de ativar/desativar a página.

### b) Widget para colar no site
- Na mesma aba, um código `<iframe>` pronto para copiar, apontando para `/r/<slug>?embed=1` (versão sem cabeçalho/rodapé, altura ajustável).
- O widget aceita apenas domínios que o dono cadastrar (lista de domínios permitidos), evitando uso por terceiros.

### Créditos e proteção contra abuso
- Cada roteiro gerado pelo visitante debita 25 créditos (roteiro com marca) do dono do link.
- Sem saldo: o visitante vê uma mensagem neutra ("indisponível no momento") e o dono recebe aviso no painel.
- Limites por link: máximo de gerações por hora/dia (configurável pelo dono, com padrão seguro), limite por IP do visitante e verificação anti-robô antes de gerar.
- Novo painel simples no Planejador: quantos roteiros foram gerados pelo link e quantos créditos consumiram.

## Detalhes técnicos

- Mobile: `useIsMobile` + listener de scroll em `JaxLauncher.tsx`; classes menores, `bubble` desabilitado no mobile; posição vertical salva em `localStorage`; ocultar quando `document.activeElement` é input/textarea ou rota `/live-room/*`.
- Nova tabela `public.trip_widgets` (owner_id, slug único, ativo, domínios permitidos, limites, contadores) + `trip_widget_generations` (log por geração, IP hash, créditos gastos). RLS: dono lê/escreve; leitura pública apenas dos campos de exibição do slug ativo, via função `security definer` para não expor o owner_id. GRANTs explícitos para `anon`/`authenticated`/`service_role`.
- Geração pública via rota de servidor `src/routes/api/public/widget-itinerary.ts`: valida payload com Zod, confere slug/ativo/origem, aplica rate limit, cobra o dono com `spend_for_feature` (`trip_create_branded`) usando cliente admin dentro do handler, chama o mesmo prompt do planejador e devolve o roteiro.
- Página `src/routes/r.$slug.tsx` (pública) reaproveita os componentes de exibição/PDF do planejador; `head()` próprio com título/descrição da marca. Modo `?embed=1` remove chrome.
- Nova aba de configuração dentro de `_app.planner.tsx` consumindo funções em `src/lib/trip-widget.functions.ts`.

## Fora do escopo
- Cobrança do visitante, contas próprias para visitantes e personalização visual avançada do widget (fontes/CSS) ficam para depois.
