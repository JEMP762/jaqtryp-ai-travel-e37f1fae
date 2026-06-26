import { createFileRoute } from "@tanstack/react-router";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { AppearanceModeSwitcher } from "@/components/AppearanceModeSwitcher";

export const Route = createFileRoute("/_app/settings/appearance")({
  head: () => ({
    meta: [
      { title: "Aparência — Jaqtryp AI" },
      { name: "description", content: "Personalize a cor do tema e o modo do sistema." },
    ],
  }),
  component: AppearancePage,
});

function AppearancePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 md:px-10">
      <header className="mb-2">
        <h1 className="text-3xl font-bold">Aparência</h1>
        <p className="mt-1 text-muted-foreground">
          Personalize as cores e o visual do seu Jaqtryp AI.
        </p>
      </header>
      <AppearanceModeSwitcher />
      <ThemeSwitcher />
    </div>
  );
}
