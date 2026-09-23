# Corrigir salvamento da venda e publicar o widget atualizado

## Diagnóstico confirmado

- O salvamento falha porque o ambiente publicado aceita no máximo **100.000 iterações PBKDF2**, enquanto a implementação solicita 120.000.
- Nenhum link possui hash ou salt de senha gravado; a tentativa que falhou não deixou configuração parcial.
- Não é necessário remover a senha: ela pode continuar protegida com PBKDF2-SHA256, salt individual e 100.000 iterações.
- A prévia já contém moeda e idioma, enquanto o site publicado ainda mostra a versão anterior.

## Correção

1. Ajustar exclusivamente a derivação da senha de 120.000 para 100.000 iterações.
2. Manter o restante da segurança atual: salt aleatório, SHA-256, hash não reversível, comparação segura e limite de tentativas.
3. Validar o fluxo completo de configuração de venda:
   - salvar link HTTPS, valor e senha;
   - recarregar o Dashboard e confirmar que a configuração permanece ativa sem exibir a senha;
   - confirmar que senha incorreta não libera;
   - confirmar que senha correta libera o roteiro sem nova cobrança.
4. Verificar novamente a página pública e o carregamento do cliente para descartar erro transitório da prévia.
5. Publicar a versão atual, reunindo a correção da senha e os seletores já implementados de moeda e idioma.
6. Conferir no endereço publicado, em computador e celular, os seletores, a tradução e o modo de venda.

## Escopo preservado

- Nenhuma alteração no gerador principal, créditos, planos, autenticação ou indicação.
- Nenhuma remoção da senha e nenhuma mudança no link público existente.
- Nenhuma integração automática com o provedor de pagamento.
