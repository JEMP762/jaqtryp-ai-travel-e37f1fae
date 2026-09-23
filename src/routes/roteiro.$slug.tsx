import { createFileRoute } from "@tanstack/react-router";
import { SharedResultPage } from "@/components/shared/SharedResultPage";

export const Route = createFileRoute("/roteiro/$slug")({
  head: () => ({ meta: [
    { title: "Roteiro compartilhado — JAQTRYP AI" },
    { name: "description", content: "Confira este roteiro e crie gratuitamente seu próprio planejamento de viagem." },
    { property: "og:title", content: "Confira este roteiro criado com JAQTRYP AI" },
    { property: "og:description", content: "Veja o planejamento e crie gratuitamente o seu." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

function Page() {
  return <SharedResultPage slug={Route.useParams().slug} intent="itinerary" />;
}