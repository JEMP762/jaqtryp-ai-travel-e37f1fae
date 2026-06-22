# Estratégia: Créditos Pré-pagos JaqTryp

Para viajantes que usam o app 1-2x por ano, plano mensal/anual é barreira. A solução: **carteira de créditos pré-pagos que NÃO expiram**, com recarga via Stripe quando o usuário quiser. O viajante paga só pelo que usa, na viagem que vai fazer.

## Modelo de negócio

**Recarga base: $15.99 = 1.000 créditos** (1 crédito ≈ $0,016).
Markup ≥ 80% acima do custo da Lovable AI / provedores — cada função consome X créditos.

**Recargas adicionais** (com bônus para incentivar volume maior):
- $5.99 → 350 créditos
- $15.99 → 1.000 créditos (pacote padrão)
- $29.99 → 2.000 créditos + 10% bônus = 2.200
- $49.99 → 3.500 créditos + 15% bônus = 4.025

Créditos **nunca expiram**, ficam na carteira até a próxima viagem.

## O que é grátis (sem créditos)

- Buscador de voos
- Buscador de hospedagem
- Tradutor por texto digitado (texto curto, plain)
- Clima, câmbio, dashboard

## O que consome créditos (tabela inicial)

| Função | Custo |
|---|---|
| Roteiro IA (planner) | 80 créditos |
| Exportar roteiro PDF | 15 créditos |
| Tradução de texto longo / outro idioma avançado | 5 créditos por requisição |
| Tradução por voz (STT + tradução + TTS) | 20 créditos por trecho |
| Tradutor de imagem (OCR + tradução) | 30 créditos por foto |
| Tradutor de arquivo (PDF/doc) | 50 créditos por arquivo |
| Live Translator — sessão Bluetooth | 5 créditos / minuto |
| Conexão Bluetooth Live (setup) | 10 créditos |
| Text-to-speech avulso | 3 créditos por frase |

Valores ajustáveis depois pelo admin.

## Fluxo do usuário

1. Usuário entra no app → ganha **100 créditos grátis** no signup para experimentar.
2. Ao acionar uma função paga sem saldo: modal "Saldo insuficiente — recarregue" com pacotes.
3. Checkout Stripe Embedded (modelo já existente, mas em `mode: "payment"` em vez de subscription).
4. Webhook credita a carteira.
5. Wallet visível em `/billing` (novo tab "Créditos") com histórico de consumo.

## Estrutura técnica

### Migração (SQL)

```sql
-- 1. Tabela de saldo
CREATE TABLE public.user_credits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,
  lifetime_purchased integer NOT NULL DEFAULT 0,
  lifetime_spent integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.user_credits TO authenticated;
GRANT ALL ON public.user_credits TO service_role;
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own credits" ON public.user_credits FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. Ledger (auditoria de todo movimento)
CREATE TABLE public.credit_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,            -- positivo = recarga, negativo = consumo
  reason text NOT NULL,              -- 'signup_bonus' | 'purchase' | 'translator_voice' | 'planner_ia' | ...
  metadata jsonb DEFAULT '{}'::jsonb,
  stripe_session_id text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT ON public.credit_ledger TO authenticated;
GRANT ALL ON public.credit_ledger TO service_role;
ALTER TABLE public.credit_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ledger" ON public.credit_ledger FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE INDEX ON public.credit_ledger (user_id, created_at DESC);

-- 3. Função atômica para debitar (impede saldo negativo)
CREATE FUNCTION public.spend_credits(_user uuid, _amount int, _reason text, _meta jsonb DEFAULT '{}')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_balance int;
BEGIN
  INSERT INTO user_credits(user_id) VALUES(_user) ON CONFLICT DO NOTHING;
  UPDATE user_credits SET balance = balance - _amount, lifetime_spent = lifetime_spent + _amount, updated_at=now()
  WHERE user_id=_user AND balance >= _amount RETURNING balance INTO current_balance;
  IF current_balance IS NULL THEN RETURN false; END IF;
  INSERT INTO credit_ledger(user_id, delta, reason, metadata) VALUES(_user, -_amount, _reason, _meta);
  RETURN true;
END $$;

-- 4. Função para creditar (recarga via webhook)
CREATE FUNCTION public.add_credits(_user uuid, _amount int, _reason text, _session text DEFAULT NULL, _meta jsonb DEFAULT '{}')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO user_credits(user_id, balance, lifetime_purchased)
    VALUES(_user, _amount, CASE WHEN _reason='purchase' THEN _amount ELSE 0 END)
  ON CONFLICT(user_id) DO UPDATE
    SET balance = user_credits.balance + _amount,
        lifetime_purchased = user_credits.lifetime_purchased + CASE WHEN _reason='purchase' THEN _amount ELSE 0 END,
        updated_at = now();
  INSERT INTO credit_ledger(user_id, delta, reason, stripe_session_id, metadata)
    VALUES(_user, _amount, _reason, _session, _meta);
END $$;

-- 5. Atualizar handle_new_user para dar bônus de 100 créditos
-- (adiciona ao trigger existente um INSERT em credit_ledger + user_credits)
```

