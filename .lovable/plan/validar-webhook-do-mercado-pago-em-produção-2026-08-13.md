# Validar webhook do Mercado Pago em produção

O webhook `https://jaqtryp.com/api/public/mercadopago/webhook` foi configurado no painel do Mercado Pago. Agora precisamos confirmar que notificações chegam, são processadas e os créditos entram corretamente.

## 1. Testar se o endpoint responde

- Fazer uma requisição GET para `https://jaqtryp.com/api/public/mercadopago/webhook`
- Esperado: HTTP 200 com body "ok"
- Se der erro 404/500, há problema de rota ou deploy

## 2. Simular uma notificação de pagamento

- Enviar POST para o mesmo endpoint com payload de exemplo do Mercado Pago (`type: "payment"`, `data.id` de um pagamento real)
- Verificar logs do servidor para confirmar que `syncPixPaymentStatus` foi chamada
- Confirmar que o retorno é HTTP 200

## 3. Teste real de pagamento via PIX

- Acessar `/credits` logado com uma conta de teste
- Escolher um pacote → PIX
- Escanear o QR Code ou copiar o código
- Pagar o PIX pelo app do banco
- Aguardar notificação do Mercado Pago
- Verificar se os créditos aparecem automaticamente na carteira

## 4. Conferir logs e histórico

- Logs do webhook no servidor
- Histórico de créditos do usuário (motivo `purchase_pix`)
- Status do pagamento na tabela `pix_payments`

## 5. Ajustes finais (se necessário)

- Se o webhook não chegar em até 5 minutos após o pagamento: revisar URL e eventos no painel do Mercado Pago
- Se o webhook chegar mas os créditos não entrarem: corrigir `syncPixPaymentStatus` ou permissões no banco
- Se tudo funcionar: documentar o fluxo e marcar como concluído

## Fora de escopo

- Alterar preços dos pacotes
- Modificar a integração do Stripe
- Criar novas funcionalidades de créditos
