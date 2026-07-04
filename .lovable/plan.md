# Consertar o dashboard de Hospedagem

## Diagnóstico

Testei a API direto agora:

- `GET /air/airports` (voos) → **200 OK** ✅
- `GET /stays/accommodation/suggestions?query=Lisboa` → **404 Not found** ❌

Ou seja, a conta Duffel deste projeto **não tem o produto Stays habilitado**. Igual aos voos, a Duffel exige aprovação separada para liberar Stays. Enquanto isso, toda busca vai falhar.

Além disso, o código atual em `src/routes/_app.stays.tsx` (linha 92) só reconhece erro `403` como "API indisponível" — o 404 real cai no `else` e mostra um toast genérico "Not found" que provavelmente confundiu você.

## O que vou fazer

### 1. Corrigir a detecção de indisponibilidade (fix imediato)
No `_app.stays.tsx`, ampliar o `onError` da busca para tratar 401/403/404/`not_found`/`insufficient_scope` como "API indisponível" e acionar o mesmo fallback bonito que já existe (card "Reservas internas indisponíveis" + botão Booking.com com a busca pré-preenchida).

### 2. Mostrar fallback proativo (sem esperar erro)
Adicionar uma flag `stays_provider_status` que o backend expõe. Se a Duffel Stays retornar erro conhecido de acesso, guardar em memória por 5 min e já mostrar o card do Booking.com no topo antes mesmo do usuário buscar, explicando: *"Reservas internas de hospedagem estão em processo de habilitação com nosso provedor. Enquanto isso, buscas abrem no Booking.com com sua comissão de afiliado."*

### 3. Preparar Booking.com Affiliate como fonte principal temporária
Enquanto a Duffel não libera Stays, o Booking Affiliate Program:
- é gratuito e aprovação em ~24h
- paga 25–40% da comissão do Booking em cada reserva confirmada
- deep links já funcionam sem SDK

Vou:
- Adicionar `BOOKING_AFFILIATE_ID` como variável (você cadastra em https://www.booking.com/affiliate-program → me envia o `aid`)
- Reescrever a URL do fallback para incluir `&aid=${BOOKING_AFFILIATE_ID}` — assim já monetiza cada clique
- Deixar o botão "Reservar no Booking.com" mais destacado

### 4. Deixar código Duffel Stays pronto pra ligar
Não removo `stays.functions.ts` — mantenho tudo funcionando. No dia que a Duffel aprovar Stays, é só o backend parar de retornar 404 e o dashboard volta ao fluxo interno automaticamente.

### 5. Instrução clara para você
Vou deixar no chat os 2 passos que dependem de você:
1. Solicitar acesso ao Stays na Duffel: dashboard Duffel → **Products → Stays → Request access** (grátis, ~2-5 dias úteis)
2. Cadastrar no Booking Affiliate: https://www.booking.com/affiliate-program/v2/index.html — me mandar o `aid` quando aprovado

## Fora de escopo desta rodada
- Integrar Hotelbeds, Expedia TAAP ou outro API de hotéis (podemos ver depois se você quiser reservas *internas* de fato, sem redirect)
- Mexer em voos, chat, tradutor ou outras áreas
- Publicar / Play Store (fica para outra conversa quando você quiser)
