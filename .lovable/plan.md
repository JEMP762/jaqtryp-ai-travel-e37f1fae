## Plano de correção

1. **Corrigir o identificador do participante**
   - Unificar o ID usado no realtime com o ID autenticado da sessão anônima.
   - Hoje a sala registra o participante no backend com um ID, mas envia/recebe mensagens com outro ID local; isso explica por que a tradução pode chegar para um lado e não para o anfitrião.

2. **Corrigir envio e recebimento da tradução nos dois sentidos**
   - Garantir que cada fala gere uma mensagem persistida e entregue para todos os participantes.
   - Exibir para quem falou a própria frase/transcrição sem depender de tradução para si mesmo.
   - Para o outro participante, sempre buscar a tradução pelo idioma/ID correto e tocar o áudio traduzido.

3. **Reduzir alucinação no botão/gatilho de tradução**
   - Trocar a gravação por blocos muito sensíveis por um fluxo com validação mínima de fala: duração mínima, energia mínima e texto mínimo antes de traduzir.
   - Remover envios automáticos de silêncio/ruído e impedir reenvio repetido do mesmo texto curto.
   - Manter o comportamento desejado: tocar uma vez para ligar, parar automaticamente quando a pessoa parar de falar.

4. **Adicionar áudio traduzido também na videochamada**
   - A videochamada continuará transmitindo o áudio nativo pelo Daily.
   - A tradução por IA ficará em paralelo: texto no chat + voz traduzida tocando no dispositivo do receptor.
   - Adicionar controle claro para ativar/desativar “voz traduzida” durante áudio ou vídeo, para o usuário escolher ouvir só letras ou letras + áudio.

5. **Trocar TTS instável por TTS do backend com Lovable AI**
   - Substituir o `/api/public/tts` baseado em Google Translate não oficial por geração de voz via Lovable AI no servidor.
   - Isso melhora confiabilidade e permite padronizar cobrança/erros.

6. **Cobrar créditos automaticamente apenas após sucesso**
   - Cobrar a feature de tradução ao vivo depois que a fala for transcrita/traduzida com sucesso e a mensagem for salva/enviada.
   - Incluir metadados: sala, idioma origem, quantidade de destinatários e tipo (`live_audio`/`live_video`).
   - Se não houver saldo, bloquear a tradução com aviso claro antes de gastar IA.

7. **Validação final**
   - Testar uma sala com dois participantes simulados: convidado fala, anfitrião recebe texto + áudio traduzido; anfitrião fala, convidado recebe texto + áudio traduzido.
   - Verificar que silêncio/ruído não cria traduções falsas.
   - Verificar que chamadas de vídeo continuam funcionando e que a tradução por voz roda em paralelo.