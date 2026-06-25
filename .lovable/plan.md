## Plano — Corrigir erro de processamento do Tradutor de Arquivos IA

### Causa raiz
Inspecionei `src/lib/file-translator.functions.ts` e identifiquei três problemas que fazem a tradução falhar logo após o upload:

1. **PDF enviado com formato multimodal incorreto.** O código manda PDFs como `image_url` com data URL `application/pdf`. O AI Gateway/Google rejeita — PDFs devem ir como `{ type: "file", file: { filename, file_data } }`.
2. **Erros do Gateway são engolidos.** Qualquer falha vira `"Falha ao consultar IA"` sem status nem corpo, impossibilitando o diagnóstico.
3. **Risco de timeout do Worker.** Tradução em chunks é totalmente sequencial; arquivos médios estouram o tempo do Worker e o usuário vê "erro ao processar".

### Mudanças (apenas em `src/lib/file-translator.functions.ts`)

1. **`callAI`** — para PDFs, usar bloco `{ type: "file", file: { filename, file_data: "data:application/pdf;base64,..." } }`. Para erros, ler `resp.text()` e incluir status + trecho no `Error.message`, com `console.error` server-side.
2. **Pipeline de tradução** — reduzir `CHUNK_CHARS` para ~6000 e processar até 3 chunks em paralelo (`Promise.all` com janela de concorrência). Encurta a duração total e diminui chance de timeout.
3. **Guardas de tamanho** — recusar com mensagem clara: texto extraído > 120k chars ou PDF sem texto extraível > 4MB.
4. **Logs** — `console.error("[translateFile] failure", { recId, kind, size, err })` no `catch` para inspeção via server-function-logs.

### O que NÃO muda
Dashboard, navegação, cobrança de créditos, RLS, bucket, planos, webhooks.

### Validação
Build/typecheck, abrir `/file-translator` no Playwright, subir um TXT pequeno (deve concluir e debitar 10 créditos) e verificar logs caso ainda falhe.