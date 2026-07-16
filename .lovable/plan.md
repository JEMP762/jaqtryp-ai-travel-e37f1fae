## Plano: Ajustar PWA + Adicionar Web Push

Vou executar as duas frentes em paralelo.

### Parte 1 — Polir PWA

- **Ícones dedicados** (gerados por IA, estilo do app — azul/roxo com avião/globo estilizado):
  - `public/icon-192.png` (192×192)
  - `public/icon-512.png` (512×512)
  - `public/icon-maskable-512.png` (512×512 com safe zone para Android adaptativo)
  - `public/apple-touch-icon.png` (180×180)
- **`public/manifest.webmanifest`** atualizado:
  - `name`: "Jaqtryp — Viagens com IA"
  - `short_name`: "Jaqtryp"
  - `theme_color`: `#0b0b12`, `background_color`: `#0b0b12`
  - `display`: `standalone`, `orientation`: `portrait`
  - `icons[]` referenciando os 3 PNGs (incluindo `purpose: "maskable"`)
  - `shortcuts[]`: Live Translate, Planejador, Carteira
- **`src/routes/__root.tsx`**: adicionar `<link rel="apple-touch-icon">` e garantir `theme-color` correto.

### Parte 2 — Web Push Notifications

Push nativo do navegador (Web Push API + VAPID), sem depender de FCM/Firebase. Funciona em Android/Chrome/Edge/Firefox e iOS 16.4+ (após instalar o PWA).

**Backend (Supabase + TanStack server functions):**
- Migração SQL: tabela `push_subscriptions` (`user_id`, `endpoint` unique, `p256dh`, `auth`, `user_agent`, `created_at`) com RLS (usuário só vê/gerencia as próprias) + GRANTs.
- Secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (gerados por mim e adicionados via add_secret). `VITE_VAPID_PUBLIC_KEY` exposto ao cliente.
- `src/lib/push.functions.ts`:
  - `subscribeToPush({ subscription })` — grava no banco.
  - `unsubscribeFromPush({ endpoint })` — remove.
  - `sendPushToUser({ userId, title, body, url })` — server-only, usa `web-push` para enviar.
- Endpoint público `src/routes/api/public/push/send.ts` para gatilhos internos (protegido por secret).

**Service Worker de Push (isolado, não é app-shell — regra do skill PWA respeitada):**
- `public/push-sw.js` apenas com handlers `push` e `notificationclick` (abre a `url` do payload). Sem cache de app, sem interceptação de fetch, sem quebra do preview do Lovable.
- Guard: registro só em `import.meta.env.PROD` e fora dos hostnames de preview do Lovable.

**UI:**
- Componente `PushOptIn` no dashboard `_app.tsx`: botão "Ativar notificações" que pede permissão, cria subscription e envia ao backend. Estado: bloqueado / ativado / não suportado.
- Página `/settings` (ou seção): listar/desativar dispositivos.

**Gatilhos automáticos iniciais** (integrações leves):
- Convite de sala ao vivo: quando o host cria a sala, envia push ao convidado (se ele já tiver ativado em sessão anterior).
- Roteiro pronto: push quando o planejador termina de gerar.
- Recompensa de indicação: push quando o indicado paga.

### Detalhes técnicos

- Biblioteca: `web-push` (Node) — usada apenas dentro de handlers de server function (nunca no client bundle). Compatível com o Worker runtime via `nodejs_compat` (usa `crypto`).
- Formato do payload: `{ title, body, url, icon: "/icon-192.png", badge: "/icon-192.png" }`.
- VAPID keys geradas uma vez com `web-push generate-vapid-keys` e persistidas como secrets.
- Cleanup: quando `send` recebe 404/410 do endpoint, remove a subscription do banco.

### Ordem de execução

1. Gerar ícones + atualizar manifest + `__root.tsx`.
2. `bun add web-push` + gerar/salvar VAPID keys.
3. Migração `push_subscriptions`.
4. Server functions + rota pública.
5. `public/push-sw.js` + registrar com guards.
6. UI de opt-in no dashboard.
7. Gatilhos (sala ao vivo, planejador, referral).

Confirma que sigo com esses dois pacotes juntos?
