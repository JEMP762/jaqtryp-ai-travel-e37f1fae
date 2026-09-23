# Segunda etapa — ativação contextual de novos usuários

## Objetivo

Reduzir o caminho entre um link compartilhado e o primeiro resultado útil, preservando integralmente autenticação, créditos, indicações, recursos avançados e páginas atuais.

## Diagnóstico confirmado

- O cadastro já oferece Google e e-mail, mas exige nome e sempre envia o usuário autenticado ao painel geral.
- Hoje somente o código de indicação e um destino simples são preservados temporariamente; conteúdo, funcionalidade e campanha de origem não formam um contexto único.
- O callback do Google recupera apenas o endereço de destino salvo.
- O painel atual apresenta a mesma saudação, ações rápidas, créditos e catálogo de recursos para todos.
- O planejador gera o roteiro apenas na tela; as tabelas existentes de viagens e itinerários não estão sendo alimentadas por esse fluxo. Por isso não existe um resultado persistido para “Continue sua viagem”.
- A página pública `/r/$slug` é um gerador incorporável patrocinado pelo proprietário do widget, não uma página de visualização de um roteiro compartilhado. Ela será preservada.
- A busca de voos já aceita parâmetros de origem, destino e datas. O tradutor e o planejador ainda não recebem um contexto de entrada padronizado.
- A carteira, os arquivos traduzidos e os pedidos possuem persistência; traduções simples e roteiros do painel não possuem continuidade suficiente.
- O JAX já conhece a página atual, porém aparece como ajuda genérica e não acompanha o estágio de ativação.
- Não existe atualmente uma estrutura própria de eventos de ativação/onboarding no banco.
- Os custos continuam centralizados no catálogo existente e o consumo ocorre nas operações atuais; nenhum novo sistema de créditos é necessário.

## Experiência a construir

### 1. Contexto único de entrada

Criar uma camada central de contexto com estes tipos:

- `itinerary`
- `flight_search`
- `image_translation`
- `document_translation`
- `travel_budget`
- `direct`

Ela preservará, antes e depois do Google/e-mail:

- código de indicação;
- conteúdo e funcionalidade de origem;
- destino pretendido após o acesso;
- `utm_source`, `utm_medium`, `utm_campaign` e campanha informada;
- dados seguros para pré-preencher a primeira ação;
- variante de experiência futura.

O contexto ficará temporariamente no navegador durante a entrada e será consolidado na conta após a autenticação. O referral atual continuará sendo aplicado pela função existente, sem duplicação.

### 2. Páginas públicas de conteúdo compartilhado

Criar páginas mobile-first específicas para resultados compartilhados:

- `/roteiro/$slug` para roteiro;
- `/traducao/$slug` para tradução compartilhada.

Cada página abrirá primeiro o conteúdo útil, com metadados próprios para WhatsApp e redes sociais, e só depois exibirá o CTA contextual:

- “Criar meu roteiro”;
- “Traduzir minha imagem”.

O compartilhamento será explícito pelo dono do resultado. O link público mostrará somente uma cópia segura do resultado autorizado, nunca dados privados da conta. O gerador existente `/r/$slug` continuará funcionando sem alteração de finalidade.

### 3. Cadastro simples e contínuo

- Manter “Continuar com Google” como primeira opção.
- Transformar “Continuar com e-mail” em uma alternativa simples, sem pedir nome obrigatório nessa etapa.
- Manter senha segura, recuperação e login existentes.
- Preservar o contexto completo tanto no cadastro por e-mail quanto no retorno do Google.
- Se a pessoa já tiver conta, o mesmo contexto será respeitado no login.
- Após autenticar, enviar para o onboarding contextual ou diretamente para a ação pendente; nunca para o painel genérico quando houver intenção válida.

### 4. Onboarding contextual e retomável

Criar um fluxo focado, sem o catálogo completo do painel, com progresso visível e botões grandes.

Para roteiro:

