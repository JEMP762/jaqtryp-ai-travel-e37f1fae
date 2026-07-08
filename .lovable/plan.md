## Por que só o convidado ouve tradução hoje

Consultei `live_room_messages`: **todas as últimas 20 mensagens da sua sala vieram do mesmo `from_user_id` (o anfitrião)**. O convidado não inseriu nenhuma. Ou seja, o convidado nunca ativa a tradução no lado dele — a chamada de vídeo/áudio (Daily) toca o áudio nativo em paralelo, mas nada é capturado para o pipeline de tradução a menos que o próprio participante ligue o botão do microfone.

O botão hoje é pequeno, fica no rodapé, e a UI não deixa claro que **cada lado precisa ligar o seu próprio** para que a mensagem seja enviada e traduzida para o outro.

## O que vou implementar

### 1. Botões grandes e explícitos para cada lado
- **Botão principal "🎙 Ligar tradução ao vivo"** no topo, do tamanho de um CTA (não mais só o círculo no rodapé). Ao ligar, muda para "🔴 Traduzindo — Desligar".
- **Botão "📨 Enviar agora"** ao lado, para forçar o envio imediato (útil se o VAD não detectar o silêncio).
- Mantém o círculo de microfone no rodapé como atalho, mas o CTA fica em destaque.

### 2. Presença mostra o estado do outro lado
- A presença passa a incluir `liveOn: boolean`.
- No cabeçalho, ao lado de cada participante: 🎙 verde = tradução ligada, 🔇 cinza = desligada.
- Se o outro estiver 🔇, aparece aviso amarelo: **"Peça para <Nome> tocar em 'Ligar tradução ao vivo' no aparelho dele para você ouvir a tradução."**

### 3. Botão "Pedir para ativar" (host → guest)
- No card de participante desligado, um botão "Enviar lembrete" dispara broadcast que faz o outro lado tocar um som + toast: **"O anfitrião pediu que você ligue a tradução ao vivo."**

### 4. Corrigir o "áudio descartado" quando os dois falam
- Removo o `discardNextRecordingRef` que corta a gravação do receptor quando chega uma mensagem: hoje isso faz o convidado perder a fala se falar quase junto com o anfitrião. Passo a apenas pausar a reprodução, não a captura.

### 5. Corrigir o rejoin da chamada de vídeo
- No `CallPanel`, o Daily frame não remonta quando `sharedVideoUrl` chega depois do primeiro render em uma reentrada. Vou garantir remontagem sempre que a URL mudar, resolvendo o bug de "sai e não consegue voltar".

## Arquivos afetados
- `src/routes/live-room.$code.tsx` — CTAs grandes, presença com `liveOn`, indicadores no header, botão "pedir para ativar", corrigir descarte.
- `src/components/live-room/CallPanel.tsx` — remontar Daily quando `sharedUrl` muda.
- Sem mudanças de schema.

Confirma que posso implementar assim.