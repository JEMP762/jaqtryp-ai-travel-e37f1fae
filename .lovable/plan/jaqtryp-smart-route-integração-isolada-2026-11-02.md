# JAQTRYP SMART ROUTE — integração isolada

## Análise da integração

- O JAQTRYP existente usa React 19, TypeScript, TanStack Start/Router e Tailwind 4, com Lovable Cloud. Não será criado outro projeto nem substituída a arquitetura.
- O painel já tem menu compartilhado entre computador e celular. A única alteração prevista nesse menu é adicionar **SMART ROUTE**, mantendo todos os itens atuais.
- Há GPS pontual e mapa Leaflet na ferramenta Shield, mas não há um sistema completo de navegação, busca de endereços ou trajetos de ônibus/metrô. O Shield ficará intacto.
- Áudio e notificações já possuem recursos reutilizáveis. Notificações de aproximação e acompanhamento contínuo ainda precisam ser implementados no novo módulo, sem mudar o assistente de viagem.
- O banco foi consultado: existem 47 tabelas, incluindo viagens, atividades diárias, resultados salvos e assinaturas de notificações. O planejador salva parte dos roteiros como texto em resultados; não há um formato estruturado único para paradas navegáveis.
- Autenticação, créditos, assinaturas, pagamentos, indicação e administração permanecem como estão. O módulo não usará o gerador IA atual para criar rotas nem atribuirá um custo de créditos por conta própria.

## O que será adicionado

### 1. Painel exclusivo SMART ROUTE

Uma nova página dentro do JAQTRYP, com duas modalidades escolhidas pelo usuário:

- **Atrações do roteiro:** selecionar um roteiro salvo, escolher um dia e confirmar os locais para montar a sequência de visitas. Importar apenas dados realmente disponíveis; texto sem endereço precisa de busca e confirmação, não de coordenadas inventadas pela IA.
- **Buscar trajeto:** escolher origem e destino, utilizando a localização atual como origem somente após autorização.

Mapa com posição atual, marcadores e caminho; seleção de caminhada, carro ou transporte público. Ônibus e metrô serão apresentados conforme a disponibilidade do provedor na cidade, incluindo instruções e horários fornecidos, sem promessa de dados em tempo real onde não existirem.

### 2. Navegação durante o uso

- Iniciar, pausar e encerrar acompanhamento do GPS.
- Mostrar próxima parada, distância e instruções disponíveis.
- Recalcular somente por ação explícita ou desvio confirmado, evitando consultas a cada atualização do GPS.
- Opção de ouvir instruções no idioma escolhido; interromper áudio e GPS ao encerrar a navegação.
- Permissão negada, GPS indisponível, endereço ambíguo e trajeto não encontrado terão estados próprios, sem bloquear o restante do JAQTRYP.
- Notificações opcionais nos dispositivos compatíveis, sem substituir o mecanismo de notificações existente.

### 3. Dados e privacidade

Reaproveitar a leitura dos roteiros/resultados com as permissões atuais, sem modificar seus dados. Persistência da nova sequência de paradas ficará em estruturas exclusivas somente se necessária, com migrações incrementais, permissões explícitas, acesso restrito ao proprietário e instruções de reversão.

Localização ao vivo permanecerá na sessão, sem salvar histórico de deslocamento ou compartilhar a posição por padrão.

## Limitações e dependências antes de implementar

- **Google Maps:** usar a integração do Google Maps para o novo módulo; preservar o mapa já existente no Shield. Consultas são cobradas pelo serviço e podem ficar caras com uso frequente. Aplicar autenticação, limites de quantidade, sugestões com atraso, deduplicação e cache permitido pelo provedor; não criar uma consulta pública ilimitada.
- Existe uma conexão gerenciada acessível, ainda não vinculada ao projeto. Seu mapa funciona em domínios Lovable, mas **não autoriza `jaqtryp.com`**. Para mapa dentro do domínio próprio, é necessária uma conexão com credenciais próprias e domínio autorizado. Apresentar a configuração antes desta etapa; não tratar vincular a conexão gerenciada como solução para o domínio próprio.
- **Tela bloqueada:** navegador/PWA não garante GPS contínuo ou instruções de áudio em segundo plano. A primeira versão acompanha enquanto a página estiver ativa e oferece continuidade no aplicativo de mapas. Notificações não eliminam essa limitação. Se acompanhamento garantido com tela bloqueada for indispensável, interromper essa etapa e discutir uma alternativa, sem reconstruir o projeto.
- Não afirmar que rotas, horários ou trânsito são verificados antes de obter dados do serviço.

## Detalhes técnicos

- Seguir a estrutura de painel autenticado realmente existente (`/_app`), sem criar uma segunda proteção de login nem migrar rotas atuais.
- Nova página `src/routes/_app.smart-route.tsx`, com arquivos exclusivos em `src/components/smart-route/` e `src/lib/smart-route/`.
- Alteração mínima em `src/routes/_app.tsx`: um item no menu compartilhado. Documentar essa justificativa.
- Funções novas autenticadas para busca de locais e cálculo de caminhos, credenciais somente no servidor e chamadas pelo conector. Usar Places API (New) e Routes API; não usar a IA como fonte de endereços ou trajetos.
- Reutilizar os componentes visuais e serviços existentes sem mudar suas interfaces; registrar as decisões estruturais em `AGENTS.md`.
- Antes das alterações funcionais, registrar o ponto recuperável da versão e preservar uma cópia limpa dos arquivos que serão modificados; não manipular o Git gerenciado pela plataforma.

## Validação e entrega

- Testes pequenos de autorização, validação de coordenadas, interpretação de trajetos, limpeza do acompanhamento e prevenção de avisos repetidos.
- Conferir carregamento e navegação no computador e celular, permissões negadas, falhas e estados vazios.
- Conferir os fluxos existentes de login, planejador, tradutor, assistente, treinamento de imigração e painéis; fluxos reais de cobrança só com autorização, sem consumir créditos nem movimentar dinheiro para testes por conta própria.
- Conferir erros de compilação, console e servidor. Relatar qualquer verificação pendente em vez de declarar aprovação global.
- O ambiente de testes do agente **não permite validar Google Maps ao vivo**. Busca, mapa, trajetos e funcionamento no aparelho precisarão da validação do usuário em um endereço autorizado; não simular resultados como prova.
- Não publicar automaticamente. A entrega só será considerada completa após as verificações disponíveis e validação real das dependências, sem perda de dados ou regressões.