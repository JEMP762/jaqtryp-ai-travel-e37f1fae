# Simplificar a venda com Mercado Pago

## Experiência do usuário

- Nenhum usuário precisará informar Client ID, Client Secret ou chave técnica.
- No painel, o usuário verá apenas o botão **Conectar Mercado Pago**.
- Ao clicar, ele entra na própria conta Mercado Pago e autoriza o JAQTRYP uma única vez.
- Depois informa somente o valor do roteiro e ativa a venda.
- O visitante recebe o QR Code Pix na própria página; quando o Mercado Pago confirmar, o roteiro é liberado automaticamente.

## Por que não usar somente um link colado

Um link comum de pagamento não informa ao JAQTRYP qual geração foi paga. Sem essa identificação, o sistema não consegue liberar automaticamente o roteiro certo com segurança. A autorização por um clique mantém a experiência simples e permite vincular cada Pix ao roteiro correspondente.

## Configuração única do JAQTRYP

- Client ID e Client Secret pertencem somente ao aplicativo JAQTRYP no Mercado Pago.
- Essas duas credenciais são configuradas uma única vez pelo administrador do JAQTRYP e ficam protegidas no servidor.
- Elas nunca serão solicitadas aos usuários e nunca aparecerão no painel.
- Corrigir a tela para não tentar iniciar a conexão enquanto essa configuração global ainda não estiver pronta; mostrar apenas um estado claro de indisponibilidade temporária.

## Ajustes no trabalho já iniciado

- Manter as preferências combináveis nos dois geradores.
- Manter as tabelas privadas de conexão e de compras Pix já preparadas.
- Finalizar a autorização por um clique, retorno seguro, QR Code, consulta de estado e confirmação automática.
- Remover definitivamente senha e link externo do fluxo de venda.
- Preservar créditos, planos, autenticação, indicação, moeda, tradução e PDF.

## Validação

- Usuário conecta sua conta sem digitar credenciais técnicas.
- Conta conectada permanece identificada após recarregar o painel.
- Venda não pode ser ativada sem uma conta conectada.
- Pix fica associado a uma única geração e ao valor configurado.
- Confirmação correta libera automaticamente; pagamento pendente, expirado, divergente ou de outra geração não libera.
- Desconectar a conta desativa a venda e evita deixar visitantes presos.
- Preferências combináveis funcionam no gerador principal e no link público, em computador e celular.

## Dependência final

Para ativar o botão real, o administrador do JAQTRYP precisa cadastrar uma única vez as credenciais do aplicativo Mercado Pago. Essa etapa é da plataforma, não de cada usuário.
