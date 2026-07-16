import {
  createFileRoute,
  Link,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import {
  LayoutDashboard,
  Sparkles,
  MessageSquare,
  Languages,
  Plane,
  BedDouble,
  Tag,
  ShieldCheck,
  LogOut,
  Globe2,
  CreditCard,
  Menu,
  Mic,
  Wallet,
  Coins,
  FileText,
  Palette,
  Gift,
} from "lucide-react";


import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { CreditLowBalanceBanner } from "@/components/CreditLowBalanceBanner";
import { ThemeQuickSwatches } from "@/components/ThemeSwitcher";
import { AppearanceModeQuickToggle } from "@/components/AppearanceModeSwitcher";
import { applyReferralCode } from "@/lib/referrals.functions";
import { toast } from "sonner";

const REF_STORAGE_KEY = "jq_pending_ref";


export const Route = createFileRoute("/_app")({
  component: AppShell,
});

function AppShell() {
  const { user, loading } = useAuth();
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = React.useState(false);

  React.useEffect(() => {
    if (!loading && !user) {
      nav({ to: "/login" });
    }
  }, [loading, user, nav]);

  // Apply pending referral code after any authenticated arrival (incl. Google OAuth
  // which redirects to `${origin}/` and never re-mounts /signup).
  React.useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const code = window.sessionStorage.getItem(REF_STORAGE_KEY);
    if (!code) return;
    window.sessionStorage.removeItem(REF_STORAGE_KEY);
    applyReferralCode({ data: { code } })
      .then((res: any) => {
        if (res?.ok) toast.success("Código de indicação aplicado!");
      })
      .catch(() => {
        /* ignore */
      });
  }, [user]);


  // Close drawer on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [path]);

  if (loading || !user) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }


  const items = [
    { to: "/dashboard", icon: LayoutDashboard, label: t("dash.welcome") },
    { to: "/planner", icon: Sparkles, label: t("dash.planner") },
    { to: "/chat", icon: MessageSquare, label: t("dash.chat") },
    { to: "/translator", icon: Languages, label: t("dash.translator") },
    { to: "/file-translator", icon: FileText, label: "Tradutor de Arquivos IA" },
    { to: "/live-translator", icon: Mic, label: "Live Translator" },

    { to: "/flights", icon: Plane, label: "Voos" },

    { to: "/stays", icon: BedDouble, label: "Hospedagem" },
    { to: "/wallet", icon: Wallet, label: "Carteira IA" },
    { to: "/credits", icon: Coins, label: "Créditos" },
    { to: "/deals", icon: Tag, label: "Promoções" },
    { to: "/shield", icon: ShieldCheck, label: "JAQ Shield" },
    { to: "/billing", icon: CreditCard, label: "Minha Assinatura" },
    { to: "/settings/appearance", icon: Palette, label: "Aparência" },
    { to: "/referrals", icon: Gift, label: "Indique e ganhe" },
  ] as const;

  const onSignOut = async () => {
    await supabase.auth.signOut();
    nav({ to: "/" });
  };

  const SidebarContent = (
    <>
      <Link to="/dashboard" className="flex items-center gap-2 px-6 py-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-primary shadow-glow">
          <span className="text-sm font-black text-primary-foreground">J</span>
        </div>
        <span className="font-bold tracking-tight">
          Jaqtryp <span className="text-gradient">AI</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((it) => {
          const Icon = it.icon;
          const active = path === it.to || path.startsWith(it.to + "/");
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {it.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <div className="mb-3 px-1">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Modo</span>
          </div>
          <AppearanceModeQuickToggle />
        </div>
        <div className="mb-3 px-1">
          <div className="mb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">Tema</div>
          <ThemeQuickSwatches />
        </div>
        <button
          onClick={() => setLang(lang === "pt" ? "en" : "pt")}
          className="mb-2 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <Globe2 className="h-4 w-4" /> {lang.toUpperCase()}
        </button>
        <div className="rounded-lg bg-sidebar-accent p-3">
          <div className="truncate text-xs font-medium">{user?.email}</div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onSignOut}
            className="mt-2 h-8 w-full justify-start gap-2 text-muted-foreground"
          >
            <LogOut className="h-3.5 w-3.5" /> {t("nav.logout")}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col border-r border-border bg-sidebar md:flex">
        {SidebarContent}
      </aside>

      {/* Mobile top bar with hamburger */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-sidebar/95 px-4 backdrop-blur md:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col bg-sidebar p-0">
            {SidebarContent}
          </SheetContent>
        </Sheet>
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-primary shadow-glow">
            <span className="text-xs font-black text-primary-foreground">J</span>
          </div>
          <span className="text-sm font-bold tracking-tight">
            Jaqtryp <span className="text-gradient">AI</span>
          </span>
        </Link>
        <div className="w-9" />
      </header>

      <main className="flex-1 overflow-x-hidden pt-14 md:pt-0">
        <CreditLowBalanceBanner />
        <Outlet />
      </main>
    </div>
  );
}
