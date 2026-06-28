"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Settings,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

function NavItem({ href, icon, label, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
}

const NAV_ITEMS = [
  { href: "/", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
  {
    href: "/analytics",
    icon: <TrendingUp size={20} />,
    label: "Market Analytics",
  },
  { href: "/wallet", icon: <Wallet size={20} />, label: "Wallet" },
  { href: "/settings", icon: <Settings size={20} />, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

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
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={isActive(item.href)}
          />
        ))}
      </nav>

      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          onClick={logout}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut size={20} />
          Log Out
        </Button>
      </div>
    </aside>
  );
}
