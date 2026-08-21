# Melhorias no Tradutor do Dashboard — Copiar e Colar

## Objetivo
Adicionar ações de **copiar** a tradução final e **colar** texto na área de origem diretamente na página `/translator` do dashboard, sem quebrar o funcionamento atual.

## Escopo
- Apenas a página `src/routes/_app.translator.tsx`.
- Nenhuma alteração em backend, cobrança de créditos ou rotas.

## Implementação

1. **Copiar tradução**
   - Adicionar botão com ícone `Copy` (lucide-react) ao lado do botão "Ouvir tradução", no painel de destino (`out`).
   - Ao clicar, copiar o conteúdo de `out` para a área de transferência via `navigator.clipboard.writeText`.
   - Exibir toast de sucesso "Tradução copiada!" ou erro "Não foi possível copiar.".
   - Botão desabilitado quando `out` estiver vazio.

2. **Colar texto de origem**
   - Adicionar botão com ícone `ClipboardPaste` (lucide-react) no painel de origem (`src`), ao lado dos botões existentes (câmera, scanner, microfone, ouvir).
   - Ao clicar, ler `navigator.clipboard.readText` e inserir no `Textarea` de origem.
   - Exibir toast de sucesso "Texto colado!" ou erro "Permita acesso à área de transferência.".

3. **UX e acessibilidade**
   - Usar `title` nos botões para indicar a ação.
   - Manter o estilo dos botões `ghost` `size="icon"` já usado nos controles do tradutor.
   - Garantir que os novos botões respeitem os estados de carregamento/empty.

4. **Validação**
   - Rodar `bun run typecheck` (ou equivalente) após a alteração.
   - Verificar visualmente no preview se os botões aparecem e se copiar/colar funcionam.

## Resultado esperado
O usuário consegue colar texto rapidamente no campo de origem e copiar a tradução gerada com um clique, melhorando o fluxo no mobile e desktop.