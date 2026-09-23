# Motor viral integrado ao referral existente

## Diagnóstico confirmado

- O referral global já vive em `profiles.referral_code` e `profiles.referred_by`; `apply_referral_code` já impede autoindicação e não substitui um vínculo existente.
- A página atual de indicação já mostra código, link, quantidade de indicados, créditos e histórico.
- Compras e assinaturas já recompensam o indicador por `reward_referrer`; pagamentos usam referências únicas e verificações idempotentes.
- Créditos permanecem centralizados em `add_credits`, `credit_ledger` e `reward_referrer`.
- Já existem snapshots públicos opt-in para roteiro e tradução, mas o link ainda precisa receber automaticamente o código do proprietário e virar parte de uma atribuição rastreável.
- O trabalho de ativação em andamento já criou contexto persistente, resultados, compartilhamentos e eventos; ele será ampliado, sem criar um segundo referral.

## O que será construído

1. **Atribuição first-touch**
   - Capturar `ref` apenas quando ainda não existir um referral pendente válido.
   - Persistir origem, função e `share_id` durante navegação, cadastro por e-mail e Google.
   - Ao cadastrar, chamar o RPC existente e registrar a transição `registered`, sem substituir referral já atribuído.

2. **Compartilhamento contextual seguro**
   - Gerar o snapshot público somente quando o usuário tocar em compartilhar.
   - Validar ownership no servidor e anexar automaticamente `?ref=<código atual>`.
   - Manter `/roteiro/$slug` e `/traducao/$slug`; adicionar `/orcamento/$slug`.
   - Arquivos/documentos nunca serão publicados automaticamente; o compartilhamento será um resumo explícito, sem arquivo, URL privada ou texto sensível.
   - Preparar tipos extensíveis para orçamento, busca de voo e novos resultados.

3. **Ciclo e antifraude**
   - Criar uma tabela de jornadas de referral com estados `clicked`, `registered`, `activated`, `rewarded` e `rejected`.
   - Vincular indicador, indicado, função e compartilhamento; adicionar chaves únicas por visitante, indicado e evento.
   - Criar RPCs transacionais para captura/atribuição e recompensa; validar autoindicação e ownership no banco.
   - Usar chaves idempotentes no ledger para impedir créditos repetidos por recarga, refresh ou chamadas concorrentes.

4. **Recompensas configuráveis**
   - Criar configuração administrativa única para cadastro válido, primeira ativação e pagamento.
   - Valores iniciais: 20 créditos no cadastro válido e 50 no primeiro uso relevante, ambos editáveis e ativáveis/desativáveis.
   - Reutilizar as recompensas de pacote/assinatura já existentes; apenas conectar a origem e registrar os eventos correspondentes.

5. **Eventos e métricas**
   - Registrar `share_created`, `share_clicked`, `referral_captured`, `referral_signup`, `referral_activation` e `referral_rewarded`.
   - Guardar somente IDs técnicos, função, origem, variante, status, recompensa e data.
   - Ampliar “Motor de Crescimento” com conversão, recompensas, assinaturas e ranking por função.

6. **Experiência do usuário**
   - Compartilhamento opcional após roteiro, imagem, arquivo e orçamento, usando WhatsApp, Web Share e copiar link.
   - Texto natural focado no conteúdo.
   - Ampliar “Indique e ganhe” com confirmados, ativações, créditos e progresso conforme configuração.
   - Manter o layout atual e não interromper a ação principal.

## Validação

- Testes do fluxo A–N: compartilhamento, captura, navegação, cadastro, ativação, recompensa, idempotência, autoindicação, mobile, privacidade e usuário sem referral.
- Testes de regressão do link geral, login Google/e-mail, créditos, planos, pagamentos e páginas atuais.
- Inspeção das páginas públicas para garantir ausência de dados pessoais, arquivos e URLs privadas.

## Detalhes técnicos

- Alterações de banco serão aditivas, com `GRANT`, RLS e RPCs de privilégios mínimos.
- A resolução do referral ocorrerá no servidor; o cliente apenas transporta uma referência pendente.
- `share_id` será imprevisível e o snapshot público conterá uma lista segura de campos por tipo.
- O painel administrativo continuará protegido por papel `admin` validado no servidor.
