# Passo a passo para deixar a integração Mystifly pronta

Este guia mostre o que você precisa fazer, na ordem certa, para que o
sistema de voos funcione de verdade.

## 1. Entrar no painel de admin

- Vá para o app (domínio do JAQTRYP).
- Faça login com seu usuário de administrador.
- Se o seu usuário não for admin, ninguém consegue ver a tela da Mystifly.

## 2. Acessar a configuração da Mystifly

- Dentro do app, abra: **Administração → Mystifly**.
- Ali tem o formulário de configuração e o status da conexão.
- Você também pode entrar em **Administração → Testes Mystifly** para bater
  cada endpoint manualmente.

## 3. Cadastrar as credenciais de sandbox (testes)

A Mystifly deve ter enviado um e-mail com os dados de acesso. Você precisa
colocar no mínimo:

- Endereço do ambiente de testes (Base URL sandbox)
- Usuário
- Senha

Campos opcionais:

- Número da conta
- Chave de API extra

Importante: esses dados nunca aparecem no navegador. Eles ficam guardados
apenas no servidor.

## 4. Testar a conexão

- Na tela Admin → Mystifly, clique no botão **Testar conexão**.
- O sistema vai criar uma sessão real na Mystifly e atualizar o status.
- Se der certo, o status muda para "Conectado".
- Se der errado, aparece a mensagem de erro. Copie a mensagem e me mostre
  para corrigirmos.

## 5. Rodar os testes de homologação

Ainda em **Admin → Testes Mystifly**, execute na ordem abaixo. Cada teste
grava um log automaticamente.

1. **createSession** — cria sessão.
2. **searchLowestFare** — busca passagem só de ida.
3. **searchBrandedFare** — busca passagem ida e volta.
4. **fareRules** — mostra as regras de uma tarifa.
5. **revalidate** — revalida o preço antes de reservar.
6. **bookFlight** — faz uma reserva de teste (use "hold" primeiro).
7. **tripDetails** — confere o PNR da reserva.
8. **orderTicket** — emite o bilhete.
9. **bookingNotes** — adiciona uma observação.
10. **invoiceSearch** — busca a fatura.
11. **postTicketingRequest** — abre pedido pós-emissão (void/refund).
12. **ptrSearch** — consulta os pedidos pós-emissão.
13. **scheduleChange** — lista alterações de malha.
14. **creditNote** — consulta notas de crédito.
15. **bookingCancel** — cancela a reserva de teste.

Se algum teste falhar, me avise qual endpoint e qual mensagem apareceu.

## 6. Revisar os logs

- Na tela Admin → Mystifly, a seção "Últimas chamadas" mostra o resultado de
cada teste.
- Cada linha tem: endpoint, sucesso ou erro, tempo de resposta e referência.
- Isso ajuda a identificar se o problema é credencial, formato de dados ou
  indisponibilidade da Mystifly.

## 7. Gerar o relatório de homologação

- Depois que todos os testes passarem, eu gero um relatório atualizado em
  `docs/mystifly.md`.
- Esse relatório pode ser enviado para a Mystifly como comprovação de que a
  integração está funcionando.

## 8. Trocar para produção

- Depois que a Mystifly aprovar a homologação, você cadastra o endereço de
  produção (Base URL production) e o usuário/senha de produção.
- Na tela Admin → Mystifly, altera o ambiente de "sandbox" para
  "production".
- Pronto. A partir daí, os usuários podem buscar e reservar vois reais.

## O que não precisa fazer agora

- Não precisa alterar código.
- Não precisa mexer em banco de dados.
- Não precisa publicar o app de novo.

Tudo que falta é colocar os dados da Mystifly e rodar os testes.
