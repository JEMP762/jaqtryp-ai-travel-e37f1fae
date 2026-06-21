O problema agora não parece estar mais no código: o projeto já usa o broker correto (`lovable.auth.signInWithOAuth`) nas telas de login e cadastro. As URLs que você listou indicam que a etapa que ainda está bloqueando é a configuração do OAuth/Google ou a publicação da versão corrigida.

Plano:
1. Validar que a versão publicada contém a correção de OAuth feita no código.
   - Se ainda não foi publicado depois da alteração, publicar/atualizar o app é obrigatório; caso contrário o domínio `jaqtryp.com` continua rodando a versão antiga.

2. Manter no Google Cloud apenas a URL exigida pelo broker:
   - `https://oauth.lovable.app/callback`
   - Remover as URLs `https://jaqtryp-com.lovable.app/~oauth/callback`, `https://jaqtryp.com/~oauth/callback` e `https://www.jaqtryp.com/~oauth/callback` dos “Authorized redirect URIs”, porque elas são caminhos internos do app/proxy, não o callback final que o Google deve chamar quando se usa o broker Lovable.

3. Conferir se o Client ID/Secret configurado no painel de Auth do backend é exatamente o mesmo OAuth Client editado no Google Cloud.
   - Se houver dois OAuth Clients no Google, editar o errado mantém o mesmo erro mesmo com as URLs certas.

4. Testar primeiro no domínio publicado Lovable:
   - `https://jaqtryp-com.lovable.app`
   - Depois testar no domínio customizado:
   - `https://jaqtryp.com`

5. Se ainda bloquear, capturar o erro exato mostrado pelo Google ou pela página de callback.
   - Se for `redirect_uri_mismatch`, o OAuth Client ainda não contém `https://oauth.lovable.app/callback` no lugar correto.
   - Se for outro erro, o próximo ajuste depende da mensagem exata.

Não vou mexer em código agora, porque a chamada OAuth já está correta no projeto e continuar alterando arquivos provavelmente só consumiria créditos sem resolver a configuração externa.