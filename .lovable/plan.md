# Plano: Voos e Hospedagens em modo Redirecionamento (links públicos)

Enquanto Duffel produção não é liberada, o app **busca e compara preços** normalmente, mas **não finaliza reserva interna**. Redireciona para links públicos genéricos (Skyscanner, Google Flights, Booking). Depois basta trocar por links afiliados (com seu ID) ou reativar reserva direta.

## Comportamento para o usuário

### Voos (`/flights`)
- Busca Duffel continua ativa (ofertas reais, cias, horários, preços).
- Botão **"Reservar"** → **"Ver e reservar no parceiro"** com badge "Redireciona para site oficial".
- Ao clicar: abre nova aba com link público (Skyscanner por padrão, fallback Google Flights) já preenchido (origem, destino, datas, passageiros, classe).
- Banner discreto no topo: *"Reservas diretas em breve — por enquanto finalize no site parceiro."*
- Fluxo Stripe/passageiros/`createFlightCheckoutSession` fica no código, oculto por flag.

### Hospedagens (`/stays`)
- Já usa fallback Booking.com. Vou reforçar:
  - Cada hotel mostra 2 botões: **Booking.com** e **Hotels.com** (link público).
  - Se `BOOKING_AFFILIATE_ID` estiver setado, usa afiliado; senão, link público (funciona igual, só sem comissão).
- Mesmo banner explicativo.

## O que vou implementar

1. **Flag** `BOOKING_MODE = "redirect" | "direct"` em `src/lib/pricing.ts` (default `"redirect"`). Trocar 1 linha ativa reserva direta.
2. **Helper novo** `src/lib/affiliate-links.ts`:
   - `buildFlightLink({ origin, destination, departure, return, adults, cabin })` → Skyscanner + Google Flights.
   - `buildStayLink({ query, checkIn, checkOut, guests, rooms, partner })` → Booking + Hotels.com.
   - Usa afiliado se secret existir; senão link público.
3. **UI Voos** (`_app.flights.tsx` + card de oferta):
   - Ocultar CTA de checkout interno quando `redirect`.
   - Novo botão "Reservar no parceiro" (nova aba) + registrar clique.
   - Banner topo.
4. **UI Stays** (`_app.stays.tsx`):
   - Dois botões por hotel (Booking, Hotels.com).
   - Mesmo banner.
5. **Tabela `affiliate_clicks`** (Supabase):
   - `id, user_id, partner, kind (flight|stay), payload jsonb, estimated_value, clicked_at`.
   - RLS: usuário lê os próprios; admin (`has_role`) lê tudo; GRANTs completos.
6. **Painel admin** (`_app.admin.financial.tsx`):
   - Aba "Cliques em parceiros" — total por parceiro/período.
7. **Manter intacto**: busca Duffel, Stripe checkout, `pending_flight_bookings`, `flight_orders`, `createStayBooking`. Nada é apagado — só oculto atrás da flag.

## Depois (quando você quiser)
- Cadastrar em Skyscanner Partners / Booking Affiliate → me passa os IDs → adiciono como secrets → helper passa a usar afiliado automaticamente.
- Duffel liberar produção → flipar `BOOKING_MODE = "direct"` → checkout interno volta.

## Verificação
- Buscar voo GRU→LIS → clicar "Reservar no parceiro" → abre Skyscanner com os campos preenchidos.
- Buscar hotel Lisboa → clicar Booking → abre Booking.com com datas/hóspedes.
- Registro aparece em `affiliate_clicks` e no painel admin.
