# Sistema de Créditos JAQTRYP AI — Plano de Implementação

## Visão geral

Unificar três fontes de saldo (gratuitos, mensais de assinatura, avulsos comprados) numa única carteira de créditos, com regras de consumo e prioridade de gasto definidas. A base já existe (`user_credits`, `credit_ledger`, funções `spend_credits` / `add_credits`, 4 pacotes avulsos na Stripe). Este plano adiciona o que falta para o sistema ficar completo.

---

## 1. Banco de dados (migração)

### 1.1 Quebrar saldo por origem
Hoje `user_credits.balance` é um único número. Trocar por três colunas para permitir regras de expiração e prioridade:

- `free_balance` (int) — créditos gratuitos do signup/bônus, sem expiração
- `monthly_balance` (int) — créditos do plano mensal, **resetam todo ciclo**
- `topup_balance` (int) — créditos avulsos comprados, **nunca expiram**
- manter `lifetime_purchased` / `lifetime_spent`
- view/coluna computada `balance = free + monthly + topup` para leitura simples

### 1.2 Ordem de gasto (definida no `spend_credits`)
1º monthly → 2º free → 3º topup
(gasta primeiro o que expira, preserva o que o usuário pagou avulso)

### 1.3 Catálogo de custos (tabela `credit_costs`)
Tabela pequena lida pelas server functions, fácil de ajustar sem deploy:

| feature_key | créditos | observação |
|---|---|---|
| `itinerary_ai` | a definir | roteiro IA |
| `pdf_export` | a definir | exportar roteiro em PDF |
| `translate_text` | a definir | tradutor texto digitado |
| `translate_voice` | a definir | tradução por voz |
| `translate_live` | a definir | tradutor ao vivo (sessão) |
| `translate_image` | a definir | OCR + tradução de imagem |
| `translate_file` | a definir | tradução de arquivo |
| `bluetooth_session` | a definir | conexão live translator BT |

Regra de preço: **markup de 80% sobre o custo do provedor de IA** (precisamos confirmar os valores antes de popular).

### 1.4 Reset mensal dos créditos do plano
- Coluna `monthly_reset_at` em `user_credits`
- Cron (pg_cron) diário que, para cada assinatura ativa, zera `monthly_balance` e credita a alocação do plano (600 Essencial / 1500 Pro) quando `now() >= monthly_reset_at`
- Log no `credit_ledger` com `reason = 'monthly_grant'`

### 1.5 Atualizar `handle_new_user`
Trocar o `INSERT` de 100 créditos para popular `free_balance = 100`.

### 1.6 Atualizar `add_credits` / `spend_credits`
- `add_credits` recebe parâmetro `_bucket` (`free|monthly|topup`) e credita na coluna certa
- `spend_credits` aplica a ordem 1.2 atomicamente, ainda idempotente e à prova de saldo negativo
- Webhook Stripe de compra avulsa chama com `_bucket='topup'`
- Webhook Stripe de renovação mensal chama com `_bucket='monthly'`

---

## 2. Server functions

Criar `src/lib/credits.functions.ts`:

- `getMyCredits()` — retorna `{ free, monthly, topup, total, nextReset }`
- `getCreditCosts()` — retorna o catálogo da 1.3 (cacheável)
- `spendForFeature({ featureKey, metadata })` — lê custo, chama `spend_credits`, retorna `{ ok, newBalance }` ou `{ ok:false, reason:'insufficient', needed, have }`
- `listCreditHistory({ limit, cursor })` — leitura paginada do `credit_ledger`

Todas com `requireSupabaseAuth`.

---

## 3. Webhook Stripe (pacotes avulsos)

Já existem 4 produtos (`credits_350/1000/2200/4025`). Falta:

- Rota `src/routes/api/public/stripe-webhook.ts` (ou estender a existente) tratando `checkout.session.completed` para esses 4 price IDs
- Mapear price → quantidade de créditos
- Chamar `add_credits(user_id, qty, 'purchase', session_id, 'topup')` (idempotente)

---

## 4. UI — Carteira de créditos

Novo painel acessível pelo menu (ou dentro de “More”):

- **Card de saldo**: total grande + breakdown (mensal X / Y, gratuitos, avulsos), data do próximo reset
- **Pacotes avulsos**: 4 cards usando o `useStripeCheckout` (Embedded Checkout) — preços 5.99 / 15.99 / 29.99 / 49.99
- **Tabela de custos por feature** (transparência)
- **Histórico**: lista do `credit_ledger` com filtro (compra, gasto, bônus, renovação)
- **Banner de saldo baixo** quando `total < menor custo de feature ativa`

---

## 5. Aplicar consumo nas features existentes

Em cada ponto de uso, antes de chamar o provedor de IA:
1. `spendForFeature({ featureKey })`
2. Se `insufficient` → modal “Sem créditos suficientes” com CTA para comprar pacote ou ver planos
3. Se ok → executa a feature

Pontos a instrumentar:
- Geração de roteiro IA
- Export PDF do roteiro
- Tradutor texto / voz / live / imagem / arquivo
- Conexão Bluetooth do live translator

**Não cobrar** (confirmar): buscador de voo, hospedagem.

---

## 6. Mensagem de upsell (copy pronto do briefing)

Quando saldo baixo / esgotado:
> “Seus créditos acabaram. Aguarde a renovação dos créditos mensais, compre créditos avulsos ou aproveite o melhor custo-benefício nos planos mensais.”

---

## Detalhes técnicos

- Migração única cobrindo 1.1 a 1.6, com GRANTs nas novas colunas e funções restritas a `service_role`
- pg_cron acionando uma função `process_monthly_resets()` 1x/dia
- `credit_costs` com policy de leitura para `authenticated`
- Tipos do Supabase regenerados após a migração antes de escrever as server functions

---

## Perguntas antes de implementar

1. **Custos por feature (1.3)** — você tem a tabela final de créditos por feature? Sem isso eu chuto valores. Posso propor uma tabela inicial baseada em markup 80% sobre OpenAI/ElevenLabs e você ajusta?
2. **Plano mensal e Stripe** — os planos Essencial ($9 / 600cr) e Pro ($19 / 1500cr) **já existem como produtos recorrentes na Stripe**, ou preciso criá-los também?
3. **Pacote de boas-vindas** — manter 100 créditos no signup como `free_balance`? Algum bônus extra ao assinar plano pela 1ª vez?
4. **Reset mensal** — créditos mensais não usados são perdidos ao renovar (confirma?) ou acumulam até um teto?