"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";

// Mock data for BTC/USD price chart
const mockMarketData = [
  { time: "09:00", price: 64250 },
  { time: "10:00", price: 64500 },
  { time: "11:00", price: 64300 },
  { time: "12:00", price: 65000 },
  { time: "13:00", price: 64800 },
  { time: "14:00", price: 65200 },
  { time: "15:00", price: 65500 },
];

export function MarketOverview() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Market Overview</h2>
          <p className="text-sm text-muted-foreground">BTC/USD 24h Price</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">$65,500</div>
          <div className="text-green-500 text-sm font-medium">+3.2%</div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={mockMarketData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
          <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(v) => `$${v}` />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              borderColor: "hsl(var(--border))",
              borderRadius: "0.5rem",
              color: "hsl(var(--foreground))"
            }}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--primary))"
            strokeWidth={3}
            dot={{ r: 4, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 6 }}
          />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
