import * as React from "react";
import { LayoutDashboard, ChartBar as BarChart3, Wallet, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
}

function NavItem({ icon, label, href }: NavItemProps) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link href={href} className="w-full block">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
          isActive
            ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.12)]"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        {icon}
        <span className="font-medium">{label}</span>
      </div>
    </Link>
  );
}

export function Sidebar() {
  const { logout } = useAuth();

  return (
    <aside className="w-64 border-r border-border bg-card/80 backdrop-blur-sm h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center glow-cyan">
            <span className="text-primary-foreground font-bold text-lg font-mono">Q</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">QazVelo</h1>
            <p className="text-xs text-muted-foreground font-mono tracking-wide uppercase">Engine</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <NavItem
          icon={<LayoutDashboard size={18} />}
          label="Dashboard"
          href="/"
        />
        <NavItem
          icon={<BarChart3 size={18} />}
          label="Financial Analyst"
          href="/analytics"
        />
        <NavItem
          icon={<Wallet size={18} />}
          label="Wallet"
          href="/wallet"
        />
        <NavItem
          icon={<Settings size={18} />}
          label="Settings"
          href="/settings"
        />
      </nav>

      <div className="p-4 border-t border-border">
        <button
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 text-sm"
          onClick={logout}
        >
          <LogOut size={18} />
          Log Out
        </button>
      </div>
    </aside>
  );
}
