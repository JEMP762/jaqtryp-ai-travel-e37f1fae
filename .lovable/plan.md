## Corrigir o e-mail de recuperação de senha (remetente: contact@jaqtryp.com)

### Diagnóstico (verificado)
- As páginas `/forgot-password` e `/reset-password` existem e o código está correto (envio do link + `updateUser({ password })`).
- **O projeto não tem domínio de envio de e-mail configurado.** Hoje os e-mails de autenticação saem por um remetente genérico da plataforma — motivo típico de o link não chegar, cair em spam ou ser bloqueado pelo Gmail/Outlook.
- Não há registros recentes de pedidos de recuperação nos logs de autenticação.

### Passos
1. **Configurar o domínio de envio `jaqtryp.com`**, com remetente `contact@jaqtryp.com`. Isso é feito pelo assistente de configuração de e-mail (botão abaixo do plano, após aprovação). O SPF/DKIM/MX é gerenciado automaticamente por delegação de DNS — a verificação pode levar de algumas horas até 72h.
2. **Criar os modelos de e-mail de autenticação com a marca Jaqtryp** — recuperação de senha, confirmação de cadastro, magic link, troca de e-mail — usando as cores e o logo do app.
3. **Aumentar o limite horário de envio de e-mails de autenticação**, hoje no padrão baixo, para um valor compatível com o volume real de cadastros e recuperações.
4. **Melhorar a tela "Recuperar senha"**:
   - aviso claro do remetente esperado (`contact@jaqtryp.com`) e para conferir o spam;
   - botão "Reenviar link" com contador de 60s;
   - mensagem amigável quando o limite de envios é atingido, em vez do erro técnico.
5. **Opção de entrada por link mágico** na tela de login/recuperação: se o usuário não lembra a senha, recebe um link de acesso e define a nova senha dentro do app — um caminho de recuperação extra usando a mesma infraestrutura.

### O que preciso de você
Concluir o assistente de configuração do domínio de e-mail (usaremos `jaqtryp.com`, que já é seu). Assim que o domínio estiver registrado, sigo com os passos 2 a 5 na mesma execução — não é preciso esperar o DNS verificar para eu implementar.

### Enquanto o DNS não verifica
Se algum usuário precisar entrar imediatamente (ex.: `joseedimilsonmessiaspassos@gmail.com`), posso gerar um link de recuperação direto ou definir uma senha temporária. É só pedir.

### Detalhes técnicos
- `src/routes/reset-password.tsx` não precisa de mudanças — o fluxo de recuperação já trata `token_hash`, `code` e `access_token`.
- Alterações previstas: `src/routes/forgot-password.tsx` e `src/routes/login.tsx`, novos modelos de e-mail de autenticação, e ajuste do limite de envio no serviço de autenticação.
