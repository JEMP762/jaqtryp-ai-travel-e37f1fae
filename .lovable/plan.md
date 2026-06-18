# Corrigir recuperação de senha

## Problema
Ao clicar no link do e-mail, o usuário é levado para `/reset-password?code=...`. A página atual não troca esse `code` por uma sessão, então sempre exibe "Link inválido ou expirado".

## Mudanças em `src/routes/reset-password.tsx`

1. Adicionar um estado `status: "checking" | "ready" | "invalid"` (em vez do booleano `ready`).
2. No `useEffect` inicial:
   - Ler `code` da query string (`window.location.search`).
   - Se houver `code`, chamar `await supabase.auth.exchangeCodeForSession(code)`. Em sucesso → `status="ready"`; em erro → `status="invalid"` com mensagem clara.
   - Se não houver `code`, manter o fallback atual: checar `getSession()` e o listener `onAuthStateChange` para `PASSWORD_RECOVERY`/`SIGNED_IN` (compatível com links antigos em hash `#access_token`).
   - Se nada disso resolver após a checagem, `status="invalid"`.
3. Renderizar:
   - `checking` → um pequeno "Validando link..." (evita o flash de "inválido").
   - `ready` → formulário de nova senha (igual hoje).
   - `invalid` → mensagem atual com link para `/forgot-password`.
4. Limpar o `code` da URL após o exchange com `window.history.replaceState` (evita reuso se o usuário recarregar).

Sem mudanças no `/forgot-password`, nas configurações de auth, nem em outros arquivos.
