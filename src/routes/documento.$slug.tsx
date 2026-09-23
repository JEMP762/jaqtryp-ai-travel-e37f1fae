import { createFileRoute } from "@tanstack/react-router";
import { SharedResultPage } from "@/components/shared/SharedResultPage";

export const Route = createFileRoute("/documento/$slug")({
  head: () => ({ meta: [
    { title: "Resumo de tradução — JAQTRYP AI" },
    { name: "description", content: "Confira um resumo de tradução compartilhado com segurança." },
    { property: "og:title", content: "Resumo de tradução criado com JAQTRYP AI" },
    { property: "og:description", content: "Veja o resumo e traduza seu próprio arquivo." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Page,
});

function Page() {
  return <SharedResultPage slug={Route.useParams().slug} intent="document_translation" />;
}