## Objetivo
Garantir que toda compra de pacote avulso seja creditada automaticamente pelo webhook — sem intervenção manual — mesmo em casos de borda.

## Diagnóstico do que aconteceu

A compra `pi_3TlqBzF2249riykh0lrbWM9g` falhou ao creditar porque:

1. O Checkout Session foi criado **antes** do deploy que passou a espelhar `metadata` para o `PaymentIntent` (`payment_intent_data.metadata`).
2. Quando o webhook recebeu `payment_intent.succeeded`, o `obj.metadata` estava vazio → handler descartou o evento (`meta.kind !== "credit_pack"`).
3. O fix de espelhar metadata já está no código, mas só vale para **novas** compras. Precisa também estar publicado (produção).

Para 100% de confiabilidade, vamos adicionar redundância para que **mesmo sem metadata** o webhook consiga creditar.

## O que vou implementar

### 1. Fallback robusto no webhook (`src/routes/api.public.payments.webhook.ts`)

Quando `payment_intent.succeeded` chegar **sem metadata** (ou sem `kind=credit_pack`), o handler vai:

- Buscar o Customer no Stripe (`stripe.customers.retrieve(obj.customer)`).
- Ler `customer.metadata.userId` (já populado no `createCreditPackCheckout`).
- Mapear o valor pago (`obj.amount_received` em centavos) → pacote correspondente em `CREDIT_PACKS` (999→700, 2499→2000, 5999→4000).
- Se casar usuário + valor, creditar com `add_credits` usando `pi_id` como `stripe_session_id` (idempotente).
- Logar `[credit_pack] resolved via customer fallback` para auditoria.

Resultado: mesmo se a metadata sumir por qualquer motivo (race, edição de Checkout, integrações antigas), o crédito é aplicado.

### 2. Tratamento dual de eventos sem duplicidade

Stripe envia `checkout.session.completed` **e** `payment_intent.succeeded` para o mesmo pagamento. A idempotência atual usa `obj.id`, que é diferente entre os dois (`cs_…` vs `pi_…`) — isso permitiria créditos duplicados em teoria.

Correção: usar sempre o **PaymentIntent id** como chave de idempotência.
- Em `checkout.session.completed`: usar `obj.payment_intent` (string id do PI).
- Em `payment_intent.succeeded`: usar `obj.id`.
- Ambos gravam o mesmo `stripe_session_id = pi_…` no ledger → segunda inserção é ignorada pela função `add_credits`.

### 3. Logs estruturados para monitoramento

Adicionar logs claros em cada caminho para facilitar diagnóstico futuro via `server-function-logs`:
- `[credit_pack] received` (com type, id, metadata keys)
- `[credit_pack] credited` (com userId, credits, sessionId)
- `[credit_pack] skipped` (com motivo: not_credit_pack | missing_user | unknown_amount)
- `[credit_pack] fallback_used` (quando resolveu via customer)

### 4. Publicação obrigatória

O webhook só passa a usar o código novo após publicar o projeto. Vou lembrar de publicar ao final, e sugerir o botão de publish.

## Detalhes técnicos

**Mapeamento valor → pacote** (mesmo `CREDIT_PACKS` já existente):

```text
999 cents  → 700  créditos (Starter)
2499 cents → 2000 créditos (Explorer)
5999 cents → 4000 créditos (Global)
```

**Fluxo do handler (novo):**

```text
event.type in (checkout.session.completed, payment_intent.succeeded)
  ↓
extrair PI id (de obj.payment_intent ou obj.id)
  ↓
tentar metadata direta (kind=credit_pack)
  ├─ sim → creditar
  └─ não → fallback:
            buscar customer
            customer.metadata.userId existe?
              └─ sim + valor casa pacote → creditar
              └─ não → log skip + retornar 200
```

**Idempotência:** `add_credits` já retorna sem alterar quando `stripe_session_id` já existe no ledger → seguro chamar múltiplas vezes.

**Arquivos alterados:**
- `src/routes/api.public.payments.webhook.ts` — refatorar `handleCreditPackEvent`.

Nenhuma migração de DB necessária — `add_credits` e `credit_ledger` já suportam o fluxo.

## Após aprovação

1. Aplico o código.
2. Você publica o projeto (botão de publish) para o webhook em produção rodar a nova versão.
3. Próximas compras são creditadas automaticamente, com fallback duplo de segurança.