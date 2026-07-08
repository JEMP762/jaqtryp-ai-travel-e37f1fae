Plano para corrigir a sala ao vivo:

1. Tornar a tradução realmente contínua
- Transformar o botão de microfone em um modo “tradução ao vivo ligada/desligada”.
- Enquanto estiver ligado, o app grava pequenos trechos automaticamente, para quando a pessoa silencia, envia para transcrição/tradução/voz e reinicia a escuta sozinho.
- Isso funcionará com “sem chamada”, “só áudio” e “vídeo HD”.

2. Separar chamada nativa de tradução
- A chamada de vídeo/áudio continuará sendo o canal nativo da conversa.
- A tradução em tempo real será enviada pelo microfone de cada participante para o outro ouvir no idioma dele.
- Evitar que o próprio áudio traduzido seja capturado de volta pelo microfone, pausando/reiniciando a escuta nos momentos certos.

3. Corrigir entrega da tradução para quem está na sala
- Manter um identificador estável por navegador/dispositivo, para o convidado e anfitrião não mudarem de ID ao sair/voltar.
- Ajustar o envio para sempre mirar nos participantes atuais e mostrar erro claro se a tradução não for entregue.
- Melhorar a exibição local para confirmar que o texto foi traduzido e enviado.

4. Corrigir retorno/reentrada na chamada de vídeo
- Criar estado persistente da sala no backend com modo atual da chamada, anfitrião e URL da sala de vídeo.
- Quando alguém entra ou volta pelo link, o app recupera esse estado e reconecta à chamada existente, em vez de depender apenas de um evento temporário.
- Adicionar ação de reconectar/tentar novamente quando o iframe de vídeo falhar ou a pessoa sair e voltar.

5. Validação
- Testar o fluxo com dois participantes simulados: convidado fala, anfitrião recebe texto e áudio traduzido; anfitrião fala, convidado recebe tradução.
- Testar sair da sala e entrar novamente pelo link, confirmando que a chamada de vídeo e a tradução continuam disponíveis.

Detalhes técnicos:
- Adicionar uma tabela de estado da sala com Realtime e regras públicas limitadas ao código da sala.
- Alterar `live-room.$code.tsx` para usar escuta contínua com VAD e recomeço automático.
- Ajustar `CallPanel.tsx` para reconexão robusta e uso do URL persistido.
- Manter `/api/public/stt` e `/api/public/translate-broadcast`, mas melhorar os retornos/erros para o frontend.