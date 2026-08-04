import * as React from "react";
import { Copy, Loader2, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type Widget = {
  id: string;
  slug: string;
  active: boolean;
  headline: string | null;
  intro: string | null;
  allowed_domains: string[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export function TripWidgetPanel({ companyName }: { companyName: string }) {
  const [widget, setWidget] = React.useState<Widget | null>(null);
  const [slug, setSlug] = React.useState("");
  const [headline, setHeadline] = React.useState("");
  const [intro, setIntro] = React.useState("");
  const [domains, setDomains] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [stats, setStats] = React.useState({ total: 0, credits: 0 });

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = slug ? `${origin}/r/${slug}` : "";
  const embedCode = slug
    ? `<iframe src="${origin}/r/${slug}?embed=1" style="width:100%;height:900px;border:0" loading="lazy" title="Roteiro de viagem"></iframe>`
    : "";

  React.useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("trip_widgets")
        .select("id, slug, active, headline, intro, allowed_domains")
        .eq("owner_id", user.id)
        .maybeSingle();
      if (data) {
        const w = data as Widget;
        setWidget(w);
        setSlug(w.slug);
        setHeadline(w.headline ?? "");
        setIntro(w.intro ?? "");
        setActive(w.active);
        setDomains((w.allowed_domains ?? []).join(", "));

        const { data: gens } = await supabase
          .from("trip_widget_generations")
          .select("credits_spent")
          .eq("widget_id", w.id);
        setStats({
          total: gens?.length ?? 0,
          credits: (gens ?? []).reduce((a, g) => a + (g.credits_spent ?? 0), 0),
        });
      } else {
        setSlug(slugify(companyName) || "");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    const clean = slugify(slug);
    if (clean.length < 3) {
      toast.error("Escolha um endereço com pelo menos 3 letras.");
      return;
    }
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;
      if (!user) throw new Error("Sessão expirada. Entre novamente.");
      const payload = {
        owner_id: user.id,
        slug: clean,
        active,
        headline: headline.trim() || null,
        intro: intro.trim() || null,
        allowed_domains: domains
          .split(",")
          .map((d) => d.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, ""))
          .filter(Boolean),
      };
      const { data, error } = await supabase
        .from("trip_widgets")
        .upsert(payload, { onConflict: "owner_id" })
        .select("id, slug, active, headline, intro, allowed_domains")
        .single();
      if (error) {
        if (error.code === "23505") throw new Error("Esse endereço já está em uso. Escolha outro.");
        throw new Error(error.message);
      }
      setWidget(data as Widget);
      setSlug((data as Widget).slug);
      toast.success("Link salvo");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-border bg-card/60 p-6">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold">Meu link / Widget de roteiro</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Publique uma página com a sua marca para que seus clientes gerem roteiros sozinhos. Cada
        roteiro gerado consome 25 créditos da sua conta.
      </p>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">Endereço do link</Label>
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted-foreground">{origin}/r/</span>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={() => setSlug(slugify(slug))}
                placeholder="minhamarca"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Título da página (opcional)</Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Monte seu roteiro com a nossa agência"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mensagem de boas-vindas (opcional)</Label>
            <Textarea
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              rows={2}
              placeholder="Preencha os dados e receba seu roteiro em segundos."
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Domínios autorizados para o widget (separe por vírgula)</Label>
            <Input
              value={domains}
              onChange={(e) => setDomains(e.target.value)}
              placeholder="minhaagencia.com.br, outrosite.com"
            />
            <p className="text-[11px] text-muted-foreground">
              Deixe vazio para permitir qualquer site.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="widget-active" className="text-xs">
              Página ativa
            </Label>
            <Switch id="widget-active" checked={active} onCheckedChange={setActive} />
          </div>

          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar link
          </Button>

          {widget && (
            <div className="space-y-3 rounded-xl border border-border/70 bg-background/40 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Link público</Label>
                <div className="flex gap-2">
                  <Input readOnly value={publicUrl} className="text-xs" />
                  <Button variant="outline" size="icon" onClick={() => copy(publicUrl, "Link")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Código do widget (cole no seu site)</Label>
                <div className="flex gap-2">
                  <Textarea readOnly value={embedCode} rows={3} className="text-[11px]" />
                  <Button variant="outline" size="icon" onClick={() => copy(embedCode, "Código")}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.total} roteiro(s) gerado(s) pelo link · {stats.credits} créditos consumidos.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
