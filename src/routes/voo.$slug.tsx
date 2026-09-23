import { createFileRoute } from "@tanstack/react-router";
import { SharedResultPage } from "@/components/shared/SharedResultPage";

export const Route = createFileRoute("/voo/$slug")({
  head: () => ({ meta: [
    { title: "Busca de voo compartilhada — JAQTRYP AI" },
    { name: "description", content: "Confira este resumo de busca e encontre seus próprios voos." },
    { property: "og:title", content: "Busca de voo criada com JAQTRYP AI" },
    { property: "og:description", content: "Veja o resumo e faça sua própria busca." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  return <SharedResultPage slug={Route.useParams().slug} intent="flight_search" />;
}