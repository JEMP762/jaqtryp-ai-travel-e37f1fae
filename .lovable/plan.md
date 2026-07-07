## Diagnóstico

Encontrei 3 problemas independentes na sala ao vivo (`/live-room/$code`):

### 1. Tradução nunca aparece para ninguém (mic-only e vídeo)
A tabela `live_room_messages` **nunca foi criada** — a migração `20260706162553_...sql` só insere `credit_costs`, esqueceu do `CREATE TABLE`. Por isso:
- STT captura o áudio, transcreve corretamente
- `/api/public/translate-broadcast` chama tradução + TTS com sucesso
- Tenta `INSERT` na tabela inexistente → falha silenciosa (`console.error`, mas retorna 200)
- Nenhuma mensagem chega via realtime → nada aparece no chat, nem áudio traduzido toca

### 2. Chamada de vídeo dá erro para o convidado
O convidado também chama `createDailyRoom`. Se o anfitrião criou primeiro, a segunda chamada volta 409 e faz GET — geralmente ok, mas se a chave `DAILY_API_KEY` só está no ambiente de produção e o convidado abrir do preview, ou se o iframe do Daily não recebe permissão de câmera/mic, o erro atual é opaco. Vou:
- Melhorar a mensagem de erro exibida (mostrar `reason`/`error` do serverFn e erros do próprio Daily)
- Deixar só o anfitrião criar a sala e o convidado usar o mesmo cache/URL via broadcast realtime (fallback: ainda tenta criar sozinho após 3s se não receber URL)

### 3. Gravação não para sozinha quando a pessoa termina de falar
Hoje é toggle manual. Vou adicionar VAD (voice activity detection) com Web Audio API: quando o botão do microfone é pressionado, começa a gravar; monitora o volume RMS em tempo real; após ~1.2 s de silêncio abaixo do limiar, para automaticamente e envia. Botão "Parar" continua disponível.

---

## Plano de execução

### A. Nova migração — criar `live_room_messages` + realtime
```sql
CREATE TABLE public.live_room_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code text NOT NULL,
  from_user_id text NOT NULL,
  from_name text NOT NULL,
  from_lang text NOT NULL,
  original_text text NOT NULL,
  per_recipient jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.live_room_messages (room_code, created_at);

GRANT SELECT, INSERT ON public.live_room_messages TO anon, authenticated;
GRANT ALL ON public.live_room_messages TO service_role;

ALTER TABLE public.live_room_messages ENABLE ROW LEVEL SECURITY;
-- Sala é pública por código (efêmera, sem PII persistente)
CREATE POLICY "public read"   ON public.live_room_messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert" ON public.live_room_messages FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_room_messages;
ALTER TABLE public.live_room_messages REPLICA IDENTITY FULL;
```

### B. Auto-stop por silêncio em `src/routes/live-room.$code.tsx`
- Ao iniciar `MediaRecorder`, criar `AudioContext` + `AnalyserNode` na mesma stream
- Loop `requestAnimationFrame` mede RMS
- Estado: aguarda ≥400 ms de fala (RMS > limiar ~0.02) antes de armar o auto-stop
- Depois de detectar fala, se RMS < limiar por 1200 ms contínuos → `stopRecording()`
- Timeout máximo de 30 s como segurança
- Limpar RAF + fechar AudioContext em `onstop` e no unmount

### C. `CallPanel.tsx` — vídeo mais robusto
- Exibir `error` retornado do `createDailyRoom` de forma clara (código + mensagem)
- Adicionar handler `call.on("error", ...)` do Daily e mostrar no UI
- Convidado (quem não abriu a sala primeiro) recebe URL via broadcast `daily-url` na channel; se não chegar em 3 s, tenta criar sozinho como fallback
- Anfitrião, ao entrar no modo vídeo, emite `{ event: "daily-url", payload: { url } }` assim que `createDailyRoom` resolve

### Fora de escopo
- Gravação da chamada, transcrição pós-call, mudar de provedor.
- Não vou mexer no fluxo de crédito nem em outras rotas.
