# PIX (Mercado Pago) como segunda opção de recarga

Adicionar PIX em reais ao lado do Stripe em dólar, sem tocar em nada do fluxo Stripe atual.

## O que NÃO muda

- `src/lib/stripe.ts`, `src/lib/stripe.server.ts`, `src/lib/credits.functions.ts` (checkout Stripe), `src/components/CreditPackCheckout.tsx`
- Webhook atual `/api/public/payments/webhook` (assinaturas, pacotes, voos) — nenhuma linha alterada
- Preços em dólar, produtos/prices do Stripe, assinaturas, regras de crédito

## Preços PIX (independentes do dólar)

| Pacote | Créditos | Stripe | PIX |
|---|---|---|---|
| Starter | 700 | US$ 9,99 | R$ 49,90 |
| Explorer (mais vendido) | 2.000 | US$ 24,99 | R$ 125,90 |
| Global | 4.000 | US$ 59,99 | R$ 296,90 |

## Fluxo do usuário

1. Na página de Créditos, o usuário clica em "Comprar" no pacote.
2. Abre um seletor: "Como você deseja pagar?" → Cartão / Stripe (US$) ou PIX (R$, 10% OFF).
3. Stripe → abre exatamente o diálogo atual.
4. PIX → cria a cobrança no Mercado Pago e mostra QR Code + código copia-e-cola, com contagem de expiração e verificação automática de status a cada poucos segundos.
5. Quando o pagamento é aprovado, o saldo é atualizado e aparece no histórico.

## Backend

Nova tabela `pix_payments` (não há tabela genérica de compras hoje; `credit_ledger` continua sendo a fonte do saldo):

- `id`, `user_id`, `provider` ('mercado_pago'), `payment_method` ('pix'), `mp_payment_id` (único),
  `lookup_key`, `credits`, `amount_brl`, `status` ('pending' | 'approved' | 'rejected' | 'cancelled'),
  `qr_code`, `qr_code_base64`, `expires_at`, `created_at`, `updated_at`
- RLS: usuário lê só as próprias linhas; escrita apenas por service_role. GRANTs explícitos.

Server functions novas em `src/lib/pix.functions.ts` (autenticadas):
- `createPixPayment({ lookupKey })` — valida o pacote contra a tabela fixa de preços PIX no servidor (nunca confia em valor vindo do cliente), cria o pagamento no Mercado Pago, grava `pix_payments` como `pending` e devolve QR Code/código.
- `getPixPaymentStatus({ id })` — consulta o Mercado Pago, atualiza a linha e devolve o status.

Novo webhook isolado: `src/routes/api/public/mercadopago.webhook.ts`
- Recebe a notificação, ignora o corpo como fonte de verdade e consulta `GET /v1/payments/{id}` na API do Mercado Pago.
- Libera créditos só se `status === 'approved'`, o valor pago bater com o preço do pacote e o `user_id`/`lookup_key` dos metadados existir.
- Idempotência: `UPDATE ... WHERE mp_payment_id = X AND status <> 'approved'` — só credita se essa atualização afetar uma linha; depois chama a RPC `add_credits` com `reason = 'purchase_pix'` e o id do pagamento como referência.
- `pending` / `rejected` / `cancelled` apenas atualizam status, sem créditos.

O mesmo caminho de liberação é usado pelo polling de status (com a mesma trava de idempotência), para o caso do webhook atrasar.

## Histórico

`listCreditHistory` passa a incluir o método na exibição: entradas com `reason = 'purchase'` mostram "Stripe / US$", entradas `purchase_pix` mostram "PIX · Mercado Pago" com o valor em reais vindo dos metadados do ledger.

## Credenciais

Será solicitado, por formulário seguro, apenas:
- `MERCADOPAGO_ACCESS_TOKEN` (usado somente no servidor)

Opcional depois: segredo para validar assinatura do webhook do Mercado Pago (a consulta na API já garante a segurança).

## Verificação final

- Compra Stripe de ponta a ponta continua idêntica (diálogo, webhook, créditos).
- Compra PIX: QR gerado, status pendente sem créditos, créditos liberados só após aprovação, reenvio do webhook não duplica créditos.
