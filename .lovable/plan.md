## Problema

Todas as chamadas de IA estão retornando **HTTP 403** no gateway. A causa é o uso do modelo `google/gemini-3-flash-preview`, que era um preview e não está mais habilitado — por isso o usuário vê "AI gateway error" em toda funcionalidade que usa IA (chat, tradução, planner, file-translator, sala ao vivo).

Confirmado nos logs do AI Gateway: 9 falhas consecutivas em 15/07, todas com `client_error (http 403)` no mesmo modelo.

## Solução

Substituir `google/gemini-3-flash-preview` pelo modelo estável equivalente da geração atual: **`google/gemini-3.5-flash`** (mesma família Google, atual, rápido, preço similar, sem necessidade de mudar prompts ou payloads).

## Arquivos afetados (5)

1. `src/lib/wallet-ai.functions.ts` — fallback do wallet AI
2. `src/lib/file-translator.functions.ts` — tradutor de arquivos (não-PDF)
3. `src/routes/api.public.translate-broadcast.ts` — tradução da Sala ao Vivo
4. `src/routes/api.ai.tsx` — endpoint genérico de IA
5. `src/routes/api.chat.tsx` — chat

Em cada arquivo, trocar apenas a string do modelo. Nenhum outro parâmetro precisa mudar (a API do gateway é a mesma).

## Verificação

Após o deploy, disparar uma tradução curta na Sala ao Vivo e confirmar `status: success (http 200)` no próximo log do AI Gateway.
