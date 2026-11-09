"use client";

import type { PaymentMethod } from "@/lib/types/database";
import { formatAED } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Pencil, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export function WalletCard({
  paymentMethod,
  isFirst,
  isLast,
  onEdit,
  onAdjust,
  onToggleActive,
  onMoveUp,
  onMoveDown,
}: {
  paymentMethod: PaymentMethod;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onAdjust: () => void;
  onToggleActive: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-card p-3">
      {/* Color dot + name & balance. Takes the full first line on narrow
          screens; the actions wrap underneath instead of crushing the name. */}
      <div className="flex min-w-[10rem] flex-1 items-center gap-3">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{
            backgroundColor: paymentMethod.color ?? "var(--muted-foreground)",
          }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="min-w-0 break-words">{paymentMethod.name}</span>
            {!paymentMethod.is_active && (
              <Badge variant="secondary" className="text-xs">
                Inactive
              </Badge>
            )}
          </p>
          <p
            className={cn(
              "text-xs font-medium tabular-nums",
              paymentMethod.balance < 0 ? "text-destructive" : "text-mod-finance"
            )}
          >
            {formatAED(paymentMethod.balance)}
          </p>
        </div>
      </div>

      {/* Actions — every control keeps the shared 44px touch target. */}
      <div className="ml-auto flex shrink-0 items-center">
        <Button
          size="icon"
          variant="ghost"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move up"
        >
          <ChevronUp aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move down"
        >
          <ChevronDown aria-hidden="true" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={onEdit}
          aria-label="Edit wallet"
        >
          <Pencil aria-hidden="true" />
        </Button>
        {paymentMethod.is_active && (
          <Button
            size="icon"
            variant="ghost"
            onClick={onAdjust}
            aria-label="Adjust balance"
          >
            <SlidersHorizontal aria-hidden="true" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={onToggleActive}
        >
          {paymentMethod.is_active ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </div>
  );
}
