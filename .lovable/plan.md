# Parar de cair no login + validar o PIX sem precisar entrar

Dois problemas, um plano.

## 1. "Entro normal e do nada volta pro login"

O que está causando isso hoje (verificado no código):

- Toda vez que o app acha que não há usuário (inclusive durante o carregamento inicial no celular ou logo após o app instalado abrir), ele chama uma **renovação forçada de sessão**. Quando duas telas fazem isso ao mesmo tempo (painel + assistente JAX + PWA em segundo plano), o servidor invalida o token e a pessoa é expulsa — é exatamente o "do nada volta pro login".
- A área logada é renderizada primeiro no servidor, onde não existe sessão; na volta para o navegador há uma janela em que o app acha que ninguém está logado e já manda para `/login`.
- Qualquer falha temporária de rede na renovação do token é tratada como "usuário deslogado", em vez de "tente de novo".

O que será feito:

1. A área logada passa a ser renderizada apenas no navegador (sem etapa no servidor), acabando com a janela de "sem sessão".
2. Remover a renovação forçada de sessão. A biblioteca já renova sozinha; o app só reage ao resultado.
3. Só mandar para `/login` quando houver um sinal real de saída (sessão ausente e confirmada, ou logout). Falha de rede mostra "reconectando", não expulsa.
4. Um único ponto de controle de sessão no app (hoje há checagens espalhadas), com estado "carregando" separado de "deslogado".
5. Guardar a página em que a pessoa estava e voltar para ela depois de entrar.

Resultado esperado: entrar uma vez e continuar dentro, inclusive no app instalado e depois de dias sem abrir.

## 2. PIX: como testar sem conseguir entrar

A chave do Mercado Pago já está cadastrada no projeto. Os testes não dependem de você conseguir logar:

1. Teste direto no servidor (feito por mim): criar uma cobrança PIX de teste chamando o Mercado Pago com a chave configurada, e confirmar que volta QR Code e código copia-e-cola. Se a chave for de teste/sandbox ou estiver sem PIX habilitado, o erro aparece aqui e eu informo exatamente o que falta.
2. Teste do webhook: simular a notificação de pagamento aprovado e conferir que os créditos entram uma vez só (sem duplicar em reenvio).
3. Depois do item 1 acima resolvido, teste real na tela: abrir Créditos → Comprar → PIX e ver o QR Code aparecer.
4. Registrar o endereço de notificação do Mercado Pago (`/api/public/mercadopago/webhook`) no painel do Mercado Pago — sem isso o pagamento aprovado não libera crédito automaticamente, só quando a tela consulta o status.

Se algum erro do Mercado Pago aparecer (chave de produção pendente, conta sem PIX/chave cadastrada), eu digo qual é e o que você precisa fazer do lado deles — não dá para contornar isso pelo código.

## Detalhes técnicos

- `src/routes/_app.tsx`: `ssr: false` na rota; remover o `supabase.auth.refreshSession()` do efeito de guarda; redirecionar só quando `initializing === false && !session`.
- `src/hooks/useAuth.tsx`: expor `initializing`; ignorar eventos `TOKEN_REFRESHED` sem sessão; não zerar o usuário em erro transitório.
- `src/routes/login.tsx` / `signup.tsx` / `index.tsx`: continuar redirecionando quem já tem sessão, agora usando `initializing`.
- PIX: executar `createPixPayment` pelo servidor com um usuário de teste e chamar `syncPixPaymentStatus`; conferir logs de `/api/public/mercadopago/webhook`.

## Fora de escopo

Stripe, créditos existentes, Mystifly, salas ao vivo e regras de segurança do banco não são alterados.
