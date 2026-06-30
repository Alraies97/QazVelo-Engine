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
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import api, { getAccessToken } from "@/lib/api";
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
  const wsRef = React.useRef<WebSocket | null>(null);

  React.useEffect(() => {
    void fetchMarketAnalytics();
    void fetchOrders();
  }, []);

  React.useEffect(() => {
    void fetchAnalyticsHistory(historyPage);
  }, [historyPage]);

  React.useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchMarketAnalytics = async () => {
    setAnalyticsLoading(true);
    setError(null);
    try {
      const { data } = await api.post<TickerCalculateResponse>(
        "/analytics/ticker-calculate",
        {
          ticker: "BTC-USD",
          period: "1mo",
          calculation_window: 3,
        }
      );
      setMetrics(data.metrics);
      setSource(data.source);
    } catch (err) {
      const status =
        (err as { response?: { status?: number } }).response?.status;
      setError(
        status === 401
          ? "Authentication required. Please sign in to access analytics."
          : `Unable to load analytics data. ${
              (err as Error).message ?? "Is the backend running?"
            }`
      );
      console.error("fetchMarketAnalytics error:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchOrders = async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const response = await api.get<MockOrder[]>('/analytics/orders-history');
      setOrders(response.data || []);
    } catch (err) {
      console.error('Failed to fetch orders', err);
      const status = (err as { response?: { status?: number } }).response?.status;
      setOrdersError(
        status === 401
          ? 'Authentication required. Please sign in to view order history.'
          : `Failed to load orders: ${(err as Error).message}`
      );
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchAnalyticsHistory = async (page = 1) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const { data } = await api.get<PaginatedAnalyticsResponse>(
        '/analytics/history',
        {
          params: {
            page,
            page_size: 10,
          },
        }
      );
      setHistory(data.results ?? []);
      setHistoryTotal(data.total);
    } catch (err) {
      console.error('Failed to load analytics history', err);
      const status = (err as { response?: { status?: number } }).response?.status;
      setHistoryError(
        status === 401
          ? 'Authentication required. Please sign in to access analytics history.'
          : `Failed to load analytics history: ${(err as Error).message}`
      );
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchLiveMarketAnalytics = async () => {
    setLiveCalcLoading(true);
    setLiveCalcError(null);
    try {
      const { data } = await api.get<TickerCalculateResponse>('/analytics/live-calculate', {
        params: {
          metric_name: 'BTC-USD',
          period: 5,
        },
      });
      setLiveCalcData(data);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      setLiveCalcError(
        status === 401
          ? 'Authentication required. Please sign in to fetch live market analytics.'
          : `Failed to fetch live analytics: ${(err as Error).message}`
      );
    } finally {
      setLiveCalcLoading(false);
    }
  };

  const buildWebSocketUrl = () => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      throw new Error('Authentication required to connect to analytics websocket.');
    }

    const baseUrl = api.defaults.baseURL ?? window.location.origin;
    const url = new URL(baseUrl);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/api/v1/ws/analytics';
    url.searchParams.set('token', accessToken);
    return url.toString();
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    setWsError(null);
    setWsMessages([]);
    try {
      const socket = new WebSocket(buildWebSocketUrl());
      wsRef.current = socket;

      socket.onopen = () => setWsConnected(true);
      socket.onmessage = (event) => {
        setWsMessages((messages) => [...messages, event.data]);
      };
      socket.onclose = () => setWsConnected(false);
      socket.onerror = () => setWsError('WebSocket connection failed. Please check your network and login state.');
    } catch (err) {
      setWsError((err as Error).message);
      setWsConnected(false);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsConnected(false);
  };

  const sendWebSocketMetric = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setWsError('WebSocket is not connected. Connect first to stream live analytics.');
      return;
    }

    const payload = {
      metric_name: 'BTC-USD',
      metric_value: Math.round((Math.random() * 100 + 30000) * 100) / 100,
      extra_payload: {
        source: 'browser-demo',
        timestamp: new Date().toISOString(),
      },
    };

    wsRef.current.send(JSON.stringify(payload));
  };

  const chartData: ChartPoint[] = React.useMemo(() => {
    if (!metrics) return [];
    return metrics.simple_moving_average.map((value, index) => ({
      time: `T${index + 1}`,
      sma: value,
    }));
  }, [metrics]);

  const handleExport = async () => {
    setError(null);
    try {
      const response = await api.get('/analytics/export', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `qazvelo-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export', err);
      setError(`Failed to export data: ${(err as Error).message}`);
    }
  };

  const filteredOrders =
    statusFilter === "ALL"
      ? orders
      : orders.filter((order) => order.status === statusFilter);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            Financial Analyst Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Audit execution system and perform data analysis
          </p>
        </div>
        <Button onClick={handleExport} className="bg-primary">
          Export Data to CSV
        </Button>
      </div>

      {/* Chart Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">
              Live SMA Market Indicator
            </h2>
            <p className="text-sm text-muted-foreground">
              {source ? `Source: ${source}` : "Loading analytics source..."}
            </p>
          </div>
          {analyticsLoading && (
            <div className="text-sm text-muted-foreground">Loading analytics...</div>
          )}
        </div>
        <div className="h-80">
          {error ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground px-4">
              {error}
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-muted-foreground px-4">
              {analyticsLoading ? "Fetching chart data..." : "No metrics available yet."}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="sma" stroke="hsl(var(--primary))" strokeWidth={3} name="SMA" dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Audit Table Section */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-foreground">
            Order History Audit Table
          </h2>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground">
              Filter by Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-background border border-border rounded-lg text-foreground text-sm"
            >
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
                  <td colSpan={8} className="px-6 py-12 text-center">
                    Loading orders...
                  </td>
                </tr>
                ) : ordersError ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-red-500">
                      {ordersError}
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    No orders found matching your filters
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-6 py-4 font-mono">{order.id}</td>
                    <td className="px-6 py-4 font-medium text-foreground">
                      {order.asset_symbol}
                    </td>
                    <td className="px-6 py-4">{order.order_type}</td>
                    <td
                      className={`px-6 py-4 font-semibold ${
                        order.side === "BUY"
                          ? "text-green-500"
                          : "text-red-500"
                      }`}
                    >
                      {order.side}
                    </td>
                    <td className="px-6 py-4">
                      ${order.price ? order.price.toFixed(2) : "-"}
                    </td>
                    <td className="px-6 py-4">{order.quantity.toFixed(4)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                          order.status === "EXECUTED"
                            ? "bg-green-500/10 text-green-500"
                            : order.status === "PENDING"
                            ? "bg-yellow-500/10 text-yellow-500"
                            : "bg-red-500/10 text-red-500"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live analytics and websocket tools */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Live Analytics Fetch
              </h2>
              <p className="text-sm text-muted-foreground">
                Hit the live analytics endpoint for a fast market snapshot.
              </p>
            </div>
            <Button
              onClick={fetchLiveMarketAnalytics}
              disabled={liveCalcLoading}
              className="bg-primary"
            >
              {liveCalcLoading ? "Fetching..." : "Fetch Live"
              }
            </Button>
          </div>
          {liveCalcError && (
            <div className="text-sm text-red-500 mb-4">{liveCalcError}</div>
          )}
          {liveCalcData ? (
            <div className="space-y-3 text-sm text-foreground">
              <div>
                <span className="font-semibold">Source:</span> {liveCalcData.source}
              </div>
              <div>
                <span className="font-semibold">Status:</span> {liveCalcData.status}
              </div>
              <div>
                <span className="font-semibold">Computed at:</span>{" "}
                {new Date(liveCalcData.computed_at).toLocaleString()}
              </div>
              <div>
                <span className="font-semibold">SMA points:</span> {liveCalcData.metrics.simple_moving_average.length}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No live analytics data loaded yet.
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">
                Analytics History
              </h2>
              <p className="text-sm text-muted-foreground">
                Browse historical analytics records stored for your account.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => setHistoryPage((page) => Math.max(page - 1, 1))}
                disabled={historyLoading || historyPage <= 1}
              >
                Previous
              </Button>
              <Button
                variant="secondary"
                onClick={() => setHistoryPage((page) => page + 1)}
                disabled={historyLoading || (historyTotal !== null && historyPage * 10 >= historyTotal)}
              >
                Next
              </Button>
            </div>
          </div>

          {historyLoading ? (
            <div className="py-12 text-center text-muted-foreground">
              Loading history...
            </div>
          ) : historyError ? (
            <div className="py-12 text-center text-red-500">
              {historyError}
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No analytics history available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-muted-foreground">
                <thead className="bg-accent/50 text-foreground text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3">Metric</th>
                    <th className="px-4 py-3">Value</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id ?? `${record.metric_name}-${record.timestamp}`} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-foreground">{record.metric_name}</td>
                      <td className="px-4 py-3">{record.metric_value}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {new Date(record.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground break-words">
                        {record.extra_payload ? JSON.stringify(record.extra_payload) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 text-xs text-muted-foreground">
            Page {historyPage} {historyTotal !== null ? `of ${Math.ceil(historyTotal / 10)}` : ""}
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Analytics WebSocket Stream</h2>
            <p className="text-sm text-muted-foreground">
              Connect to the `/ws/analytics` socket and send sample metric payloads.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={connectWebSocket} disabled={wsConnected} className="bg-primary">
              Connect
            </Button>
            <Button onClick={disconnectWebSocket} disabled={!wsConnected} variant="secondary">
              Disconnect
            </Button>
            <Button onClick={sendWebSocketMetric} disabled={!wsConnected} variant="secondary">
              Send Metric
            </Button>
          </div>
        </div>

        {wsError && <div className="text-sm text-red-500 mb-4">{wsError}</div>}
        <div className="text-sm text-muted-foreground mb-4">
          Status: {wsConnected ? "Connected" : "Disconnected"}
        </div>
        <div className="max-h-56 overflow-auto rounded-xl border border-border bg-background p-4 text-xs text-muted-foreground">
          {wsMessages.length === 0 ? (
            <div>No websocket messages yet.</div>
          ) : (
            wsMessages.map((message, index) => (
              <div key={`${index}-${message}`} className="mb-2 break-words">
                {message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
