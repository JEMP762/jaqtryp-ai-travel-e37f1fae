# Monetização opcional do roteiro com logo

## Escopo preservado

- Alterar somente **Meu link / Widget de roteiro** e sua página pública `/r/:slug`.
- Manter intactos o gerador principal, autenticação, planos, créditos, referral, traduções e demais páginas.
- Um widget sem configuração completa de venda continuará gratuito e exibirá o roteiro inteiro exatamente como hoje.
- O pagamento será externo e manual: o JAQTRYP abre o link indicado, e a senha definida pelo dono libera o roteiro sem consultar o provedor de pagamento.

## Configuração de Venda do Link

Adicionar um bloco discreto no painel do link com logo:

- **Link de Recebimento**: URL HTTPS validada, compatível com Mercado Pago, Stripe, Pix, Kiwify e outros links externos.
- **Valor do Roteiro**: valor positivo em reais, exibido no formato brasileiro.
- **Senha de Desbloqueio**: código definido pelo proprietário, com tamanho mínimo e limite seguro.
- Permitir ativar a monetização somente quando os três campos estiverem válidos.
- Permitir limpar a configuração e retornar imediatamente ao modo gratuito.
- Nunca devolver ou exibir novamente a senha salva; o painel apenas informa que existe uma senha configurada e permite substituí-la.

## Armazenamento e segurança

- Acrescentar campos opcionais à configuração existente do widget para link de recebimento, valor, hash/salt da senha e status monetizado.
- Salvar a senha somente como hash com salt, nunca em texto puro.
- Criar funções autenticadas específicas para o proprietário ler e salvar a configuração, validando URL, valor, senha e propriedade do widget no servidor.
- Manter as políticas atuais e não conceder acesso público aos campos privados.
- Acrescentar ao registro da geração o conteúdo necessário para posterior desbloqueio; esse conteúdo continuará privado no banco.

## Página pública monetizada

- Ao carregar o link, retornar somente o estado de monetização, valor formatado e link externo; nunca retornar hash ou senha.
- Gerar e cobrar créditos exatamente pelo fluxo atual.
- Em modo monetizado, guardar o roteiro completo no servidor e devolver ao navegador apenas:
  - cabeçalho e logo atuais;
  - resumo inicial;
  - conteúdo até o fim do **Dia 1**;
  - indicação visual borrada a partir do **Dia 2**, sem enviar o texto protegido ao navegador.
- Sobre a área bloqueada, mostrar o valor, o botão **Pagar e Liberar Roteiro** e o campo **Já pagou? Digite a senha de acesso**.
- Abrir o link de recebimento em nova aba com proteção contra controle da janela original.
- Validar a senha no servidor usando o identificador da geração e o widget correspondente; após sucesso, devolver o roteiro completo e liberar tradução e PDF.
- Aplicar limite de tentativas por visitante e geração para reduzir tentativas de adivinhação.
- Senha incorreta mantém o bloqueio e mostra mensagem clara, sem regenerar nem cobrar créditos novamente.

## Compatibilidade com idioma e PDF

- Preservar moeda, idioma inicial, tradução posterior, logo e modo incorporado já existentes.
- Enquanto bloqueado, esconder/desabilitar tradução e PDF para impedir acesso indireto ao conteúdo completo.
- Após desbloquear, restaurar integralmente os controles atuais; o PDF usa somente a versão já liberada.
- Se o roteiro tiver sido solicitado em outro idioma, o Dia 1 exibido e o conteúdo liberado permanecem nesse idioma.

## Validação

- Widget gratuito: geração e exibição completa sem qualquer etapa extra.
- Widget monetizado: resumo + Dia 1 visíveis, restante realmente ausente da resposta e representado com blur.
- Link de pagamento abre corretamente; senha errada não libera; senha certa libera sem nova geração ou cobrança.
- Tradução e PDF ficam indisponíveis antes e funcionam depois do desbloqueio.
- Troca/remoção da senha e desativação da monetização.
- URL inválida, valor inválido, senha curta e tentativas repetidas são rejeitados.
- Verificação em celular e computador, tanto na página pública quanto incorporada.
- Regressão focada em créditos do proprietário, limites do widget, logo, idiomas e moeda.

## Detalhes técnicos

- Migração aditiva nas tabelas do widget e de suas gerações, sem remover ou reinterpretar colunas atuais.
- Validação com Zod no cliente e no servidor.
- Hash com salt usando API criptográfica compatível com o ambiente publicado e comparação resistente a diferenças de tempo.
- Separação do Markdown no servidor por títulos de dia; o cliente recebe apenas a prévia autorizada.
- Nenhuma integração ou webhook novo de pagamento será criado neste escopo.
