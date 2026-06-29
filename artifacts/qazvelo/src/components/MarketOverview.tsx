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
import api, { getAccessToken } from "@/lib/api";
import type { TickerCalculateResponse } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ChartPoint {
  time: string;
  price: number;
}

interface AssetOption {
  label: string;
  ticker: string;
  binanceSymbol: string | null;
  color: string;
}

const ASSETS: AssetOption[] = [
  { label: "BTC/USD", ticker: "BTC-USD", binanceSymbol: "BTCUSDT", color: "#f59e0b" },
  { label: "ETH/USD", ticker: "ETH-USD", binanceSymbol: "ETHUSDT", color: "#8b5cf6" },
  { label: "AAPL/USD", ticker: "AAPL",   binanceSymbol: null,      color: "#22c55e" },
];

const REFRESH_MS  = 30_000;
const TICK_MS     = 3_000;
const MAX_POINTS  = 50;

type LiveSource = "connecting" | "binance" | "simulated";

export function MarketOverview() {
  const [selectedAsset, setSelectedAsset] = React.useState<AssetOption>(ASSETS[0]);
  const [data, setData]                   = React.useState<ChartPoint[]>([]);
  const [loading, setLoading]             = React.useState(true);
  const [refreshing, setRefreshing]       = React.useState(false);
  const [error, setError]                 = React.useState<string | null>(null);
  const [lastUpdated, setLastUpdated]     = React.useState<Date | null>(null);
  const [chartKey, setChartKey]           = React.useState(0);
  const [currentPrice, setCurrentPrice]   = React.useState<number | null>(null);
  const [openPrice, setOpenPrice]         = React.useState<number | null>(null);
  const [ticking, setTicking]             = React.useState(false);
  const [liveSource, setLiveSource]       = React.useState<LiveSource>("simulated");

  const tickCounterRef   = React.useRef(0);
  const selectedAssetRef = React.useRef(selectedAsset);
  const baselineReadyRef = React.useRef(false);
  const wsRef            = React.useRef<WebSocket | null>(null);
  const wsTickTimeRef    = React.useRef(0);

  React.useLayoutEffect(() => { selectedAssetRef.current = selectedAsset; }, [selectedAsset]);

  const fetchData = React.useCallback(async (isInitial: boolean) => {
    const asset = selectedAssetRef.current;
    if (isInitial) { setLoading(true); } else { setRefreshing(true); }
    setError(null);
    try {
      const { data: resp } = await api.post<TickerCalculateResponse>(
        "/analytics/ticker-calculate",
        { ticker: asset.ticker, period: "1mo", calculation_window: 3 }
      );
      const pts: ChartPoint[] = resp.metrics.simple_moving_average.map((v, i) => ({
        time:  `T${i + 1}`,
        price: Math.round(v * 100) / 100,
      }));
      const first = pts[0]?.price ?? null;
      const last  = pts[pts.length - 1]?.price ?? null;
      tickCounterRef.current = pts.length;
      baselineReadyRef.current = true;
      setOpenPrice(first);
      setCurrentPrice(last);
      setData(pts);
      setLastUpdated(new Date());
      setTicking(true);
      if (!isInitial) setChartKey((k) => k + 1);
    } catch (err) {
      const s = (err as { response?: { status?: number } }).response?.status;
      setError(
        s === 401
          ? "Authentication required."
          : "Unable to load market data. Is the backend running?"
      );
      setTicking(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    setTicking(false);
    setData([]);
    setCurrentPrice(null);
    setOpenPrice(null);
    setError(null);
    setLoading(true);
    setChartKey((k) => k + 1);
    baselineReadyRef.current = false;

    void fetchData(true);
    const timer = setInterval(() => void fetchData(false), REFRESH_MS);
    return () => clearInterval(timer);
  }, [selectedAsset.ticker, fetchData]);

  React.useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (!selectedAsset.binanceSymbol) {
      setLiveSource("simulated");
      return;
    }

    const token = getAccessToken();
    if (!token) {
      setLiveSource("simulated");
      return;
    }

    setLiveSource("connecting");

    const buildUrl = () => {
      const baseUrl = api.defaults.baseURL ?? window.location.origin;
      const url = new URL(baseUrl);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.pathname = "/api/v1/ws/market";
      url.searchParams.set("symbol", selectedAsset.binanceSymbol!);
      url.searchParams.set("token", token);
      return url.toString();
    };

    let ws: WebSocket;
    try {
      ws = new WebSocket(buildUrl());
    } catch {
      setLiveSource("simulated");
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => setLiveSource("binance");

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          price?: number;
          symbol?: string;
        };
        if (msg.type !== "tick" || typeof msg.price !== "number") return;

        const now = Date.now();
        if (now - wsTickTimeRef.current < 1000) return;
        wsTickTimeRef.current = now;

        if (!baselineReadyRef.current) return;

        const price = Math.round(msg.price * 100) / 100;
        setCurrentPrice(price);
        tickCounterRef.current += 1;
        setData((prev) =>
          [...prev, { time: `T${tickCounterRef.current}`, price }].slice(-MAX_POINTS)
        );
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => setLiveSource("simulated");

    ws.onclose = () =>
      setLiveSource((prev) => (prev === "binance" ? "simulated" : prev));

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [selectedAsset.ticker]);

  React.useEffect(() => {
    const shouldTick =
      ticking && (!selectedAsset.binanceSymbol || liveSource === "simulated");
    if (!shouldTick) return;

    const timer = setInterval(() => {
      setData((prev) => {
        if (prev.length === 0) return prev;
        const last  = prev[prev.length - 1];
        const drift = last.price * 0.0001;
        const noise = (Math.random() - 0.48) * last.price * 0.002;
        const newPrice = Math.max(0.01, Math.round((last.price + drift + noise) * 100) / 100);
        setCurrentPrice(newPrice);
        tickCounterRef.current += 1;
        return [...prev, { time: `T${tickCounterRef.current}`, price: newPrice }].slice(-MAX_POINTS);
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [ticking, selectedAsset.ticker, liveSource]);

  React.useEffect(() => {
    const handler = () => setTimeout(() => void fetchData(false), 800);
    window.addEventListener("wallet:updated", handler);
    return () => window.removeEventListener("wallet:updated", handler);
  }, [fetchData]);

  const pctChange =
    currentPrice !== null && openPrice !== null && openPrice > 0
      ? ((currentPrice - openPrice) / openPrice) * 100
      : 0;
  const isPositive = pctChange >= 0;

  const sourceBadge: { label: string; dot: string; badge: string } = {
    binance:    { label: "Binance Live", dot: "bg-green-500 animate-pulse",   badge: "bg-green-500/10 text-green-500" },
    connecting: { label: "Connecting…",  dot: "bg-amber-500 animate-pulse",   badge: "bg-amber-500/10 text-amber-500" },
    simulated:  { label: selectedAsset.binanceSymbol ? "Simulated" : "Simulated", dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground" },
  }[liveSource] ?? { label: "Simulated", dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground" };

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-semibold text-foreground">Market Overview</h2>
            <span className={cn("flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium", sourceBadge.badge)}>
              <span className={cn("h-1.5 w-1.5 rounded-full", sourceBadge.dot)} />
              {sourceBadge.label}
            </span>
          </div>

          {currentPrice !== null ? (
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                ${currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={cn("text-sm font-semibold tabular-nums", isPositive ? "text-green-500" : "text-red-500")}>
                {isPositive ? "▲" : "▼"} {Math.abs(pctChange).toFixed(2)}%
              </span>
            </div>
          ) : (
            <div className="h-8 mt-0.5" />
          )}

          {lastUpdated && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Updated {lastUpdated.toLocaleTimeString()}
              {refreshing && " · Syncing…"}
            </p>
          )}
        </div>

        <div className="w-36 shrink-0">
          <Select
            value={selectedAsset.ticker}
            onValueChange={(ticker) => {
              const asset = ASSETS.find((a) => a.ticker === ticker);
              if (asset) setSelectedAsset(asset);
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSETS.map((a) => (
                <SelectItem key={a.ticker} value={a.ticker}>{a.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="h-72">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm">Loading {selectedAsset.label}…</span>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground px-4 text-sm">
            {error}
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            No market data available.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart key={chartKey} data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 11 }}
                domain={["auto", "auto"]}
                width={72}
                tickFormatter={(v: number) =>
                  v >= 1000
                    ? `$${(v / 1000).toFixed(1)}k`
                    : `$${v.toFixed(2)}`
                }
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "0.5rem",
                  color: "hsl(var(--foreground))",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  selectedAsset.label,
                ]}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke={selectedAsset.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: selectedAsset.color }}
                isAnimationActive={true}
                animationDuration={600}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
