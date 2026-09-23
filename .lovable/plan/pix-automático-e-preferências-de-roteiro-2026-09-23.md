# Pix automático e preferências de roteiro

## Resultado esperado

- O proprietário do link conecta a própria conta Mercado Pago no Dashboard e recebe diretamente cada venda.
- O visitante paga por Pix dentro da página do roteiro, sem abrir outra aba.
- A confirmação do Mercado Pago libera automaticamente o roteiro completo; a senha deixa de fazer parte do fluxo normal.
- Os geradores principal e público oferecem categorias combináveis para personalizar o roteiro.

## Pagamento Pix por proprietário

- Substituir o campo de link externo por **Conectar Mercado Pago**, mantendo links sem venda no modo gratuito atual.
- Implementar a autorização segura da conta Mercado Pago de cada proprietário e guardar apenas os dados necessários no servidor.
- Manter preço e ativação da venda no painel; remover a exigência e a interface de senha.
- Na geração monetizada, criar uma cobrança Pix exclusiva para a geração, com valor e proprietário vinculados no servidor.
- Exibir QR Code, código copia-e-cola, valor e estado do pagamento sobre a parte bloqueada, na mesma página.
- Consultar o estado enquanto a tela estiver aberta e também processar a confirmação oficial do Mercado Pago.
- Após confirmação, liberar o texto completo, tradução e PDF sem gerar novamente e sem nova cobrança de créditos.
- Vincular cada pagamento à geração e ao visitante, validar o valor e impedir reutilização ou processamento duplicado.
- Preservar o Dia 1 visível até o pagamento e manter o conteúdo restante fora da resposta enquanto bloqueado.

## Modelos combináveis de preferências

Adicionar aos dois geradores opções de um clique que podem ser combinadas:

- Cultura e história
- Gastronomia
- Natureza
- Aventura
- Família
- Romance
- Vida noturna
- Compras
- Bem-estar
- Fotografia

Manter também um campo livre para desejos, atrações ou necessidades específicas. O pedido enviado à IA reunirá todas as categorias marcadas e o texto adicional, priorizando as principais atrações compatíveis sem criar um cronograma impraticável.

## Compatibilidade e transição

- Não alterar créditos, planos, autenticação, indicação nem o gerador fora dessas preferências.
- Configurações de senha antigas deixam de determinar a monetização; nenhum hash ou senha será enviado ao navegador.
- Uma venda só poderá ser ativada após a conta Mercado Pago do proprietário estar conectada.
- Se a conta for desconectada, o link volta ao modo gratuito para não deixar visitantes presos.
- Reutilizar a integração Pix atual sem misturar vendas de roteiro com recargas de créditos.

## Estrutura técnica

- Criar armazenamento privado para a conexão Mercado Pago e uma tabela de compras de roteiro com geração, proprietário, visitante, valor, identificador externo, estado, expiração e data de liberação.
- Criar retorno público de autorização da conta e ampliar o webhook Mercado Pago; ambos validam a origem e usam operações idempotentes.
- Criar ações públicas de início do Pix e consulta/liberação, retornando somente os dados necessários ao comprador.
- Compartilhar a lista de preferências entre os dois formulários e validar os identificadores no servidor.

## Validação

- Conectar e desconectar uma conta Mercado Pago no Dashboard.
- Gerar roteiro gratuito sem qualquer mudança no fluxo atual.
- Gerar roteiro pago, criar Pix na página, confirmar pagamento e liberar automaticamente sem senha.
- Confirmar que pagamento pendente, expirado, valor divergente ou de outra geração não libera conteúdo.
- Confirmar idempotência do webhook e ausência de cobrança adicional de créditos no desbloqueio.
- Testar categorias múltiplas e campo livre nos dois geradores.
- Conferir geração, tradução, PDF, moeda e idiomas em computador, celular e modo incorporado.

## Dependência para ativação real

A conexão de contas exige as credenciais de aplicativo/marketplace do Mercado Pago. A implementação pode ser concluída e testada estruturalmente, mas o teste real de conexão e pagamento dependerá dessas credenciais estarem configuradas no projeto.
