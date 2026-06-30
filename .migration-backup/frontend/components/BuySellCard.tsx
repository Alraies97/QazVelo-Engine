"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import {
  OrderSide,
  OrderType,
  type MockOrder,
  type WalletSummary,
} from "@/lib/types";

type UiOrderType = "market" | "limit";
type UiOrderSide = "buy" | "sell";

export function BuySellCard() {
  const [side, setSide] = React.useState<UiOrderSide>("buy");
  const [orderType, setOrderType] = React.useState<UiOrderType>("market");
  const [asset, setAsset] = React.useState("BTC");
  const [quantity, setQuantity] = React.useState("");
  const [price, setPrice] = React.useState("65500");
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      // The order schema requires the wallet id, so resolve it first.
      const { data: summary } = await api.get<WalletSummary>("/wallet");

      const payload = {
        wallet_id: summary.wallet.id,
        asset_symbol: asset,
        order_type: orderType === "market" ? OrderType.MARKET : OrderType.LIMIT,
        side: side === "buy" ? OrderSide.BUY : OrderSide.SELL,
        price: Number(price),
        quantity: Number(quantity),
      };

      const { data: order } = await api.post<MockOrder>(
        "/wallet/orders",
        payload
      );

      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("wallet:updated"));
      }

      setFeedback({
        type: "success",
        message: `Order #${order.id} ${order.status.toLowerCase()}: ${order.side} ${order.quantity} ${order.asset_symbol}`,
      });
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response
        ?.status;
      const detail = (
        err as { response?: { data?: { detail?: string } } }
      ).response?.data?.detail;
      let message = detail ?? "Failed to place order. Please try again.";
      if (status === 401) {
        message = "Authentication required. Please sign in to trade.";
      } else if (status === 404) {
        message = "No wallet found. Create a mock wallet first.";
      }
      setFeedback({ type: "error", message });
    } finally {
      setLoading(false);
    }
  };

  const total = Number(quantity) * Number(price);

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-6">
        <div className="flex bg-accent rounded-lg p-1 w-full">
          <button
            onClick={() => setSide("buy")}
            className={cn(
              "flex-1 py-2 rounded-md font-semibold text-sm transition-all duration-200",
              side === "buy"
                ? "bg-green-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setSide("sell")}
            className={cn(
              "flex-1 py-2 rounded-md font-semibold text-sm transition-all duration-200",
              side === "sell"
                ? "bg-red-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sell
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Asset Selector */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Asset</label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value)}
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="BTC">BTC/USD</option>
            <option value="ETH">ETH/USD</option>
            <option value="AAPL">AAPL/USD</option>
          </select>
        </div>

        {/* Order Type */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Order Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType("market")}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                orderType === "market"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={cn(
                "flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all",
                orderType === "limit"
                  ? "bg-primary text-primary-foreground"
                  : "bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              Limit
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-2">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Price (for limit orders only) */}
        {orderType === "limit" && (
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-2">Price</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        {/* Total */}
        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-muted-foreground">Total</span>
          <span className="font-bold text-foreground">${total.toFixed(2)}</span>
        </div>

        {feedback && (
          <div
            className={cn(
              "text-sm rounded-lg px-3 py-2",
              feedback.type === "success"
                ? "bg-green-600/10 text-green-500"
                : "bg-red-600/10 text-red-500"
            )}
          >
            {feedback.message}
          </div>
        )}

        {/* Submit Button */}
        <Button
          className={cn(
            "w-full py-6 text-lg font-bold",
            side === "buy" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
          )}
          onClick={handleSubmit}
          disabled={loading || !quantity}
        >
          {loading ? "Processing..." : `${side === "buy" ? "Buy" : "Sell"} ${asset}`}
        </Button>
      </div>
    </div>
  );
}
