## Objetivo

Landing page **sem preços** — foco só em atrair. Os valores só aparecem para o usuário **depois que ele consome os 100 créditos gratuitos de boas-vindas**, num modal que oferece as duas opções: **recarga avulsa** ou **assinatura mensal/anual**. Nada quebra: preços, Stripe, checkout e telas internas continuam iguais.

## Como fica para o usuário

### 1. Landing page (`/`) — sem preços
Na seção de Planos:
- Removo os números `$0 / $9 / $19 / $97.20 / $205.20` e a nota "Assinaturas cobradas em USD…".
- Removo o toggle Mensal/Anual da home (ele continua ativo dentro do app).
- Cada card mostra só: nome do plano, benefícios e um selo (Free = "Grátis para começar", Pro = "Mais escolhido", Ultra = "Experiência completa") + CTA "Começar grátis" → `/signup`.
- Handlers `handleSubscribe` e `openCheckout` e todos os `priceId` ficam intactos no arquivo (código dormindo), pronto para reativar num flip.

### 2. Novo modal "Continue com tudo liberado" (dispara quando os 100 créditos grátis acabam)
- Componente novo `src/components/UpgradeGateDialog.tsx`.
- Regra de disparo (hook `useUpgradeGate`):
  - `wallet.free === 0` **E** `wallet.monthly === 0` **E** `wallet.topup === 0` **E** `lifetime_spent >= 1` (garante que já usou os grátis, não é conta nova).
  - Sem assinatura ativa (`has_premium_access` = false — reaproveita `getMyCredits` + verificação de subscription).
- Dispara em dois pontos:
  a. Automaticamente ao abrir qualquer rota `_app.*` (uma vez por sessão, com `sessionStorage` para não incomodar).
  b. Quando qualquer feature retorna `reason: "insufficient"` → `handleCreditError` (em `src/lib/credit-error.ts`) passa a abrir o modal em vez do toast atual (mantém toast como fallback quando o modal já foi visto).
- Conteúdo do modal (duas colunas):
  - **Recarga avulsa** → lista os 3 packs de `CREDIT_PACKS` (Starter/Explorer/Global), com "MAIS POPULAR" no 2000. Botão "Comprar" abre o `CreditPackCheckoutDialog` existente.
  - **Assinatura** → 2 cards Pro e Ultra, com toggle Mensal/Anual local. Botão chama `useSubscriptionCheckout` com os `priceId` que hoje moram na home. Aqui **os preços aparecem**, pois é a primeira vez que o usuário está diante da decisão de pagar.
- Rodapé: "Créditos gratuitos usados. Escolha como continuar." + link "Ver detalhes na Carteira" → `/credits`.

### 3. Aviso preventivo dentro do app
- O `CreditLowBalanceBanner` já existe e continua aparecendo em `/credits`. Nada muda ali.

## Arquivos afetados

1. **`src/routes/index.tsx`** — remover exibição de preços, toggle e nota de rodapé; ajustar CTAs. Manter todo o resto do código intacto.
2. **`src/components/UpgradeGateDialog.tsx`** (novo) — modal com abas Recarga / Assinatura.
3. **`src/hooks/useUpgradeGate.tsx`** (novo) — hook que lê `getMyCredits` + subscription e decide quando abrir.
4. **`src/routes/_app.tsx`** — montar `<UpgradeGateDialog />` uma vez para todas as rotas autenticadas.
5. **`src/lib/credit-error.ts`** — quando `insufficient`, disparar evento `window.dispatchEvent(new CustomEvent("open-upgrade-gate"))` que o modal escuta; mantém toast como fallback.

## O que NÃO muda

- Nenhum arquivo de pricing / Stripe / webhooks / créditos / RLS.
- Preços continuam existindo em `/credits` e `/billing` (usuário logado que quer ver por conta própria).
- Fluxo de compra: mesmos `priceId`, mesmos `CREDIT_PACKS`, mesmo `openCheckout`.
- Bônus de 100 créditos, `handle_new_user`, `spend_for_feature`: intocados.

## Verificação

- Abrir `/` deslogado → seção de planos sem valores, CTAs "Começar grátis".
- Criar conta nova → dashboard normal, sem modal (tem 100 créditos, `lifetime_spent = 0`).
- Consumir os 100 créditos → próxima ação paga dispara o modal com Recarga + Assinatura (com preços).
- Fechar o modal e tentar outra feature paga → toast de créditos + botão "Comprar" (fallback já existente).
- `bun run build` sem erros.

Confirma esse fluxo (modal ao esgotar os 100 grátis, com Recarga + Assinatura lado a lado) que eu implemento?