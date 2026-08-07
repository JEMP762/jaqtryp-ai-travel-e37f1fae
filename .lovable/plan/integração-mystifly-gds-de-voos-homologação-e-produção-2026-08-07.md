# Integração Mystifly (GDS de voos) — homologação e produção

Objetivo: deixar a JAQTRYP pronta para o checklist de homologação da Mystifly, com toda a chamada à API feita no servidor, credenciais nunca expostas, logs completos e telas administrativas de configuração, teste e monitoramento.

## O que será criado

### 1. Credenciais e configuração
- Credenciais (usuário, senha, base URL sandbox/produção, API key) ficam em segredos do backend — nunca no frontend nem no banco.
- Tabela `mystifly_settings` (linha única) apenas para ajustes não sensíveis: ambiente ativo (sandbox/produção), timeout, número de tentativas, tempo de cache, status da última conexão e data da última sincronização. Somente administradores leem/alteram.
- Tabela `mystifly_api_logs`: data, endpoint, request, response, duração, status HTTP, erro, usuário, id da viagem, id da reserva e referência MF. Leitura restrita a administradores.

### 2. Serviço central da API (servidor)
`MystiflyApiService` responsável por: criar sessão, reaproveitar sessão válida em cache, renovar quando expira, aplicar timeout, repetir tentativas em falhas temporárias, limitar taxa de chamadas, validar JSON, padronizar erros e gravar log de toda chamada.

### 3. Endpoints implementados
Create Session, Search Lowest Fare, Search Branded Fare, Revalidate, Fare Rules, Book Flight, Order Ticket, Trip Details, Booking Cancel, Booking Notes, Invoice Search, Post Ticketing Request, PTR Search, Schedule Change, Credit Note — cada um com tipagem, validação de entrada, tratamento de erro e log.

### 4. Telas
- **Configurações → Mystifly API**: ambiente, timeout, tentativas, cache, status da conexão, última sincronização e botão "Testar conexão". Campos de credencial apenas indicam "configurado/ausente", sem mostrar valores.
- **Admin → Mystifly Test**: botões individuais para cada endpoint, exibindo request, response, tempo, status HTTP, erros e logs.
- **Admin → Mystifly Dashboard**: status da API, sessão ativa e tempo restante, último search/booking/ticket, total de requisições, erros das últimas 24h e tempo médio de resposta.
- Todas dentro da área administrativa já existente, com a mesma verificação de papel `admin`.

### 5. Documentação
Arquivo `docs/mystifly.md` com todos os endpoints, exemplos de request/response, mapa dos serviços e o fluxo:
```text
Create Session -> Search -> Revalidate -> Fare Rules -> Book Flight -> Order Ticket -> Trip Details
                                                              |-> Cancel / PTR / Invoice / Credit Note
```

### 6. Checklist de homologação
Ao final, uma lista de status (Implementado / Em desenvolvimento / Pendente) cobrindo One Way, Return, Economy, Premium Economy, Business, First, Booking In Progress, Ticketing In Progress, pós-emissão, cancelamento, reembolso, reemissão e consulta de reserva.

## Detalhes técnicos
- Camada de serviço em `src/lib/mystifly/` (`client.server.ts`, `session.server.ts`, `search.server.ts`, `booking.server.ts`, `ticket.server.ts`, `trip.server.ts`, `invoice.server.ts`, `ptr.server.ts`, `cancel.server.ts`, `schedule.server.ts`, `credit.server.ts`, `types.ts`, `validators.ts`, `utils.ts`) — sufixo `.server` garante que nada disso chegue ao navegador.
- Exposição ao app via `src/lib/mystifly.functions.ts` (server functions finas com `requireSupabaseAuth` + verificação de papel admin nas operações administrativas), respeitando a regra de arquivos de server function serem apenas invólucros.
- Sessão em cache no processo do servidor com expiração; renovação automática ao receber erro de sessão inválida.
- Rotas novas: `/admin/mystifly` (configuração + dashboard) e `/admin/mystifly/test`.
- Sem mocks: se as credenciais não estiverem configuradas, as telas mostram "credenciais ausentes" em vez de dados falsos.

## O que preciso de você
1. As credenciais de sandbox da Mystifly (usuário, senha, base URL e API key, se houver) — vou pedir por um formulário seguro quando começar a execução.
2. Confirmar se as buscas de voo do app (página Voos) devem passar a usar a Mystifly nesta etapa, ou se por ora a integração fica só no ambiente administrativo até a homologação ser aprovada.
