import { createFileRoute } from "@tanstack/react-router";
import { SharedResultPage } from "@/components/shared/SharedResultPage";

export const Route = createFileRoute("/orcamento/$slug")({
  head: () => ({ meta: [
    { title: "Orçamento compartilhado — JAQTRYP AI" },
    { name: "description", content: "Confira este orçamento de viagem e crie o seu gratuitamente." },
    { property: "og:title", content: "Orçamento de viagem criado com JAQTRYP AI" },
    { property: "og:description", content: "Veja o resumo e organize sua própria viagem." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

function Page() {
  return <SharedResultPage slug={Route.useParams().slug} intent="travel_budget" />;
}