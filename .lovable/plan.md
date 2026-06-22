# Plano: corrigir tradutor + liberar acesso

## Causa do problema

O `/api/ai` (rota servidor) exige `Authorization: Bearer <jwt>` da sessão do usuário (Supabase). 

- `src/routes/_app.live-translator.tsx` já envia o token via `authedJsonHeaders()` — funciona quando há sessão.
- `src/routes/_app.translator.tsx` chama `fetch("/api/ai", ...)` **sem** o header de autorização — todas as chamadas (texto, imagem/OCR, microfone) retornam **401 Unauthorized**, por isso "nada funciona" na página do tradutor.

Como o live-translator usa o mesmo endpoint corretamente, o problema dele provavelmente é colateral (sessão expirada ou a mesma confusão do usuário ao testar). A correção do header e uma verificação garantem ambos.

## Mudanças

### 1. `src/routes/_app.translator.tsx`
- Importar `authedJsonHeaders` de `@/lib/authed-fetch`.
- Trocar os dois `headers: { "Content-Type": "application/json" }` (em `handleImageOcr` e em `translateText`) por `headers: await authedJsonHeaders()`.
- Se `resp.status === 401`, mostrar toast claro: "Sessão expirada, faça login novamente."

### 2. Liberar acesso premium para `messiaspassosj@gmail.com`
Migração SQL que promove o usuário (id `344ef7ea-5a7b-4cd7-afdf-b14c0b291b89`, role atual `free`) para `ultra` (nível mais alto disponível: `free | premium | ultra | admin`):

```sql
UPDATE public.user_roles
   SET role = 'ultra'
 WHERE user_id = '344ef7ea-5a7b-4cd7-afdf-b14c0b291b89';

INSERT INTO public.user_roles (user_id, role)
SELECT '344ef7ea-5a7b-4cd7-afdf-b14c0b291b89', 'ultra'
 WHERE NOT EXISTS (
   SELECT 1 FROM public.user_roles
    WHERE user_id = '344ef7ea-5a7b-4cd7-afdf-b14c0b291b89'
 );
```

(Se preferir `premium` em vez de `ultra`, me avise antes de implementar.)

## Verificação
- Após o build, abrir `/translator` logado e testar texto, foto e microfone.
- Abrir `/live-translator` e confirmar que a tradução retorna.
- Confirmar a role do usuário no banco.
