# Menos burocracia no acesso + Google mais confiável

Objetivo: o usuário entra uma vez e continua logado. E o botão "Continuar com Google" leva direto ao painel, sem cair na página de vendas.

## O que está causando a fricção hoje

- O login com Google volta para a página inicial (`redirect_uri` = raiz do site). A pessoa clica, o Google autentica, mas ela cai na landing page com os botões "Entrar / Criar conta" — parece que não funcionou.
- A página inicial não reconhece quem já está logado: mesmo com sessão ativa ela continua mostrando "Entrar".
- O app instalado (PWA) abre sempre em `/`, então a impressão é sempre a de estar deslogado.
- Ao abrir uma tela interna, se a sessão ainda está sendo restaurada ou o token acabou de expirar, o app manda para `/login` em vez de tentar renovar a sessão primeiro.

## O que será feito

1. **Retorno correto do Google**
   - Nova página pública `/auth/callback`: espera a sessão ficar pronta e então envia para o painel (ou para a página que a pessoa queria antes).
   - Login e Cadastro passam a usar esse endereço de retorno, com estado de carregando no botão e mensagens de erro em português.
   - Conferir/ativar o provedor Google na autenticação do projeto, para não dar "Unsupported provider".

2. **Continuar logado**
   - Antes de mandar alguém para `/login`, o app tenta renovar a sessão uma vez; só redireciona se realmente não houver sessão.
   - A página inicial e as telas de login/cadastro redirecionam automaticamente quem já tem sessão para o painel.
   - O app instalado passa a abrir direto no painel (`start_url` = `/dashboard`), caindo na landing só se não houver sessão.

3. **Menos pedidos de senha**
   - Manter o "link mágico" (entrar por e-mail sem senha) visível no login, já existente.
   - Nenhuma mudança em regras de segurança do banco, cobrança de créditos ou fluxo de pagamento.

## Detalhes técnicos

- Novo arquivo `src/routes/auth.callback.tsx` (rota pública, sem gate) que aguarda `onAuthStateChange`/`getSession` e navega para `/dashboard`.
- `src/routes/login.tsx` e `src/routes/signup.tsx`: `redirect_uri: ${window.location.origin}/auth/callback`, botão Google com `loading`, tratamento de erro traduzido.
- `src/routes/_app.tsx`: antes de `nav({ to: "/login" })`, tentar `supabase.auth.refreshSession()` uma vez; só redirecionar se falhar.
- `src/hooks/useAuth.tsx`: expor `initializing` para diferenciar "carregando" de "sem sessão" e evitar redirecionamento prematuro.
- `src/routes/index.tsx`: se `user` existir, `navigate({ to: "/dashboard", replace: true })`.
- `public/manifest.webmanifest`: `start_url` e `id` para `/dashboard`.
- Configuração de autenticação: habilitar/validar o provedor Google (`configure_social_auth`).

## Fora de escopo

Mystifly, PIX/Mercado Pago, créditos, salas ao vivo e políticas RLS permanecem inalterados.