1. Destino;
2. Datas e duração;
3. Pessoas e estilo, com escolhas clicáveis;
4. Orçamento aproximado e confirmação do custo existente.

Para os demais contextos:

- tradução por imagem: abrir diretamente a captura/envio da primeira imagem;
- tradução de documento: abrir o envio do arquivo;
- orçamento: coletar destino, duração e perfil e abrir a carteira com esses dados;
- voos: coletar rota e datas e abrir a busca já preenchida;
- entrada direta: perguntar apenas “O que você quer fazer agora?” com as cinco ações principais.

O progresso e o rascunho do onboarding serão salvos separadamente. Nenhuma viagem, carteira ou tradução incompleta será criada. Se a pessoa abandonar, poderá retomar do passo válido.

### 5. Primeiro resultado e persistência

- Reaproveitar as funções de geração e cobrança existentes.
- Mostrar o custo real vindo do catálogo antes da confirmação e o saldo gratuito real da conta, sem fixar “100” no código.
- Cobrar apenas quando a operação já puder entregar o resultado, mantendo a regra atual.
- Após sucesso, salvar o resultado mínimo necessário para continuidade e compartilhamento.
- Exibir um estado curto de processamento e, em seguida, o resultado útil na mesma experiência.
- Não apresentar planos ou recargas durante entrada/onboarding; a recarga continuará aparecendo somente quando necessária pelo saldo.

### 6. Descoberta progressiva

Depois do primeiro resultado, mostrar somente próximos passos relacionados:

- roteiro → buscar voos → organizar orçamento;
- tradução de imagem → ouvir/copiar → traduzir documento;
- orçamento → registrar primeira despesa → buscar voo;
- voo → criar roteiro → organizar orçamento.

Após o resultado, disponibilizar WhatsApp, compartilhamento nativo e copiar link. A chamada “Convide amigos e ganhe créditos” usará o programa de indicação atual e só aparecerá nessa etapa positiva.

### 7. JAX contextual

Adicionar uma ajuda compacta e integrada ao estado atual, sem nova tela complexa:

- durante onboarding, uma dica curta referente apenas ao passo atual;
- após o resultado, sugestões relacionadas ao que acabou de ser criado;
- no painel, orientação baseada na última atividade.

O botão flutuante atual será preservado; no onboarding mobile, a ajuda aparecerá dentro da tela para não cobrir controles.

### 8. Painel inteligente e “Continue de onde parou”

Substituir o destaque genérico por estados derivados de dados reais:

- novo usuário: “Comece sua viagem”;
- onboarding pendente: “Continue de onde parou”;
- roteiro existente: “Continue sua viagem”;
- viagem próxima: “Sua viagem está chegando”;
- uso recente de tradução: “Traduzir novamente”.

Criar uma seção de atividade recente com o item, data e CTA correto. O catálogo completo continuará disponível abaixo e na navegação, mas não disputará atenção com a próxima ação principal.

### 9. Eventos e métricas

Registrar, com nomes e propriedades padronizados:

- `onboarding_started`;
- `onboarding_completed`;
- `first_action`;
- `first_result`;
- `second_action`;
- `share_clicked`;
- `feature_discovered`;
- `subscription_started`.

Também registrar visualização do conteúdo compartilhado, clique no CTA, cadastro concluído e retorno. Eventos públicos aceitarão apenas nomes e propriedades permitidos, sem texto de tradução, documentos, e-mail ou conteúdo pessoal.

Criar uma visão administrativa do funil para acompanhar:

- visitante → cadastro;
- cadastro → primeira ação;
- primeira ação → primeiro resultado;
- primeiro resultado → segunda ação;
- resultado → compartilhamento;
- ativação → retorno;
- ativação → assinatura.

A visão mostrará conversão, abandono e tempo entre etapas, filtráveis por funcionalidade, origem, campanha e período.

### 10. Preparação para experimentos

