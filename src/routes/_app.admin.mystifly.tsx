import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Plane,
  Save,
  PlugZap,
  Activity,
  AlertTriangle,
  Timer,
  FlaskConical,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { checkIsAdmin } from "@/lib/commission.functions";
import {
  mystiflyDashboard,
  mystiflyLogs,
  mystiflySaveSettings,
  mystiflyTestConnection,
} from "@/lib/mystifly.functions";

export const Route = createFileRoute("/_app/admin/mystifly")({
  component: MystiflyAdminPage,
  head: () => ({
    meta: [
      { title: "Mystifly API | Administração JAQTRYP" },
      {
        name: "description",
        content:
          "Configuração, status de conexão e monitoramento da integração Mystifly na JAQTRYP.",
      },
      { property: "og:title", content: "Mystifly API | Administração JAQTRYP" },
      {
        property: "og:description",
        content: "Painel administrativo da integração Mystifly.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MystiflyAdminPage() {
  const checkFn = useServerFn(checkIsAdmin);
  const dashFn = useServerFn(mystiflyDashboard);
  const logsFn = useServerFn(mystiflyLogs);
  const saveFn = useServerFn(mystiflySaveSettings);
  const testFn = useServerFn(mystiflyTestConnection);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkFn(), retry: false });
  const enabled = adminQ.data?.isAdmin === true;

  const dashQ = useQuery({
    queryKey: ["mystifly-dashboard"],
    queryFn: () => dashFn(),
    enabled,
    refetchInterval: 30000,
  });
  const logsQ = useQuery({
    queryKey: ["mystifly-logs"],
    queryFn: () => logsFn({ data: { limit: 25 } }),
    enabled,
  });

  const [form, setForm] = useState({
    environment: "sandbox" as "sandbox" | "production",
    timeoutMs: 30000,
    maxRetries: 2,
    cacheTtlSeconds: 900,
  });

  useEffect(() => {
    if (dashQ.data) {
      setForm({
        environment: dashQ.data.environment as "sandbox" | "production",
        timeoutMs: dashQ.data.settings.timeoutMs,
        maxRetries: dashQ.data.settings.maxRetries,
        cacheTtlSeconds: dashQ.data.settings.cacheTtlSeconds,
      });
    }
  }, [dashQ.data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: form }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      dashQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const test = useMutation({
    mutationFn: () => testFn(),
    onSuccess: (r: any) => {
      if (r.ok) toast.success(`Conexão OK em ${r.durationMs}ms`);
      else toast.error(r.message);
      dashQ.refetch();
      logsQ.refetch();
    },
    onError: (e: any) => toast.error(e?.message || "Falha no teste"),
  });

  if (adminQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!enabled) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Somente administradores podem configurar a integração Mystifly.
        </p>
      </div>
    );
  }

  const d = dashQ.data;
  const creds = d?.credentials;
  const missingCreds =
    creds && (!creds.baseUrl || !creds.username || !creds.password);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Plane className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mystifly API</h1>
            <p className="text-sm text-muted-foreground">
              Configuração, status da conexão e monitoramento da integração
            </p>
          </div>
        </div>
        <Link
          to="/admin/mystifly/test"
          className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/60"
        >
          <FlaskConical className="h-4 w-4" /> Tela de testes
        </Link>
      </div>

      {missingCreds && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium">Credenciais ausentes</p>
            <p className="text-muted-foreground">
              Cadastre as credenciais da Mystifly nos segredos do backend
              (Base URL, usuário e senha) para habilitar as chamadas reais.
            </p>
          </div>
        </div>
      )}

      {/* Dashboard */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          icon={<PlugZap className="h-4 w-4" />}
          label="Status da API"
          value={
            d?.connectionStatus === "ok"
              ? "Conectado"
              : d?.connectionStatus === "error"
                ? "Erro"
                : "Não testado"
          }
          hint={d?.connectionMessage || d?.lastSyncAt ? `Última sincronização: ${fmtDate(d?.lastSyncAt)}` : undefined}
        />
        <Kpi
          icon={<Timer className="h-4 w-4" />}
          label="Sessão ativa"
          value={d?.session.active ? `${d.session.remainingSeconds}s restantes` : "Sem sessão"}
        />
        <Kpi
          icon={<Activity className="h-4 w-4" />}
          label="Requisições (24h)"
          value={String(d?.stats.requests24h ?? 0)}
          hint={`Tempo médio: ${d?.stats.avgResponseMs ?? 0}ms`}
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Erros (24h)"
          value={String(d?.stats.errors24h ?? 0)}
        />
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-3">
        <LastCard title="Último Search" row={d?.lastSearch} />
        <LastCard title="Último Booking" row={d?.lastBooking} />
        <LastCard title="Último Ticket" row={d?.lastTicket} />
      </section>

      {/* Configuração */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="mb-6 space-y-5 rounded-2xl border border-border/60 bg-card p-6"
      >
        <h2 className="text-lg font-semibold">Configurações</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ambiente">
            <select
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              value={form.environment}
              onChange={(e) =>
                setForm({ ...form, environment: e.target.value as "sandbox" | "production" })
              }
            >
              <option value="sandbox">Sandbox (homologação)</option>
              <option value="production">Produção</option>
            </select>
          </Field>
          <Field label="Tempo limite (ms)">
            <input
              type="number"
              min={3000}
              max={120000}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              value={form.timeoutMs}
              onChange={(e) => setForm({ ...form, timeoutMs: Number(e.target.value) })}
            />
          </Field>
          <Field label="Máximo de tentativas">
            <input
              type="number"
              min={0}
              max={5}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              value={form.maxRetries}
              onChange={(e) => setForm({ ...form, maxRetries: Number(e.target.value) })}
            />
          </Field>
          <Field label="Tempo de cache da sessão (s)">
            <input
              type="number"
              min={0}
              max={86400}
              className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm"
              value={form.cacheTtlSeconds}
              onChange={(e) => setForm({ ...form, cacheTtlSeconds: Number(e.target.value) })}
            />
          </Field>
        </div>

        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm">
          <p className="mb-2 font-medium">Credenciais (armazenadas com segurança no backend)</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            <CredRow label="Base URL" ok={!!creds?.baseUrl} />
            <CredRow label="Usuário" ok={!!creds?.username} />
            <CredRow label="Senha" ok={!!creds?.password} />
            <CredRow label="API Key (opcional)" ok={!!creds?.apiKey} />
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            Os valores nunca são exibidos nem enviados ao navegador.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {save.isPending ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={() => test.mutate()}
            disabled={test.isPending}
            className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2 text-sm hover:border-primary/60 disabled:opacity-60"
          >
            <PlugZap className="h-4 w-4" /> {test.isPending ? "Testando…" : "Testar conexão"}
          </button>
        </div>
      </form>

      {/* Logs */}
      <section className="rounded-2xl border border-border/60 bg-card p-6">
        <h2 className="mb-3 text-lg font-semibold">Últimas chamadas</h2>
        {logsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : !logsQ.data?.rows?.length ? (
          <p className="text-sm text-muted-foreground">Nenhuma chamada registrada ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">Data</th>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Tempo</th>
                  <th>Erro</th>
                </tr>
              </thead>
              <tbody>
                {logsQ.data.rows.map((r: any) => (
                  <tr key={r.id} className="border-t border-border/40">
                    <td className="py-2 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    <td className="whitespace-nowrap">{r.endpoint}</td>
                    <td>
                      <span
                        className={
                          r.success
                            ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                            : "rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                        }
                      >
                        {r.http_status ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">{r.duration_ms ?? 0}ms</td>
                    <td className="max-w-[280px] truncate text-muted-foreground">{r.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function fmtDate(v?: string | null) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4">
      <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
        {icon} {label}
      </div>
      <div className="text-lg font-semibold">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function LastCard({ title, row }: { title: string; row: any }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm">
      <div className="text-xs uppercase text-muted-foreground">{title}</div>
      {row ? (
        <>
          <div className="mt-1 font-medium">{fmtDate(row.created_at)}</div>
          <div className="text-xs text-muted-foreground">
            {row.mf_reference || row.booking_id || "sem referência"} · {row.duration_ms ?? 0}ms
          </div>
        </>
      ) : (
        <div className="mt-1 text-muted-foreground">Nenhum registro</div>
      )}
    </div>
  );
}

function CredRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 text-primary" />
      ) : (
        <XCircle className="h-4 w-4 text-destructive" />
      )}
      <span>{label}</span>
      <span className="text-xs text-muted-foreground">{ok ? "configurado" : "ausente"}</span>
    </li>
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
