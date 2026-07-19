## Garantia de compatibilidade — sem quebrar usuários existentes nem login

Nada do que foi implementado agora (ocultar preços na landing + `UpgradeGateDialog`) altera o fluxo de autenticação, sessões, senhas ou dados existentes. Mesmo assim, vou fazer uma passagem de verificação e endurecer 3 pontos para garantir zero impacto:

### 1. Login e cadastro — intocados
- Não vou mexer em `src/routes/login.tsx`, `signup.tsx`, `reset-password.tsx`, `_authenticated/route.tsx`, `handle_new_user`, triggers ou RPCs de auth.
- Verificação: reler os arquivos e confirmar que nenhuma alteração desta rodada os importa/afeta.

### 2. Usuários já pagantes / com assinatura ativa — não veem o modal
O `useUpgradeGate` só abre quando:
- `free + monthly + topup == 0` **E**
- `lifetimeSpent >= 1` **E**
- `has_premium_access() == false`

Reforços para garantir:
- Se qualquer uma das 3 queries falhar (rede/RLS), o hook trata como "não abrir" (fail-safe silencioso, nunca fail-open).
- Adicionar guarda extra: se `subscription_status in ('active','trialing','past_due')` → nunca abrir, mesmo com saldo zero.
- Nunca abrir automaticamente em rotas de auth (`/login`, `/signup`, `/reset-password`, `/auth/*`) nem no primeiro carregamento antes das queries resolverem.

### 3. Usuários novos (100 créditos grátis) — sem interrupção
- Enquanto `lifetimeSpent < 1` (ainda não gastou nada), modal nunca abre.
- Toast de "crédito insuficiente" continua aparecendo só quando uma ação realmente falha por saldo — comportamento idêntico ao anterior, só muda o botão do toast (agora abre modal em vez de link direto).

### 4. Landing page — apenas visual
- Removi números/toggle, mas mantive IDs de preço, `CREDIT_PACKS`, `useSubscriptionCheckout` e todo o backend Stripe intactos. Checkout existente continua funcionando normalmente para quem já usa.

### Verificação final
- `tsgo` (typecheck) já passou.
- Vou reler `_app.tsx`, `useUpgradeGate.tsx` e `credit-error.ts` para confirmar as guardas acima e ajustar se faltar alguma.
- Sem migração de banco, sem mudança em RLS, sem mudança em auth.

Confirma que sigo com esses reforços de segurança no modal (itens 2 e 3)?
