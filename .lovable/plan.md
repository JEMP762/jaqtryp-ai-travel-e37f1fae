## Objetivo
Três ajustes pequenos, sem quebrar nada existente:

### 1. Aviso de saldo baixo só aparece na aba de créditos
- Remover `<CreditLowBalanceBanner />` de `src/routes/_app.tsx` (hoje aparece em todas as páginas logadas).
- Renderizar o banner apenas no topo de `src/routes/_app.credits.tsx` (aba "Créditos / Consumo").
- Comportamento (tiers zero/critical/low, botão dispensar, refetch a cada 30s) permanece igual — só muda o local.

### 2. Habilitar automaticamente usuários que erraram no cadastro
Usuários que se cadastraram enquanto o trigger `handle_new_user` falhava podem estar em `auth.users` sem linha em `profiles`, `user_roles` ou `user_credits`, o que trava o app após o login. Vamos:

- Rodar um backfill único (via `supabase--insert`) que, para cada usuário em `auth.users` sem registro correspondente:
  - cria `profiles` (nome vindo de metadata ou do e-mail),
  - cria `user_roles` com `'free'`,
  - cria `user_credits` com bônus de 100 e registra `credit_ledger` `signup_bonus` (idempotente por `user_id`).
- O trigger `handle_new_user` já é blindado com `EXCEPTION WHEN OTHERS` — nenhum novo cadastro fica travado.
- Nada muda para quem já está OK (usa `ON CONFLICT DO NOTHING` / `NOT EXISTS`).

### 3. Link "Esqueci minha senha" no cadastro
- A rota `/forgot-password` já existe e funciona (envia e-mail com `redirectTo=/reset-password`).
- Adicionar no rodapé de `src/routes/signup.tsx` um link discreto "Esqueceu a senha?" apontando para `/forgot-password`, ao lado do link "Entrar".
- Login já tem esse link — nada a mudar lá.

## Arquivos tocados
- `src/routes/_app.tsx` — remover import e uso do banner.
- `src/routes/_app.credits.tsx` — adicionar banner no topo da página.
- `src/routes/signup.tsx` — adicionar link "Esqueceu a senha?".
- Backfill SQL via `supabase--insert` (sem migração de schema).

## Fora de escopo
- Não altero o trigger `handle_new_user` (já está resiliente).
- Não altero o componente `CreditLowBalanceBanner` em si.
- Não mudo o fluxo de reset (`/reset-password` continua igual).
