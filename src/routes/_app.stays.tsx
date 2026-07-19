import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BedDouble, Loader2, MapPin, Search, Star } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  searchStays,
  getStayRates,
  createStayBooking,
  getStaysProviderStatus,
} from "@/lib/stays.functions";

import { getCommissionSettings } from "@/lib/pricing.functions";
import { PriceBreakdown } from "@/components/pricing/PriceBreakdown";
import { UpsellSuggestions } from "@/components/pricing/UpsellSuggestions";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { buildStayLink, STAYS_BOOKING_MODE, PARTNER_LABEL } from "@/lib/affiliate-links";
import { logAffiliateClick } from "@/lib/affiliate-clicks.functions";
import { ExternalLink } from "lucide-react";

const staysSearchSchema = z.object({
  query: fallback(z.string(), "").default(""),
  check_in_date: fallback(z.string(), "").default(""),
  check_out_date: fallback(z.string(), "").default(""),
  guests: fallback(z.number(), 0).default(0),
  auto: fallback(z.boolean(), false).default(false),
});

export const Route = createFileRoute("/_app/stays")({
  validateSearch: zodValidator(staysSearchSchema),
  component: StaysPage,
});

function tomorrowISO(offset = 1) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function StaysPage() {
  const { user } = useAuth();
  const searchFn = useServerFn(searchStays);
  const ratesFn = useServerFn(getStayRates);
  const bookFn = useServerFn(createStayBooking);
  const settingsFn = useServerFn(getCommissionSettings);
  const providerStatusFn = useServerFn(getStaysProviderStatus);
  const sp = Route.useSearch();
  const settingsQuery = useQuery({ queryKey: ["commission-settings"], queryFn: () => settingsFn(), retry: false });
  const providerQuery = useQuery({
    queryKey: ["stays-provider-status"],
    queryFn: () => providerStatusFn(),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });


  const [form, setForm] = React.useState(() => ({
    query: sp.query || "Lisboa",
    check_in_date: sp.check_in_date || tomorrowISO(1),
    check_out_date: sp.check_out_date || tomorrowISO(4),
    guests: sp.guests || 2,
    rooms: 1,
  }));

  const [results, setResults] = React.useState<any[]>([]);
  const [selected, setSelected] = React.useState<any | null>(null);
  const [details, setDetails] = React.useState<any | null>(null);
  const [bookingRate, setBookingRate] = React.useState<any | null>(null);
  const [guest, setGuest] = React.useState({
    given_name: "",
    family_name: "",
    email: user?.email || "",
    phone_number: "",
  });

  const [apiUnavailable, setApiUnavailable] = React.useState(false);
  const providerUnavailable = providerQuery.data?.unavailable ?? false;
  const affiliateId = providerQuery.data?.booking_affiliate_id ?? null;
  const redirectMode = STAYS_BOOKING_MODE === "redirect";
  const showFallback = redirectMode || apiUnavailable || providerUnavailable;

  const logClickFn = useServerFn(logAffiliateClick);
  function openPartnerStay(partner: "booking" | "hotels" | "airbnb") {
    const url = buildStayLink(
      {
        query: form.query,
        check_in_date: form.check_in_date,
        check_out_date: form.check_out_date,
        guests: form.guests,
        rooms: form.rooms,
      },
      partner,
    );
    window.open(url, "_blank", "noopener,noreferrer");
    logClickFn({
      data: {
        partner,
        kind: "stay",
        payload: {
          query: form.query,
          check_in: form.check_in_date,
          check_out: form.check_out_date,
          guests: form.guests,
          rooms: form.rooms,
        },
      },
    }).catch(() => {});
  }

  const bookingFallback = React.useMemo(() => {
    const q = encodeURIComponent(form.query || "");
    const aid = affiliateId ? `&aid=${encodeURIComponent(affiliateId)}` : "";
    return `https://www.booking.com/searchresults.html?ss=${q}&checkin=${form.check_in_date}&checkout=${form.check_out_date}&group_adults=${form.guests}${aid}`;
  }, [form, affiliateId]);

  const isUnavailableError = (msg: string) =>
    /\b(401|403|404)\b/.test(msg) ||
    /forbidden|not[_ ]found|unauthori[sz]ed|insufficient[_ ]scope|not enabled/i.test(msg);

  const search = useMutation({
    mutationFn: () => searchFn({ data: form }),
    onSuccess: (d: any) => {
      if (d?.unavailable) {
        setApiUnavailable(true);
        setResults([]);
        toast.error("Hospedagens indisponíveis no momento", {
          description: "Abrindo busca no Booking.com…",
          action: { label: "Abrir Booking", onClick: () => window.open(bookingFallback, "_blank", "noopener,noreferrer") },
        });
        return;
      }
      setApiUnavailable(false);
      setResults(d.results);
      if (!d.results.length) toast.message("Nenhum resultado encontrado");
    },
    onError: (e) => {
      const msg = (e as Error).message || "";
      if (isUnavailableError(msg)) {
        setApiUnavailable(true);
        toast.error("Hospedagens indisponíveis no momento", {
          description: "Abrindo busca no Booking.com…",
          action: { label: "Abrir Booking", onClick: () => window.open(bookingFallback, "_blank", "noopener,noreferrer") },
        });
      } else {
        toast.error(msg);
      }
    },
  });


  // Auto-trigger when arriving from a deal (?auto=true)
  const autoRan = React.useRef(false);
  React.useEffect(() => {
    if (sp.auto && !autoRan.current && form.query) {
      autoRan.current = true;
      search.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.auto]);

  const loadRates = useMutation({
    mutationFn: (id: string) => ratesFn({ data: { search_result_id: id } }),
    onSuccess: (d) => setDetails(d),
    onError: (e) => toast.error((e as Error).message),
  });

  const book = useMutation({
    mutationFn: () =>
      bookFn({
        data: {
          rate_id: bookingRate.id,
          email: guest.email,
          phone_number: guest.phone_number,
          guests: [
            { given_name: guest.given_name, family_name: guest.family_name },
          ],
        },
      }),
    onSuccess: (d) => {
      toast.success(`Reserva confirmada! Ref: ${d.reference || d.id}`);
      setBookingRate(null);
      setSelected(null);
      setDetails(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const openDetails = (r: any) => {
    setSelected(r);
    setDetails(null);
    loadRates.mutate(r.id);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
          <BedDouble className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Hospedagem</h1>
          <p className="text-sm text-muted-foreground">
            Hotéis, hostels e apartamentos com reserva e pagamento
          </p>
        </div>
      </div>

      {/* Search form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          search.mutate();
        }}
        className="grid gap-3 rounded-2xl border border-border bg-card/60 p-4 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]"
      >
        <div className="space-y-1.5">
          <Label>Destino ou hotel</Label>
          <Input
            value={form.query}
            onChange={(e) => setForm({ ...form, query: e.target.value })}
            placeholder="Ex: Lisboa, Tóquio, Hotel X"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Check-in</Label>
          <Input
            type="date"
            min={tomorrowISO(0)}
            value={form.check_in_date}
            onChange={(e) =>
              setForm({ ...form, check_in_date: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Check-out</Label>
          <Input
            type="date"
            min={form.check_in_date || tomorrowISO(1)}
            value={form.check_out_date}
            onChange={(e) =>
              setForm({ ...form, check_out_date: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Hóspedes</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={form.guests}
            onChange={(e) =>
              setForm({ ...form, guests: Number(e.target.value) })
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label>Quartos</Label>
          <Input
            type="number"
            min={1}
            max={5}
            value={form.rooms}
            onChange={(e) =>
              setForm({ ...form, rooms: Number(e.target.value) })
            }
          />
        </div>
        <div className="flex items-end">
          <Button
            type="submit"
            disabled={search.isPending}
            className="bg-gradient-primary shadow-glow"
          >
            {search.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Buscar
          </Button>
        </div>
      </form>

      {showFallback && (
        <div className="mt-6 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-card p-5">
          <div className="mb-1 text-sm font-semibold">
            {redirectMode ? "Compare e reserve nos parceiros" : "Reservas internas em habilitação"}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            {redirectMode
              ? "Enquanto habilitamos reservas diretas no app, sua busca abre nos maiores portais — mesmos preços, reserva imediata e proteção do parceiro."
              : `Estamos concluindo a aprovação do nosso provedor de hospedagens. Enquanto isso, sua busca abre no Booking.com${affiliateId ? " com nossa parceria oficial" : ""} — mesmos preços, reserva imediata.`}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openPartnerStay("booking")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow hover:opacity-90"
            >
              {PARTNER_LABEL.booking} <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openPartnerStay("hotels")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium hover:border-primary/60"
            >
              {PARTNER_LABEL.hotels} <ExternalLink className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openPartnerStay("airbnb")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-sm font-medium hover:border-primary/60"
            >
              {PARTNER_LABEL.airbnb} <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}


      {/* Results */}
      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => openDetails(r)}
            className="group overflow-hidden rounded-2xl border border-border bg-card text-left transition hover:border-primary/50"
          >
            <div
              className="h-40 bg-muted bg-cover bg-center"
              style={{
                backgroundImage: r.accommodation.photos?.[0]
                  ? `url(${r.accommodation.photos[0]})`
                  : undefined,
              }}
            />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-tight">
                  {r.accommodation.name}
                </h3>
                {r.accommodation.rating ? (
                  <div className="flex shrink-0 items-center gap-0.5 text-xs text-amber-400">
                    <Star className="h-3 w-3 fill-current" />
                    {r.accommodation.rating}
                  </div>
                ) : null}
              </div>
              {r.accommodation.location?.address ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {[
                    r.accommodation.location.address.line_one,
                    r.accommodation.location.address.city_name,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              ) : null}
              <div className="mt-3 text-sm">
                <span className="text-lg font-bold text-primary">
                  {r.cheapest_rate_currency} {r.cheapest_rate_total_amount}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  total
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Details / rates dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected?.accommodation?.name}</DialogTitle>
          </DialogHeader>

          {loadRates.isPending && (
            <div className="grid place-items-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {details && (
            <div className="space-y-4">
              {details.accommodation.photos?.[0] && (
                <img
                  src={details.accommodation.photos[0]}
                  alt={details.accommodation.name}
                  className="h-56 w-full rounded-lg object-cover"
                />
              )}
              {details.accommodation.description && (
                <p className="text-sm text-muted-foreground line-clamp-4">
                  {details.accommodation.description}
                </p>
              )}
              <div>
                <h4 className="mb-2 text-sm font-semibold">
                  Tarifas disponíveis
                </h4>
                <div className="space-y-2">
                  {details.rates.map((rate: any) => (
                    <div
                      key={rate.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">
                          {rate.room_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {rate.board_type || "Sem refeição"} ·{" "}
                          {rate.payment_type}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-bold">
                            {rate.total_currency} {rate.total_amount}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => setBookingRate(rate)}
                          className="bg-gradient-primary"
                        >
                          Reservar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!details.rates.length && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma tarifa disponível.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Booking dialog */}
      <Dialog
        open={!!bookingRate}
        onOpenChange={(o) => !o && setBookingRate(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar reserva</DialogTitle>
          </DialogHeader>
          {bookingRate && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                book.mutate();
              }}
              className="space-y-3"
            >
              <div className="rounded-lg bg-muted/30 p-3 text-sm">
                <div className="font-medium">{bookingRate.room_name}</div>
                <div className="text-muted-foreground">
                  Tarifa base:{" "}
                  <span className="font-bold text-foreground">
                    {bookingRate.total_currency} {bookingRate.total_amount}
                  </span>
                </div>
              </div>
              <PriceBreakdown
                originalAmount={bookingRate.total_amount}
                currency={bookingRate.total_currency}
                settings={settingsQuery.data ?? undefined}
                compact
              />
              <UpsellSuggestions
                kind="stay"
                currency={bookingRate.total_currency}
                enabled={settingsQuery.data?.upsells_enabled ?? true}
              />
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={guest.given_name}
                    onChange={(e) =>
                      setGuest({ ...guest, given_name: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Sobrenome</Label>
                  <Input
                    value={guest.family_name}
                    onChange={(e) =>
                      setGuest({ ...guest, family_name: e.target.value })
                    }
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={guest.email}
                  onChange={(e) =>
                    setGuest({ ...guest, email: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={guest.phone_number}
                  onChange={(e) =>
                    setGuest({ ...guest, phone_number: e.target.value })
                  }
                  placeholder="+5511999999999"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={book.isPending}
                className="w-full bg-gradient-primary shadow-glow"
              >
                {book.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Pagar e confirmar
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Pagamento processado via saldo Duffel (modo teste).
              </p>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
