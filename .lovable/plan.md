## Objetivo

Hoje só o **Tradutor de Arquivo** e o **Tradutor Bluetooth** debitam créditos automaticamente. Todas as outras features de IA (Planner, Tradutor texto/imagem, Tradutor ao vivo, Chat IA, Wallet IA, Scanner OCR, etc.) consomem IA sem cobrar nada do saldo. Vou padronizar a cobrança em todo o sistema usando o catálogo `credit_costs` que já existe no banco.

## Como vai funcionar (regra única)

1. **Verifica saldo antes** de chamar a IA (evita gastar IA quando o usuário não tem créditos).
2. **Executa a operação**.
3. **Debita o custo apenas em caso de sucesso** (mesma lógica já usada no tradutor de arquivo: `supabase.rpc("spend_for_feature", ...)`).
4. Se falhar → não cobra.
5. Resposta inclui `creditsSpent` e `balance` para o frontend atualizar o saldo na hora.

Assinantes Pro/Ultra continuam usando IA — a função `has_premium_access` já considera assinatura como acesso liberado, mas o débito de créditos passa a ser obrigatório para **todos** (alinhado ao seu pedido). Caso queira manter Pro/Ultra ilimitado, me avise no chat ao revisar o plano.

## Mapeamento feature → custo (já cadastrado em `credit_costs`)

| Feature no app | Onde | `feature_key` | Custo |
|---|---|---|---|
| Tradutor de texto | `_app.translator.tsx` (texto) | `translate_text` | 2 |
| Tradutor de imagem | `_app.translator.tsx` (imagem) | `translate_image` | 8 |
| Tradutor por voz | `_app.live-translator.tsx` (gravação rápida) | `translate_voice` | 8 |
| Sessão Tradutor ao Vivo | `_app.live-translator.tsx` (sala) | `translate_live` | 15 |
| Chat IA | `_app.chat.tsx` / `api.chat.tsx` | `translate_text` (2) | 2 |
| Wallet — Scanner OCR de recibo | `scanReceipt` | `scanner_ocr` | 5 |
| Wallet — Pergunte à IA | `askWalletAi` | `translate_text` | 2 |
| Wallet — Relatório do Consultor | `advisorReport` | `itinerary_ai` | 30 |
| Wallet — Conversão por linguagem natural | `fxAsk` | `translate_text` | 2 |
| Planner — Criar roteiro completo | `_app.planner.tsx` (gerar) | `trip_create_full` | 15 |
| Planner — Atualizar com IA | `_app.planner.tsx` (refinar) | `trip_update_ai` | 5 |
| Planner — Otimizar viagem | `_app.planner.tsx` (otimizar) | `trip_optimize_full` | 20 |
| Tradutor de arquivo | `_app.file-translator.tsx` | `file_translation` | 10 | já feito
| Tradutor Bluetooth (5/15/30/60 min) | `BluetoothTranslatorSession` | `bt_translate_*` | 5–35 | já feito

Stays/Flights/Wallet CRUD/Câmbio sem IA continuam **sem cobrança** (eles geram receita via comissão).

## Mudanças técnicas

1. **Novo helper** `src/lib/credit-charge.server.ts`
   - `chargeFeature(supabase, userId, featureKey, metadata?)`
   - `requireBalance(supabase, userId, featureKey)` — bloqueia antes da chamada de IA
   - Reutiliza `spend_for_feature` RPC.

2. **Migrar `api.ai.tsx` e `api.tts.ts`** de rota pública para usar Supabase auth + cobrança.
   - `api.ai.tsx` aceita `featureKey` no body (default `translate_text`); cobra após sucesso.
   - `api.tts.ts` cobra `translate_voice` quando usado por voz.

3. **Atualizar server functions**
   - `scanReceipt` → cobra `scanner_ocr` no sucesso.
   - `askWalletAi`, `advisorReport`, `fxAsk` → cobrar conforme tabela.
   - Adicionar `generateItinerary` / `updateItinerary` / `optimizeTrip` server functions (extrair lógica que hoje está em `_app.planner.tsx` chamando `api.ai`) e cobrar.

4. **Atualizar componentes**
   - `_app.translator.tsx` → passa `featureKey: 'translate_text'` ou `'translate_image'`.
   - `_app.live-translator.tsx` → cobra `translate_voice` por gravação e `translate_live` ao iniciar sessão.
   - `_app.chat.tsx` → cobra `translate_text` por mensagem.
   - `_app.planner.tsx` → usa novas server functions com cobrança.
   - Em todos: se resposta vier `insufficient`, mostra toast "Créditos insuficientes" com link para `/billing`.

5. **Atualizar saldo na UI**
   - O componente do badge de créditos no header é invalidado via `queryClient.invalidateQueries({ queryKey: ['my-credits'] })` após cada operação bem-sucedida.

## Fora do escopo

- Reembolso parcial em falhas tardias (a IA já respondeu mas algo quebrou depois) — improvável e cobrir adiciona complexidade.
- Mudanças nos preços dos pacotes ou nos valores de `credit_costs`.
- Cobrança em buscas de voos/estadias (não há IA cara envolvida).
- Migração da rota `api.ai` para `createServerFn` (mantém-se rota HTTP, só adiciona auth+cobrança).
