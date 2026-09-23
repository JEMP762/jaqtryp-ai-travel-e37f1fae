# Conectar Mercado Pago e validar o desbloqueio automático

## Objetivo
Conectar a conta Mercado Pago do proprietário do link ativo `meu-roteiro` ao JAQTRYP e executar um teste real de R$ 1,00, confirmando que o roteiro completo é liberado automaticamente após a aprovação do Pix.

## Etapas
1. **Preparar e publicar o fluxo atual**
   - Validar a compilação e os pontos críticos do fluxo de conexão, geração do Pix, consulta de status e desbloqueio.
   - Publicar a versão atual para que o Mercado Pago use URLs públicas estáveis no retorno da autorização e nas notificações de pagamento.

2. **Conectar a conta do proprietário**
   - No Dashboard, ativar “Vender o roteiro gerado” e usar “Conectar Mercado Pago”.
   - Você concluirá a autorização na página oficial do Mercado Pago; nenhuma credencial técnica será solicitada.
   - Confirmar no Dashboard que a conta voltou conectada.

3. **Configurar o teste**
   - Definir temporariamente o valor do roteiro como **R$ 1,00** e salvar.
   - Confirmar que o link público passa ao modo monetizado sem alterar o gerador padrão, créditos, planos ou autenticação.

4. **Executar uma compra real**
   - Abrir o link público como visitante, escolher preferências, moeda e idioma, e gerar um roteiro.
   - Confirmar que apenas o Dia 1 aparece antes do pagamento.
   - Gerar o Pix na própria página, sem abrir nova aba; você fará o pagamento de R$ 1,00.

5. **Validar a confirmação e a liberação**
   - Acompanhar a confirmação automática pela consulta periódica e pela notificação do Mercado Pago.
   - Confirmar que somente o pagamento aprovado, com valor e roteiro correspondentes, libera o conteúdo completo.
   - Verificar que não há senha, nova cobrança de créditos no desbloqueio ou liberação por pagamento pendente, expirado ou divergente.
   - Recarregar a página e confirmar que o estado liberado permanece registrado.

6. **Encerrar o teste com segurança**
   - Restaurar o valor comercial desejado ou desativar temporariamente a venda, conforme sua orientação após o teste.
   - Registrar o resultado final e qualquer falha observada sem expor dados da conta ou do pagamento.

## Participação necessária
- Você autoriza a conexão na página oficial do Mercado Pago.
- Você paga o Pix real de R$ 1,00 exibido pelo link.
- O valor recebido ficará na conta Mercado Pago conectada, sujeito às regras e eventuais tarifas do provedor.

## Critérios de conclusão
- Conta Mercado Pago conectada por autorização, sem pedir Client ID ou Client Secret ao usuário.
- Pix de R$ 1,00 criado dentro da página pública.
- Pagamento aprovado e associado à geração correta.
- Roteiro completo liberado automaticamente e mantido após recarregar.
- Fluxos gratuitos e demais áreas do JAQTRYP permanecem inalterados.
