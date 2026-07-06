## Objetivo

1. Corrigir o bug em `/live-room/:code`: quem cria a sala (host) não recebe nem o texto traduzido nem o áudio das falas do convidado.
2. Adicionar chamada ao vivo dentro da sala, com escolha entre **Vídeo (Daily.co)** e **Só áudio (economia — WebRTC P2P grátis)**.

---

## Parte 1 — Corrigir tradução/áudio para o host

### Diagnóstico
Hoje a sala usa `channel.broadcast` do Supabase Realtime. O convidado envia `broadcast` com `perRecipient[hostId]`, mas o host frequentemente não recebe porque:

- O broadcast do Realtime v2 pode não estar habilitado para usuários anônimos na sala, e como `broadcast: { self: false }` o convidado nunca vê a própria mensagem chegando (não há confirmação de que o canal funciona).
- Se o presence sync do convidado ainda não incluiu o host quando ele fala, `others` fica vazio e a rota nem é chamada.
- O `audioRef` do host precisa estar destravado antes do primeiro áudio chegar.

### Correções (arquivo `src/routes/live-room.$code.tsx` + backend)

1. **Persistir mensagens em tabela `live_room_messages`** e assinar via `postgres_changes` (mais confiável que broadcast puro):
   - Nova migração: tabela `public.live_room_messages` com `room_code text`, `from_user_id text`, `from_name text`, `from_lang text`, `original_text text`, `per_recipient jsonb`, `created_at timestamptz`. RLS aberto para `SELECT/INSERT` em `anon` e `authenticated` filtrado por `room_code` (salas são efêmeras, código de 6 chars); `GRANT` para ambos os roles; `ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_messages`. TTL: cron/trigger apagar linhas > 24h.
   - `/api/public/translate-broadcast` insere a linha após traduzir e devolve o `id`; o front deixa de fazer `channel.send` e passa a assinar `postgres_changes` (INSERT filtrado por `room_code=eq.<code>`).
   - Ao receber INSERT, cada participante lê `per_recipient[myId]` e renderiza o texto + toca o áudio (base64 MP3).

2. **Garantir que o host tenha entrada em `perRecipient`**: no lado do emissor, sempre incluir também o próprio `userId+lang` como target adicional (para o próprio locutor receber a confirmação e o áudio, se quiser ouvir), mas por padrão o front do próprio emissor pula a reprodução (respeitando a escolha: só ouvir a resposta do outro).

3. **Destravar áudio do host de forma agressiva**: chamar `unlockAudio()` também ao primeiro toque em qualquer botão da sala (já é chamado no "Entrar"; adicionar retry ao receber INSERT — se `audio.play()` falhar, mostrar botão "Tocar áudio" flutuante).

4. **Presence: só permitir gravar quando `others.length >= 1`** — desabilitar o botão de microfone com mensagem clara "Aguardando convidado" para evitar mensagens perdidas.

5. **Diagnóstico visível**: mostrar um pequeno indicador de status do canal ("Conectado / Reconectando") baseado no callback `channel.subscribe`.

---

## Parte 2 — Chamadas ao vivo (vídeo + áudio)

Adicionar um seletor no topo da sala:

```
[ Sem chamada ]  [ 🎙 Só áudio (grátis) ]  [ 📹 Vídeo HD (Daily) ]
```

### Modo "Só áudio" (economia — WebRTC P2P, sem custo)
- WebRTC nativo, sinalização via canal Realtime já existente (`live-room:<code>-signal`).
- Troca de SDP offer/answer e ICE candidates via `channel.send` de broadcast.
- Cada peer adiciona seu `MediaStream` de microfone e conecta `RTCPeerConnection`.
- UI: avatares dos participantes com indicador de fala (analyser RMS), botão mute/unmute, botão encerrar.
- Limite prático: 2–4 pessoas (mesh). Acima disso avisar para usar Daily.

### Modo "Vídeo HD" (Daily.co)
- Requer secret `DAILY_API_KEY` (o usuário cria conta grátis em daily.co, pega a key em Developers → API keys; pediremos via `add_secret` quando ele escolher esse modo pela primeira vez).
- Novo `createServerFn` `createDailyRoom({ code })`:
  - Chama `POST https://api.daily.co/v1/rooms` com `{ name: <code>, properties: { exp: now+2h, enable_prejoin_ui: false, enable_screenshare: true, max_participants: 8 } }`.
  - Retorna a URL `https://<subdomain>.daily.co/<code>`.
  - Cacheia em memória por `code` para não recriar.
- Instalar `@daily-co/daily-js` (`bun add @daily-co/daily-js`).
- Componente `<DailyCallFrame roomUrl={...} userName={myName} />` renderizado dentro da sala em um card sticky (mobile: aba dedicada). Ele reutiliza `mic/cam` — a tradução falada continua tocando pelos alto-falantes do dispositivo em paralelo (o Daily não bloqueia o `<audio>` de tradução).
- Botão "Sair da chamada" desconecta do Daily mas mantém a sala de tradução.

### UX comum
- A escolha do modo é do host, propagada aos convidados via um novo campo `presence.callMode`.
- Quando o host muda o modo, convidados recebem toast "Anfitrião iniciou vídeo/áudio — entrar?".

---

## Detalhes técnicos

Arquivos criados:
- `supabase/migrations/<ts>_live_room_messages.sql` — tabela + RLS + GRANTs + publication.
- `src/lib/daily.functions.ts` — `createDailyRoom` server fn (lê `process.env.DAILY_API_KEY` dentro do handler).
- `src/components/live-room/CallPanel.tsx` — orquestra P2P audio ou Daily iframe.
- `src/components/live-room/AudioCallP2P.tsx` — WebRTC mesh via Realtime signaling.

Arquivos alterados:
- `src/routes/live-room.$code.tsx` — remover `channel.broadcast` como transporte de mensagens (mantém só para signaling WebRTC), assinar `postgres_changes`, adicionar seletor de modo de chamada, integrar `<CallPanel>`.
- `src/routes/api.public.translate-broadcast.ts` — após traduzir, `INSERT` em `live_room_messages` via `supabaseAdmin` e responder `{ id }`.

Secrets:
- `DAILY_API_KEY` — solicitado via `add_secret` na primeira vez que o host escolher "Vídeo HD" (não pediremos agora).

Créditos:
- Chamada de vídeo Daily: cobrar 1 crédito por minuto por participante (padrão semelhante ao Bluetooth translator). Modo só-áudio P2P: grátis.
- Adicionar `feature_key`s `live_call_video_min` e `live_call_audio_min` em `credit_costs` (só o de vídeo cobra).

Fora do escopo:
- Gravação da chamada, transcrição pós-chamada, salas com mais de 8 pessoas, chat de texto separado dentro da chamada.
