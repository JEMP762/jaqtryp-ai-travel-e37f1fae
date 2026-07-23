# Conectar projeto ao GitHub via Git Sync

## Objetivo
Sincronizar o código deste projeto (Jaqtryp) com um repositório GitHub, permitindo backup, edição externa e colaboração em dois sentidos.

## O que será feito
- Ativar a integração Git Sync no editor Lovable.
- Criar um novo repositório no GitHub conectado a esta conta.
- Configurar sincronização automática bidirecional entre Lovable e GitHub.

## Passos de implementação

1. **Abrir o menu de integração GitHub**
   - No editor Lovable, clicar no botão **+** (Plus) no canto inferior esquerdo da caixa de chat.
   - Escolher **GitHub** → **Connect project**.

2. **Autorizar o Lovable GitHub App**
   - Será redirecionado ao GitHub para autorizar o app Lovable.
   - Confirmar a conta/organização onde o repositório será criado.

3. **Criar o repositório**
   - No Lovable, selecionar a conta/organização GitHub.
   - Clicar em **Create Repository** para gerar o repositório com o código atual do projeto.

4. **Verificar sincronização**
   - Após a criação, o código é enviado automaticamente.
   - Alterações futuras no Lovable são empurradas para o GitHub automaticamente.
   - Alterações feitas no GitHub (localmente ou por outro dev) são sincronizadas de volta para o Lovable.

## Limitações e cuidados
- O Lovable **não importa repositórios GitHub existentes**. O repositório deve ser criado a partir do Lovable.
- Apenas **uma conta GitHub** pode estar conectada por conta Lovable.
- A sincronização é automática; evite editar os mesmos arquivos simultaneamente nos dois lados para não gerar conflitos.
- Histórico de versões e rollback interno do Lovable continuam disponíveis independentemente do GitHub.
- Caso queira editar localmente, poderá clonar o repositório GitHub após a conexão.

## Após a conexão
- O botão de download do codebase aparece desbloqueado (quando aplicável).
- É possível usar branches experimentais se a opção **GitHub Branch Switching** estiver ativada em Account Settings → Labs.
- O deploy continua sendo gerenciado pelo Lovable; a conexão GitHub é apenas sincronização de código.

## Alternativa não escolhida
- **GitHub Connector**: usado para chamar a API do GitHub dentro do app (automações, dashboards de issues). Não será ativado neste plano.