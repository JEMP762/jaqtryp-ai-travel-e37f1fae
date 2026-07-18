import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { handleCreditError } from "@/lib/credit-error";
import {
  Wallet,
  Plus,
  Camera,
  Sparkles,
  TrendingDown,
  Loader2,
  Trash2,
  ArrowRightLeft,
  Lock,
  PiggyBank,
  Send,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  listWallets,
  createWallet,
  deleteWallet,
  listExpenses,
  createExpense,
  deleteExpense,
  getWalletSummary,
  setBudget,
  suggestBudget,
  getWalletQuota,
} from "@/lib/wallet.functions";
import { scanReceipt, askWalletAi, advisorReport, fxAsk } from "@/lib/wallet-ai.functions";
import { getFxRate } from "@/lib/fx.functions";

export const Route = createFileRoute("/_app/wallet")({
  component: WalletPage,
});

const CURRENCIES = ["BRL", "USD", "EUR", "GBP", "JPY", "ARS", "CAD", "AUD", "CHF", "MXN", "CLP", "CNY"];
const CATEGORIES = [
  { v: "food", l: "Alimentação" },
  { v: "transport", l: "Transporte" },
  { v: "lodging", l: "Hospedagem" },
  { v: "shopping", l: "Compras" },
  { v: "leisure", l: "Lazer" },
  { v: "health", l: "Saúde" },
  { v: "fees", l: "Taxas" },
  { v: "other", l: "Outros" },
];
const CAT_LABEL = Object.fromEntries(CATEGORIES.map((c) => [c.v, c.l]));
const PIE_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#06b6d4", "#a855f7", "#ef4444", "#64748b"];

