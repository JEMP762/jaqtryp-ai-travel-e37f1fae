## Problema

Novos usuários recebem "database error" ao tentar criar conta. A mensagem indica que o Supabase Auth cria o registro em `auth.users`, mas o trigger `handle_new_user` falha ao popular as tabelas do `public`, e por isso a sessão nunca é finalizada.

## Causas prováveis (em ordem)

1. **Proteção de senha vazada (HIBP)** — ativamos recentemente `password_hibp_enabled=true`. Senhas comuns/vazadas retornam erro 422 que na UI aparece como falha genérica de "database".
2. **Trigger `handle_new_user`** — insere em `profiles`, `user_roles`, `user_credits`, `credit_ledger`. Se qualquer INSERT falhar (ex.: conflito de `referral_code` gerado, coluna `balance` legada, RLS/GRANT ausente no `service_role`), o signup inteiro cai com "Database error saving new user".
3. **Trigger `set_referral_code_on_profile`** — gera código com `gen_random_bytes`; se o retry >10 estourar por colisão improvável, ainda funciona (usa fallback), mas vale garantir idempotência.

## Ações

### 1. Instrumentar o trigger para nunca derrubar o signup
Reescrever `public.handle_new_user` envolvendo cada INSERT em `BEGIN ... EXCEPTION WHEN OTHERS THEN RAISE WARNING ...`. O objetivo é:
- Registrar o erro no log do Postgres (visível em analytics) sem impedir o `auth.users` de ser criado.
- Garantir `ON CONFLICT DO NOTHING` em `profiles`, `user_roles`, `user_credits`.
- Usar defaults corretos e não depender da coluna legada `balance`.

### 2. Melhorar mensagens no cliente
Em `src/routes/signup.tsx`, mapear:
- `unexpected_failure` / `Database error saving new user` → "Não foi possível concluir o cadastro. Tente novamente em instantes ou use outro e-mail."
- `weak_password` (HIBP) → mensagem atual já cobre.

### 3. Verificação pós-migração
- Ler `postgres_logs` para confirmar qual INSERT estava falhando (agora aparecerá como WARNING sem quebrar).
- Testar cadastro real com e-mail novo + senha forte.

## Detalhes técnicos

Migração proposta:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (NEW.id,
            COALESCE(NEW.raw_user_meta_data->>'full_name',
                     NEW.raw_user_meta_data->>'name',
                     split_part(NEW.email,'@',1)),
            NEW.raw_user_meta_data->>'avatar_url')
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profiles: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'free') ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user user_roles: %', SQLERRM;
  END;

  BEGIN
    INSERT INTO public.user_credits (user_id, free_balance, lifetime_purchased)
    VALUES (NEW.id, 100, 0) ON CONFLICT (user_id) DO NOTHING;

    INSERT INTO public.credit_ledger (user_id, delta, reason, metadata)
    VALUES (NEW.id, 100, 'signup_bonus',
            '{"bucket":"free","note":"Welcome bonus"}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user credits: %', SQLERRM;
  END;

  RETURN NEW;
END $$;
```

Depois valido nos logs qual passo estava travando e ajusto especificamente (por exemplo, adicionando GRANT faltante ou default).

## Fora do escopo
- Não alterar configuração de HIBP (o usuário quer manter contas seguras).
- Não mexer em referrals, salas ao vivo ou outras features.
