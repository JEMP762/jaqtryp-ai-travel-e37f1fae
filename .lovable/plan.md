## 1) Programa de Indicação (10% em créditos)

**Regra**
- Cada usuário recebe um **código de indicação** único (ex.: `JOSE7A2X`) e um link `https://jaqtryp.com/?ref=JOSE7A2X`.
- Quando alguém se cadastra com esse código/link e depois **compra créditos ou assina**, o indicador ganha:
  - **Pacotes avulsos:** 10% em créditos (700 → 70; 2.000 → 200; 4.000 → 400).
  - **Assinatura Pro (recorrente):** 100 créditos a cada renovação paga.
  - **Assinatura Ultra (recorrente):** 200 créditos a cada renovação paga.
- Vínculo é **permanente** (uma vez indicado, sempre daquele indicador).
- Auto‑indicação bloqueada; cada pagamento gera no máximo uma recompensa (idempotente por `stripe_session_id` / `invoice_id`).

**Backend (migration)**
- `profiles.referral_code text unique` + trigger que gera código no signup.
- `profiles.referred_by uuid references auth.users` (nullable, imutável após set).
- `referral_rewards` (id, referrer_id, referred_id, source `pack|sub_pro|sub_ultra`, credits, stripe_ref, created_at) — RLS: dono lê o próprio.
- RPC `apply_referral_code(_code text)` — vincula o usuário logado ao indicador se `referred_by` ainda é null e código ≠ self.
- RPC `reward_referrer(_paid_user uuid, _kind text, _pack_credits int, _stripe_ref text)` — SECURITY DEFINER, idempotente, credita via `add_credits(..., bucket='topup', reason='referral_bonus')`.

**Webhook Stripe (`api.public.payments.webhook`)**
- Em `checkout.session.completed` (kind=credit_pack): após creditar o comprador, chamar `reward_referrer` com 10% do pack.
- Em `invoice.paid` (subscription): identificar tier pelo price/lookup (`pro` → 100, `ultra` → 200) e chamar `reward_referrer`.

**Frontend**
- Nova página `_app.referrals.tsx`: mostra código, link copiável, total de indicados, créditos ganhos, histórico (`referral_rewards`), CTA de compartilhar (WhatsApp/copiar).
- Link no sidebar "Indique e ganhe".
- Signup (`/signup`): ler `?ref=` do querystring, guardar em `sessionStorage`, e após criar conta chamar `apply_referral_code`.
- Banner leve no dashboard: "Ganhe créditos indicando amigos".

## 2) Aparência — renomear "Claro Lovable" → "Claro Adorável"

- Trocar label em `src/lib/theme/AppearanceModeProvider.tsx` e `src/components/AppearanceModeSwitcher.tsx` (só o texto exibido; `id` do modo continua `light-lovable` para não invalidar preferências salvas).
- Atualizar textos em `src/routes/_app.settings.appearance.tsx`.

## 3) Cortesia para joseedimilsonmessiaspassos@gmail.com

- Localizar `user_id` pelo email e creditar **10.000 créditos grátis** via `add_credits(..., bucket='topup', reason='courtesy_grant', metadata={granted_by:'admin', note:'cortesia'})`.
- Sem assinatura de cortesia (só créditos, como pedido).

## Fora de escopo
- Não mexer no fluxo de sala ao vivo, tradutor, Duffel, TTS/STT.
- Sem mudança visual além do rename.

Pode aprovar que já implemento.
