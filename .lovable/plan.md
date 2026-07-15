## Plano

1. **Corrigir o erro de permissão da sala ao vivo**
   - Aplicar uma migração pequena na tabela `room_participants` para conceder ao app as permissões necessárias de leitura/criação/remoção para usuários autenticados.
   - Manter as regras de segurança atuais: cada usuário só consegue registrar/ver/remover a própria participação.
   - Garantir acesso administrativo do backend para rotinas internas.

2. **Melhorar a reentrada em salas existentes**
   - Ajustar o fluxo de “Entrar” para tratar reentrada como operação segura/idempotente.
   - Se o usuário já estiver registrado na sala, a entrada deve continuar normalmente em vez de mostrar erro.

3. **Adicionar os créditos solicitados**
   - Localizar os usuários pelos emails:
     - `ana.jucs22@gmail.com`: adicionar 5.000 créditos.
     - `joseedimilsonmessiaspassos@gmail.com`: adicionar 10.000 créditos.
   - Registrar os créditos no histórico com motivo de cortesia/admin para ficar rastreável.

4. **Validação**
   - Conferir no banco que as permissões da tabela foram aplicadas.
   - Conferir que os créditos foram adicionados aos saldos corretos.
   - Revisar o fluxo da tela `/live-room/:code` para confirmar que a mensagem “Não foi possível registrar sua entrada na sala” não será exibida em reentrada normal.

## Detalhes técnicos

- O diagnóstico atual mostra que `room_participants` possui políticas de segurança, mas não possui permissões concedidas para `authenticated`/`service_role` na camada de acesso do banco. Isso causa rejeição antes mesmo das regras por usuário funcionarem.
- A correção principal será uma migração com `GRANT` em `room_participants`, sem abrir acesso público anônimo.
- Os créditos serão uma alteração de dados, não de estrutura, usando a função existente de créditos para manter saldo e histórico consistentes.