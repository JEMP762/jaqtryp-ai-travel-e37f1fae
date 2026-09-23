import { createFileRoute } from "@tanstack/react-router";
import { SharedResultPage } from "@/components/shared/SharedResultPage";

export const Route = createFileRoute("/traducao/$slug")({
  head: () => ({ meta: [
    { title: "Tradução compartilhada — JAQTRYP AI" },
    { name: "description", content: "Confira esta tradução e traduza gratuitamente sua própria imagem." },
    { property: "og:title", content: "Confira esta tradução criada com JAQTRYP AI" },
    { property: "og:description", content: "Veja o resultado e traduza gratuitamente sua própria imagem." },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: Page,
});

function Page() {
  return <SharedResultPage slug={Route.useParams().slug} intent="image_translation" />;
}