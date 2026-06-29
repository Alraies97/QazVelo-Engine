"use client";

import * as React from "react";
import { MarketOverview } from "@/components/MarketOverview";
import { BuySellCard } from "@/components/BuySellCard";

export default function DashboardPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        <MarketOverview />
      </div>
      <div className="lg:col-span-1">
        <BuySellCard />
      </div>
    </div>
  );
}
