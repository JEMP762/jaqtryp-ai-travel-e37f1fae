## Roteiro com logo da empresa (25 créditos) + 10.000 créditos para messiaspassosj@gmail.com

### 0. Créditos manuais
- Creditar **10.000 créditos** (bucket avulso/topup, que não expira) na conta `messiaspassosj@gmail.com`, com registro no histórico ("bônus concedido"). Se o e-mail ainda não tiver conta criada, aviso e o crédito é aplicado assim que ele se cadastrar.

### 1. Armazenamento da logo
- Novo bucket privado `brand-logos` (arquivo em `userId/logo.png`, máx. ~2 MB, PNG/JPG/WEBP).
- Políticas em `storage.objects`: cada usuário só lê/escreve/apaga a própria pasta.
- Nova tabela `user_branding` (`user_id`, `company_name`, `logo_path`) com acesso restrito ao dono e os GRANTs necessários.
- A logo é exibida por URL assinada — nada fica público.

### 2. Cobrança
- Novo item em `credit_costs`: `trip_create_branded` = **25 créditos** ("Roteiro com logo").
- `trip_create_full` permanece **15 créditos**.
- Incluir `trip_create_branded` na allowlist de `src/routes/api.ai.tsx` para que a checagem de saldo e o débito usem o custo correto (fluxo de cobrança existente, sem mudanças na lógica).

### 3. Interface do Planejador (`/planner`)
- Novo bloco "Marca da empresa" no painel lateral:
  - upload da logo com preview e botão remover;
  - campo opcional "Nome da empresa";
  - switch **"Incluir logo no roteiro (25 créditos)"** — desligado por padrão e desabilitado enquanto não houver logo.
- Botão de gerar mostra o custo atual: "Gerar roteiro — 15 créditos" ou "— 25 créditos".

### 4. Exibição da logo
- **Na tela:** cabeçalho do roteiro mostra logo + nome da empresa acima do título quando gerado em modo com marca.
- **No PDF/impressão:** cabeçalho com a imagem (altura ~56px) acima do título e rodapé discreto com o nome da empresa. Roteiros sem marca imprimem exatamente como hoje.

### 5. Garantias de não-regressão
- Sem logo enviada, tudo funciona igual a hoje (mesmo custo, mesmo layout).
- Falha ao carregar a logo não bloqueia a geração: cai para o modo sem marca e cobra 15.
- Créditos insuficientes continuam usando o tratamento de erro e o modal de upgrade já existentes.

### Detalhes técnicos
- Arquivos: `src/routes/_app.planner.tsx`, `src/routes/api.ai.tsx`, novo `src/lib/branding.ts`; migração SQL (tabela, políticas de storage, linha em `credit_costs`) e uma operação de dados para os 10.000 créditos.
- Nenhuma alteração em autenticação, checkout ou nas demais funcionalidades.
