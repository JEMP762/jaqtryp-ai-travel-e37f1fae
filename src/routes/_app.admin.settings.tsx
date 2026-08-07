import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings, Save, BarChart3, Plane } from "lucide-react";
import { getCommissionSettings, updateCommissionSettings } from "@/lib/pricing.functions";
import { checkIsAdmin } from "@/lib/commission.functions";

export const Route = createFileRoute("/_app/admin/settings")({
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const checkFn = useServerFn(checkIsAdmin);
  const getFn = useServerFn(getCommissionSettings);
  const updateFn = useServerFn(updateCommissionSettings);
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkFn(), retry: false });
  const settingsQ = useQuery({
    queryKey: ["commission-settings"],
    queryFn: () => getFn(),
    enabled: adminQ.data?.isAdmin === true,
  });

  const [form, setForm] = useState({
    markup_type: "percent" as "percent" | "fixed",
    markup_value: 3,
    service_fee_type: "fixed" as "percent" | "fixed",
    service_fee_value: 18,
    default_currency: "BRL",
    upsells_enabled: true,
  });

  useEffect(() => {
    if (settingsQ.data) setForm(settingsQ.data as any);
  }, [settingsQ.data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: form }),
    onSuccess: () => {
      toast.success("Configurações salvas");
      settingsQ.refetch();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  if (adminQ.isLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!adminQ.data?.isAdmin) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        <h1 className="text-xl font-bold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Apenas administradores podem alterar a monetização.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-10">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Settings className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Monetização</h1>
            <p className="text-sm text-muted-foreground">Defina markup, taxa de serviço e upsells</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/financial" className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/60">
            <BarChart3 className="h-4 w-4" /> Painel
          </Link>
          <Link to="/admin/mystifly" className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm hover:border-primary/60">
            <Plane className="h-4 w-4" /> Mystifly
          </Link>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="space-y-5 rounded-2xl border border-border/60 bg-card p-6"
      >
        <Section title="Markup (margem JAQTRYP)">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <select
                value={form.markup_type}
                onChange={(e) => setForm({ ...form, markup_type: e.target.value as any })}
                className="input"
              >
                <option value="percent">Percentual (%)</option>
                <option value="fixed">Valor fixo</option>
              </select>
            </Field>
            <Field label={form.markup_type === "percent" ? "Valor (%)" : "Valor"}>
              <input
                type="number" step="0.01" min={0}
                value={form.markup_value}
                onChange={(e) => setForm({ ...form, markup_value: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
        </Section>

        <Section title="Taxa de serviço">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <select
                value={form.service_fee_type}
                onChange={(e) => setForm({ ...form, service_fee_type: e.target.value as any })}
                className="input"
              >
                <option value="fixed">Valor fixo</option>
                <option value="percent">Percentual (%)</option>
              </select>
            </Field>
            <Field label={form.service_fee_type === "percent" ? "Valor (%)" : "Valor"}>
              <input
                type="number" step="0.01" min={0}
                value={form.service_fee_value}
                onChange={(e) => setForm({ ...form, service_fee_value: Number(e.target.value) })}
                className="input"
              />
            </Field>
          </div>
        </Section>

        <Section title="Geral">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Moeda padrão">
              <input
                value={form.default_currency}
                onChange={(e) => setForm({ ...form, default_currency: e.target.value.toUpperCase() })}
                maxLength={4}
                className="input"
              />
            </Field>
            <Field label="Upsells">
              <label className="inline-flex items-center gap-2 pt-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.upsells_enabled}
                  onChange={(e) => setForm({ ...form, upsells_enabled: e.target.checked })}
                />
                Exibir sugestões no checkout
              </label>
            </Field>
          </div>
        </Section>

        <button
          type="submit"
          disabled={save.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Salvar configurações
        </button>
      </form>

      <style>{`
        .input { width: 100%; background: hsl(var(--background) / 0.6); border: 1px solid hsl(var(--border)); border-radius: 0.625rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold">{title}</div>
      {children}
    </div>
  );
}