### Produtos Stripe (one-time)

Criar 4 produtos via `batch_create_product` em `mode: "payment"`:
- `credits_350` ($5.99), `credits_1000` ($15.99), `credits_2200` ($29.99), `credits_4025` ($49.99)
Tax code: `txcd_10000000` (general digital goods).

### Backend (server functions)

- `src/lib/credits.functions.ts` — `getMyCredits()`, `getCreditHistory()`, `spendCredits({reason, amount})` (com `requireSupabaseAuth`).
- `src/lib/credit-checkout.functions.ts` — `createCreditsCheckout({priceId, environment})` reaproveitando padrão `mode: "payment"` com metadata `{ kind: "credits", credits_amount: 1000, userId }`.
- `src/routes/api.public.payments.webhook.ts` — adicionar branch `checkout.session.completed` quando `metadata.kind === "credits"`: chamar `add_credits()` via service role.

### Frontend

- **`/billing`** — Adicionar aba "Créditos" com:
  - Saldo atual em destaque + barra de progresso
  - 4 cards de recarga (com bônus visíveis)
  - Histórico recente do ledger
- **Hooks**: `useCredits()` (React Query, ouve realtime na tabela `user_credits`).
- **Componente `CreditCostBadge`** — pill "💎 30 créditos" exibido em cada botão de ação paga.
- **Modal `InsufficientCreditsDialog`** — aparece quando `spendCredits` falha; mostra saldo atual e atalho para recarga.
- **Wrapper `withCreditCheck(reason, amount, fn)`** — utilitário usado em `_app.translator.tsx`, `_app.live-translator.tsx`, `_app.planner.tsx` para debitar antes de executar.
- **Onboarding**: banner no `/dashboard` para usuários sem nenhuma compra explicando o modelo "pague só pela viagem".

### Pontos de integração

| Arquivo | Mudança |
|---|---|
| `_app.translator.tsx` | Wrap em `withCreditCheck` (texto longo = 5, voz = 20, imagem = 30, arquivo = 50) |
| `_app.live-translator.tsx` | Cobrar 10 cr. ao iniciar sessão + 5 cr./min via timer |
| `_app.planner.tsx` | 80 cr. por geração; 15 cr. ao exportar PDF |
| `api.tts.ts` / `api.public.tts.ts` | 3 cr. por requisição autenticada |
| `_app.tsx` (sidebar) | Mostrar saldo de créditos no header |

### Manter assinaturas Pro/Ultra?

**Sim, em paralelo.** Quem assina recebe créditos mensais inclusos + features exclusivas (sem cobrança por uso até um limite). Pro = 2.000 cr/mês, Ultra = 5.000 cr/mês. Isso preserva a receita recorrente dos viajantes frequentes sem afastar os ocasionais.

## Entregáveis desta implementação

1. Migration com tabelas + funções RPC.
2. 4 produtos Stripe de créditos.
3. Server functions de carteira/checkout/webhook.
4. UI: aba Créditos no /billing, badges de custo, modal de saldo insuficiente, saldo no header.
5. Integração nos 4 fluxos pagos (translator, live-translator, planner, TTS).
6. Bônus de 100 créditos no signup (atualizar `handle_new_user`).

## Próximos passos (após esta entrega)

- Promoções sazonais (ex: "+30% créditos em julho/dezembro").
- Pacote de boas-vindas pré-viagem ("Combo Europa: 2.500 cr por $24.90").
- Referral: ganhe 200 créditos por amigo convidado.