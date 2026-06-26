import { createFileRoute } from "@tanstack/react-router";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

export const Route = createFileRoute("/_app/settings/appearance")({
  head: () => ({
    meta: [
      { title: "Aparência — Jaqtryp AI" },
      { name: "description", content: "Personalize a cor do tema do sistema." },
    ],
  }),
  component: AppearancePage,
});

function AppearancePage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 md:px-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Aparência</h1>
        <p className="mt-1 text-muted-foreground">
          Personalize as cores e o visual do seu Jaqtryp AI.
        </p>
      </header>
      <ThemeSwitcher />
    </div>
  );
}
