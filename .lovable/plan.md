# Tradutor de Arquivos IA

Novo módulo independente para traduzir documentos (PDF, DOCX, XLSX, CSV, PPTX, TXT) preservando estrutura, com débito automático de créditos via o sistema existente (`spend_for_feature` → consome de monthly → free → topup).

## 1. Backend — Banco

**Migration** com:
- Inserir em `credit_costs`: `('file_translation', 10, 'Tradução de arquivo', 'Tradução de documento com IA', true)`.
- Nova tabela `file_translations` (histórico):
  - `user_id`, `file_name`, `file_type`, `source_lang`, `target_lang`, `credits_spent` int, `status` (`processing|success|error`), `error_message`, `storage_path_original`, `storage_path_translated`
  - RLS: usuário vê/insere/atualiza apenas as próprias linhas. GRANTs para `authenticated` e `service_role`.
- Novo bucket de Storage `file-translations` (privado) — criado via tool de storage.

## 2. Backend — Server functions

Arquivo `src/lib/file-translator.functions.ts` (createServerFn + `requireSupabaseAuth`):

- `translateFile({ file_base64, file_name, file_type, target_lang })`:
  1. `has_premium_access` (já permite assinantes + créditos avulsos).
  2. Verifica saldo (`user_credits`): se < 10, retorna `{ ok:false, reason:"insufficient" }`.
  3. Cria registro `file_translations` com status `processing`.
  4. Extrai texto conforme tipo (PDF via `pdfjs-dist`/serverless equivalente leve, DOCX via `mammoth`, XLSX/CSV via `xlsx`, PPTX via parser simples, TXT direto). Estrutura preservada como markdown/JSON intermediário por seção.
  5. Detecta idioma original (heurística + 1 chamada IA).
  6. Traduz por blocos chamando Lovable AI Gateway (`google/gemini-3-flash-preview`) com system prompt: preservar títulos, tabelas, listas, formatação markdown.
  7. Regenera arquivo no formato original (DOCX via `docx` lib, XLSX via `xlsx`, TXT/CSV direto; PDF e PPTX entregues como `.docx` na primeira versão com aviso).
  8. Upload do arquivo traduzido em `file-translations/{user_id}/{id}.{ext}`.
  9. **Sucesso** → `spend_for_feature(user, 'file_translation')`, atualiza row com `status='success'`, `credits_spent=10`, `source_lang`, `storage_path_translated`. Retorna `{ ok, download_url (signed), id, source_lang }`.
  10. **Erro** → `status='error'`, sem cobrança. Retorna erro amigável.

- `listFileTranslations({ range })` — histórico (today/7d/30d/all) ordenado desc.
- `getFileTranslationDownloadUrl({ id })` — signed URL 1h.

## 3. Frontend — Rota e menu

- Novo arquivo `src/routes/_app.file-translator.tsx` com `Route /_app/file-translator`.
- Adicionar item no menu em `src/routes/_app.tsx` (após `translator`):
  - `{ to: "/file-translator", icon: Languages, label: "Tradutor de Arquivos IA" }` (ícone Globe ou FileText também aceitável — usaremos `FileText`).

## 4. UI da página

Layout em 3 áreas:

**a) Upload card**
- Dropzone (`react-dropzone` já presente? senão `input file` + drag/drop nativo) aceitando `.pdf,.docx,.xlsx,.csv,.pptx,.txt` (até 10 MB).
- Texto: "Envie um arquivo e traduza para qualquer idioma em segundos."
- Após selecionar: mostra nome, tipo, tamanho; botão remover.

**b) Confirmação**
- Select de idioma destino (mesma lista `LANGS` de `_app.translator.tsx` + extras: russo, holandês, hindi, turco, polonês).
- Aviso: "Esta conversão consumirá **10 créditos**." (lê de `credit_costs` via wallet hook).
- Saldo atual visível. Se insuficiente: bloqueia botão e exibe CTAs **Comprar Créditos** (`/credits`) e **Assinar Plano** (`/billing`).
- Botão **Traduzir Arquivo** (loader durante processamento).

**c) Resultado**
- ✅ "Tradução concluída com sucesso."
- Botões: 📥 Baixar Arquivo Traduzido, 📄 Visualizar (abre em nova aba), 🔄 Traduzir Novamente.

**d) Estatísticas (cards no topo)**
- Arquivos traduzidos (count)
- Idiomas utilizados (distinct count)
- Créditos consumidos (sum)
- Economia estimada (count × R$50 — placeholder configurável)

**e) Histórico**
- Tabela: Data, Arquivo, Idioma original → destino, Créditos, Status (badge), ação Baixar.
- Filtros: Hoje / 7d / 30d / Todos (tabs).

## 5. Regras de cobrança

- Débito **somente após sucesso** (passo 9). Erros não cobram.
- Idempotência: cada chamada cria UMA linha em `file_translations`; `spend_for_feature` é chamado uma vez no fluxo de sucesso e registrado em `credit_ledger` automaticamente.
- Liberação para Pro/Ultra/avulso já garantida por `has_premium_access`.

## 6. Detalhes técnicos

- Parsers em server runtime (Cloudflare Worker compatível): `mammoth` (DOCX→texto), `xlsx` (XLSX/CSV), `pdf-parse`/alternativa edge para PDF — se incompatível com Worker, fallback de PDF/PPTX entrega `.txt` traduzido.
- Tradução em chunks (~3000 tokens) para arquivos grandes, com retries.
- Upload do arquivo original do client em base64 → server decodifica para Buffer.
- Bucket privado; downloads sempre via signed URL.
- i18n: adicionar chave `dash.fileTranslator` em `src/lib/i18n/*`.

## Fora de escopo

Planos, preços de assinatura, webhook de pagamento, pacotes de créditos avulsos, dashboard de compra de créditos.
