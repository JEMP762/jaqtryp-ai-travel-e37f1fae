## Plano

1. Corrigir o erro `Invalid key`
   - Sanitizar o nome do arquivo antes de montar o caminho no armazenamento.
   - Remover/substituir caracteres problemáticos como travessão, acentos especiais, múltiplos espaços e símbolos que tornam a chave inválida.
   - Exemplo: `portugal — Roteiro__pt.md` passará a ser salvo como algo seguro, como `portugal-roteiro__pt.md`.

2. Manter o nome amigável para o usuário
   - O arquivo baixado continuará com um nome legível.
   - O caminho interno será seguro para o backend.

3. Melhorar a mensagem de erro
   - Se o armazenamento falhar, retornar uma mensagem mais clara e registrar detalhes técnicos no log.

4. Confirmar cobrança automática de créditos
   - A cobrança já está posicionada para acontecer somente depois que a tradução é gerada e salva com sucesso.
   - Após corrigir o salvamento, a função `spend_for_feature('file_translation')` deve debitar automaticamente os créditos.
   - Também vou ajustar a verificação para usar o saldo total correto e evitar inconsistências com o catálogo de créditos.

5. Validar o fluxo
   - Testar mentalmente o caso informado (`portugal — Roteiro__pt.md`) contra a nova sanitização.
   - Conferir que o caminho fica no formato permitido: `userId/translationId/nome-seguro.md`.

## Observação

Não precisa de uma nova API para esse erro. A chave inválida vem do nome/caminho do arquivo no armazenamento, não da IA.