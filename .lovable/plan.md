Plano de correção:

1. Corrigir o erro que impede o dashboard de abrir
   - Remover dependências/uso problemático no carregamento inicial do dashboard.
   - Trocar a leitura direta de saldo pelo frontend por uma função autenticada já existente, evitando falhas de permissão/RLS no carregamento.
   - Adicionar estados de carregamento e erro para histórico e saldo, para a tela não quebrar quando uma chamada falhar.

2. Tornar o processamento de tradução mais robusto
   - Ajustar a função `translateFile` para validar acesso, saldo e custo com mensagens claras.
   - Corrigir o envio de PDF para IA: em vez de tratar PDF como imagem, usar conteúdo textual/arquivo em formato aceito pelo gateway ou fallback seguro.
   - Garantir que falhas de extração/tradução salvem histórico como `error`, sem cobrar créditos.

3. Garantir cobrança automática de créditos
   - Manter a regra: cobrar somente após tradução concluída com sucesso.
   - Usar a função central `spend_for_feature('file_translation')` para debitar automaticamente do saldo total, seguindo a ordem mensal, grátis e avulso.
   - Após sucesso, atualizar o saldo e histórico imediatamente na interface.

4. Corrigir créditos Pro e Ultra
   - Revisar o webhook de assinatura para mapear corretamente os preços/lookup keys dos planos Pro e Ultra.
   - Garantir concessão automática de créditos mensais no ciclo atual quando a assinatura ficar ativa/trialing.
   - Tornar a concessão idempotente para não duplicar créditos se o webhook for reenviado.
   - Preservar planos, valores e sistema de assinatura existentes.

5. Corrigir inconsistências no banco
   - Criar uma migração para reforçar/corrigir `spend_for_feature`, `has_premium_access` e grants necessários.
   - Ajustar a tabela/histórico de traduções apenas se necessário para estabilidade; sem mudar valores dos pacotes avulsos.

6. Validação
   - Verificar navegação até `/file-translator`.
   - Verificar que usuário com créditos consegue acessar.
   - Verificar que usuário sem saldo recebe CTA para comprar créditos/assinar.
   - Verificar que uma tradução concluída desconta 10 créditos automaticamente e registra no histórico.
   - Verificar que Pro/Ultra recebem o aviso/saldo mensal esperado via webhook.