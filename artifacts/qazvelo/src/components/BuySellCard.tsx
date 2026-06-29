import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderType, OrderSide } from "@/lib/types";
import type { MockOrder, WalletSummary } from "@/lib/types";

type UiOrderType = "market" | "limit";
type UiOrderSide = "buy" | "sell";

const ASSETS = [
  { value: "BTC", label: "BTC/USD" },
  { value: "ETH", label: "ETH/USD" },
  { value: "AAPL", label: "AAPL/USD" },
];

export function BuySellCard() {
  const [side, setSide] = React.useState<UiOrderSide>("buy");
  const [orderType, setOrderType] = React.useState<UiOrderType>("market");
  const [asset, setAsset] = React.useState("BTC");
  const [quantity, setQuantity] = React.useState("");
  const [price, setPrice] = React.useState("65500");
  const [loading, setLoading] = React.useState(false);

  const [walletBalance, setWalletBalance] = React.useState<number | null>(null);
  const [positions, setPositions] = React.useState<{ asset_symbol: string; quantity: number }[]>([]);
  const [walletLoading, setWalletLoading] = React.useState(true);

  const fetchWallet = React.useCallback(async () => {
    try {
      const { data } = await api.get<WalletSummary>("/wallet");
      setWalletBalance(data.wallet.balance);
      setPositions(data.positions ?? []);
    } catch {
      setWalletBalance(null);
      setPositions([]);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchWallet();
    const handler = () => fetchWallet();
    window.addEventListener("wallet:updated", handler);
    return () => window.removeEventListener("wallet:updated", handler);
  }, [fetchWallet]);

  const qty = Number(quantity);
  const px = Number(price);
  const total = qty * px;

  const currentPosition = positions.find((p) => p.asset_symbol === asset);
  const heldQuantity = currentPosition?.quantity ?? 0;

  const insufficientFunds =
    side === "buy" &&
    walletBalance !== null &&
    qty > 0 &&
    px > 0 &&
    total > walletBalance;

  const insufficientPosition =
    side === "sell" && qty > 0 && qty > heldQuantity;

  const hasWarning = insufficientFunds || insufficientPosition;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: summary } = await api.get<WalletSummary>("/wallet");

      const payload = {
        wallet_id: summary.wallet.id,
        asset_symbol: asset,
        order_type: orderType === "market" ? OrderType.MARKET : OrderType.LIMIT,
        side: side === "buy" ? OrderSide.BUY : OrderSide.SELL,
        price: Number(price),
        quantity: Number(quantity),
      };

      const { data: order } = await api.post<MockOrder>("/wallet/orders", payload);

      setWalletBalance(summary.wallet.balance);
      setPositions(summary.positions ?? []);
      window.dispatchEvent(new Event("wallet:updated"));

      toast.success(
        `Order #${order.id} ${order.status.toLowerCase()}: ${order.side} ${order.quantity} ${order.asset_symbol}`
      );

      setQuantity("");
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
      let message = detail ?? "Failed to place order. Please try again.";
      if (status === 401) {
        message = "Authentication required. Please sign in to trade.";
      } else if (status === 404) {
        message = "No wallet found. Create a mock wallet first.";
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass terminal-border rounded-xl p-6 shadow-sm flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex bg-secondary rounded-lg p-1 w-full">
          <button
            onClick={() => setSide("buy")}
            className={cn(
              "flex-1 py-2.5 rounded-md font-semibold text-sm transition-all duration-200",
              side === "buy"
                ? "bg-success text-success-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Buy
          </button>
          <button
            onClick={() => setSide("sell")}
            className={cn(
              "flex-1 py-2.5 rounded-md font-semibold text-sm transition-all duration-200",
              side === "sell"
                ? "bg-danger text-danger-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Sell
          </button>
        </div>
      </div>

      {/* Balance / Position display */}
      <div className="flex justify-between items-center mb-4 px-1">
        {side === "buy" ? (
          <div className="text-sm text-muted-foreground">
            Available:{" "}
            <span className={cn("font-semibold text-terminal-data", walletLoading ? "text-muted-foreground" : "text-foreground")}>
              {walletLoading
                ? <Skeleton className="h-4 w-24 inline-block rounded" />
                : walletBalance !== null
                ? `$${walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : "—"}
            </span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            {asset} held:{" "}
            <span className="font-semibold text-terminal-data text-foreground">
              {heldQuantity > 0 ? heldQuantity : "0"}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-4 flex-1">
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">Asset</label>
          <div className="flex gap-2">
            {ASSETS.map((a) => (
              <button
                key={a.value}
                onClick={() => setAsset(a.value)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm font-medium transition-all border",
                  asset === a.value
                    ? "bg-primary/10 border-primary text-primary-foreground"
                    : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">Order Type</label>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType("market")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all border",
                orderType === "market"
                  ? "bg-primary/10 border-primary text-primary-foreground"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              )}
            >
              Market
            </button>
            <button
              onClick={() => setOrderType("limit")}
              className={cn(
                "flex-1 py-2 rounded-lg text-sm font-medium transition-all border",
                orderType === "limit"
                  ? "bg-primary/10 border-primary text-primary-foreground"
                  : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              )}
            >
              Limit
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">Quantity</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="0.00"
            className={cn(
              "w-full px-4 py-3 bg-background border rounded-lg text-foreground text-terminal-data focus:outline-none focus:ring-2 focus:ring-primary transition-all",
              hasWarning ? "border-destructive" : "border-border"
            )}
          />
        </div>

        {orderType === "limit" && (
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Price</label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground text-terminal-data focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className={cn("font-bold text-terminal-data text-lg", hasWarning ? "text-danger" : "text-foreground")}>
            ${total.toFixed(2)}
          </span>
        </div>

        {/* Pre-trade warnings */}
        {insufficientFunds && (
          <div className="text-sm rounded-lg px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20">
            Insufficient balance — need{" "}
            <span className="font-semibold">${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            {walletBalance !== null && (
              <>, have{" "}
                <span className="font-semibold">${walletBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </>
            )}
            .
          </div>
        )}

        {insufficientPosition && (
          <div className="text-sm rounded-lg px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20">
            Insufficient {asset} — need{" "}
            <span className="font-semibold">{qty}</span>
            , hold{" "}
            <span className="font-semibold">{heldQuantity}</span>.
          </div>
        )}

        <Button
          className={cn(
            "w-full py-6 text-lg font-bold tracking-tight",
            side === "buy"
              ? "bg-success hover:bg-success/80 text-success-foreground"
              : "bg-danger hover:bg-danger/80 text-danger-foreground"
          )}
          onClick={handleSubmit}
          disabled={loading || !quantity || hasWarning}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Processing…
            </span>
          ) : (
            `${side === "buy" ? "Buy" : "Sell"} ${asset}`
          )}
        </Button>
      </div>
    </div>
  );
}
