Vou corrigir a recuperação de senha como prioridade, sem mexer em outras áreas do app.

1. Ajustar a configuração de autenticação
- Ativar o processamento correto de sessão no link de recuperação para o cliente aceitar `?code=...` e `#access_token=...`.
- Garantir que o link enviado pelo e-mail volte para `/reset-password` no domínio correto.

2. Corrigir `/reset-password`
- Processar o link de recuperação de forma explícita e segura, sem marcar como inválido antes da autenticação terminar.
- Tratar os dois formatos possíveis de link: código PKCE e token no hash.
- Mostrar o formulário somente depois que a sessão de recuperação estiver válida.
- Exibir mensagem clara em português quando o link estiver expirado, já usado ou inválido.

3. Corrigir `/forgot-password`
- Enviar o e-mail com redirecionamento correto.
- Evitar sessão antiga atrapalhando o fluxo, mas sem quebrar o link de recuperação.
- Melhorar o feedback para o usuário após solicitar o e-mail.

4. Validar o fluxo no preview
- Testar a tela de solicitar recuperação.
- Testar a tela de redefinição simulando link sem token, token inválido e estado de carregamento.
- Confirmar que a página não cai mais direto em “link inválido” quando ainda está processando.

Detalhes técnicos:
- A causa provável é que o cliente de autenticação atual não está com `detectSessionInUrl` configurado explicitamente, e o código anterior passou a depender desse comportamento automático.
- A correção vai deixar o fluxo resiliente: se vier `code`, troca por sessão; se vier `access_token`/`refresh_token`, seta a sessão; se vier erro do provedor, mostra a mensagem correta.