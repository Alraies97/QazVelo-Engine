import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import api, { getAccessToken } from "@/lib/api";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ReconnectingWebSocket } from "@/lib/ws";
import type {
  AnalyticsMetrics,
  AnalyticsRecord,
  MockOrder,
  PaginatedAnalyticsResponse,
  TickerCalculateResponse,
} from "@/lib/types";

interface ChartPoint {
  time: string;
  sma: number;
}

export function AnalyticsView() {
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [orders, setOrders] = React.useState<MockOrder[]>([]);
  const [metrics, setMetrics] = React.useState<AnalyticsMetrics | null>(null);
  const [source, setSource] = React.useState<string | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = React.useState(false);
  const [ordersLoading, setOrdersLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [ordersError, setOrdersError] = React.useState<string | null>(null);
  const [history, setHistory] = React.useState<AnalyticsRecord[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);
  const [historyPage, setHistoryPage] = React.useState(1);
  const [historyTotal, setHistoryTotal] = React.useState<number | null>(null);
  const [liveCalcLoading, setLiveCalcLoading] = React.useState(false);
  const [liveCalcData, setLiveCalcData] = React.useState<TickerCalculateResponse | null>(null);
  const [liveCalcError, setLiveCalcError] = React.useState<string | null>(null);
  const [wsConnected, setWsConnected] = React.useState(false);
  const [wsMessages, setWsMessages] = React.useState<string[]>([]);
  const [wsError, setWsError] = React.useState<string | null>(null);
  const wsRef = React.useRef<ReconnectingWebSocket | null>(null);

  React.useEffect(() => {
    void fetchMarketAnalytics();
    void fetchOrders();
  }, []);

  React.useEffect(() => {
    void fetchAnalyticsHistory(historyPage);
  }, [historyPage]);

  React.useEffect(() => {
    return () => {
      wsRef.current?.stop();
      wsRef.current = null;
    };
  }, []);

  const hasLoadedRef = React.useRef(false);

  const fetchMarketAnalytics = async () => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    setAnalyticsLoading(true);
    setError(null);
    try {
      const { data } = await api.post<TickerCalculateResponse>("/analytics/ticker-calculate", {
        ticker: "BTC-USD",
        period: "1mo",
        calculation_window: 3,
      });
      setMetrics(data.metrics);
      setSource(data.source);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const msg = status === 401
        ? "Authentication required. Please sign in to access analytics."
        : status === 404
        ? "Historical data unavailable for BTC-USD."
        : "Unable to load analytics data.";
      setError(msg);
      toast.error("Analytics: Failed to load market data.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const response = await api.get<MockOrder[]>("/analytics/orders-history");
      setOrders(response.data || []);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setOrdersError(
        status === 401
          ? "Authentication required. Please sign in to view order history."
          : "Failed to load orders."
      );
      toast.error("Analytics: Failed to load order history.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchAnalyticsHistory = async (page = 1) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data } = await api.get<PaginatedAnalyticsResponse>("/analytics/history", {
        params: { page, page_size: 10 },
      });
      setHistory(data.results ?? []);
      setHistoryTotal(data.total);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setHistoryError(
        status === 401
          ? "Authentication required."
          : "Failed to load analytics history."
      );
      toast.error("Analytics: Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchLiveMarketAnalytics = async () => {
    setLiveCalcLoading(true);
    setLiveCalcError(null);
    try {
      const { data } = await api.get<TickerCalculateResponse>("/analytics/live-calculate", {
        params: { metric_name: "BTC-USD:SMA_3", period: 5 },
      });
      setLiveCalcData(data);
      toast.success("Live analytics fetched successfully.");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setLiveCalcError(
        status === 401
          ? "Authentication required."
          : "Failed to fetch live analytics."
      );
      toast.error("Live analytics fetch failed.");
    } finally {
      setLiveCalcLoading(false);
    }
  };

  const buildWebSocketUrl = () => {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error("Authentication required to connect to analytics websocket.");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = new URL(`${protocol}//${window.location.host}/api/v1/ws/analytics`);
    url.searchParams.set("token", accessToken);
    return url.toString();
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    setWsError(null);
    setWsMessages([]);
    try {
      const ws = new ReconnectingWebSocket(buildWebSocketUrl(), {
        onOpen: () => {
          setWsConnected(true);
          setWsError(null);
        },
        onMessage: (event) => {
          setWsMessages((msgs) => [...msgs, event.data as string]);
        },
        onClose: () => {
          setWsConnected(false);
        },
        onError: (err) => {
          setWsError("WebSocket connection failed.");
          setWsConnected(false);
        },
      });
      wsRef.current = ws;
      ws.start();
    } catch (err) {
      setWsError((err as Error).message);
      setWsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    wsRef.current?.stop();
    wsRef.current = null;
    setWsConnected(false);
  };

  const sendWebSocketMetric = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setWsError("WebSocket is not connected. Connect first.");
      toast.error("WebSocket not connected.");
      return;
    }
    const payload = {
      metric_name: "BTC-USD",
      metric_value: Math.round((Math.random() * 100 + 30000) * 100) / 100,
      extra_payload: { source: "browser-demo", timestamp: new Date().toISOString() },
    };
    wsRef.current.send(JSON.stringify(payload));
    toast.success("Test metric sent.");
  };

  const chartData: ChartPoint[] = React.useMemo(() => {
    if (!metrics) return [];
    return metrics.simple_moving_average.map((value, index) => ({ time: `T${index + 1}`, sma: value }));
  }, [metrics]);

  const handleExport = async () => {
    setError(null);
    try {
      const response = await api.get("/analytics/export", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `qazvelo-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Export downloaded.");
    } catch (err) {
      setError(`Failed to export data: ${(err as Error).message}`);
      toast.error("Export failed.");
    }
  };

  const filteredOrders = statusFilter === "ALL" ? orders : orders.filter((o) => o.status === statusFilter);
  const totalHistoryPages = historyTotal != null ? Math.ceil(historyTotal / 10) : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Financial Analyst Dashboard</h1>
          <p className="text-muted-foreground mt-2">Audit execution system and perform data analysis</p>
        </div>
        <Button onClick={handleExport} className="bg-primary hover:bg-primary/80 text-primary-foreground font-semibold">
          Export Data to CSV
        </Button>
      </div>

      {/* Chart Section */}
      <div className="glass terminal-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Live SMA Market Indicator</h2>
            <p className="text-sm text-muted-foreground">
              {source ? `Source: ${source}` : "Loading analytics source..."}
            </p>
          </div>
          {analyticsLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              Loading analytics...
            </div>
          )}
        </div>
        <div className="h-80">
          {error ? (
            <div className="h-full flex items-center justify-center text-center gap-3 text-muted-foreground px-4">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <span className="text-destructive text-lg">!</span>
              </div>
              <span className="text-sm">{error}</span>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground px-4">
              {analyticsLoading ? (
                <>
                  <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  <span className="text-sm">Fetching chart data...</span>
                </>
              ) : (
                <>
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground text-lg">?</span>
                  </div>
                  <span className="text-sm">No metrics available yet.</span>
                </>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12, fontFamily: "var(--app-font-mono)" }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12, fontFamily: "var(--app-font-mono)" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "0.5rem", color: "hsl(var(--foreground))", fontFamily: "var(--app-font-mono)", fontSize: "12px" }} />
                <Legend />
                <Line type="monotone" dataKey="sma" stroke="hsl(var(--primary))" strokeWidth={2} name="SMA" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Order History */}
      <div className="glass terminal-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">Order History Audit Table</h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">Filter by Status:</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="ALL">All</option>
              <option value="PENDING">Pending</option>
              <option value="EXECUTED">Executed</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-muted-foreground">
            <thead className="bg-accent/50 text-foreground text-xs uppercase">
              <tr>
                <th className="px-6 py-3">Order ID</th>
                <th className="px-6 py-3">Asset</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Side</th>
                <th className="px-6 py-3">Price</th>
                <th className="px-6 py-3">Quantity</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created At</th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12">
                    <div className="space-y-3">
                      <Skeleton className="h-5 w-full rounded" />
                      <Skeleton className="h-5 w-full rounded" />
                      <Skeleton className="h-5 w-full rounded" />
                    </div>
                  </td>
                </tr>
              ) : ordersError ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center text-danger">{ordersError}</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-12 text-center">No orders found matching your filters</td></tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="px-6 py-4 font-mono text-terminal-data">{order.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">{order.asset_symbol}</td>
                    <td className="px-6 py-4">{order.order_type}</td>
                    <td className={cn("px-6 py-4 font-semibold", order.side === "BUY" ? "text-success" : "text-danger")}>{order.side}</td>
                    <td className="px-6 py-4 text-terminal-data">${order.price ? order.price.toFixed(2) : "—"}</td>
                    <td className="px-6 py-4 text-terminal-data">{order.quantity.toFixed(4)}</td>
                    <td className="px-6 py-4">
                      <span className={cn("inline-flex px-2 py-1 rounded-full text-xs font-semibold",
                        order.status === "EXECUTED" ? "bg-success/10 text-success" : order.status === "PENDING" ? "bg-warning/10 text-warning" : "bg-danger/10 text-danger"
                      )}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">{new Date(order.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live tools */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass terminal-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Live Analytics Fetch</h2>
              <p className="text-sm text-muted-foreground">Hit the live analytics endpoint for a fast market snapshot.</p>
            </div>
            <Button onClick={fetchLiveMarketAnalytics} disabled={liveCalcLoading} className="bg-primary hover:bg-primary/80 font-semibold">
              {liveCalcLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Fetching...
                </span>
              ) : (
                "Fetch Live"
              )}
            </Button>
          </div>
          {liveCalcError && <p className="text-sm text-danger mb-3">{liveCalcError}</p>}
          {liveCalcData && (
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">Source: <span className="text-foreground text-terminal-data">{liveCalcData.source}</span></p>
              <p className="text-muted-foreground">Status: <span className="text-foreground text-terminal-data">{liveCalcData.status}</span></p>
              <p className="text-muted-foreground">SMA points: <span className="text-foreground text-terminal-data">{liveCalcData.metrics.simple_moving_average.length}</span></p>
            </div>
          )}
        </div>

        <div className="glass terminal-border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-2">WebSocket Stream</h2>
          <p className="text-sm text-muted-foreground mb-4">Connect to the live analytics WebSocket feed.</p>
          <div className="flex gap-2 mb-4">
            <Button onClick={connectWebSocket} disabled={wsConnected} size="sm" className="bg-primary hover:bg-primary/80 font-semibold">Connect</Button>
            <Button onClick={disconnectWebSocket} disabled={!wsConnected} size="sm" variant="outline">Disconnect</Button>
          </div>
          <div className={cn("text-xs mb-2 font-mono", wsConnected ? "text-success" : "text-muted-foreground")}>
            {wsConnected ? "● Connected" : "● Disconnected"}
          </div>
          {wsError && <p className="text-xs text-danger mb-2">{wsError}</p>}
          {wsConnected && (
            <Button onClick={sendWebSocketMetric} size="sm" variant="outline" className="mb-3">Send Test Metric</Button>
          )}
          {wsMessages.length > 0 && (
            <div className="bg-background rounded-lg p-3 max-h-32 overflow-y-auto text-xs font-mono text-foreground space-y-1 border border-border">
              {wsMessages.slice(-10).map((msg, i) => <div key={i}>{msg}</div>)}
            </div>
          )}
        </div>

        <div className="glass terminal-border rounded-xl p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-foreground mb-2">Analytics History</h2>
          <p className="text-sm text-muted-foreground mb-4">Paginated record of past analytics computations.</p>
          {historyLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
              <Skeleton className="h-4 w-full rounded" />
            </div>
          ) : historyError ? (
            <p className="text-sm text-danger">{historyError}</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No history yet.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {history.map((r, i) => (
                <div key={r.id ?? i} className="flex justify-between text-foreground">
                  <span className="text-muted-foreground truncate mr-2">{r.metric_name}</span>
                  <span className="font-mono text-terminal-data">{r.metric_value.toFixed(2)}</span>
                </div>
              ))}
              {totalHistoryPages && totalHistoryPages > 1 && (
                <div className="flex gap-2 mt-3">
                  <Button size="sm" variant="outline" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => p - 1)}>Prev</Button>
                  <span className="text-xs text-muted-foreground self-center">Page {historyPage} / {totalHistoryPages}</span>
                  <Button size="sm" variant="outline" disabled={historyPage >= totalHistoryPages} onClick={() => setHistoryPage((p) => p + 1)}>Next</Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
