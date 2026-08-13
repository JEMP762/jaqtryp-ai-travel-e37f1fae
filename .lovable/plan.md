# Ativar PIX em produção (Mercado Pago)

## Situação atual
O pagamento de teste (ID 1327863648) voltou da API do Mercado Pago com `live_mode: false`. Isso confirma que a credencial salva no projeto é de **teste (sandbox)** — por isso o banco mostra "chave PIX inexistente" ao ler o QR Code.

## O que fazer

### 1. Pegar a credencial de produção
No painel do Mercado Pago:
- Entre em **Suas integrações** → selecione a aplicação do JAQTRYP
- Vá em **Credenciais de produção**
- Copie o **Access Token** (começa com `APP_USR-`)

Observação: se a conta ainda não tiver as credenciais de produção liberadas, o Mercado Pago pede o preenchimento dos dados da aplicação (modelo de negócio, site, etc.) antes de exibi-las.

### 2. Substituir a chave no projeto
Vou abrir o formulário seguro para você colar o novo valor em `MERCADOPAGO_ACCESS_TOKEN`. O valor vai direto para o cofre de secrets — não passa pelo chat.

### 3. Conferir o webhook de produção
Confirmar que em **Webhooks/Notificações** da aplicação (aba **Produção**) está cadastrada a URL:
```
https://jaqtryp.com/api/public/mercadopago/webhook
```
com o evento `payment`.

### 4. Validar
- Gerar uma recarga PIX real de valor baixo pelo app
- Verificar que o pagamento criado retorna `live_mode: true`
- Pagar pelo banco e confirmar que o webhook credita os créditos automaticamente
- Checar o registro em `pix_payments` (status `approved`) e o saldo na carteira

## Detalhes técnicos
- Nenhuma mudança de código é necessária: `src/lib/pix.server.ts` já lê `MERCADOPAGO_ACCESS_TOKEN` do ambiente e o mesmo fluxo serve para sandbox e produção.
- O webhook (`src/routes/api.public.mercadopago.webhook.ts`) já trata IDs desconhecidos com 200 OK para evitar retentativas infinitas.
- O Stripe permanece intocado; PIX continua como segunda opção de pagamento.
