
# Personalização de tema pelo usuário

Adicionar um seletor visual de temas dentro do sistema para o usuário escolher a cor principal (accent) que será aplicada em toda a interface, incluindo uma nova opção **Azul Claro**.

## O que será entregue

1. **Novo provider de tema** (`src/lib/theme/ThemeProvider.tsx`)
   - Mantém `themeId` (ex: `neon-blue`, `sky`, `violet`, `emerald`, `sunset`, `rose`, `slate`) persistido em `localStorage` (`jq_theme`).
   - Aplica `data-theme="<id>"` no `<html>` para trocar tokens via CSS.
   - Hook `useTheme()` para ler/atualizar.
   - Registrado no `__root.tsx` junto de `I18nProvider`.

2. **Tokens por tema em `src/styles.css`**
   - Mantém o tema atual (Neon Blue) como padrão.
   - Adiciona blocos `:root[data-theme="sky"] { ... }` etc. sobrescrevendo apenas `--primary`, `--primary-glow`, `--ring`, `--sidebar-primary`, `--gradient-primary`, `--gradient-hero`, `--shadow-glow`.
   - Sem hardcode — tudo via tokens semânticos já existentes, então todo o app reflete a troca automaticamente (sidebar ativo, botões, gradientes, glow, badges).

3. **Paleta proposta** (6–7 opções, visualmente distintas)
   - **Neon Blue** (atual, padrão)
   - **Sky** (azul claro — pedido do usuário)
   - **Violet**
   - **Emerald**
   - **Sunset** (laranja/coral)
   - **Rose**
   - **Slate** (neutro grafite)

4. **UI de seleção** (`src/components/ThemeSwitcher.tsx`)
   - Card com swatches circulares (cor primária + glow) mostrando cada tema.
   - Item ativo com anel `ring-2 ring-primary`.
   - Aplica imediatamente ao clicar (preview ao vivo).

5. **Pontos de acesso**
   - Nova rota `/_app/settings/appearance` com o `ThemeSwitcher` e título "Aparência".
   - Link "Aparência" no sidebar (`src/routes/_app.tsx`) com ícone `Palette`.
   - Mini-swatch no rodapé do sidebar (ao lado do seletor PT/EN) para troca rápida.

## Fora de escopo

- Modo claro/escuro completo (o app é dark-first; só trocamos a cor de destaque).
- Cores totalmente customizadas via color picker — apenas presets curados.
- Backend: preferência fica em `localStorage` (sem coluna no banco) para não exigir migração.

## Detalhes técnicos

- Os tokens trocados são apenas accent/primary; `background`, `card`, `border` continuam iguais para manter a identidade dark futurista.
- `--gradient-primary` é redefinido em cada tema usando `var(--primary)` / `var(--primary-glow)` para que `bg-gradient-primary`, `text-gradient` e `shadow-glow` atualizem sem mudar componentes.
- O `ThemeProvider` aplica o atributo antes do primeiro paint via `useLayoutEffect` para evitar flash do tema padrão.
