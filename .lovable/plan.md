## Diagnóstico

O `redirect_uri_mismatch` continua porque as URLs que você adicionou em **Authorized redirect URIs** no Google Cloud apontam para o seu app:

```
❌ https://jaqtryp.com/~oauth/callback
❌ https://www.jaqtryp.com/~oauth/callback
```

O Google **nunca** redireciona para o seu domínio diretamente. O fluxo é:

```text
Usuário → Google → Backend (Supabase) → Seu app (jaqtryp.com)
                        ↑
              é AQUI que o Google precisa
              de permissão para redirecionar
```

Portanto, a URL autorizada no Google Cloud tem que ser a do **backend**, não a do seu app.

## O que fazer (sem mexer em código)

### 1. No Google Cloud Console
**APIs & Services → Credentials → seu OAuth 2.0 Client ID → Authorized redirect URIs**

- **Remova** as duas URLs erradas:
  - `https://jaqtryp.com/~oauth/callback`
  - `https://www.jaqtryp.com/~oauth/callback`

- **Adicione esta URL exata** (única que o Google precisa):
  ```
  https://etmuritswjialcycfgvw.supabase.co/auth/v1/callback
  ```
  Sem barra no final. Sem `http`. Sem espaços.

- Clique em **Save**. Pode levar 1–2 minutos para propagar.

### 2. Authorized JavaScript origins (na mesma tela)
Adicione (essas sim usam o seu domínio):
```
https://jaqtryp.com
https://www.jaqtryp.com
https://jaqtryp-com.lovable.app
https://id-preview--6d4b0769-d635-4330-aa35-732b66d1a0d8.lovable.app
```

### 3. Confirme que o Client ID e Secret do Google estão colados no painel do Lovable Cloud
**Cloud → Users → Auth Settings → Google** — Client ID e Client Secret devem ser **do mesmo OAuth Client** que você acabou de editar no Google Cloud (não de outro projeto Google).

## Por que `/~oauth/callback` parece certo mas não é

Esse caminho `/~oauth/callback` é interno do Lovable e funciona apenas porque o broker do Lovable intercepta. Mas como você está usando **suas próprias credenciais Google manuais**, o fluxo padrão do Supabase é usado — e o Supabase espera receber o callback na URL `*.supabase.co/auth/v1/callback`.

## Nenhuma mudança de código é necessária

Toda correção é no Google Cloud Console. Posso confirmar depois que você fizer a alteração.