Centralizar textos, CTAs, ordem dos passos e variantes em uma configuração tipada. A variante atribuída será persistida no contexto/evento para permitir comparações futuras sem espalhar condições pelas páginas.

## Componentes e páginas previstos

### Criar

- gerenciador de contexto de entrada e retomada;
- fluxo de onboarding contextual com passos reutilizáveis;
- cartão de próxima ação/continuidade;
- bloco de próximos passos relacionados;
- controles de compartilhamento pós-resultado;
- páginas públicas de roteiro e tradução;
- funções seguras para salvar resultados, progresso e eventos;
- painel administrativo de ativação e funil.

### Alterar

- página de cadastro e login;
- callback do Google;
- área autenticada para apresentar onboarding focado;
- painel principal e ações rápidas;
- planejador, tradutor de imagem/texto, tradutor de arquivos, voos e carteira para receber contexto e registrar sucesso;
- JAX para mensagens de ativação;
- webhooks/fluxos existentes apenas no ponto necessário para registrar `subscription_started` confirmado.

### Preservar

- programa de indicação e recompensas;
- saldos, catálogo e cobrança de créditos;
- Google, e-mail, senha, recuperação e sessões atuais;
- `/r/$slug` e widgets de terceiros;
- pagamentos, planos e recargas;
- todas as funcionalidades e rotas existentes.

## Estrutura técnica

Adicionar tabelas protegidas para:

- estado e rascunho do onboarding por usuário;
- resultados concluídos e retomáveis;
- cópias públicas explicitamente compartilhadas;
- eventos do funil de ativação.

Cada tabela terá permissões explícitas, regras por proprietário e acesso público somente ao snapshot marcado como compartilhado. Escritas públicas de analytics passarão por validação, lista fechada de eventos e limitação de abuso. Conteúdo sensível não entrará nos eventos.

As páginas protegidas continuarão usando a sessão existente; as novas leituras do painel ocorrerão após a autenticação, sem introduzir carregamentos protegidos em páginas públicas.

## Testes de ponta a ponta

1. **Roteiro pelo WhatsApp:** abrir `/roteiro/$slug?ref=...&utm_source=whatsapp`, visualizar, cadastrar por Google e por e-mail, confirmar referral, concluir quatro passos, gerar, compartilhar e abrir novamente o link público.
2. **Tradução por imagem:** abrir resultado compartilhado, cadastrar, chegar diretamente ao envio de imagem, traduzir e acessar os próximos passos.
3. **Entrada direta:** cadastrar sem referral, escolher uma intenção e concluir o onboarding correspondente.
4. **Retorno:** sair e voltar dias depois; validar “Continue sua viagem” e retomada do resultado correto.
5. **Abandono:** parar em cada passo, voltar e retomar sem criar viagem/carteira/tradução incompleta.
6. **Créditos:** validar saldo gratuito real, custo real antes da ação, débito único no sucesso e encaminhamento à recarga apenas quando o saldo for insuficiente.
7. **Segurança e privacidade:** tentar acessar resultado não compartilhado, slug inválido e dados de outro usuário.
8. **Mobile:** validar Google/e-mail, teclado, upload/câmera, CTAs, compartilhamento nativo e ausência de sobreposição do JAX.
9. **Regressão:** login recorrente, referral atual, widgets `/r/$slug`, pagamentos, painel avançado e todas as rotas atuais.

## Critérios de conclusão

- Nenhum link contextual termina no painel genérico antes da primeira ação.
- Referral, origem, campanha e intenção sobrevivem aos dois métodos de cadastro/login.
- Um usuário recebe valor antes de ofertas premium.
- Resultados concluídos podem ser retomados e, por escolha do usuário, compartilhados.
- O painel indica uma única próxima ação prioritária baseada em dados reais.
- Os oito eventos solicitados e as etapas auxiliares aparecem no funil administrativo.
- Os cenários A–E passam em celular e desktop sem regressão dos fluxos existentes.
