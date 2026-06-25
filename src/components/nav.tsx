"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, List, Star, TrendingUp, AlertTriangle, Settings, Moon, Sun, Bell, Activity, Newspaper, Sword, Gem, BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { LanguageSelector } from "@/components/language-selector";
import { CurrencySelector } from "@/components/currency-selector";
import { LiveIndicator } from "@/components/live-indicator";

const NAV = [
  { href: "/", key: "nav.items", icon: List },
  { href: "/gear", key: "nav.gear", icon: Sword },
  { href: "/materials", key: "nav.materials", icon: Gem },
  { href: "/rankings", key: "nav.rankings", icon: TrendingUp },
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/favorites", key: "nav.favorites", icon: Star },
  { href: "/anomalies", key: "nav.anomalies", icon: AlertTriangle },
  { href: "/news", key: "nav.news", icon: Newspaper },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 },
  { href: "/admin", key: "nav.admin", icon: Settings },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <Button variant="ghost" size="icon" aria-label="theme" />;
  return (
    <Button variant="ghost" size="icon" aria-label="toggle theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function NotificationBell() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/notifications")
        .then((r) => r.json())
        .then((d) => active && setUnread(d.unread ?? 0))
        .catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);
  return (
    <Link href="/favorites?tab=alerts" className="relative inline-flex">
      <Button variant="ghost" size="icon" aria-label="notifications">
        <Bell className="h-4 w-4" />
      </Button>
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <aside className="hidden w-56 shrink-0 border-r bg-card/40 md:flex md:flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Activity className="h-5 w-5 text-primary" />
        <span className="font-bold leading-tight">
          Taskbar Hero
          <span className="block text-[10px] font-normal text-muted-foreground">Market Analytics</span>
        </span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <n.icon className="h-4 w-4" />
              {t(n.key)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function Topbar() {
  const pathname = usePathname();
  const { t } = useT();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-4 backdrop-blur">
      {/* モバイル用の簡易ナビ (狭幅では縮小して横スクロール) */}
      <nav className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto md:hidden">
        {NAV.map((n) => {
          const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href} className={cn("rounded p-2", active ? "text-primary" : "text-muted-foreground")} aria-label={t(n.key)}>
              <n.icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>
      <div className="hidden md:block text-sm text-muted-foreground">{t("app.tagline")}</div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <LiveIndicator />
        <NotificationBell />
        <ThemeToggle />
        <CurrencySelector />
        <LanguageSelector />
      </div>
    </header>
  );
}
