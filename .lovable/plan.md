# Liberação Premium via Créditos Avulsos

## Objetivo
Garantir que qualquer usuário com `topup_balance > 0` (créditos avulsos) tenha o mesmo acesso de um assinante Pro/Ultra, sem alterar planos, valores ou o checkout existente.

## Diagnóstico atual
Hoje o "gate premium" usa apenas a RPC `has_active_subscription`:
- `src/lib/wallet.functions.ts` → `isProUser()` (bloqueia carteiras, scanner, advisor)
- `src/lib/wallet-ai.functions.ts` → `requireProAccess()` (bloqueia scanner OCR / Consultor IA)
- `src/routes/_app.planner.tsx` → checa `subscriptions` direto no client para liberar idiomas/PDF multilíngue
- `src/routes/_app.wallet.tsx` → consome `quota.isPro` retornado por `getWalletQuota`

Quem comprou créditos avulsos é bloqueado mesmo tendo saldo. A cobrança real já ocorre via `spend_for_feature` (RPC) que consome de qualquer bucket (monthly/free/topup), então basta liberar o gate.

## Mudanças

### 1. Backend — nova RPC `has_premium_access`
Migration adicionando função SECURITY DEFINER:
```sql
create or replace function public.has_premium_access(user_uuid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    public.has_active_subscription(user_uuid, 'live')
    or public.has_active_subscription(user_uuid, 'test')
    or coalesce((select topup_balance from public.user_credits where user_id = user_uuid), 0) > 0
$$;
grant execute on function public.has_premium_access(uuid) to authenticated, service_role;
```
Regra única: assinatura ativa **OU** saldo avulso > 0 ⇒ premium.

### 2. Server functions
- `src/lib/wallet.functions.ts`: `isProUser()` passa a chamar `has_premium_access`.
- `src/lib/wallet-ai.functions.ts`: `requireProAccess()` idem (mensagem de erro passa a sugerir "assine um plano ou compre créditos avulsos").
- Toda nova feature premium deve usar esse helper unificado.

### 3. Client — Planner
`src/routes/_app.planner.tsx`: substituir a query direta em `subscriptions` por `supabase.rpc("has_premium_access", { user_uuid })`. Mantém o comportamento visual; apenas amplia quem é considerado "pro".

### 4. UX de consumo (já implementado, apenas confirmar)
- Antes de executar: telas premium já exibem o custo via `getCreditCosts` + tooltip "Esta ação consumirá X créditos".
- Após executar: `spend_for_feature` debita do bucket disponível (monthly → free → topup) e registra em `credit_ledger`; saldo é re-fetchado pelos componentes de saldo existentes.
- Sem saldo: mensagem de erro já existente é ajustada para oferecer **comprar créditos avulsos** OU **assinar plano** (link `/billing`).

### 5. Conversão de arquivos (item da spec)
Não há código de conversão de arquivos hoje. Esta tarefa cobre **somente o desbloqueio premium**; criar o conversor (10 créditos/arquivo) fica fora deste plano e pode ser pedido depois.

## Fora de escopo (não tocar)
- Planos Pro/Ultra, preços, pacotes avulsos, webhook, dashboard de compra, `createCreditPackCheckout`, tabela `subscriptions`.

## Resultado
Comprador de créditos avulsos passa a abrir Planner multilíngue, Scanner OCR, Consultor IA, múltiplas carteiras e qualquer feature futura que use `has_premium_access`, consumindo do `topup_balance` automaticamente.