function fmt(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function ProBadge() {
  return (
    <Badge variant="outline" className="ml-2 border-primary/50 text-primary">
      <Sparkles className="mr-1 h-3 w-3" /> Pro
    </Badge>
  );
}

function UpgradeBanner({ message }: { message: string }) {
  return (
    <Card className="border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-5 w-5 text-primary" />
        <div className="flex-1">
          <p className="text-sm">{message}</p>
          <Button asChild size="sm" className="mt-2">
            <Link to="/billing">Fazer upgrade</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function WalletPage() {
  const _listWallets = useServerFn(listWallets);
  const _createWallet = useServerFn(createWallet);
  const _deleteWallet = useServerFn(deleteWallet);
  const _getQuota = useServerFn(getWalletQuota);

  const [wallets, setWallets] = React.useState<any[]>([]);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [quota, setQuota] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [creating, setCreating] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const [w, q] = await Promise.all([_listWallets({}), _getQuota({})]);
    setWallets(w.wallets);
    setQuota(q);
    if (!activeId && w.wallets.length) setActiveId(w.wallets[0].id);
    setLoading(false);
  }, [_listWallets, _getQuota, activeId]);

  React.useEffect(() => {
    refresh().catch((e) => {
      console.error(e);
      setLoading(false);
    });
  }, []); // eslint-disable-line

  const active = wallets.find((w) => w.id === activeId) || null;

  const handleCreate = async (form: { name: string; currency: string; initial: number }) => {
    try {
      const res = await _createWallet({
        data: {
          name: form.name,
          main_currency: form.currency,
          initial_balance: form.initial,
        },
      });
      toast.success("Carteira criada");
      setCreating(false);
      setActiveId(res.wallet.id);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar carteira");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover esta carteira e suas despesas?")) return;
    try {
      await _deleteWallet({ data: { id } });
      toast.success("Carteira removida");
      if (activeId === id) setActiveId(null);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Wallet className="h-7 w-7 text-primary" />
            Carteira IA Global
          </h1>
          <p className="text-sm text-muted-foreground">
            Assistente financeiro inteligente para viajantes.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {quota && !quota.isPro && (
            <Badge variant="outline" className="text-xs">
              {quota.expensesThisMonth}/{quota.expensesLimit} despesas no mês
            </Badge>
          )}
          <Button onClick={() => setCreating(true)} size="sm">
            <Plus className="mr-1 h-4 w-4" /> Nova carteira
          </Button>
        </div>
      </header>

      {wallets.length === 0 ? (
        <Card className="p-8 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground" />
          <h3 className="mt-3 text-lg font-semibold">Nenhuma carteira ainda</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie sua primeira carteira de viagem para começar a registrar despesas.
          </p>
          <Button className="mt-4" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-4 w-4" /> Criar carteira
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {wallets.map((w) => (
              <button
                key={w.id}
                onClick={() => setActiveId(w.id)}
                className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                  activeId === w.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border hover:bg-accent"
                }`}
              >
                <Wallet className="h-3.5 w-3.5" />
                {w.name} · {w.main_currency}
                <Trash2
                  className="ml-1 h-3.5 w-3.5 opacity-0 transition group-hover:opacity-60 hover:!opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(w.id);
                  }}
                />
              </button>
            ))}
          </div>

          {active && <WalletDetail wallet={active} isPro={!!quota?.isPro} />}
        </>
      )}

      <CreateWalletDialog open={creating} onOpenChange={setCreating} onCreate={handleCreate} />
    </div>
  );
}

function CreateWalletDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (f: { name: string; currency: string; initial: number }) => void;
}) {
  const [name, setName] = React.useState("Minha viagem");
  const [currency, setCurrency] = React.useState("BRL");
  const [initial, setInitial] = React.useState("0");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova carteira</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Moeda principal</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Saldo inicial</Label>
              <Input
                type="number"
                inputMode="decimal"
                value={initial}
                onChange={(e) => setInitial(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onCreate({
                name: name.trim() || "Carteira",
                currency,
                initial: Number(initial) || 0,
              })
            }
          >
            Criar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WalletDetail({ wallet, isPro }: { wallet: any; isPro: boolean }) {
  const _summary = useServerFn(getWalletSummary);
  const [summary, setSummary] = React.useState<any>(null);

  const refresh = React.useCallback(async () => {
    try {
      const s = await _summary({ data: { wallet_id: wallet.id } });
      setSummary(s);
    } catch (e) {
      console.error(e);
    }
  }, [_summary, wallet.id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="flex w-full flex-wrap">
        <TabsTrigger value="overview">Visão geral</TabsTrigger>
        <TabsTrigger value="expenses">Despesas</TabsTrigger>
        <TabsTrigger value="fx">Câmbio</TabsTrigger>
        <TabsTrigger value="budget">Orçamento</TabsTrigger>
        <TabsTrigger value="advisor">Consultor IA{!isPro && <Lock className="ml-1 h-3 w-3" />}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewPanel wallet={wallet} summary={summary} />
      </TabsContent>
      <TabsContent value="expenses">
        <ExpensesPanel wallet={wallet} isPro={isPro} onChange={refresh} />
      </TabsContent>
      <TabsContent value="fx">
        <FxPanel wallet={wallet} />
      </TabsContent>
      <TabsContent value="budget">
        <BudgetPanel wallet={wallet} summary={summary} onChange={refresh} />
      </TabsContent>
      <TabsContent value="advisor">
        <AdvisorPanel wallet={wallet} isPro={isPro} />
      </TabsContent>
    </Tabs>
  );
}

function OverviewPanel({ wallet, summary }: { wallet: any; summary: any }) {
  if (!summary) {
    return (
      <div className="grid place-items-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  const k = summary.kpis;
  const catData = Object.entries(summary.byCategory).map(([k, v]) => ({
    name: CAT_LABEL[k] || k,
    value: +(v as number).toFixed(2),
  }));
  const countryData = Object.entries(summary.byCountry).map(([k, v]) => ({
    name: k,
    value: +(v as number).toFixed(2),
  }));
  const series = summary.series;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Saldo" value={fmt(k.balance, wallet.main_currency)} />
        <Kpi label="Total gasto" value={fmt(k.totalSpent, wallet.main_currency)} />
        <Kpi label="Orçamento" value={k.totalBudget ? fmt(k.totalBudget, wallet.main_currency) : "—"} />
        <Kpi
          label="Restante"
          value={k.totalBudget ? fmt(k.remaining, wallet.main_currency) : "—"}
          tone={k.remaining < 0 ? "danger" : "ok"}
        />
      </div>

      {k.totalBudget > 0 && (
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Uso do orçamento</span>
            <span>{k.usagePct}%</span>
          </div>
          <Progress value={k.usagePct} />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Gastos por categoria</h3>
          {catData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem despesas ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={catData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {catData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: any) => fmt(Number(v), wallet.main_currency)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Evolução diária</h3>
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip formatter={(v: any) => fmt(Number(v), wallet.main_currency)} />
                <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#g)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {countryData.length > 0 && (
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Gastos por país</h3>
          <div className="flex flex-wrap gap-2">
            {countryData.map((c) => (
              <Badge key={c.name} variant="secondary">
                {c.name}: {fmt(c.value, wallet.main_currency)}
              </Badge>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "ok" | "danger" }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
    </Card>
  );
}

function ExpensesPanel({
  wallet,
  isPro,
  onChange,
}: {
  wallet: any;
  isPro: boolean;
  onChange: () => void;
}) {
  const _list = useServerFn(listExpenses);
  const _create = useServerFn(createExpense);
  const _del = useServerFn(deleteExpense);
  const _scan = useServerFn(scanReceipt);
  const [rows, setRows] = React.useState<any[]>([]);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [scanning, setScanning] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const r = await _list({ data: { wallet_id: wallet.id } });
    setRows(r.expenses);
  }, [_list, wallet.id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const [form, setForm] = React.useState({
    amount: "",
    currency: wallet.main_currency,
    category: "other",
    merchant: "",
    country: "",
    notes: "",
  });

  const add = async () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return toast.error("Informe um valor válido");
    try {
      await _create({
        data: {
          wallet_id: wallet.id,
          amount,
          currency: form.currency,
          category: form.category as any,
          merchant: form.merchant || undefined,
          country: form.country || undefined,
          notes: form.notes || undefined,
        },
      });
      toast.success("Despesa registrada");
      setForm({ ...form, amount: "", merchant: "", notes: "" });
      await refresh();
      onChange();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  const del = async (id: string) => {
    await _del({ data: { id } });
    await refresh();
    onChange();
  };

  const handleFile = async (file: File) => {
    if (!isPro) {
      toast.error("Scanner IA é exclusivo do plano pago.");
      return;
    }
    setScanning(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await _scan({ data: { image: dataUrl, wallet_id: wallet.id } });
      const s = res.suggestion;
      setForm({
        amount: String(s.amount),
        currency: s.currency,
        category: s.category,
        merchant: s.merchant || "",
        country: s.country || "",
        notes: "Importado via Scanner IA",
      });
      setScanOpen(false);
      toast.success("Recibo analisado — confira e salve.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao ler recibo");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Nova despesa</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setScanOpen(true)}
            className="gap-1"
          >
            <Camera className="h-4 w-4" /> Scanner IA {!isPro && <Lock className="ml-1 h-3 w-3" />}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-1">
            <Label>Valor</Label>
            <Input
              type="number"
              inputMode="decimal"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div>
            <Label>Moeda</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.v} value={c.v}>
                    {c.l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Estabelecimento</Label>
            <Input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
          </div>
          <div>
            <Label>País</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
          <div className="flex items-end">
            <Button onClick={add} className="w-full">
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          </div>
        </div>
        <div className="mt-3">
          <Label>Observações</Label>
          <Textarea
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Categoria</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2 text-right">Em {wallet.main_currency}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhuma despesa registrada.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-3 py-2 text-xs">{String(r.occurred_at).slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.merchant || "—"}</div>
                    {r.country && <div className="text-xs text-muted-foreground">{r.country}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs">{CAT_LABEL[r.category] || r.category}</td>
                  <td className="px-3 py-2 text-right">{fmt(Number(r.amount), r.currency)}</td>
                  <td className="px-3 py-2 text-right font-medium">
                    {fmt(Number(r.amount_in_main), wallet.main_currency)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" onClick={() => del(r.id)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center">
              Scanner IA <ProBadge />
            </DialogTitle>
          </DialogHeader>
          {!isPro ? (
            <UpgradeBanner message="O Scanner IA extrai automaticamente valor, moeda, data, categoria e estabelecimento de fotos de recibos. Disponível no plano pago." />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Envie uma foto, print, recibo ou nota fiscal. A IA preenche os campos para você revisar.
              </p>
              <Input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                disabled={scanning}
              />
              {scanning && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Analisando recibo…
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FxPanel({ wallet }: { wallet: any }) {
  const _fx = useServerFn(getFxRate);
  const _ask = useServerFn(fxAsk);
  const [amount, setAmount] = React.useState("100");
  const [from, setFrom] = React.useState("USD");
  const [to, setTo] = React.useState(wallet.main_currency);
  const [rate, setRate] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [prompt, setPrompt] = React.useState("");
  const [aiResult, setAiResult] = React.useState<any>(null);

  const convert = async () => {
    setLoading(true);
    try {
      const r = await _fx({ data: { base: from, quote: to } });
      setRate(r.rate);
    } catch {
      toast.error("Câmbio indisponível");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    convert();
    // eslint-disable-next-line
  }, [from, to]);

  const askAI = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    try {
      const r = await _ask({ data: { prompt } });
      setAiResult(r);
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  const converted = rate && amount ? Number(amount) * rate : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ArrowRightLeft className="h-4 w-4 text-primary" /> Conversor de moedas
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>De</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Para</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3">
          <Label>Valor</Label>
          <Input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="mt-4 rounded-lg bg-muted/40 p-3 text-center">
          {loading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                {fmt(Number(amount) || 0, from)} =
              </div>
              <div className="text-2xl font-bold text-primary">{fmt(converted, to)}</div>
              {rate && (
                <div className="mt-1 text-xs text-muted-foreground">
                  1 {from} = {rate.toFixed(4)} {to}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Câmbio IA — pergunte em texto livre
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Ex: "Quanto são 500 euros em reais?" · "Converter 100 dólares para euros"
        </p>
        <div className="flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Pergunte sobre câmbio…"
            onKeyDown={(e) => e.key === "Enter" && askAI()}
          />
          <Button onClick={askAI} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        {aiResult && (
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">
              {fmt(aiResult.amount, aiResult.from)} =
            </div>
            <div className="text-xl font-bold text-primary">
              {fmt(aiResult.result, aiResult.to)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              1 {aiResult.from} = {Number(aiResult.rate).toFixed(4)} {aiResult.to}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function BudgetPanel({
  wallet,
  summary,
  onChange,
}: {
  wallet: any;
  summary: any;
  onChange: () => void;
}) {
  const _set = useServerFn(setBudget);
  const _suggest = useServerFn(suggestBudget);
  const b = summary?.budget;
  const [total, setTotal] = React.useState(String(b?.total_budget || 0));
  const [daily, setDaily] = React.useState(String(b?.daily_budget || 0));
  const [reserve, setReserve] = React.useState(String(b?.emergency_reserve || 0));
  const [destination, setDestination] = React.useState("");
  const [days, setDays] = React.useState("7");
  const [style, setStyle] = React.useState<"budget" | "standard" | "premium">("standard");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (b) {
      setTotal(String(b.total_budget));
      setDaily(String(b.daily_budget));
      setReserve(String(b.emergency_reserve));
    }
  }, [b]);

  const save = async () => {
    setSaving(true);
    try {
      await _set({
        data: {
          wallet_id: wallet.id,
          total_budget: Number(total) || 0,
          daily_budget: Number(daily) || 0,
          emergency_reserve: Number(reserve) || 0,
          currency: wallet.main_currency,
        },
      });
      toast.success("Orçamento salvo");
      onChange();
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  const suggest = async () => {
    if (!destination.trim()) return toast.error("Informe o destino");
    setSaving(true);
    try {
      const r = await _suggest({
        data: {
          destination,
          days: Math.max(1, Number(days) || 1),
          currency: wallet.main_currency,
          style,
        },
      });
      setTotal(String(r.total_budget));
      setDaily(String(r.daily_budget));
      setReserve(String(r.emergency_reserve));
      toast.success("Sugestão gerada — revise e salve.");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <PiggyBank className="h-4 w-4 text-primary" /> Orçamento da viagem
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Total ({wallet.main_currency})</Label>
            <Input type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Diário</Label>
              <Input type="number" value={daily} onChange={(e) => setDaily(e.target.value)} />
            </div>
            <div>
              <Label>Reserva emergência</Label>
              <Input type="number" value={reserve} onChange={(e) => setReserve(e.target.value)} />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null} Salvar orçamento
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Sugestão automática
        </h3>
        <div className="space-y-3">
          <div>
            <Label>Destino</Label>
            <Input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="Ex: Paris, França"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias</Label>
              <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div>
              <Label>Perfil</Label>
              <Select value={style} onValueChange={(v: any) => setStyle(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="budget">Econômico</SelectItem>
                  <SelectItem value="standard">Padrão</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={suggest} variant="outline" className="w-full">
            <TrendingDown className="mr-1 h-4 w-4" /> Gerar sugestão
          </Button>
        </div>
      </Card>
    </div>
  );
}

function AdvisorPanel({ wallet, isPro }: { wallet: any; isPro: boolean }) {
  const _ask = useServerFn(askWalletAi);
  const _report = useServerFn(advisorReport);
  const [prompt, setPrompt] = React.useState("");
  const [messages, setMessages] = React.useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [report, setReport] = React.useState("");

  if (!isPro) {
    return (
      <UpgradeBanner message="O Consultor Financeiro IA analisa seus gastos, detecta excessos, sugere economia e responde perguntas em linguagem natural. Disponível no plano pago." />
    );
  }

  const send = async () => {
    if (!prompt.trim()) return;
    const userMsg = prompt;
    setPrompt("");
    setMessages((m) => [...m, { role: "user", text: userMsg }]);
    setLoading(true);
    try {
      const r = await _ask({ data: { wallet_id: wallet.id, prompt: userMsg } });
      setMessages((m) => [...m, { role: "ai", text: r.text }]);
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  const runReport = async () => {
    setLoading(true);
    try {
      const r = await _report({ data: { wallet_id: wallet.id } });
      setReport(r.report);
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="flex h-[520px] flex-col p-4">
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" /> Pergunte ao Consultor
        </h3>
        <p className="mb-2 text-xs text-muted-foreground">
          Ex: "Quanto já gastei?" · "Meu orçamento está saudável?" · "Qual categoria gasta mais?"
        </p>
        <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3">
          {messages.length === 0 && (
            <p className="text-center text-xs text-muted-foreground">Comece uma conversa…</p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg p-2 text-sm ${
                m.role === "user" ? "ml-8 bg-primary/10 text-primary" : "mr-8 bg-background"
              }`}
            >
              {m.role === "ai" ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{m.text}</ReactMarkdown>
                </div>
              ) : (
                m.text
              )}
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> pensando…
            </div>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Pergunte algo…"
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <Button onClick={send} disabled={loading}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingDown className="h-4 w-4 text-primary" /> Relatório do Consultor
          </h3>
          <Button onClick={runReport} size="sm" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gerar"}
          </Button>
        </div>
        {report ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Gere uma análise completa: diagnóstico, gastos excessivos, sugestões de economia, melhor momento
            para câmbio e previsão de gastos.
          </p>
        )}
      </Card>
    </div>
  );
}
