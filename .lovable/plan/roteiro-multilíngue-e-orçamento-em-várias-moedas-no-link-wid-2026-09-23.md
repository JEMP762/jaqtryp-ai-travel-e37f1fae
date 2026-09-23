# Roteiro multilíngue e orçamento em várias moedas no link/widget

## Objetivo
Melhorar a página pública de roteiro para que o visitante escolha moeda e idioma antes de gerar, e possa traduzir o roteiro pronto para outros idiomas. Toda cobrança continua sendo feita no saldo do proprietário do link.

## Experiência do visitante
- Adicionar ao formulário seletores claros de **moeda do orçamento** e **idioma do roteiro**.
- Oferecer as moedas principais usadas pelo produto, com código e símbolo, mantendo BRL como padrão.
- Oferecer os 11 idiomas já existentes no tradutor: português, inglês, espanhol, francês, italiano, alemão, japonês, chinês, coreano, árabe e russo.
- Se o idioma inicial não for português, gerar o roteiro-base e entregar a versão traduzida no idioma escolhido.
- Depois do resultado, exibir um seletor “Traduzir roteiro” para criar outra versão sem perder a original.
- Permitir alternar entre as versões já geradas e baixar o PDF na versão atualmente selecionada.
- Manter logo, nome da empresa, página pública e modo incorporado existentes, com boa adaptação para celular.

## Créditos
- Preservar o custo atual de **25 créditos** para `trip_create_branded`.
- Usar dinamicamente o custo configurado em `translate_text` para cada idioma adicional; no banco atual ele é **2 créditos**.
- Exemplo atual: roteiro com marca + uma tradução = **27 créditos**. Se o custo administrativo de tradução mudar, o widget acompanha automaticamente.
- Mostrar o custo antes da ação: 25 para português; 25 + custo atual para outro idioma; e custo atual em cada nova tradução.
- Conferir o saldo do dono antes de iniciar. Se faltar crédito, informar ao visitante que o serviço está indisponível, sem revelar saldo ou dados do proprietário.
- Cobrar tradução somente após uma tradução concluída com sucesso e registrar o valor total consumido nas estatísticas atuais do widget.

## Proteção contra abuso e cobrança indevida
- A tradução pública aceitará somente um roteiro realmente gerado por aquele widget, validando identificador, proprietário e assinatura/hash do conteúdo.
- Reutilizar os limites por hora, por dia, por visitante e a lista de domínios já existentes.
- Validar idioma e moeda por listas permitidas; rejeitar texto, código de moeda ou identificador adulterado.
- Não permitir que a rota pública seja usada para traduzir textos arbitrários às custas do dono do link.

## Persistência e painel do proprietário
- Acrescentar à geração do widget apenas os dados necessários para auditoria: moeda, idioma original, hash do resultado e créditos de tradução.
- Manter o total atual de roteiros e créditos consumidos, passando a incluir traduções.
- Atualizar a explicação no painel do link para deixar claro: 25 créditos por roteiro e o custo vigente por tradução.
- Não alterar planos, autenticação, referral, link público, branding ou regras gerais de créditos.

## Implementação técnica
- Evoluir a rota pública do widget com ações separadas e validadas para gerar e traduzir.
- Reutilizar `trip_create_branded`, `translate_text`, `checkBalance` e `chargeFeature`; nenhum preço ficará fixo na interface ou na lógica.
- Aplicar uma migração aditiva para os campos de auditoria da geração, mantendo registros existentes compatíveis.
- Garantir que falhas de IA ou tradução não produzam cobrança de tradução nem resultado marcado como concluído.
- Investigar e eliminar o erro atual de carregamento do cliente antes da validação final, caso ainda seja reproduzível.

## Validação
- Testar geração em português com BRL e cobrança de 25 créditos.
- Testar geração inicial em outro idioma e cobrança de 25 + custo vigente de tradução.
- Testar tradução posterior para um ou mais idiomas e uma cobrança por nova versão.
- Testar troca entre versões, PDF, logo e valores na moeda escolhida.
- Testar saldo insuficiente antes do roteiro e antes da tradução.
- Testar repetição rápida, conteúdo adulterado, domínio não autorizado e limites por visitante.
- Validar página normal e widget incorporado em celular e computador, sem regressão no link atual.
