## Plano de correção

1. **Corrigir o identificador do participante**
   - Unificar o ID usado no realtime com o ID autenticado da sessão anônima.
   - Hoje a sala registra o participante no backend com um ID, mas envia/recebe mensagens com outro ID local; isso explica por que a tradução pode chegar para um lado e não para o anfitrião.

2. **Corrigir envio e recebimento da tradução nos dois sentidos**
   - Garantir que cada fala gere uma mensagem persistida e entregue para todos os participantes.
   - Exibir para quem falou a própria frase/transcrição sem depender de tradução para si mesmo.
   - Para o outro participante, sempre buscar a tradução pelo idioma/ID correto e tocar o áudio traduzido.

3. **Novo gatilho de tradução — mais confiável e sem alucinação**

   Substituir o gatilho atual (VAD sensível + botão “Enviar agora”) por **três modos claros** que o usuário escolhe no topo do microfone:

   - **Modo A — Segurar para falar (push-to-talk, padrão recomendado)**
     - Segurar o botão do microfone enquanto fala.
     - Solta o botão → envia para tradução.
     - Zero alucinação (só grava enquanto o dedo está pressionado) e funciona bem em ambiente barulhento.
     - Suporte a tecla de espaço no desktop para segurar/soltar.

   - **Modo B — Toque para falar / toque para parar (hands‑free simples)**
     - 1º toque começa a gravar, 2º toque envia.
     - Cronômetro visível na tela mostrando quantos segundos estão gravando.
     - Corte automático de segurança em 20s.

   - **Modo C — Automático (contínuo, com detecção de voz melhorada)**
     - Escuta contínua com VAD reajustado: exige fala real (energia mínima + duração mínima) e envia após uma pausa curta.
     - Filtros anti-ruído: descarta transcrições muito curtas, repetidas ou de silêncio.
     - Botão grande de “Pausar escuta” sempre visível.

   Padrão inicial = **Modo A (segurar para falar)** porque elimina o problema de alucinação relatado. O usuário pode alternar pelo seletor no topo do controle de microfone; a preferência fica salva.

   Além disso:
   - Feedback visual claro (barra de nível do microfone) para mostrar que está captando fala.
   - Bloquear reenvio do mesmo texto curto em intervalo curto.
   - Remover o botão “Enviar agora” do fluxo automático (fonte de confusão).

4. **Adicionar áudio traduzido também na videochamada**
   - A videochamada continuará transmitindo o áudio nativo pelo Daily.
   - A tradução por IA ficará em paralelo: texto no chat + voz traduzida tocando no dispositivo do receptor.
   - Adicionar controle claro para ativar/desativar “voz traduzida” durante áudio ou vídeo, para o usuário escolher ouvir só letras ou letras + áudio.

5. **Trocar TTS instável por TTS do backend com Lovable AI**
   - Substituir o `/api/public/tts` baseado em Google Translate não oficial por geração de voz via Lovable AI no servidor.
   - Isso melhora confiabilidade e permite padronizar cobrança/erros.

6. **Cobrança de créditos apenas no anfitrião da sala**
   - Quem cria/convida a sala é o **anfitrião**, e é a única pessoa cobrada por qualquer tradução ou TTS realizado dentro daquela sala — inclusive quando o convidado é quem fala.
   - Convidados entram como usuários anônimos e **não gastam créditos próprios**, mesmo que a fala deles seja traduzida ou o áudio traduzido seja tocado no aparelho deles.
   - Como implementar:
     - Registrar no banco o `host_user_id` da sala no primeiro `join` (quem chegar primeiro e não for anônimo, ou o criador do link).
     - Toda chamada a `/api/public/translate-broadcast`, `/api/public/stt` e `/api/public/tts` dentro de uma sala vai identificar o `host_user_id` e debitar créditos **apenas dessa conta**, independentemente de qual participante disparou a ação.
     - Pré-checar saldo do anfitrião antes de rodar STT/tradução; se faltar saldo, avisar de forma clara em **ambos os lados** (“O anfitrião está sem créditos — tradução pausada”).
     - Se não houver sala (uso do tradutor normal fora da sala ao vivo), a cobrança continua para o próprio usuário logado, como hoje.
   - Metadados salvos no ledger: sala, quem falou (convidado ou anfitrião), idioma de origem, quantidade de destinatários e tipo (`live_audio`/`live_video`), para transparência no dashboard.
   - Debitar somente após sucesso (transcrição + tradução + persistência da mensagem).

7. **Validação final**
   - Testar uma sala com dois participantes simulados: convidado fala, anfitrião recebe texto + áudio traduzido; anfitrião fala, convidado recebe texto + áudio traduzido.
   - Confirmar no dashboard do anfitrião que **todas** as traduções da sala aparecem debitadas na conta dele, e que a conta do convidado (quando existir) não é cobrada.
   - Testar os três modos do gatilho (segurar, toque/toque, automático) em desktop e mobile.
   - Verificar que silêncio/ruído não cria traduções falsas.
   - Verificar que chamadas de vídeo continuam funcionando e que a tradução por voz roda em paralelo.
   - Testar cenário “anfitrião sem créditos”: tradução pausa e ambos os lados recebem aviso.