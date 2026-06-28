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
import api from "@/lib/api";

// Mock price/SMA data for chart (will fetch from backend later)
const mockChartData = [
  { time: "09:00", price: 64250, sma: 64100 },
  { time: "10:00", price: 64500, sma: 64200 },
  { time: "11:00", price: 64300, sma: 64350 },
  { time: "12:00", price: 65000, sma: 64600 },
  { time: "13:00", price: 64800, sma: 64750 },
  { time: "14:00", price: 65200, sma: 64950 },
  { time: "15:00", price: 65500, sma: 65150 },
];

// Mock order data (will fetch from backend endpoint /analytics/orders-history later)
interface MockOrder {
  id: number;
  asset_symbol: string;
  order_type: "MARKET" | "LIMIT";
  side: "BUY" | "SELL";
  price: number | null;
  quantity: number;
  status: "PENDING" | "EXECUTED" | "CANCELED";
  created_at: string;
}

const mockOrders: MockOrder[] = [
  {
    id: 1,
    asset_symbol: "BTC",
    order_type: "MARKET",
    side: "BUY",
    price: 65500,
    quantity: 0.1,
    status: "EXECUTED",
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    asset_symbol: "ETH",
    order_type: "LIMIT",
    side: "SELL",
    price: 3200,
    quantity: 2,
    status: "PENDING",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

export function AnalyticsView() {
  const [statusFilter, setStatusFilter] = React.useState<string>("ALL");
  const [orders, setOrders] = React.useState<MockOrder[]>(mockOrders);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    // Uncomment to fetch real data from backend when auth is set up
    // fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const response = await api.get("/analytics/orders-history");
      setOrders(response.data);
    } catch (err) {
      console.error("Failed to fetch orders", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await api.get("/analytics/export", {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `qazvelo-export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Failed to export", err);
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
        <h2 className="text-xl font-semibold text-foreground mb-6">
          Live Price & SMA Indicator
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockChartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="time"
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                tick={{ fontSize: 12 }}
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
              <Legend />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                name="Price"
              />
              <Line
                type="monotone"
                dataKey="sma"
                stroke="#10b981"
                strokeWidth={2}
                strokeDasharray="5 5"
                name="SMA"
              />
            </LineChart>
          </ResponsiveContainer>
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
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    Loading orders...
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
    </div>
  );
}
