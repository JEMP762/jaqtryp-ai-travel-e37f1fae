import { createFileRoute } from "@tanstack/react-router";
import { SmartRoutePanel } from "@/components/smart-route/SmartRoutePanel";
import { smartItineraryOptions } from "@/lib/smart-route/queries";

export const Route = createFileRoute("/_app/smart-route")({
  loader: ({ context }) => context.queryClient.ensureQueryData(smartItineraryOptions),
  head: () => ({ meta: [
    { title: "JAQTRYP SMART ROUTE — Trajetos e atrações" },
    { name: "description", content: "Organize visitas e consulte trajetos com localização, transporte público e instruções no JAQTRYP SMART ROUTE." },
    { property: "og:title", content: "JAQTRYP SMART ROUTE — Trajetos e atrações" },
    { property: "og:description", content: "Navegue pelas atrações do seu roteiro ou pesquise um trajeto no JAQTRYP." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: SmartRoutePanel,
});