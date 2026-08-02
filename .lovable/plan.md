O objetivo é fazer os e-mails de recuperação de senha (e outros e-mails de autenticação) chegarem na caixa de entrada do usuário, saindo de `contact@jaqtryp.com`, em vez de um remetente genérico. O domínio `jaqtryp.com` já está configurado no projeto e está registrado na Hostinger, então precisamos ativar a infraestrutura de e-mail nele.

### Diagnóstico confirmado
- O fluxo de recuperação de senha já existe e está funcional: `/forgot-password`, `/reset-password`, `resetPasswordForEmail` e `updateUser`.
- O domínio `jaqtryp.com` está configurado no projeto, mas ainda não existe configuração de envio de e-mail. Hoje os e-mails de autenticação saem por remetente genérico da plataforma, o que costuma cair em spam ou ser bloqueado pelo Gmail/Outlook.
- A tela de recuperação já tem aviso de remetente e contador de reenvio, mas ainda precisa dos modelos de e-mail com a marca.

### Passos
1. **Ativar envio de e-mail no domínio `jaqtryp.com`** (remetente `contact@jaqtryp.com`)
   - Usar o assistente de configuração de e-mail para o domínio já existente.
   - O DNS (SPF, DKIM, MX) é gerenciado automaticamente por delegação de subdomínio. Como o domínio está na Hostinger, será necessário adicionar os registros `NS` informados pelo assistente no painel DNS da Hostinger.
   - A verificação pode levar de algumas horas até 72h.

2. **Criar modelos de e-mail de autenticação com a marca Jaqtryp**
   - Recuperação de senha, confirmação de cadastro, magic link, troca de e-mail e reautenticação.
   - Usar as cores do app (azul neon), gradiente e logo Jaqtryp.
   - Corpo do e-mail em fundo branco (padrão de e-mail), mas com os acentos da marca.

3. **Aumentar o limite horário de envio de e-mails de autenticação**
   - O padrão do Supabase é baixo e pode bloquear cadastros/recuperações.
   - Ajustar `rate_limit_email_sent` para um valor compatível com o volume real.

4. **Manter as melhorias já feitas na tela de recuperação**
   - Aviso claro do remetente `contact@jaqtryp.com` e instrução para conferir spam.
   - Botão "Reenviar link" com contador de 60s.
   - Mensagem amigável quando atingir o limite de envios.
   - Opção de link mágico na tela de login/recuperação.

5. **Validar o envio**
   - Após configuração, testar o fluxo de recuperação e confirmar que o e-mail chega com a marca Jaqtryp.

### O que preciso de você
Concluir o assistente de configuração do domínio de e-mail (já pode ser iniciado abaixo). Assim que o domínio estiver registrado no assistente, sigo com os passos 2 a 5 na mesma execução — não é preciso esperar o DNS verificar para eu criar os modelos e ajustar o limite.

### Enquanto o DNS não verifica
Se algum usuário precisar entrar imediatamente, posso gerar um link de recuperação direto ou definir uma senha temporária. É só pedir.

### Detalhes técnicos
- `src/routes/reset-password.tsx` não precisa de mudanças — o fluxo de recuperação já trata `token_hash`, `code` e `access_token`.
- Alterações previstas: modelos de e-mail de autenticação, ajuste do limite de envio, e confirmação das melhorias em `src/routes/forgot-password.tsx` e `src/routes/login.tsx`.

<presentation-actions>
<presentation-open-email-setup>Configurar e-mail no domínio jaqtryp.com</presentation-open-email-setup>
</presentation-actions>