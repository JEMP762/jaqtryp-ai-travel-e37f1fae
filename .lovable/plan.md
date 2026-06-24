## Diagnóstico

A compra foi processada no Stripe e o webhook chegou ao servidor (3 chamadas POST `/api/public/payments/webhook?env=live` retornaram 200 logo após o pagamento), mas o `credit_ledger` não recebeu nenhuma linha de `purchase` e o `topup_balance` continua zero para todos os usuários.

Causa: o handler `handleCreditPackEvent` só atua em `checkout.session.completed`. O endpoint de webhook gerenciado pela Lovable encaminha eventos como `payment_intent.succeeded` e `charge.succeeded`, mas **não inclui `checkout.session.completed`** — por isso as 3 chamadas retornaram 200 sem creditar nada.

Além disso, a `metadata` que enviamos hoje vai apenas para o objeto `Checkout Session`. O `PaymentIntent` chega ao webhook sem `userId`/`credits`/`kind`, então mesmo escutando `payment_intent.succeeded` o handler atual não conseguiria identificar a compra.

## Correções

1. **`src/lib/credits.functions.ts` — `createCreditPackCheckout`**
   - Adicionar `payment_intent_data.metadata` espelhando a metadata da sessão:
     ```ts
     payment_intent_data: {
       description: product.name,
       metadata: { userId, kind: "credit_pack", lookup_key, credits: String(pack.credits) },
     }
     ```
   - Mantém `metadata` no nível da Session (compatibilidade).

2. **`src/routes/api.public.payments.webhook.ts` — `handleCreditPackEvent`**
   - Aceitar dois tipos de evento:
     - `checkout.session.completed` (caminho atual)
     - `payment_intent.succeeded` (novo) → lê `obj.metadata` do PaymentIntent.
   - Usar `obj.id` (PaymentIntent ID) como `_session` para preservar idempotência por `stripe_session_id` no ledger. O caminho de Session continua usando `session.id`. Cada evento gera no máximo uma linha de ledger porque o `add_credits` já filtra duplicidade por `stripe_session_id`, e PI.id ≠ Session.id (ambos são únicos por compra).
   - Adicionar `console.log` curto no início do handler com `type` e `meta.kind` para facilitar diagnóstico futuro.

3. **Backfill manual da compra já realizada**
   - Pedirei o **PaymentIntent ID** (ou e-mail do comprador + horário) para creditar manualmente os créditos via `add_credits` no banco. Sem isso essa compra específica não pode ser reconciliada automaticamente, pois a metadata não chegou ao PaymentIntent.

## Sem mudanças
- UI de `/credits`, dashboard, banner de saldo baixo, RPCs `add_credits`/`spend_credits`, RLS e schema do banco permanecem inalterados.

## Validação
- Fazer nova compra de teste; confirmar nos logs do servidor o `console.log` do handler e ver linha no `credit_ledger` com `reason='purchase'` e `topup_balance` incrementado.
