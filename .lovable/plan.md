## Objetivo
Vincular os 3 pacotes de créditos avulsos aos IDs de produto Stripe que você forneceu, sem alterar preços, créditos ou demais regras já implementadas.

## Mapeamento
| Pacote | Créditos | Preço | Stripe Product ID |
|---|---|---|---|
| Starter | 700 | US$ 9,99 | `prod_UlMf0q6vvfA0He` |
| Explorer | 2.000 | US$ 24,99 | `prod_UlMgLGFHU8Vpbk` |
| Global | 4.000 | US$ 59,99 | `prod_UlMhQaBJyIp1vg` |

## Mudanças

1. **`src/lib/credits.functions.ts`**
   - Adicionar campo `stripeProductId` em cada item de `CREDIT_PACKS`.
   - No `createCreditPackCheckout`, trocar a resolução de preço:
     - Hoje: `stripe.prices.list({ lookup_keys: [lookupKey] })`.
     - Novo: `stripe.prices.list({ product: pack.stripeProductId, active: true, limit: 10 })` e selecionar o preço cujo `unit_amount` bate com `priceUsd * 100` e `currency === 'usd'`.
   - Mantém o fallback por `lookup_key` se nenhum preço for encontrado (compatibilidade).
   - Continuar passando `metadata.lookup_key` e `metadata.credits` na sessão (o webhook já usa isso para creditar).

2. **`src/routes/api.public.payments.webhook.ts`**
   - Nenhuma mudança necessária: o webhook credita com base em `metadata.credits` / `metadata.lookup_key`, que continuam sendo enviados.

3. **Sem migração de banco** e **sem alterações na UI** (`/credits`, dashboard, banner de saldo baixo).

## Validação
- Verificar no preview que cada pacote abre o Embedded Checkout com o valor correto (9,99 / 24,99 / 59,99) e que a compra credita o saldo `topup_balance` via webhook.

## Pré‑requisito
Os 3 produtos Stripe acima precisam ter ao menos um **price ativo em USD** com o valor correspondente. Se algum produto ainda não tiver price criado, eu crio com `payments--create_price` na etapa de build.
