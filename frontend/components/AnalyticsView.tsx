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
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { formatNumber, formatDateTime } from "@/lib/format";
import type {
  PaginatedAnalyticsResponse,
  TickerCalculateResponse,
} from "@/lib/types";

const PERIODS = ["1mo", "3mo", "6mo", "1y"];

interface ChartPoint {
  time: string;
  sma: number;
  volatility: number | null;
}

export function AnalyticsView() {
  const [ticker, setTicker] = React.useState("BTC-USD");
  const [period, setPeriod] = React.useState("1mo");
  const [window, setWindow] = React.useState(3);

  const [points, setPoints] = React.useState<ChartPoint[]>([]);
  const [running, setRunning] = React.useState(false);
  const [calcError, setCalcError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState<{
    inputCount: number;
    appliedPeriod: number;
  } | null>(null);

  const [history, setHistory] =
    React.useState<PaginatedAnalyticsResponse | null>(null);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    setHistoryError(null);
    try {
      const { data } = await api.get<PaginatedAnalyticsResponse>(
        "/analytics/history",
        { params: { page: 1, page_size: 10 } }
      );
      setHistory(data);
    } catch {
      setHistoryError("Unable to load analytics history.");
    }
  }, []);

  const runCalculation = React.useCallback(async () => {
    setRunning(true);
    setCalcError(null);
    try {
      const { data } = await api.post<TickerCalculateResponse>(
        "/analytics/ticker-calculate",
        { ticker, period, calculation_window: window }
      );
      const sma = data.metrics?.simple_moving_average ?? [];
      const vol = data.metrics?.volatility_standard_deviation ?? [];
      setPoints(
        sma.map((value, index) => ({
          time: `T${index + 1}`,
          sma: value,
          volatility: index < vol.length ? vol[index] : null,
        }))
      );
      setMeta({
        inputCount: data.metrics?.input_count ?? sma.length,
        appliedPeriod: data.metrics?.applied_period ?? window,
      });
      await loadHistory();
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      const detail = (err as { response?: { data?: { detail?: string } } })
        .response?.data?.detail;
      if (status === 401) {
        setCalcError("Authentication required. Please sign in.");
      } else {
        setCalcError(
          detail ?? "Calculation failed. Check the ticker symbol and try again."
        );
      }
    } finally {
      setRunning(false);
    }
  }, [ticker, period, window, loadHistory]);

  React.useEffect(() => {
    runCalculation();
    // Run once on mount with the default ticker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Market Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Simple moving average &amp; volatility computed by the C++ analytics
          core.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <label
              htmlFor="ticker"
              className="block text-sm font-medium text-muted-foreground mb-2"
            >
              Ticker
            </label>
            <input
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label
              htmlFor="period"
              className="block text-sm font-medium text-muted-foreground mb-2"
            >
              Period
            </label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {PERIODS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="window"
              className="block text-sm font-medium text-muted-foreground mb-2"
            >
              SMA Window
            </label>
            <input
              id="window"
              type="number"
              min={1}
              value={window}
              onChange={(e) =>
                setWindow(Math.max(1, Number(e.target.value) || 1))
              }
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button
            onClick={runCalculation}
            disabled={running || !ticker}
            className="py-6 font-bold"
          >
            {running ? "Calculating..." : "Run Analysis"}
          </Button>
        </div>
        {meta && !calcError && (
          <p className="text-xs text-muted-foreground mt-4">
            {meta.inputCount} price points · SMA window {meta.appliedPeriod}
          </p>
        )}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Simple Moving Average"
          dataKey="sma"
          color="hsl(var(--primary))"
          points={points}
          loading={running}
          error={calcError}
        />
        <ChartCard
          title="Volatility (Std. Dev.)"
          dataKey="volatility"
          color="#f59e0b"
          points={points}
          loading={running}
          error={calcError}
        />
      </div>

      {/* History */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-foreground mb-4">
          Calculation History
        </h2>
        {historyError ? (
          <p className="text-sm text-muted-foreground">{historyError}</p>
        ) : !history || history.results.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No saved calculations yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4 font-medium">#</th>
                  <th className="py-2 pr-4 font-medium">Metric</th>
                  <th className="py-2 pr-4 font-medium">Value</th>
                  <th className="py-2 pr-4 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {history.results.map((row, index) => (
                  <tr
                    key={row.id ?? index}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 pr-4 text-muted-foreground">
                      {row.id ?? "—"}
                    </td>
                    <td className="py-3 pr-4 font-medium text-foreground">
                      {row.metric_name}
                    </td>
                    <td className="py-3 pr-4 text-foreground">
                      {formatNumber(row.metric_value)}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {formatDateTime(row.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted-foreground mt-3">
              Showing {history.results.length} of {history.total} records.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  dataKey,
  color,
  points,
  loading,
  error,
}: {
  title: string;
  dataKey: "sma" | "volatility";
  color: string;
  points: ChartPoint[];
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-muted-foreground mb-4">
        {title}
      </h3>
      <div className="h-64">
        {loading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            Loading...
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground px-4">
            {error}
          </div>
        ) : points.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            No data.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points}>
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
                dataKey={dataKey}
                stroke={color}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
