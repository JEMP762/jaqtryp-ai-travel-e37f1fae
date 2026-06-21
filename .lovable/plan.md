# Live Translator — Gravação por VAD + Sessão pareada entre dispositivos

Duas melhorias no dashboard `/live-translator`, mantendo intacto o `/translator`.

## 1) Tap-to-talk com auto-stop por silêncio (VAD)

**Hoje:** o usuário toca para começar e precisa tocar de novo para encerrar; com fone Bluetooth isso é desconfortável.

**Novo:** toca uma vez → app grava → ao detectar silêncio prolongado, encerra sozinho e dispara a transcrição/tradução já existente (ElevenLabs Scribe via `/api/public/stt`).

**Onde mexer:** `src/routes/_app.live-translator.tsx`, hook `useSpeechRecognition`:
- Criar `AudioContext` + `AnalyserNode` sobre o `MediaStream` capturado.
- Loop com `requestAnimationFrame` medindo RMS.
- Estados internos `speechStarted` / `lastVoiceAt`. Auto-stop se `speechStarted && now - lastVoiceAt > 1200ms`.
- Timeout máximo de 20 s para evitar gravação infinita.
- Cleanup do AudioContext em `onstop`, `onerror` e parada manual.
- Tocar de novo no botão continua cancelando manualmente.

Parâmetros (ajustáveis): `SILENCE_MS=1200`, `MIN_SPEECH_MS=350`, `RMS_THRESHOLD≈0.015`, `MAX_RECORDING_MS=20000`.

## 2) Sessão pareada entre dois dispositivos

**Cenário:** Usuário A (óculos/fone Bluetooth no celular dele) fala português; Usuário B (no celular dele, fone próprio) fala inglês. Cada um vê e ouve no idioma dele.

**Modelo:** uma **sala** identificada por código curto (ex.: `PT-9F4K`). Cada participante entra na sala escolhendo seu idioma. O que A fala é transcrito no celular de A, traduzido para o idioma de B e reproduzido + exibido no celular de B (e vice-versa).

### UX (nova aba "Remoto" em Conversação)
- Botão **Criar sala** → gera código de 6 caracteres, mostra QR + link `/live-translator?room=XYZ123`.
- Botão **Entrar em sala** → input do código.
- Ao entrar: escolher idioma falado + idioma para ouvir (padrão: idioma do dispositivo).
- Tela mostra os 2 participantes, status de conexão e botão **Falar** (com o VAD do item 1).
- Cada mensagem recebida: bolha com texto traduzido + reprodução TTS automática no fone Bluetooth do receptor (usa o caminho de áudio do sistema que já funciona).
- "Sair da sala" libera o slot.

### Backend (Lovable Cloud)
Tabelas novas (migração com `GRANT` + RLS):

```text
translator_rooms
  id uuid pk, code text unique, created_at, created_by uuid null,
  expires_at timestamptz (default now()+24h)

translator_participants
  id uuid pk, room_id fk, user_id uuid null, display_name text,
  spoken_lang text, listen_lang text, joined_at, last_seen_at

translator_messages
  id uuid pk, room_id fk, sender_participant_id fk,
  source_lang text, source_text text,
  target_lang text, target_text text,
  created_at
```

- RLS: leitura/escrita permitidas a `anon` **apenas** para linhas cujo `room_id` corresponde a um `code` válido e não expirado (via função `security definer` `is_room_member(code, participant_id)` armazenando token do participante em `localStorage`). Sem PII além de display name.
- Realtime habilitado em `translator_messages` e `translator_participants`.

### Server functions / rotas
- `createRoom()` — server fn: cria sala, devolve `code`.
- `joinRoom({ code, spokenLang, listenLang, displayName })` — server fn: cria participante, devolve `participantId` + token assinado p/ RLS.
- `postMessage({ roomId, participantId, audioBlob | text, spokenLang })` — server fn que:
  1. Se vier áudio: transcreve com Scribe.
  2. Para cada outro participante na sala, traduz `source_text` → `listen_lang` deles (Lovable AI Gateway, mesma cadeia já usada na tradução por texto).
  3. Insere `translator_messages` com o par `target_lang`/`target_text` do destinatário (1 linha por destinatário) — assim cada cliente filtra pelas suas linhas.
- Cliente assina canal Realtime da sala, recebe novas mensagens onde `target_lang === minhaListenLang` e dispara TTS no caminho de áudio do sistema atual.

### Fora de escopo
- Sem chamadas WebRTC P2P (latência adicional aceitável, evita NAT/STUN).
- Sem mais de 2 participantes nesta fase (esquema já suporta, UI só mostra 2 slots).
- Sem autenticação obrigatória para entrar em sala (usa código + token de participante).

## Validação
- VAD: gravar uma frase curta → para sozinho em ~1 s, tradução aparece. Tocar no botão durante gravação ainda interrompe.
- Pareamento: abrir `/live-translator` em duas janelas/navegadores, criar sala em uma, entrar com o código na outra, escolher PT↔EN; falar em uma janela e confirmar que aparece e toca em inglês na outra (e vice-versa) com áudio indo pelo Bluetooth do dispositivo receptor.

## Ordem de entrega sugerida
1. Migrações + RLS + Realtime + server fns mínimas.
2. UI da aba "Remoto" (criar/entrar/listar participantes).
3. Integração de envio (texto primeiro, áudio depois reaproveitando VAD do item 1).
4. Recebimento + TTS automático.
5. VAD aplicado também aos modos Conversação/Guia já existentes.
