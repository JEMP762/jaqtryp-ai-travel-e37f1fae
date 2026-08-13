# PIX: QR Code não é aceito pelo banco ("chave PIX inexistente")

## O que foi verificado

Consultei o pagamento gerado no teste (ID 1327863648) diretamente na API do Mercado Pago. A resposta traz:

```text
"live_mode": false
```

A conta é a `JOSEEDIMILSONMESSIASPASSOS` (Brasil, MLB, cadastro completo, vendas permitidas) — ou seja, a conta está certa. **O problema é a chave de acesso.** A `MERCADOPAGO_ACCESS_TOKEN` cadastrada no projeto é a chave de **teste (sandbox)**, não a de produção.

Consequência: todo QR Code gerado é um QR de simulação. Ele não existe no sistema oficial do PIX (Banco Central), então qualquer banco real responde "chave PIX inexistente". Isso não é erro de código — o fluxo funciona, só está apontando para o ambiente errado.

## Como resolver

### 1. Pegar a chave de produção no Mercado Pago

No painel do Mercado Pago:
1. Acesse **Seus negócios → Configurações → Gestão e administração → Credenciais**
2. Escolha a aba **Credenciais de produção** (não "de teste")
3. Se pedir, complete a homologação da aplicação (nome, setor, modelo de integração)
4. Copie o valor de **Access Token** — começa com `APP_USR-`

Observação: a chave de teste começa com `TEST-`. Se a que está cadastrada hoje começa com `TEST-`, é exatamente esse o caso.

### 2. Substituir a chave no projeto

Abro o formulário seguro para você colar a chave de produção. Ela substitui a atual, sem passar pelo chat.

### 3. Revalidar de ponta a ponta

Depois de trocar a chave:
- Gerar uma nova cobrança PIX de valor real pela tela `/credits`
- Confirmar na API que o pagamento retorna `live_mode: true`
- Escanear o QR com o app do banco e verificar se o pagamento é reconhecido
- Pagar e confirmar que os créditos entram automaticamente via webhook

### 4. Conferir a chave PIX da conta recebedora

Se, mesmo com a chave de produção, o banco recusar: a conta Mercado Pago precisa ter uma chave PIX cadastrada para receber. Verifica-se em **Seu negócio → PIX → Minhas chaves**. Sem chave cadastrada, a conta não pode receber PIX.

## Ajuste técnico já aplicado

O webhook `/api/public/mercadopago/webhook` estava retornando erro 500 quando recebia notificação de um pagamento que não existe no nosso banco, o que faz o Mercado Pago reenviar a notificação indefinidamente. Passou a responder 200 e apenas registrar o erro no log. Essa correção sobe junto na próxima publicação.

## Fora de escopo

- Alterar preços dos pacotes
- Mexer no Stripe
- Mudar o fluxo de créditos
