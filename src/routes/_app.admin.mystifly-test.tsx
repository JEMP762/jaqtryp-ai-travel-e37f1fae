import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { FlaskConical, Play, ArrowLeft } from "lucide-react";
import { checkIsAdmin } from "@/lib/commission.functions";
import { mystiflyRunEndpoint } from "@/lib/mystifly.functions";
import { MYSTIFLY_ENDPOINT_LABELS, type MystiflyEndpointKey } from "@/lib/mystifly/types";

export const Route = createFileRoute("/_app/admin/mystifly-test")({
  component: MystiflyTestPage,
  head: () => ({
    meta: [
      { title: "Testes Mystifly | Administração JAQTRYP" },
      {
        name: "description",
        content:
          "Execute manualmente cada endpoint da Mystifly e inspecione requisição, resposta e tempo.",
      },
      { property: "og:title", content: "Testes Mystifly | Administração JAQTRYP" },
      {
        property: "og:description",
        content: "Console de testes dos endpoints Mystifly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SAMPLES: Partial<Record<MystiflyEndpointKey, string>> = {
  createSession: "{}",
  searchLowestFare: JSON.stringify(
    {
      tripType: "OneWay",
      cabinClass: "Economy",
      adults: 1,
      children: 0,
      infants: 0,
      segments: [
        { origin: "GRU", destination: "LIS", departureDate: "2026-09-15" },
      ],
    },
    null,
    2,
  ),
  searchBrandedFare: JSON.stringify(
    {
      tripType: "Return",
      cabinClass: "Economy",
      adults: 1,
      children: 0,
      infants: 0,
      segments: [
        { origin: "GRU", destination: "LIS", departureDate: "2026-09-15" },
        { origin: "LIS", destination: "GRU", departureDate: "2026-09-25" },
      ],
    },
    null,
    2,
  ),
  revalidate: '{\n  "fareSourceCode": ""\n}',
  fareRules: '{\n  "fareSourceCode": ""\n}',
  bookFlight: JSON.stringify(
    {
      fareSourceCode: "",
      hold: false,
      email: "contact@jaqtryp.com",
      phone: "+5511999999999",
      passengers: [
        {
          type: "ADT",
          title: "Mr",
          firstName: "Joao",
          lastName: "Silva",
          gender: "M",
          dateOfBirth: "1990-01-01",
          nationality: "BR",
        },
      ],
    },
    null,
    2,
  ),
  orderTicket: '{\n  "uniqueId": ""\n}',
  tripDetails: '{\n  "uniqueId": ""\n}',
  bookingCancel: '{\n  "uniqueId": ""\n}',
  bookingNotes: '{\n  "uniqueId": "",\n  "note": "Teste de homologação"\n}',
  invoiceSearch: '{\n  "fromDate": "2026-01-01",\n  "toDate": "2026-12-31"\n}',
  postTicketingRequest:
    '{\n  "uniqueId": "",\n  "requestType": "Void",\n  "remarks": "Teste"\n}',
  ptrSearch: '{\n  "fromDate": "2026-01-01",\n  "toDate": "2026-12-31"\n}',
  scheduleChange: '{\n  "fromDate": "2026-01-01",\n  "toDate": "2026-12-31"\n}',
  creditNote: '{\n  "fromDate": "2026-01-01",\n  "toDate": "2026-12-31"\n}',
};

function MystiflyTestPage() {
  const checkFn = useServerFn(checkIsAdmin);
  const runFn = useServerFn(mystiflyRunEndpoint);
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkFn(), retry: false });

  const [endpoint, setEndpoint] = useState<MystiflyEndpointKey>("createSession");
  const [payload, setPayload] = useState(SAMPLES.createSession || "{}");
  const [result, setResult] = useState<any>(null);

  const run = useMutation({
    mutationFn: async () => {
      let parsed: unknown = {};
      try {
        parsed = payload.trim() ? JSON.parse(payload) : {};
      } catch {
        throw new Error("JSON inválido no corpo da requisição");
      }
      return runFn({ data: { endpoint, payload: parsed } });
    },
    onSuccess: (r: any) => {
      setResult(r);
      if (r?.ok) toast.success(`OK em ${r.durationMs}ms`);
      else toast.error(r?.error || "Chamada retornou erro");
    },
    onError: (e: any) => {
      setResult(null);
      toast.error(e?.message || "Falha na execução");
    },
  });

  if (adminQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!adminQ.data?.isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Somente administradores podem executar testes da Mystifly.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <FlaskConical className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Testes Mystifly</h1>
            <p className="text-sm text-muted-foreground">
              Execute cada endpoint e inspecione a resposta completa
            </p>
          </div>
        </div>
        <Link
          to="/admin/mystifly"
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/60"
        >
          <ArrowLeft className="h-4 w-4" /> Painel
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Endpoint
          </label>
          <select
            className="mb-4 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
            value={endpoint}
            onChange={(e) => {
              const key = e.target.value as MystiflyEndpointKey;
              setEndpoint(key);
              setPayload(SAMPLES[key] || "{}");
              setResult(null);
            }}
          >
            {Object.entries(MYSTIFLY_ENDPOINT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Corpo da requisição (JSON)
          </label>
          <textarea
            className="h-72 w-full rounded-xl border border-border/60 bg-background p-3 font-mono text-xs"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            spellCheck={false}
          />

          <button
            type="button"
            onClick={() => run.mutate()}
            disabled={run.isPending}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Play className="h-4 w-4" /> {run.isPending ? "Executando…" : "Executar"}
          </button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Resposta</h2>
            {result && (
              <span className="text-xs text-muted-foreground">
                HTTP {result.httpStatus ?? "—"} · {result.durationMs ?? 0}ms
              </span>
            )}
          </div>
          {!result ? (
            <p className="text-sm text-muted-foreground">
              Execute um endpoint para ver a resposta aqui.
            </p>
          ) : (
            <>
              {result.error && (
                <p className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {result.error}
                </p>
              )}
              <pre className="max-h-[28rem] overflow-auto rounded-xl bg-muted/40 p-3 font-mono text-[11px] leading-relaxed">
                {JSON.stringify(result.data ?? result, null, 2)}
              </pre>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
