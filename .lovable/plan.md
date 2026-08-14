# Foco em recargas + ações rápidas

Quatro mudanças, todas de interface. Nenhum código de pagamento, Stripe, PIX ou rota é apagado — apenas escondido ou reorganizado.

## 1. Assinatura recorrente em segundo plano

- Criar um interruptor único (`SUBSCRIPTIONS_ENABLED = false`) em um novo arquivo `src/lib/feature-flags.ts`. Basta trocar para `true` no seu comando para tudo voltar a aparecer.
- Com o interruptor desligado:
  - O modal "Seus créditos acabaram" (`UpgradeGateDialog`) mostra só os pacotes de recarga — sem abas "Recarga avulsa / Assinar", sem planos Pro/Ultra.
  - O item "Minha Assinatura" some do menu lateral.
  - A rota `/billing` continua existindo e funcionando (quem já assina segue vendo o status); ela só não é mais linkada.
- Todo o código de assinatura (`StripeSubscriptionCheckout`, `useSubscriptionCheckout`, `subscription.functions`, webhooks) fica intacto.

## 2. Créditos zerados sempre levam à recarga

- O modal de recarga já abre quando o saldo chega a zero. Ajuste: passa a abrir quando **qualquer** saldo (grátis, mensal ou avulso) zera, mesmo em primeiro uso, e o texto muda para "Faça uma recarga para continuar".
- Os botões do modal levam direto à escolha de pacote → Cartão (Stripe) ou PIX, como já funciona hoje.
- O link do rodapé continua indo para a Carteira/Créditos.

## 3. Gatilhos de ações rápidas

- Nova faixa de "Ações rápidas" no topo do Dashboard (abaixo da saudação): botões compactos, com ícone, roláveis no celular e em grade no desktop.
- Serviços incluídos: Roteiro IA (Planner), Chat IA, Tradutor, Live Translator, Tradutor de Arquivos, Voos, Créditos/Recarga.
- São apenas atalhos para as rotas que já existem — nenhuma lógica nova.

## 4. Remover Hospedagem do dashboard

- Tirar o item "Hospedagem" do menu lateral e qualquer cartão de hospedagem do Dashboard.
- O arquivo da rota `/stays` e as funções `stays.functions.ts` permanecem no projeto (sem link visível), então nada quebra.

## Detalhes técnicos

- Novo: `src/lib/feature-flags.ts`, `src/components/QuickActions.tsx`.
- Editados: `src/components/UpgradeGateDialog.tsx` (aba de assinatura condicional), `src/hooks/useUpgradeGate.tsx` (condição de abertura), `src/routes/_app.tsx` (remover itens do menu), `src/routes/_app.dashboard.tsx` (ações rápidas).
- Sem migrações de banco, sem alterações em Stripe/Mercado Pago/PIX, sem exclusão de rotas.
