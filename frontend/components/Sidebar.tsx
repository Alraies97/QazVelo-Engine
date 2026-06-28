"use client";

import * as React from "react";
import { LayoutDashboard, BarChart3, TrendingUp, Wallet, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  href: string;
}

function NavItem({ icon, label, href }: NavItemProps) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));

  return (
    <Link href={href} className="w-full block">
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
          isActive
            ? "bg-primary text-primary-foreground shadow-md"
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
  return (
    <aside className="w-64 border-r border-border bg-card/80 backdrop-blur-sm h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">Q</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">QazVelo</h1>
            <p className="text-xs text-muted-foreground">Engine</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <NavItem
          icon={<LayoutDashboard size={20} />}
          label="Dashboard"
          href="/"
        />
        <NavItem
          icon={<BarChart3 size={20} />}
          label="Financial Analyst"
          href="/analytics"
        />
        <NavItem
          icon={<TrendingUp size={20} />}
          label="Market Analytics"
          href="#"
        />
        <NavItem
          icon={<Wallet size={20} />}
          label="Wallet"
          href="#"
        />
        <NavItem
          icon={<Settings size={20} />}
          label="Settings"
          href="#"
        />
      </nav>

      <div className="p-4 border-t border-border">
        <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
          <LogOut size={20} />
          Log Out
        </Button>
      </div>
    </aside>
  );
}
