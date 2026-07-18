## O que encontrei agora

Eu verifiquei publicamente neste momento:

- `jaqtryp.com` → `185.158.133.1`
- `www.jaqtryp.com` → `185.158.133.1`
- `https://jaqtryp.com` abriu com status `200`
- `https://www.jaqtryp.com` redirecionou corretamente para `https://jaqtryp.com/`
- Não apareceu mais resposta da Vercel nos resolvedores principais testados.

## Motivo provável do problema no mobile

Como no celular ainda aparece `404 DEPLOYMENT_NOT_FOUND · gru1`, o mais provável é **cache/propagação DNS antiga** ainda apontando para a Vercel em algum caminho do celular, operadora, roteador ou DNS local.

Isso explica exatamente o comportamento:

1. Você corrigiu o DNS.
2. O app voltou no mobile por um momento.
3. Depois parou de novo.
4. O erro continua sendo da Vercel.

Isso geralmente acontece quando:

- Alguns servidores DNS já atualizaram e outros ainda não.
- O celular/operadora guardou o IP antigo da Vercel em cache.
- O navegador ou o app instalado/PWA ainda está preso no domínio antigo.
- Ainda existe algum registro antigo duplicado no painel DNS, principalmente `AAAA`, `CNAME` ou outro `A` escondido.

## Plano de correção sem mexer no código

### 1. Conferir novamente no DNS do domínio
No painel da Hostinger, confirmar que não existe nenhum registro antigo:

Remover se existir:

- `A @` apontando para `216.198.79.1`
- `A @` apontando para `2.57.91.91`
- qualquer `A @` apontando para `76.76.x.x`
- `CNAME www` apontando para `vercel-dns.com`
- qualquer registro `AAAA` antigo para `@` ou `www`

Deixar apenas:

| Tipo | Nome | Valor |
|---|---|---|
| A | `@` | `185.158.133.1` |
| A | `www` | `185.158.133.1` |
| TXT | `_lovable` | valor de verificação da Lovable |

### 2. Testar no celular sem cache
No celular:

- Abrir em aba anônima.
- Testar `https://jaqtryp.com`.
- Desligar Wi-Fi e testar no 4G/5G.
- Depois religar Wi-Fi e testar de novo.
- Se estiver usando o app instalado na tela inicial, remover e instalar novamente depois que o DNS estabilizar.

### 3. Aguardar propagação completa
Mesmo quando alguns testes já mostram correto, pode levar até 24–72h para sumir totalmente o cache antigo em operadoras móveis.

### 4. Se voltar a falhar depois de 24h
Aí o mais provável é existir **registro duplicado ou zona DNS duplicada** no provedor. Nesse caso, preciso que você me envie um print da tela DNS completa da Hostinger para eu apontar exatamente qual registro remover.

## Conclusão

O app está respondendo certo agora pela Lovable. O erro no mobile ainda é resto de DNS/cache da Vercel, não erro do aplicativo.