# Disponibilizar moeda e tradução no link público

## Diagnóstico confirmado

- O Dashboard entrega corretamente o endereço `/r/meu-roteiro`.
- Na prévia atual, a página já exibe **Moeda do orçamento** e **Idioma do roteiro** antes da geração, além de **Traduzir roteiro** após o resultado.
- No endereço publicado `jaqtryp.com/r/meu-roteiro`, esses controles ainda não aparecem porque ele está servindo a versão anterior.
- O banco possui apenas esse link ativo, e o custo atual continua sendo 25 créditos pelo roteiro e 2 por tradução.

## Implementação

1. Publicar a versão atual, sem alterar o gerador principal, créditos, planos, autenticação ou indicação.
2. Confirmar no link público publicado:
   - seleção de moeda antes da geração;
   - seleção de idioma antes da geração;
   - custo exibido conforme a escolha;
   - opção de traduzir após o roteiro;
   - manutenção do modo gratuito e do modo monetizado existentes.
3. Validar a página publicada em computador e celular, incluindo o modo incorporado (`?embed=1`).
4. Conferir que o link continua com a mesma URL e que não houve regressão visual ou erro no carregamento.

## Limites

- Nenhuma mudança de banco ou regra de negócio.
- Nenhuma alteração no fluxo geral de criação de roteiros.
- A ação necessária é disponibilizar publicamente o que já está implementado e validado na prévia.
