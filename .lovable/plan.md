## Diagnóstico

O erro `Erro 400: redirect_uri_mismatch` **não é um bug no código do seu projeto**. O Google compara o `redirect_uri` enviado na requisição OAuth com a lista exata de URIs autorizadas no seu projeto do Google Cloud Console — se faltar **uma** URI, ele bloqueia.

No Lovable Cloud com Google manual (BYOK), o `redirect_uri` que precisa estar autorizado **não é o domínio do seu site** (`jaqtryp.com`). É o **callback do Lovable Cloud Auth**, que é fixo por projeto e tem o formato:

```
https://<project-ref>.supabase.co/auth/v1/callback
```

Esse é o valor que aparece na seção **Google** das configurações de autenticação do Lovable Cloud (campo "Callback URL" / "URL de redirecionamento"). É **esse** valor — e só ele — que precisa estar na lista de "Authorized redirect URIs" do Client OAuth no Google Cloud.

Como dá erro tanto no preview quanto em produção, é praticamente certo que o callback do Lovable Cloud ainda não foi adicionado (ou foi adicionado errado, por ex. colando `https://jaqtryp.com` em vez do callback).

## O que vamos fazer

Nenhuma alteração de código é necessária. É só configuração no Google Cloud + Lovable Cloud. Passo a passo:

### 1. Pegar a Callback URL correta do Lovable Cloud
- Abrir **Cloud → Users → Authentication Settings → Sign In Methods → Google**.
- Copiar o valor do campo **Callback URL** (algo como `https://xxxxxxxx.supabase.co/auth/v1/callback`).

### 2. Adicionar essa URL no Google Cloud Console
- Ir em https://console.cloud.google.com/apis/credentials
- Abrir o seu **OAuth 2.0 Client ID** (tipo "Web application").
- Em **Authorized redirect URIs**, adicionar **exatamente** a Callback URL copiada no passo 1 (sem barra no final, sem espaços).
- Em **Authorized JavaScript origins**, adicionar:
  - `https://jaqtryp.com`
  - `https://www.jaqtryp.com`
  - `https://jaqtryp-com.lovable.app`
  - `https://id-preview--6d4b0769-d635-4330-aa35-732b66d1a0d8.lovable.app`
- Salvar. A propagação no Google leva de poucos segundos a ~5 minutos.

### 3. Conferir consent screen (OAuth consent screen)
- Em **Authorized domains** adicionar: `lovable.app`, `supabase.co` e `jaqtryp.com`.
- Scopes habilitados: `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
- Se o app estiver em modo **Testing**, adicionar seu email em **Test users** (ou publicar o app).

### 4. Conferir credenciais no Lovable Cloud
- Em **Cloud → Users → Authentication Settings → Google**, garantir que o **Client ID** e **Client Secret** colados são os do **mesmo** OAuth Client que você editou no passo 2 (é comum ter mais de um Client cadastrado no Google Cloud e colar o errado).

### 5. Testar
- Abrir aba anônima.
- Testar primeiro em `https://jaqtryp.com` (produção).
- Depois testar no preview.

## Por que não mexer no código

O fluxo já usa `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin })`, que é o padrão correto. O `redirect_uri` enviado ao Google é sempre o callback do Lovable Cloud Auth — o `window.location.origin` é só pra onde o Cloud devolve o usuário **depois** do callback. Mudar isso no código não resolve o `redirect_uri_mismatch`.

## Alternativa (se quiser desistir do manual)

Se em algum momento preferir, dá pra voltar pro **Google gerenciado pelo Lovable Cloud** (mesmas telas de Authentication Settings → Google → desativar credenciais customizadas). Aí não precisa de Google Cloud Console nem dessa configuração. Mas como você quer manter o seu próprio Client ID, seguimos o plano acima.

## Validação

- Em produção: clique em "Entrar com Google" → tela de consentimento aparece → redireciona de volta logado, sem erro 400.
- No preview: mesmo comportamento.
- Se ainda der `redirect_uri_mismatch`, me mande a Callback URL exata do Lovable Cloud + um print da lista "Authorized redirect URIs" do Google Cloud, que eu confiro a diferença caractere por caractere.
