## Objetivo

Remover o modo **Claro Pêssego** e substituir por um novo modo **Claro Lovable** (rosa/coral característico da Lovable), mantendo Escuro e Claro Azul intactos. Voos fica em standby até resposta da Duffel.

## Mudanças

### 1. `src/lib/theme/AppearanceModeProvider.tsx`
- Trocar tipo `AppearanceMode`: `"dark" | "light-sky" | "light-lovable"` (remove `light-peach`).
- Atualizar `APPEARANCE_MODES`: substituir entrada `light-peach` por `light-lovable`:
  - name: "Claro Lovable"
  - description: "Branco com toque rosa Lovable"
  - swatch: `["#ffffff", "#ffe4ef", "#ff6db3"]` (paleta rosa-lovable)
- Migração leve: se `localStorage` tiver `"light-peach"` salvo, normalizar para `"light-lovable"` ao ler.

### 2. `src/components/AppearanceModeSwitcher.tsx`
- Atualizar mapa `ICONS`: remover `"light-peach"`, adicionar `"light-lovable"` usando o ícone `Heart` (lucide).

### 3. `src/styles.css`
- Remover o bloco `:root[data-mode="light-peach"]` e qualquer override `[data-mode="light-peach"][data-theme="..."]`.
- Adicionar bloco `:root[data-mode="light-lovable"]` com tokens claros em paleta rosa Lovable:
  - `--background: oklch(0.985 0.012 350)` (branco com toque rosa)
  - `--foreground: oklch(0.2 0.04 350)`
  - `--card: oklch(1 0.005 350)`
  - `--muted: oklch(0.96 0.018 350)`
  - `--border: oklch(0.6 0.12 350 / 18%)`
  - `--sidebar: oklch(0.97 0.02 350)`
  - `--primary` default rosa Lovable (`oklch(0.68 0.22 350)`), `--primary-foreground` branco
  - Gradient/glow rosa.
- Espelhar a mesma estratégia já usada para `light-sky`: blocos de tema (`[data-theme="..."]`) coexistem só sobrescrevendo destaque/ring/gradient, sem alterar o fundo claro.

### 4. Não mexer
- Tema Escuro e Claro Azul permanecem como estão.
- Funcionalidades de Voos / Duffel: nada por agora, aguardar autorização.

## Fora do escopo
- Qualquer mudança no módulo de voos (aguardando Duffel).
- Detecção automática de `prefers-color-scheme`.
