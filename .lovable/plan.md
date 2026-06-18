## Plano

1. **Corrigir a página de redefinição**
   - Ajustar `/reset-password` para aceitar os dois formatos de link de recuperação que podem chegar no e-mail:
     - `?code=...` no endereço
     - `#access_token=...&type=recovery` no final do endereço
   - Validar o link antes de mostrar o formulário e exibir uma mensagem clara enquanto carrega.

2. **Melhorar o envio do e-mail de recuperação**
   - Garantir que o link enviado sempre aponte para `/reset-password` no domínio atual.
   - Evitar que o usuário fique preso em uma sessão antiga antes de usar o link de recuperação.

3. **Melhorar mensagens de erro**
   - Trocar mensagens técnicas/ambíguas por instruções em português, por exemplo: “Esse link já foi usado ou expirou. Solicite um novo link.”

4. **Validar o fluxo**
   - Conferir no app que a tela de recuperação envia o e-mail corretamente.
   - Conferir que a tela de redefinição não mostra “link inválido” antes de tentar processar o link.

## Detalhes técnicos

- A correção principal será em `src/routes/reset-password.tsx`.
- Se necessário, também ajustarei `src/routes/forgot-password.tsx` para limpar sessão anterior antes de solicitar o link.
- Não vou alterar login/cadastro nem mexer nas configurações gerais de autenticação.