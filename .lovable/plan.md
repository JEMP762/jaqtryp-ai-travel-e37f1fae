# Ativar Vídeo HD (Daily.co)

A infraestrutura de vídeo HD já foi implementada no chat ao vivo (componente `CallPanel`, server function `createDailyRoom`, SDK `@daily-co/daily-js` instalado). Falta apenas **conectar a conta Daily.co** para ativar.

## O que você precisa fazer

1. Criar conta gratuita em [daily.co](https://dashboard.daily.co/signup) (plano free inclui 10.000 minutos/mês).
2. Ir em **Developers → API Keys** no dashboard.
3. Copiar a chave (formato longo alfanumérico).

Depois que você confirmar, vou pedir a chave via formulário seguro (armazenada como secret `DAILY_API_KEY`, nunca exposta no frontend).

## O que será feito após receber a chave

1. **Salvar `DAILY_API_KEY`** como secret do backend.
2. **Verificar `src/lib/daily.functions.ts`** — confirmar que lê `process.env.DAILY_API_KEY` dentro do `.handler()` e cria salas com:
   - `enable_screenshare: true`
   - `max_participants: 8`
   - `exp` (expiração automática após ~2h para não gastar créditos)
3. **Testar fluxo completo** na sala ao vivo:
   - Host escolhe "Vídeo HD" no seletor de modo
   - Guest recebe convite e entra na sala Daily embedada
   - Confirmar que áudio/vídeo funcionam em paralelo com a tradução ao vivo
4. **Ajustar UI** se necessário: mostrar aviso de custo/limite de participantes e botão claro de encerrar chamada.

## Fora do escopo

- Gravação de chamadas
- Transcrição pós-chamada
- Salas com mais de 8 participantes
- Billing/cobrança por uso dentro do app

## Confirma?

Responda para eu prosseguir e solicitar a `DAILY_API_KEY`.
