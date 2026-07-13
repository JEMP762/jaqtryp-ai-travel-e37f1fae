## 1) Planejador IA — adicionar data de início

Em `src/routes/_app.planner.tsx`:
- Novo campo **Data de início** (input `type="date"`) ao lado de "Dias".
- Novo estado `startDate`. Ao gerar o roteiro, calcular `endDate = startDate + (dias-1)` e injetar no prompt/system para que a IA rotule cada dia com a data real (ex.: `## Dia 1 — 20/07/2026 (segunda)`), sem mudar mais nada da lógica atual.
- Campo é opcional: se não preenchido, o comportamento fica igual ao de hoje.
- No título do export (`renderPrintWindow`) incluir o intervalo de datas quando preenchido.

Sem mudanças em backend, créditos ou tabelas.

## 2) Sala ao vivo — permitir reentrar com o mesmo código

Sintoma: usuário sai da sala e não consegue voltar usando o mesmo código de convite.

Correções em `src/routes/live-room.$code.tsx` (fluxo do botão "Entrar", linhas ~1005–1051):
- Antes do `signInAnonymously`/`getUser`, chamar `supabase.auth.refreshSession()` de forma tolerante para garantir que o token esteja válido antes do RPC (evita "Not authenticated" na 2ª entrada).
- `room_participants.upsert` já é idempotente; garantir que erros de duplicidade (`23505`) sejam tratados como sucesso.
- `claim_room_host`: se retornar erro `Join the room before claiming host`, aguardar 300 ms e repetir uma vez (corrige corrida entre commit do upsert e leitura do RPC via SECURITY DEFINER).
- Pré-carregar `live_room_state` **depois** do join (não antes), evitando bloqueio por RLS `is_room_member` quando o usuário ainda não é membro.
- Adicionar botão discreto "Sair da sala" que apenas reseta `setJoined(false)` no cliente (sem apagar `room_participants`), para que a próxima entrada pelo mesmo código funcione sem recarregar.
- Toast amigável no catch: "Não foi possível entrar. Toque em Entrar novamente." + botão de nova tentativa.

Sem mudanças de schema.

## 3) 3 meses grátis de todos os recursos para ana.jucs22@gmail.com

Usuário confirmado: `id = 7984e75c-a4f7-42ac-a48a-db72e6a99f4a`.

A checagem do app (`has_premium_access`) libera **todos os recursos premium** quando existe uma assinatura ativa. Vou:

1. Inserir uma linha em `public.subscriptions` (via ferramenta de insert) para esse usuário com:
   - `status = 'active'`
   - `environment = 'live'`
   - `current_period_end = now() + interval '3 months'`
   - marcação `metadata = { grant: 'courtesy_3_months', granted_by: 'admin' }`
2. Conceder um bônus de créditos avulsos (ex.: 5.000 no bucket `topup`) via RPC `add_credits` para cobrir traduções ao vivo (que são pagas pelo anfitrião) durante o período, também com marcação de cortesia.

Nenhum código de UI muda — o `has_premium_access` já lê essa assinatura e destrava Planner, File Translator, Live Translator etc. Os créditos cobrem chamadas medidas por feature (STT/TTS/live).

## Fora de escopo
- Não mexer em Daily/CallPanel, cobrança do host, RLS existentes, nem no gatilho de microfone (walkie‑talkie).
