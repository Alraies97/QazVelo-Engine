"use client";

import * as React from "react";
import { Wallet as WalletIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { formatCurrency, formatNumber, formatDateTime } from "@/lib/format";
import { OrderSide, OrderStatus, type WalletSummary } from "@/lib/types";

export function WalletView() {
  const [summary, setSummary] = React.useState<WalletSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadWallet = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<WalletSummary>("/wallet");
      setSummary(data);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      if (status === 404) {
        // No wallet yet — create the mock wallet, then load it.
        try {
          await api.post("/wallet");
          const { data } = await api.get<WalletSummary>("/wallet");
          setSummary(data);
          return;
        } catch {
          setError("Could not create a mock wallet. Please try again.");
        }
      } else if (status === 401) {
        setError("Authentication required. Please sign in to view your wallet.");
      } else {
        setError("Unable to load wallet. Is the backend running?");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadWallet();
  }, [loadWallet]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Wallet</h1>
          <p className="text-sm text-muted-foreground">
            Your mock balance, positions, and recent orders.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadWallet}
          disabled={loading}
          className="gap-2"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      {error ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          {error}
        </div>
      ) : loading && !summary ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          Loading wallet...
        </div>
      ) : summary ? (
        <>
          {/* Balance card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-2 text-muted-foreground">
              <WalletIcon size={18} />
              <span className="text-sm font-medium">Available Balance</span>
            </div>
            <div className="text-4xl font-bold text-foreground">
              {formatCurrency(summary.wallet.balance, summary.wallet.currency)}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Wallet #{summary.wallet.id} · created{" "}
              {formatDateTime(summary.wallet.created_at)}
            </p>
          </div>

          {/* Positions */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-4">Positions</h2>
            {summary.positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open positions yet. Place a buy order to open one.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4 font-medium">Asset</th>
                      <th className="py-2 pr-4 font-medium">Quantity</th>
                      <th className="py-2 pr-4 font-medium">Avg Entry</th>
                      <th className="py-2 pr-4 font-medium">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.positions.map((pos) => (
                      <tr
                        key={pos.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-3 pr-4 font-semibold text-foreground">
                          {pos.asset_symbol}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {formatNumber(pos.quantity)}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {formatCurrency(pos.average_entry_price)}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {formatCurrency(
                            pos.quantity * pos.average_entry_price
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent orders */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-4">
              Recent Orders
            </h2>
            {summary.recent_orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="py-2 pr-4 font-medium">#</th>
                      <th className="py-2 pr-4 font-medium">Side</th>
                      <th className="py-2 pr-4 font-medium">Type</th>
                      <th className="py-2 pr-4 font-medium">Asset</th>
                      <th className="py-2 pr-4 font-medium">Qty</th>
                      <th className="py-2 pr-4 font-medium">Price</th>
                      <th className="py-2 pr-4 font-medium">Status</th>
                      <th className="py-2 pr-4 font-medium">Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.recent_orders.map((order) => (
                      <tr
                        key={order.id}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-3 pr-4 text-muted-foreground">
                          {order.id}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "font-semibold",
                              order.side === OrderSide.BUY
                                ? "text-green-500"
                                : "text-red-500"
                            )}
                          >
                            {order.side}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {order.order_type}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {order.asset_symbol}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {formatNumber(order.quantity)}
                        </td>
                        <td className="py-3 pr-4 text-foreground">
                          {order.price != null
                            ? formatCurrency(order.price)
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-xs font-medium",
                              order.status === OrderStatus.EXECUTED
                                ? "bg-green-600/10 text-green-500"
                                : order.status === OrderStatus.CANCELED
                                  ? "bg-red-600/10 text-red-500"
                                  : "bg-yellow-600/10 text-yellow-500"
                            )}
                          >
                            {order.status}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {formatDateTime(order.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
