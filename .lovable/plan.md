## Esclarecimento importante

A URL `https://etmuritswjialcycfgvw.supabase.co/auth/v1/callback` **NÃO é para ser adicionada no código do projeto**. Ela é o endpoint do backend (Lovable Cloud) e precisa ser cadastrada **no Google Cloud Console**, no painel das suas credenciais OAuth.

## Por que não está no projeto?

Essa URL é uma rota interna do backend gerenciado pelo Lovable Cloud — ela existe automaticamente, não como arquivo do seu código. O fluxo OAuth funciona assim:

```text
Usuário clica "Entrar com Google"
        ↓
Vai para google.com
        ↓
Google redireciona para → https://etmuritswjialcycfgvw.supabase.co/auth/v1/callback
        ↓
Backend processa e devolve para → https://jaqtryp.com
```

O Google precisa ter **a URL do meio** autorizada — não a do seu site.

## O que fazer (passo a passo no Google Cloud Console)

1. Acesse: https://console.cloud.google.com/apis/credentials
2. Selecione o projeto correto (o mesmo de onde veio o Client ID configurado no Lovable Cloud)
3. Clique no **OAuth 2.0 Client ID** que você está usando
4. Na seção **"Authorized redirect URIs"**:
   - **Remova** estas duas linhas erradas:
     - `https://jaqtryp.com/~oauth/callback`
     - `https://www.jaqtryp.com/~oauth/callback`
   - **Adicione** esta linha (copie exatamente, sem espaços, sem barra no final):
     ```
     https://etmuritswjialcycfgvw.supabase.co/auth/v1/callback
     ```
5. Na seção **"Authorized JavaScript origins"**, adicione:
   ```
   https://jaqtryp.com
   https://www.jaqtryp.com
   ```
6. Clique em **SAVE**
7. Aguarde 1–2 minutos (Google demora a propagar) e teste novamente

## Como confirmar que está no projeto certo do Google

Abra o painel Lovable Cloud → Users → Auth Settings → Google. O **Client ID** mostrado lá tem que ser o mesmo do OAuth Client que você está editando no Google Cloud. Se forem diferentes, você está editando o projeto errado no Google — esse é o erro mais comum quando "já adicionei e continua errado".

## Nenhuma alteração de código será feita

Esse problema é 100% de configuração externa (Google Cloud). O código do projeto está correto.
