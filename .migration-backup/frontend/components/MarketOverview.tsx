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
import api from "@/lib/api";
import type { TickerCalculateResponse } from "@/lib/types";

const DEFAULT_TICKER = "BTC-USD";
const DEFAULT_PERIOD = "1mo";
const DEFAULT_WINDOW = 3;

interface ChartPoint {
  time: string;
  price: number;
}

export function MarketOverview() {
  const [data, setData] = React.useState<ChartPoint[]>([]);
  const [latest, setLatest] = React.useState<number | null>(null);
  const [changePct, setChangePct] = React.useState<number | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function loadMarketData() {
      setLoading(true);
      setError(null);
      try {
        const { data: payload } = await api.post<TickerCalculateResponse>(
          "/analytics/ticker-calculate",
          {
            ticker: DEFAULT_TICKER,
            period: DEFAULT_PERIOD,
            calculation_window: DEFAULT_WINDOW,
          }
        );

        if (cancelled) return;

        const sma = payload.metrics.simple_moving_average ?? [];
        const points: ChartPoint[] = sma.map((price, index) => ({
          time: `T${index + 1}`,
          price,
        }));
        setData(points);
        if (points.length > 0) {
          const first = points[0].price;
          const last = points[points.length - 1].price;
          setLatest(last);
          setChangePct(first !== 0 ? ((last - first) / first) * 100 : 0);
        }
        setError(payload.source ? `Source: ${payload.source}` : null);
      } catch (err) {
        if (cancelled) return;
        const status =
          (err as { response?: { status?: number } }).response?.status;
        setError(
          status === 401
            ? "Authentication required. Please sign in to load live market data."
            : "Unable to load market data. Is the backend running?"
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMarketData();
    return () => {
      cancelled = true;
    };
  }, []);

  const changePositive = (changePct ?? 0) >= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">Market Overview</h2>
          <p className="text-sm text-muted-foreground">
            {DEFAULT_TICKER} Simple Moving Average
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-foreground">
            {latest !== null ? `$${latest.toLocaleString()}` : "--"}
          </div>
          {changePct !== null && (
            <div
              className={`text-sm font-medium ${
                changePositive ? "text-green-500" : "text-red-500"
              }`}
            >
              {changePositive ? "+" : ""}
              {changePct.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      <div className="h-64">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Loading market data...
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground px-4">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No market data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
                domain={["auto", "auto"]}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "0.5rem",
                  color: "hsl(var(--foreground))",
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
        )}
      </div>
    </div>
  );
}
