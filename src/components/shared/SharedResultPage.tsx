import * as React from "react";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import { ArrowRight, Languages, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveEntryContext, type EntryIntent } from "@/lib/onboarding-context";

type SharedResult = {
  slug: string;
  kind: "itinerary" | "translation" | "travel_budget" | "document_translation" | "flight_search";
  title: string;
  summary: string | null;
  public_payload: Record<string, unknown>;
};

function visitorId() {
  const key = "jaqtryp:visitor-id";
  let value = localStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(key, value);
  }
  return value;
}

export function SharedResultPage({ slug, intent }: { slug: string; intent: EntryIntent }) {
  const [result, setResult] = React.useState<SharedResult | null>(null);
  const [missing, setMissing] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentVisitor = visitorId();
    const context = {
      intent,
      ref: params.get("ref") ?? undefined,
      source: params.get("utm_source") ?? "shared_result",
      medium: params.get("utm_medium") ?? undefined,
      campaign: params.get("utm_campaign") ?? undefined,
      contentSlug: slug,
      visitorId: currentVisitor,
    };
    saveEntryContext(context);
    fetch(`/api/public/shared-result/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("not_found");
        return response.json();
      })
      .then((data) => {
        setResult(data);
        fetch("/api/public/activation", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ event: "shared_content_viewed", visitorId: currentVisitor, feature: data.kind, source: context.source, campaign: context.campaign, slug, ref: context.ref }),
        }).catch(() => {});
      })
      .catch(() => setMissing(true));
  }, [intent, slug]);

  const start = () => {
    const params = new URLSearchParams(window.location.search);
    saveEntryContext({
      intent,
      ref: params.get("ref") ?? undefined,
      source: params.get("utm_source") ?? "shared_result",
      medium: params.get("utm_medium") ?? undefined,
      campaign: params.get("utm_campaign") ?? undefined,
      contentSlug: slug,
      visitorId: visitorId(),
    });
    fetch("/api/public/activation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "context_cta_clicked", visitorId: visitorId(), feature: intent === "itinerary" ? "itinerary" : "translation", source: params.get("utm_source") ?? "shared_result", campaign: params.get("utm_campaign") ?? undefined, slug }),
    }).catch(() => {});
  };

  if (missing) return <div className="grid min-h-screen place-items-center px-6 text-center"><div><h1 className="text-2xl font-bold">Conteúdo indisponível</h1><p className="mt-2 text-muted-foreground">O link expirou ou deixou de ser compartilhado.</p></div></div>;
  if (!result) return <div className="grid min-h-screen place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>;

  const isTrip = result.kind === "itinerary";
  const markdown = String(result.public_payload.markdown ?? result.public_payload.translation ?? result.summary ?? "");
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <header className="mb-6 border-b border-border pb-5">
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-primary">
            {isTrip ? <MapPin className="h-4 w-4" /> : <Languages className="h-4 w-4" />}
            Criado com JAQTRYP AI
          </div>
          <h1 className="text-2xl font-bold sm:text-4xl">{result.title}</h1>
          {result.summary && <p className="mt-2 text-muted-foreground">{result.summary}</p>}
        </header>
        <article className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{markdown}</ReactMarkdown></article>
        <section className="sticky bottom-3 mt-8 border-t border-border bg-background/95 py-4 backdrop-blur">
          <p className="font-semibold">Gostou desse resultado?</p>
          <p className="mb-3 text-sm text-muted-foreground">Crie o seu gratuitamente.</p>
          <Button asChild size="lg" className="h-12 w-full sm:w-auto">
            <Link to="/signup" search={{ intent, ref: new URLSearchParams(window.location.search).get("ref") ?? undefined }} onClick={start}>
              {isTrip ? "Criar meu roteiro" : "Traduzir minha imagem"}<ArrowRight />
            </Link>
          </Button>
        </section>
      </div>
    </main>
  );
}