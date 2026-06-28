"use client";

import * as React from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/navbar";
import { MarketOverview } from "@/components/MarketOverview";
import { BuySellCard } from "@/components/BuySellCard";
import { AuthScreen } from "@/components/AuthScreen";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <main className="flex-1 p-8 overflow-auto">
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Market Overview */}
            <div className="lg:col-span-2">
              <MarketOverview />
            </div>

            {/* Right Column: Buy/Sell Card */}
            <div className="lg:col-span-1">
              <BuySellCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
