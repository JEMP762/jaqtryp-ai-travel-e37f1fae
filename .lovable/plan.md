## Objetivo

Hoje o seletor de tema troca apenas a cor de **destaque** (botões, links, glow). O fundo do sistema continua sempre o mesmo cinza-escuro azulado. Você quer que cada tema também pinte o **pano de fundo** (background do app, sidebar, cards) com a paleta escolhida, mantendo legibilidade.

## O que será feito

### 1. Estender cada tema em `src/styles.css`
Para cada um dos 7 temas (Neon Blue, Azul Claro, Violeta, Esmeralda, Pôr do Sol, Rosa, Grafite), além das variáveis de accent já existentes, sobrescrever também:

- `--background` — fundo principal (tom escuro tingido com a cor do tema)
- `--card`, `--popover` — superfícies elevadas
- `--muted`, `--muted-foreground` — áreas secundárias
- `--border`, `--input` — bordas sutis com tom do tema
- `--sidebar`, `--sidebar-accent`, `--sidebar-border` — barra lateral
- `--gradient-card`, `--gradient-hero` — fundos com gradiente

A estratégia é manter o **dark mode** (legível), mas deslocar o matiz (hue) do cinza para a cor do tema. Exemplo:
- **Azul Claro:** fundo `oklch(0.12 0.025 230)` (escuro com leve toque azul-céu)
- **Violeta:** fundo `oklch(0.12 0.03 295)`
- **Esmeralda:** fundo `oklch(0.12 0.025 160)`
- **Pôr do Sol:** fundo `oklch(0.13 0.025 40)` (escuro com calor avermelhado)
- **Rosa:** fundo `oklch(0.13 0.025 10)`
- **Grafite:** fundo neutro `oklch(0.14 0.005 255)`
- **Neon Blue:** mantém o atual (default)

Cards/sidebar/borders seguem a mesma lógica, apenas 1–3 pontos de luminosidade acima do background para criar hierarquia visual.

### 2. Transição suave
Adicionar `transition: background-color 300ms ease` no `body` para que a troca de tema não pisque bruscamente.

### 3. Nada de mudança em componentes
Como todos os componentes já usam tokens semânticos (`bg-background`, `bg-card`, `border-border`, etc.), nenhum arquivo `.tsx` precisa ser tocado. A troca acontece 100% via CSS.

## Detalhes técnicos

- Edição única em `src/styles.css`, expandindo os blocos `:root[data-theme="..."]` que já criei.
- Sem mudanças em `ThemeProvider`, `ThemeSwitcher` nem rotas.
- Sem migração de banco, sem novas dependências.

## Arquivos afetados

- `src/styles.css` (expansão dos 6 blocos de tema + transição no body)

## Fora do escopo

- Modo claro (light mode) — todos os temas continuam dark, só muda o matiz.
- Permitir cor customizada via color picker (pode virar próximo passo se quiser).
