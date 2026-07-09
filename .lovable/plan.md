## Objetivo
Trocar o gatilho atual de tradução por um **botão de microfone grande e óbvio**, estilo walkie-talkie, fácil de usar no celular durante a conversa. Acabar com as alucinações do modo automático.

## Como vai funcionar (para o usuário)

- Um **botão redondo grande de microfone** fixo no rodapé da sala, sempre visível.
- **Segurar para falar**: pressiona → grava enquanto segura → solta → traduz e envia.
  - No celular funciona com o dedo; no computador funciona com o mouse ou barra de espaço.
- Feedback visual claro: botão fica vermelho pulsando enquanto grava, mostra "🎙 Ouvindo..." + um medidor de nível de voz para o usuário ver que está captando.
- Se soltar antes de ~0,4s, cancela (evita toque acidental sem enviar áudio curtinho inútil que gera alucinação).
- Um pequeno seletor discreto acima do botão permite trocar para **"Toque p/ falar, toque p/ parar"** (mãos livres) para quem preferir. O modo automático por voz sai como padrão porque é o que estava alucinando.

## Onde ativar (bem visível)

1. **Botão principal**: fixo no rodapé da sala ao vivo, centralizado, tamanho grande (~96px), acompanhado do texto "Segure para falar".
2. **Indicador no topo**: o 🎙 ON/OFF ao lado do seu nome continua, mas agora reflete "gravando agora" em tempo real.
3. **Primeira vez**: um balão curto aparece apontando pro botão: "Segure aqui e fale. Solte para traduzir." Fecha ao primeiro uso.

## Mudanças técnicas (curtas)

- `src/routes/live-room.$code.tsx`:
  - Remover os botões atuais "🎙 Ligar tradução" / "📨 Enviar agora" e o auto-VAD como padrão.
  - Novo componente `MicPushToTalkButton` fixo no rodapé com handlers `pointerdown`/`pointerup`/`pointercancel` + suporte a `keydown/keyup` na barra de espaço.
  - Estado: `recording`, `level` (medidor), `mode` ("hold" | "toggle" | "auto").
  - Descartar clipes < 400ms; manter o filtro `isLikelyNoiseTranscript` e limites de duração máx (~15s) para não estourar custo.
- Cobrança segue igual: **só o anfitrião paga** (já implementado em `translate-broadcast` e `stt`).
- Sem mudança de backend, RLS, ou tabelas.

## Fora de escopo
- Não mexe em chamada de vídeo/áudio (Daily), TTS, ou lógica de tradução — apenas o gatilho de captura do microfone.
