## Objetivo
Resolver os 4 problemas críticos reportados e melhorar o aviso ao usuário para ele só aparecer **quando os créditos realmente acabarem** durante o uso de uma função (não como banner permanente).

---

## 1. Cadastro/Login 500 — `gen_random_bytes` ausente

**Causa confirmada:** o gatilho `on_auth_user_created` roda `handle_new_user` → insere em `profiles` → dispara o trigger que chama `set_referral_code_on_profile` → `generate_referral_code`. Embora `generate_referral_code` já esteja qualificada com `extensions.gen_random_bytes`, o log ainda mostra a falha, indicando que existe uma versão antiga cacheada ou outro caminho (ex.: `set_referral_code_on_profile` sem `search_path` correto quando executada dentro do trigger `SECURITY DEFINER` do `handle_new_user`).

**Correção (migração):**
- Reinstalar `pgcrypto` no schema `extensions` (idempotente: `CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions`).
- Recriar `generate_referral_code` e `set_referral_code_on_profile` com `SET search_path = public, extensions` e usar sempre `extensions.gen_random_bytes(...)`.
- Recriar `handle_new_user` mantendo os blocos `EXCEPTION` mas garantindo `search_path = public, extensions`.

## 2. Recursos pagos de IA falham com "Falha ao debitar créditos"

**Causa confirmada:** a migração `20260716005330` fez `REVOKE EXECUTE ON FUNCTION public.spend_for_feature ... FROM anon, PUBLIC` sem `GRANT ... TO authenticated`. Como o RPC é chamado pelo client autenticado (RLS as user) em `credits.functions.ts`, `wallet-ai.functions.ts`, `file-translator.functions.ts` e `BluetoothTranslatorSession.tsx`, todos recebem `permission denied`.

**Correção (migração):**
- `GRANT EXECUTE ON FUNCTION public.spend_for_feature(uuid, text, jsonb) TO authenticated;`
- Revisar funções irmãs afetadas pela mesma revogação (`add_credits`, `grant_monthly_credits`, `spend_credits`) — manter `add_credits`/`grant_monthly_credits`/`spend_credits` só para `service_role` (são internas), pois só `spend_for_feature` é chamada pelo client.

## 3. Aviso de crédito esgotado — mostrar só quando faltar em uma ação

O `CreditLowBalanceBanner` foi retirado do layout `_app` (a pedido anterior). Agora o pedido é: avisar **quando o usuário tentar executar uma função e não tiver créditos**. Isso é mais preciso e menos poluído que um banner permanente.

**Correção (frontend):**
- Criar utilitário `handleCreditError(err)` em `src/lib/credit-error.ts` que detecta:
  - resposta `{ ok:false, reason:"insufficient", needed, have }`
  - erros HTTP 402
  - mensagens contendo "Créditos insuficientes" / "Falha ao debitar créditos"
- Ao detectar, exibir `toast.error` com botão "Comprar créditos" que navega para `/credits`.
- Aplicar em todos os pontos de chamada de features pagas: `BluetoothTranslatorSession`, `file-translator`, `wallet-ai` (scanReceipt, askWalletAi, advisorReport, fxAsk), `translator`, `planner`, `chat`, `live-translator`.
- **Não** re-adicionar o banner global; manter só no `/credits`.

## 4. Atalho PWA "Tradução ao vivo" → 404

**Causa:** `public/manifest.webmanifest` aponta shortcut para `/live-translate`, mas a rota é `/live-translator`.

**Correção:** ajustar shortcut URL para `/live-translator`.

---

## Arquivos a editar
- **Nova migração SQL** — corrigir funções + GRANT do `spend_for_feature`.
- `src/lib/credit-error.ts` (novo) — helper de detecção + toast padronizado.
- `src/components/BluetoothTranslatorSession.tsx`
- `src/lib/file-translator.functions.ts` (retornar erro tipado; UI aplica helper)
- `src/routes/_app.file-translator.tsx`
- `src/routes/_app.wallet.tsx` (e/ou componentes que chamam wallet-ai)
- `src/routes/_app.translator.tsx`, `_app.planner.tsx`, `_app.chat.tsx`, `_app.live-translator.tsx`, `live-room.$code.tsx` — aplicar helper nos catches.
- `public/manifest.webmanifest` — corrigir shortcut.

## Verificação
- Cadastrar novo usuário de teste → conferir logs sem `gen_random_bytes`.
- Chamar `spend_for_feature` via translator → sem "permission denied".
- Zerar saldo de um usuário e tentar traduzir → toast "Créditos esgotados — Comprar" aparece.
- Instalar PWA e tocar no atalho "Tradução ao vivo" → abre `/live-translator`.
