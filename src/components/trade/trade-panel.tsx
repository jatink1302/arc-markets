"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { quoteBuy, quoteSell, type CurveParams } from "@/lib/amm";
import { placeTrade } from "@/app/actions/trade";
import { formatMoney } from "@/lib/utils";

export function TradePanel({
  playerId,
  curve,
  balance,
  heldQuantity,
}: {
  playerId: string;
  curve: CurveParams;
  balance: number;
  heldQuantity: number;
}) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [quantity, setQuantity] = useState("1");
  const [isPending, startTransition] = useTransition();

  const parsedQuantity = Number(quantity);
  const isValidQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0;

  const quote = useMemo(() => {
    if (!isValidQuantity) return null;
    try {
      return side === "BUY"
        ? quoteBuy(curve, parsedQuantity)
        : quoteSell(curve, parsedQuantity);
    } catch {
      return null;
    }
  }, [curve, side, parsedQuantity, isValidQuantity]);

  const insufficientFunds = side === "BUY" && quote !== null && quote.amount > balance;
  const insufficientShares = side === "SELL" && isValidQuantity && parsedQuantity > heldQuantity;
  const canSubmit = isValidQuantity && quote !== null && !insufficientFunds && !insufficientShares;

  function handleSubmit() {
    startTransition(async () => {
      const result = await placeTrade(playerId, side, parsedQuantity);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${result.trade.side === "BUY" ? "Bought" : "Sold"} ${result.trade.quantity.toFixed(2)} @ $${formatMoney(result.trade.price)}`,
      );
      setQuantity("1");
    });
  }

  return (
    <div className="sticky top-20 flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <Tabs value={side} onValueChange={(v) => setSide(v as "BUY" | "SELL")}>
        <TabsList className="w-full">
          <TabsTrigger value="BUY" className="flex-1">
            Buy
          </TabsTrigger>
          <TabsTrigger value="SELL" className="flex-1">
            Sell
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted-foreground">Contracts</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1 rounded-md bg-secondary p-3 font-mono text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>{side === "BUY" ? "Est. cost" : "Est. proceeds"}</span>
          <span className="text-foreground">
            {quote ? `$${formatMoney(quote.amount)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Avg price</span>
          <span className="text-foreground">
            {quote ? `$${quote.avgPrice.toFixed(4)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Price after</span>
          <span className="text-foreground">
            {quote ? `$${quote.priceAfter.toFixed(4)}` : "—"}
          </span>
        </div>
      </div>

      {insufficientFunds && (
        <p className="text-xs text-negative">Not enough balance for this trade.</p>
      )}
      {insufficientShares && (
        <p className="text-xs text-negative">
          You only hold {heldQuantity.toFixed(2)} contracts.
        </p>
      )}

      <Button disabled={!canSubmit || isPending} onClick={handleSubmit} className="w-full">
        {isPending ? "Placing…" : side === "BUY" ? "Buy" : "Sell"}
      </Button>

      <div className="flex justify-between font-mono text-xs text-muted-foreground">
        <span>Balance</span>
        <span>${formatMoney(balance)}</span>
      </div>
    </div>
  );
}
