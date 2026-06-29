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

interface ChartPoint {
  time: string;
  price: number;
}

export function MarketOverview() {
  const [data, setData] = React.useState<ChartPoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data: resp } = await api.post<TickerCalculateResponse>(
          "/analytics/ticker-calculate",
          {
            ticker: "BTC-USD",
            period: "1mo",
            calculation_window: 3,
          }
        );
        const points: ChartPoint[] = resp.metrics.simple_moving_average.map(
          (value, index) => ({
            time: `T${index + 1}`,
            price: value,
          })
        );
        setData(points);
      } catch (err) {
        const status = (err as { response?: { status?: number } }).response?.status;
        setError(
          status === 401
            ? "Authentication required."
            : "Unable to load market data. Is the backend running?"
        );
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Market Overview</h2>
        <p className="text-sm text-muted-foreground">BTC/USD — Simple Moving Average</p>
      </div>

      <div className="h-80">
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
