import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { Plane, Search, Loader2, ArrowRight, Clock, Ticket, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { searchFlights, createFlightOrder, listFlightOrders } from "@/lib/duffel.functions";
import { getCommissionSettings } from "@/lib/pricing.functions";
import { createFlightCheckoutSession } from "@/lib/checkout.functions";
import { PriceBreakdown } from "@/components/pricing/PriceBreakdown";
import { PriceWithBrl } from "@/components/pricing/PriceWithBrl";
import { UpsellSuggestions } from "@/components/pricing/UpsellSuggestions";
import { SmartCheckoutSummary } from "@/components/pricing/SmartCheckoutSummary";
import { useAuth } from "@/hooks/useAuth";
import { buildFlightLink, FLIGHTS_BOOKING_MODE, PARTNER_LABEL } from "@/lib/affiliate-links";
import { logAffiliateClick } from "@/lib/affiliate-clicks.functions";
import { ExternalLink } from "lucide-react";

const flightsSearchSchema = z.object({
  origin: fallback(z.string(), "").default(""),
  destination: fallback(z.string(), "").default(""),
  departure_date: fallback(z.string(), "").default(""),
  return_date: fallback(z.string(), "").default(""),
  auto: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_app/flights")({
  validateSearch: zodValidator(flightsSearchSchema),
  component: FlightsPage,
});

type Offer = {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { name?: string; iata_code?: string; logo?: string };
  slices: Array<{
    origin: string;
    destination: string;
    duration?: string;
    segments: Array<{
      origin: string;
      destination: string;
      departing_at: string;
      arriving_at: string;
      marketing_carrier?: string;
      marketing_carrier_iata?: string;
      flight_number?: string;
      duration?: string;
    }>;
  }>;
  passenger_ids: string[];
};

type Passenger = {
  id: string;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: "m" | "f";
  title: "mr" | "ms" | "mrs" | "miss" | "dr";
  email: string;
  phone_number: string;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function fmtDuration(d?: string) {
  if (!d) return "";
  const h = d.match(/(\d+)H/)?.[1];
  const m = d.match(/(\d+)M/)?.[1];
  return [h ? `${h}h` : "", m ? `${m}m` : ""].join(" ").trim();
}
function fmtMoney(amount: string, currency: string) {
  const n = Number(amount);
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function FlightsPage() {
  const search = useServerFn(searchFlights);
  const createOrder = useServerFn(createFlightOrder);
  const listOrders = useServerFn(listFlightOrders);
  const settingsFn = useServerFn(getCommissionSettings);
  const checkoutFn = useServerFn(createFlightCheckoutSession);
  const sp = Route.useSearch();
  const settingsQuery = useQuery({ queryKey: ["commission-settings"], queryFn: () => settingsFn(), retry: false });

  const [form, setForm] = useState(() => ({
    origin: sp.origin || "GRU",
    destination: sp.destination || "JFK",
    departure_date: sp.departure_date || tomorrowISO(),
    return_date: sp.return_date || "",
    adults: 1,
    cabin_class: "economy" as "economy" | "premium_economy" | "business" | "first",
  }));
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selected, setSelected] = useState<Offer | null>(null);
  const [confirmed, setConfirmed] = useState<{ booking_reference: string; total_amount: string; total_currency: string } | null>(null);
  const [passengers, setPassengers] = useState<Passenger[]>([]);

  const { user } = useAuth();
  const ordersQuery = useQuery({
    queryKey: ["flight-orders", user?.id],
    queryFn: async () => {
      try {
        return await listOrders();
      } catch {
        return { orders: [] };
      }
    },
    enabled: !!user,
    retry: false,
  });

  async function unwrapError(e: any): Promise<string> {
    try {
      if (e instanceof Response) {
        const txt = await e.text();
        return txt || `Erro ${e.status}`;
      }
      if (e?.message) return e.message;
      return typeof e === "string" ? e : "Erro inesperado";
    } catch {
      return "Erro inesperado";
    }
  }

  const searchMut = useMutation({
    mutationFn: async () => {
      try {
        return await search({ data: form });
      } catch (e) {
        throw new Error(await unwrapError(e));
      }
    },
    onSuccess: (data) => {
      setOffers(data.offers);
      setSelected(null);
      setConfirmed(null);
      if (!data.offers.length) toast.info("Nenhuma oferta encontrada para esses critérios.");
    },
    onError: (e: any) => toast.error(e.message || "Erro na busca"),
  });

  const orderMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma oferta");
      try {
        return await createOrder({ data: { offer_id: selected.id, passengers } });
      } catch (e) {
        throw new Error(await unwrapError(e));
      }
    },
    onSuccess: (data) => {
      setConfirmed(data);
      toast.success(`Reserva confirmada! Código: ${data.booking_reference}`);
      ordersQuery.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Falha ao reservar"),
  });

  const checkoutMut = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione uma oferta");
      const missing = passengers.some((p) => !p.given_name || !p.family_name || !p.born_on || !p.email || !p.phone_number);
      if (missing) throw new Error("Preencha os dados de todos os passageiros");
      try {
        return await checkoutFn({
          data: {
            offer_id: selected.id,
            original_amount: Number(selected.total_amount),
            original_currency: selected.total_currency,
            passengers,
            origin: selected.slices[0]?.origin,
            destination: selected.slices[selected.slices.length - 1]?.destination,
          },
        });
      } catch (e) {
        throw new Error(await unwrapError(e));
      }
    },
    onSuccess: (d) => {
      if (d?.url) window.location.href = d.url;
    },
    onError: (e: any) => toast.error(e.message || "Falha ao iniciar pagamento"),
  });

  // Auto-trigger search when arriving from a deal (?auto=true)
  const autoRan = useRef(false);
  useEffect(() => {
    if (sp.auto && !autoRan.current && form.origin && form.destination && form.departure_date) {
      autoRan.current = true;
      searchMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.auto]);


  function selectOffer(o: Offer) {
    setSelected(o);
    setPassengers(
      o.passenger_ids.map((id) => ({
        id,
        given_name: "",
        family_name: "",
        born_on: "",
        gender: "m",
        title: "mr",
        email: "",
        phone_number: "",
      }))
    );
    setConfirmed(null);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <Plane className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Voos</h1>
          <p className="text-sm text-muted-foreground">Busque, compare e reserve passagens reais via Duffel</p>
        </div>
      </div>

      {/* Search form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          searchMut.mutate();
        }}
        className="grid gap-3 rounded-2xl border border-border/60 bg-gradient-card p-5 shadow-glow md:grid-cols-6"
      >
        <Field label="Origem (IATA)">
          <input
            value={form.origin}
            onChange={(e) => setForm({ ...form, origin: e.target.value.toUpperCase() })}
            maxLength={3}
            required
            className="input"
            placeholder="GRU"
          />
        </Field>
        <Field label="Destino (IATA)">
          <input
            value={form.destination}
            onChange={(e) => setForm({ ...form, destination: e.target.value.toUpperCase() })}
            maxLength={3}
            required
            className="input"
            placeholder="JFK"
          />
        </Field>
        <Field label="Ida">
          <input
            type="date"
            value={form.departure_date}
            min={tomorrowISO()}
            onChange={(e) => setForm({ ...form, departure_date: e.target.value })}
            required
            className="input"
          />
        </Field>
        <Field label="Volta (opcional)">
          <input
            type="date"
            value={form.return_date}
            min={form.departure_date || tomorrowISO()}
            onChange={(e) => setForm({ ...form, return_date: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Adultos">
          <input
            type="number"
            min={1}
            max={9}
            value={form.adults}
            onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })}
            className="input"
          />
        </Field>
        <Field label="Classe">
          <select
            value={form.cabin_class}
            onChange={(e) => setForm({ ...form, cabin_class: e.target.value as any })}
            className="input"
          >
            <option value="economy" className="bg-background text-foreground">Econômica</option>
            <option value="premium_economy" className="bg-background text-foreground">Premium Econômica</option>
            <option value="business" className="bg-background text-foreground">Executiva</option>
            <option value="first" className="bg-background text-foreground">Primeira</option>
          </select>
        </Field>
        <div className="md:col-span-6">
          <button
            type="submit"
            disabled={searchMut.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
          >
            {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Buscar voos
          </button>
        </div>
      </form>

      {/* Results */}
      {offers.length > 0 && !selected && (
        <div className="mt-8 space-y-3">
          <h2 className="text-lg font-semibold">{offers.length} ofertas encontradas</h2>
          {offers.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-border/60 bg-card p-5 transition hover:border-primary/60 hover:shadow-glow"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1 space-y-3">
                  {o.slices.map((s, idx) => {
                    const first = s.segments[0];
                    const last = s.segments[s.segments.length - 1];
                    const stops = s.segments.length - 1;
                    return (
                      <div key={idx} className="flex items-center gap-4 text-sm">
                        <div className="text-xs text-muted-foreground w-16">{fmtDate(first.departing_at)}</div>
                        <div className="font-semibold">{fmtTime(first.departing_at)}</div>
                        <div className="text-muted-foreground">{s.origin}</div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {fmtDuration(s.duration)}{" "}
                          {stops > 0 ? `· ${stops} parada${stops > 1 ? "s" : ""}` : "· direto"}
                        </div>
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <div className="font-semibold">{fmtTime(last.arriving_at)}</div>
                        <div className="text-muted-foreground">{s.destination}</div>
                      </div>
                    );
                  })}
                  <div className="text-xs text-muted-foreground">{o.owner.name}</div>
                </div>
                <div className="flex items-center gap-4">
                  <PriceWithBrl amount={o.total_amount} currency={o.total_currency} size="lg" />

                  {FLIGHTS_BOOKING_MODE === "redirect" ? (
                    <PartnerFlightButtons offer={o} form={form} />
                  ) : (
                    <button
                      onClick={() => selectOffer(o)}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                    >
                      Selecionar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Booking form */}
      {selected && !confirmed && (
        <div className="mt-8 rounded-2xl border border-primary/30 bg-gradient-card p-6 shadow-glow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Dados dos passageiros</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <span>{selected.owner.name}</span>
                <span>·</span>
                <PriceWithBrl amount={selected.total_amount} currency={selected.total_currency} size="sm" align="left" />
              </div>
            </div>
            <button onClick={() => setSelected(null)} className="text-sm text-muted-foreground hover:text-foreground">
              ← Voltar
            </button>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-2">
            <PriceBreakdown
              originalAmount={selected.total_amount}
              currency={selected.total_currency}
              settings={settingsQuery.data ?? undefined}
            />
            <SmartCheckoutSummary
              title={`${selected.slices[0]?.origin} → ${selected.slices[selected.slices.length - 1]?.destination}`}
              subtitle={`${selected.owner.name || "Companhia"} · ${selected.slices.length > 1 ? "ida e volta" : "só ida"}`}
            />
          </div>

          <div className="mb-4">
            <UpsellSuggestions kind="flight" currency={selected.total_currency} enabled={settingsQuery.data?.upsells_enabled ?? true} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              orderMut.mutate();
            }}
            className="space-y-6"
          >
            {passengers.map((p, i) => (
              <div key={p.id} className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="mb-3 text-sm font-semibold">Passageiro {i + 1}</div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Tratamento">
                    <select
                      value={p.title}
                      onChange={(e) => updatePax(setPassengers, i, { title: e.target.value as any })}
                      className="input"
                    >
                      <option value="mr">Sr.</option>
                      <option value="mrs">Sra.</option>
                      <option value="ms">Sra.</option>
                      <option value="miss">Srta.</option>
                      <option value="dr">Dr.</option>
                    </select>
                  </Field>
                  <Field label="Nome">
                    <input required value={p.given_name} onChange={(e) => updatePax(setPassengers, i, { given_name: e.target.value })} className="input" />
                  </Field>
                  <Field label="Sobrenome">
                    <input required value={p.family_name} onChange={(e) => updatePax(setPassengers, i, { family_name: e.target.value })} className="input" />
                  </Field>
                  <Field label="Nascimento">
                    <input required type="date" value={p.born_on} onChange={(e) => updatePax(setPassengers, i, { born_on: e.target.value })} className="input" />
                  </Field>
                  <Field label="Gênero">
                    <select value={p.gender} onChange={(e) => updatePax(setPassengers, i, { gender: e.target.value as any })} className="input">
                      <option value="m">Masculino</option>
                      <option value="f">Feminino</option>
                    </select>
                  </Field>
                  <Field label="E-mail">
                    <input required type="email" value={p.email} onChange={(e) => updatePax(setPassengers, i, { email: e.target.value })} className="input" />
                  </Field>
                  <Field label="Telefone (com DDI, ex: +5511999999999)">
                    <input required value={p.phone_number} onChange={(e) => updatePax(setPassengers, i, { phone_number: e.target.value })} className="input md:col-span-2" placeholder="+5511999999999" />
                  </Field>
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-xs text-muted-foreground md:max-w-md">
                Pague em € com cartão internacional ou brasileiro (3D Secure, Apple/Google Pay) — ou use o saldo de teste Duffel.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => checkoutMut.mutate()}
                  disabled={checkoutMut.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
                >
                  {checkoutMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
                  Pagar em € (cartão)
                </button>
                <button
                  type="submit"
                  disabled={orderMut.isPending}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/40 px-5 py-2.5 text-sm font-semibold hover:border-primary/60 disabled:opacity-50"
                >
                  {orderMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Reservar (saldo Duffel)
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation */}
      {confirmed && (
        <div className="mt-8 rounded-2xl border border-primary/40 bg-gradient-card p-8 text-center shadow-glow">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-3 text-2xl font-bold">Reserva confirmada!</h2>
          <p className="mt-1 text-muted-foreground">Código de reserva</p>
          <div className="mt-2 inline-block rounded-xl border border-primary/40 bg-background/60 px-6 py-2 text-2xl font-mono font-bold tracking-widest text-primary">
            {confirmed.booking_reference}
          </div>
          <div className="mt-3 flex justify-center text-sm text-muted-foreground">
            <span className="mr-2">Total:</span>
            <PriceWithBrl amount={confirmed.total_amount} currency={confirmed.total_currency} size="sm" align="left" />
          </div>
          <button
            onClick={() => {
              setConfirmed(null);
              setSelected(null);
              setOffers([]);
            }}
            className="mt-6 rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            Nova busca
          </button>
        </div>
      )}

      {/* Past orders */}
      {ordersQuery.data?.orders && ordersQuery.data.orders.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-3 text-lg font-semibold">Suas reservas</h2>
          <div className="space-y-2">
            {ordersQuery.data.orders.map((o: any) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4 text-sm">
                <div>
                  <div className="font-mono font-bold text-primary">{o.booking_reference}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("pt-BR")}
                  </div>
                </div>
                <PriceWithBrl amount={o.total_amount} currency={o.total_currency} size="sm" />
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .input {
          width: 100%;
          background: hsl(var(--background) / 0.6);
          border: 1px solid hsl(var(--border));
          border-radius: 0.625rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: inherit;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input:focus { border-color: hsl(var(--primary)); box-shadow: 0 0 0 3px hsl(var(--primary) / 0.15); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function updatePax(setter: React.Dispatch<React.SetStateAction<Passenger[]>>, idx: number, patch: Partial<Passenger>) {
  setter((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
