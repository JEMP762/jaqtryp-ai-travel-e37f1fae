# Plano de Escala — JaqTryp (Web-first, sem Play Store)

Objetivo: crescer usuários, receita e estabilidade mantendo o app 100% na web (domínio próprio + PWA instalável), sem custo/burocracia de lojas de app.

## 1. Distribuição sem loja

- **PWA instalável real**: manifest.json + service worker + ícones (maskable 512/192) → botão "Instalar app" no Android/iOS/Desktop. Vira ícone na tela inicial igual app nativo.
- **Deep links / share targets**: registrar `share_target` no manifest pra receber texto/imagem de outros apps (útil pro tradutor e planner).
- **Domínio próprio** (`jaqtryp.com` já ativo) + subdomínios: `app.` (produto), `blog.` (SEO), `status.` (uptime).
- **QR nas materiais**: cartão + landing `/install` com instruções por SO.

## 2. Aquisição (canais que substituem a loja)

- **SEO programático**: rotas dinâmicas para pares de idiomas, cidades e roteiros (ex.: `/traduzir/portugues-ingles`, `/roteiro/lisboa-3-dias`). Cada rota com `head()` único, JSON-LD e og:image gerada.
- **Blog/conteúdo**: 2 posts/semana em `/blog` cobrindo dor real (viagem, tradução ao vivo, planejamento).
- **Referral 10%** (já implementado) — adicionar tracking de conversão + leaderboard mensal com bônus pros top 3.
- **Parcerias**: agências de viagem, professores de idioma, guias turísticos → link de indicação com override de comissão maior (15–20%).

## 3. Ativação e retenção

- **Onboarding em 60s**: 3 telas → escolher idioma nativo → testar tradução → convidar amigo pra sala ao vivo.
- **Notificações Web Push**: crédito baixo, promoção, viagem próxima, resposta do chat. Cobre 90% do que "app nativo" oferece.
- **E-mail transacional** (Lovable Email já disponível): boas-vindas, saldo baixo, recibo, recuperação de conta abandonada.
- **Free trial guiado**: 5 traduções ao vivo grátis pra novo usuário sem cartão.

## 4. Confiabilidade e performance

- **Monitorar findings do Project Monitoring** semanalmente (já ativo — resolver antes de acumular).
- **Cache/CDN**: rotas estáticas (blog, landing, pricing) pré-renderizadas; assets com hash + `Cache-Control: immutable`.
- **Custo de IA**: métrica por feature, alerta quando margem < 40%. Fallback para modelo mais barato em usuários free.
- **Compute Supabase**: acompanhar `db_health`; escalar instância só quando fila de conexões saturar.
- **Rate limit por IP e por user_id** nas rotas públicas (`/api/public/*`) pra evitar abuso.

## 5. Monetização

- **3 planos já ativos** (Free / Pro / Ultra) — adicionar:
  - **Pacote empresarial** (equipes, faturamento anual, SSO futuro).
  - **Créditos avulsos com desconto por volume** (700, 3.000, 10.000).
- **Upsell contextual**: quando usuário atinge 80% dos créditos, banner "Assine Pro e pague 60% menos por crédito".
- **Cupom de reativação**: usuário inativo 30 dias recebe 20% off no próximo pacote.

## 6. Roadmap de features com maior alavanca

Prioridade por ROI (impacto ÷ esforço):

1. **PWA install + push notifications** — trava usuário no ecossistema sem loja.
2. **SEO programático (idiomas + cidades)** — tráfego orgânico grátis contínuo.
3. **Leaderboard de indicação + bônus** — turbina o programa já existente.
4. **Modo offline básico** (últimas traduções, roteiros salvos) via service worker.
5. **Compartilhar sala ao vivo por link curto** (`jaqtryp.com/j/ABC`) com preview rico (og:image dinâmica).
6. **Widget embutível** ("Traduza no seu site" — B2B leve, gera backlink).

## 7. Métricas pra acompanhar semanalmente

- Instalações PWA (evento `beforeinstallprompt` + `appinstalled`).
- MAU / WAU / DAU.
- Custo médio de IA por usuário ativo.
- Taxa de conversão free → pago.
- Receita por indicação vs receita direta.
- Erros do Project Monitoring abertos.

## Detalhes técnicos (referência)

- PWA: `vite-plugin-pwa` ou service worker manual em `public/sw.js` + `<link rel="manifest">` no `__root.tsx`.
- Push: Web Push API + VAPID keys guardadas como secret; tabela `push_subscriptions` (user_id, endpoint, keys) com RLS.
- SEO programático: rotas paramétricas em `src/routes/` + dados de loader com `ensureQueryData`.
- Rate limit: middleware nas rotas `/api/public/*` usando tabela `rate_limit_buckets` (ip/user_id, count, window_start) ou KV.
- Analytics: `analytics--read_project_analytics` semanal + evento custom por conversão.

---

Se aprovar, eu implemento na ordem: **(1) PWA instalável + manifest** → **(2) Web Push + tabela de subscrições** → **(3) primeira leva de SEO programático** → resto por etapas.
