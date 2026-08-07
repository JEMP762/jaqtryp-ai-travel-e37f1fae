# Integração Mystifly (OnePoint) — JAQTRYP

Documentação técnica da integração com a API Mystifly usada para busca,
reserva e emissão de bilhetes aéreos.

## 1. Credenciais e ambientes

As credenciais **nunca** ficam no banco nem no código: são segredos do backend,
lidos apenas dentro de handlers de servidor.

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `MYSTIFLY_BASE_URL_SANDBOX` | sim (homologação) | Base URL do ambiente de testes |
| `MYSTIFLY_BASE_URL_PRODUCTION` | sim (produção) | Base URL do ambiente de produção |
| `MYSTIFLY_USERNAME` | sim | Usuário fornecido pela Mystifly |
| `MYSTIFLY_PASSWORD` | sim | Senha fornecida pela Mystifly |
| `MYSTIFLY_API_KEY` | opcional | Chave adicional, quando exigida |
| `MYSTIFLY_ACCOUNT_NUMBER` | opcional | Número da conta/agência |

O ambiente ativo (`sandbox` ou `production`) é escolhido na tela
**Admin → Mystifly**, sem necessidade de novo deploy.

## 2. Estrutura de pastas

```text
src/lib/mystifly/
  types.ts            Tipos, chaves e caminhos dos endpoints
  validators.ts       Schemas Zod de todas as entradas
  utils.ts            Redação de dados sensíveis, backoff, erros
  client.server.ts    Cliente HTTP: auth, retry, timeout, rate limit, logs
  session.server.ts   Ciclo de vida da sessão (cache + renovação)
  search.server.ts    Search, Branded Fare, Revalidate, Fare Rules
  booking.server.ts   Book Flight (instantâneo e hold)
  ticket.server.ts    Order Ticket
  trip.server.ts      Trip Details e Booking Notes
  cancel.server.ts    Booking Cancel
  invoice.server.ts   Invoice Search
  ptr.server.ts       Post Ticketing Requests (criação e busca)
  schedule.server.ts  Schedule Change
  credit.server.ts    Credit Note
  admin.server.ts     Dashboard, logs, salvar config, testar conexão
  runner.server.ts    Roteador endpoint → serviço (tela de testes)
src/lib/mystifly.functions.ts   Server functions expostas ao app
src/routes/_app.admin.mystifly.tsx       Configuração + dashboard
src/routes/_app.admin.mystifly-test.tsx  Console de testes
```

Arquivos `*.server.ts` jamais entram no bundle do navegador. O gateway
`mystifly.functions.ts` é um invólucro fino: importa os serviços dentro dos
handlers.

## 3. Endpoints implementados

| Chave | Função |
| --- | --- |
| `createSession` | Cria/renova a sessão |
| `searchLowestFare` | Busca menor tarifa |
| `searchBrandedFare` | Busca tarifas com marca |
| `revalidate` | Revalida a tarifa antes de reservar |
| `fareRules` | Regras tarifárias |
| `bookFlight` | Reserva (instantânea ou hold) |
| `orderTicket` | Emissão do bilhete |
| `tripDetails` | Detalhes da reserva |
| `bookingCancel` | Cancelamento |
| `bookingNotes` | Observações na reserva |
| `invoiceSearch` | Busca de faturas |
| `postTicketingRequest` | Solicitação pós-emissão (void, reembolso, alteração) |
| `ptrSearch` | Consulta de solicitações pós-emissão |
| `scheduleChange` | Alterações de malha |
| `creditNote` | Notas de crédito |

## 4. Sessão, retry e limites

- A sessão é criada sob demanda e mantida em cache pelo tempo configurado
  (padrão 900s), com renovação automática em respostas de sessão expirada.
- Cada chamada tem timeout configurável (padrão 30s) e até N novas tentativas
  (padrão 2) com backoff exponencial para erros temporários (5xx, rede).
- Limite interno de 120 requisições por minuto para proteger a cota da API.

## 5. Logs e monitoramento

Toda chamada grava em `mystifly_api_logs`: endpoint, status HTTP, sucesso,
duração, referência Mystifly, ID da reserva, erro e payloads truncados com
dados sensíveis redigidos (senha, documentos, cartão).

O dashboard em **Admin → Mystifly** mostra status da conexão, sessão ativa,
requisições e erros nas últimas 24h, tempo médio de resposta e as últimas
operações de busca, reserva e emissão.

## 6. Segurança e conformidade

- Acesso às telas e às server functions restrito ao papel `admin`
  (tabela `user_roles`).
- RLS ativo em `mystifly_settings` e `mystifly_api_logs`, com leitura e escrita
  apenas para administradores.
- Nenhum dado sensível é exibido no navegador; a tela de configuração informa
  somente se cada credencial está presente.
- Dados pessoais de passageiros não são persistidos nos logs.

## 7. Checklist de homologação

1. Configurar credenciais de sandbox e testar a conexão.
2. `searchLowestFare` One Way em classe econômica.
3. `searchLowestFare` Return em classe econômica.
4. `searchBrandedFare` com múltiplos passageiros.
5. `fareRules` e `revalidate` sobre uma tarifa retornada.
6. `bookFlight` com hold e `tripDetails` conferindo o PNR.
7. `orderTicket` emitindo o bilhete.
8. `bookingNotes` e `invoiceSearch`.
9. `postTicketingRequest` (void/reembolso) e `ptrSearch`.
10. `bookingCancel` em uma reserva de teste.
11. `scheduleChange` e `creditNote`.
12. Conferir os registros correspondentes em **Últimas chamadas**.

Após aprovação, alternar o ambiente para `production` na tela de configuração.
