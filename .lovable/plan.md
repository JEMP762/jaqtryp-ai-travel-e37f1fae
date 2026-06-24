
# Implementação — Créditos Avulsos JAQTRYP AI

Vamos manter toda a base já criada (tabela `user_credits` com 3 buckets, RPC `spend_credits`/`spend_for_feature`, webhook Stripe, página `/credits`, ledger) e fazer **apenas as mudanças do briefing novo**. Os planos mensais (Pro / Ultra) ficam intocados.

## 1. Novos pacotes avulsos (substituir os 4 antigos)

No Stripe e no catálogo `CREDIT_PACKS` (em `src/lib/credits.functions.ts`):

| Lookup key       | Nome      | Créditos | Preço    |
| ---------------- | --------- | -------- | -------- |
| `credits_700`    | Starter   | 700      | US$ 9,99 |
| `credits_2000`   | Explorer  | 2.000    | US$ 24,99 |
| `credits_4000`   | Global    | 4.000    | US$ 59,99 |

- Criar 1 product + 3 prices one-time no Stripe via `payments--create_price` (lookup_keys acima).
- Remover/desativar os antigos `credits_350 / 1000 / 2200 / 4025` do catálogo (Stripe permanece, mas frontend deixa de oferecer).
- Atualizar `CREDIT_PACKS` no código com os 3 novos itens (Explorer marcado como `popular`).

## 2. Tabela de custos por feature (`credit_costs`)

Migration que faz `UPSERT` da tabela inteira pelo `feature_key`, garantindo os valores do briefing:

| feature_key             | label                              | cost |
| ----------------------- | ---------------------------------- | ---- |
| `trip_create_full`      | Criar viagem completa              | 15   |
| `trip_update_ai`        | Atualizar roteiro com IA           | 5    |
| `trip_optimize_full`    | Otimizar viagem completa           | 20   |
| `pdf_generate`          | Gerar PDF                          | 3    |
| `pdf_translate`         | Traduzir PDF                       | 5    |
| `pdf_edit_smart`        | Editar PDF inteligente             | 6    |
| `scanner_ocr`           | Scanner OCR                        | 5    |
| `scanner_ocr_translate` | Scanner + tradução automática      | 8    |
| `scanner_ocr_advanced`  | OCR avançado                       | 10   |
| `translate_image`       | Traduzir imagem                    | 8    |
| `translate_menu_sign`   | Traduzir cardápio / placa          | 10   |
| `bt_translate_5min`     | Tradução Bluetooth — 5 min         | 5    |
| `bt_translate_15min`    | Tradução Bluetooth — 15 min        | 12   |
| `bt_translate_30min`    | Tradução Bluetooth — 30 min        | 20   |
| `bt_translate_60min`    | Tradução Bluetooth — 60 min        | 35   |

Features antigas que não estão no novo briefing permanecem ativas como estão; apenas estas são sobrescritas/garantidas.

## 3. Tradutor Bluetooth com timer

Frontend (novo componente `BluetoothTranslatorSession`):
- Modal "Iniciar sessão" mostra os 4 tiers (5/15/30/60 min) com créditos e saldo atual.
- Ao iniciar: chama `spendForFeature({ featureKey: 'bt_translate_<N>min' })`. Se `ok:false reason:insufficient` → mostra CTA "Comprar créditos".
- Cronômetro regressivo aparece durante a sessão. Aos 60s finais, toast de aviso.
- "Encerrar sessão" mostra resumo: tempo usado, créditos consumidos, saldo restante.
- Não há reembolso parcial (cobrança por bloco, conforme briefing).

## 4. Dashboard — card "Créditos Avulsos"

Adicionar card no dashboard principal (`/_app/index` ou equivalente) com:
- Saldo `topup_balance` em destaque + total geral.
- Mini-histórico das 3 últimas movimentações (filtrar ledger por `metadata.bucket = topup` ou reason `purchase`).
- Botão **Comprar Créditos** → `navigate('/credits')`.

## 5. Página `/credits` — ajustes

Já existe. Mudanças:
- Renderizar os 3 novos pacotes (Starter / Explorer / Global) com as mensagens:
  - ✅ Créditos não expiram
  - ✅ Compra única
  - ✅ Sem assinatura
  - ✅ Use quando precisar
- Tabela de consumo já lê de `credit_costs` — vai atualizar sozinha.
- Histórico: dividir em duas abas: **Compras** (delta>0, reason `purchase`) e **Consumo** (delta<0).

## 6. Alertas de saldo

Componente `<CreditLowBalanceBanner />` global (no layout `_app`):
- Calcula `pct = total / max(lifetimePurchased + freeInicial, 1)` *(ou referência simples: comparar com custo mínimo)*.
- Regras:
  - `total === 0` → banner vermelho "Saldo zerado — Comprar créditos"
  - `total < 10% do menor pacote (70 créd)` → banner laranja "Saldo crítico"
  - `total < 20%` (140 créd) → banner amarelo "Saldo baixo"
- Toast equivalente disparado uma vez por sessão após cada `spendForFeature` que cruzar os limiares.

## 7. Webhook Stripe

`src/routes/api.public.payments.webhook.ts` → `handleCreditPackEvent` já resolve créditos pelo `lookup_key`. Como o helper `packCreditsFromLookup` lê de `CREDIT_PACKS`, basta atualizar o array (passo 1). Adicionar fallback explícito para os 3 novos lookup_keys para garantir compatibilidade.

## Detalhes técnicos

- **Migration única** (data-only com `INSERT ... ON CONFLICT DO UPDATE`) para `credit_costs`. Sem mudanças de schema.
- **Stripe**: criar product `credits_avulso` se ainda não existir, depois 3 prices one-time com os lookup_keys.
- **Tipos** (`Database`) não mudam — só dados.
- **Sem alterações** em: `user_credits`, RPCs, planos mensais, `handle_new_user`, cron de reset mensal.

## Arquivos tocados

- `src/lib/credits.functions.ts` — atualizar `CREDIT_PACKS`.
- `src/routes/_app.credits.tsx` — abas Compras/Consumo + copy.
- `src/routes/_app.tsx` — montar `<CreditLowBalanceBanner />`.
- `src/components/CreditLowBalanceBanner.tsx` *(novo)*.
- `src/components/BluetoothTranslatorSession.tsx` *(novo)*.
- `src/components/DashboardCreditsCard.tsx` *(novo)* + plug no dashboard.
- `src/routes/api.public.payments.webhook.ts` — garantir mapeamento dos 3 novos lookup_keys.
- 1 migration SQL com `UPSERT` em `credit_costs`.
- Stripe: 1 product + 3 prices.
