## Objetivo

Adicionar um seletor de **Modo de Aparência** (igual claro/escuro de outros apps) com 3 opções, independente da cor de destaque atual:

1. **Escuro** (padrão atual)
2. **Claro Azul** — fundo branco-azulado, ar de céu limpo
3. **Claro Pêssego (Lovable)** — fundo branco-creme com toque coral quente

A cor de destaque escolhida (Neon Blue, Violeta, etc.) continua funcionando **por cima** de qualquer modo.

## O que será feito

### 1. Novo `AppearanceModeProvider`
Arquivo `src/lib/theme/AppearanceModeProvider.tsx` com:
- Estado `mode: "dark" | "light-sky" | "light-peach"`
- Persistência em `localStorage` (`jq_appearance_mode`)
- Aplica via `document.documentElement.setAttribute("data-mode", mode)`
- Padrão: `dark`

Registrar no `__root.tsx` ao lado do `ThemeProvider`.

### 2. Tokens em `src/styles.css`

**Modo Escuro (`:root` ou `[data-mode="dark"]`)** — mantém o que já existe.

**`:root[data-mode="light-sky"]`** — paleta clara azul:
- `--background: oklch(0.985 0.008 230)` (branco com leve azul)
- `--foreground: oklch(0.18 0.03 250)` (texto escuro azulado)
- `--card: oklch(1 0 0)` puro branco
- `--muted: oklch(0.96 0.012 230)`
- `--border: oklch(0.5 0.05 230 / 18%)`
- `--sidebar: oklch(0.97 0.012 230)`
- Recalcular `--primary-foreground` para escuro (texto sobre botões claros).

**`:root[data-mode="light-peach"]`** — paleta clara pêssego (Lovable):
- `--background: oklch(0.985 0.012 60)` (branco-creme quente)
- `--foreground: oklch(0.2 0.025 40)`
- `--card: oklch(1 0.005 60)`
- `--muted: oklch(0.96 0.015 50)` 
- `--border: oklch(0.55 0.08 40 / 18%)`
- `--sidebar: oklch(0.97 0.018 50)`
- Glow/gradient com toque coral `#FF8A65`.

**Interação com `data-theme`**: quando o modo é claro, os blocos `[data-theme="..."]` precisam ser ajustados. Solução: usar seletores combinados, ex.: `:root[data-mode="light-sky"][data-theme="violet"]` só sobrescreve `--primary`, `--ring`, `--gradient-primary` (não toca no background). Forma prática: os blocos de tema atuais ficam restritos a `[data-mode="dark"]`, e criamos blocos paralelos minimalistas para `[data-mode^="light"]` que só trocam as cores de destaque, mantendo o fundo claro.

### 3. Componente `AppearanceModeSwitcher`
Novo `src/components/AppearanceModeSwitcher.tsx`: 3 cards visuais (igual ao ThemeSwitcher), com mini-preview de cada modo (swatch escuro / azul claro / pêssego). Mostra check no ativo.

### 4. Integração na UI
- **Página `/settings/appearance`**: adicionar a seção "Modo" acima da seção "Cor do tema" que já existe.
- **Sidebar (`src/routes/_app.tsx`)**: adicionar um botão pequeno tipo toggle ☀️/🌙 ao lado dos swatches de cor, ou um terceiro mini-seletor de 3 ícones.

### 5. Transição
Já existe `transition: background-color 300ms ease` no body — funciona automaticamente.

## Arquivos afetados

- `src/lib/theme/AppearanceModeProvider.tsx` (novo)
- `src/components/AppearanceModeSwitcher.tsx` (novo)
- `src/styles.css` (3 blocos de modo + reorganização dos blocos de tema para coexistir com modos claros)
- `src/routes/__root.tsx` (envolver com `AppearanceModeProvider`)
- `src/routes/_app.settings.appearance.tsx` (adicionar seção)
- `src/routes/_app.tsx` (botão rápido na sidebar)

## Fora do escopo

- Detecção automática de `prefers-color-scheme` (pode ser próximo passo).
- Color picker totalmente customizado.
- Light mode para landing page pública (mantém visual atual).
