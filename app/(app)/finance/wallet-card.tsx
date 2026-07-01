"use client";

import type { PaymentMethod } from "@/lib/types/database";
import { formatAED } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronUp, ChevronDown, Pencil, SlidersHorizontal } from "lucide-react";

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
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
      {/* Color dot */}
      <div
        className="w-3 h-3 rounded-full shrink-0"
        style={{
          backgroundColor: paymentMethod.color ?? "var(--muted-foreground)",
        }}
      />

      {/* Name & balance */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{paymentMethod.name}</p>
        <p
          className={`text-xs font-mono ${
            paymentMethod.balance < 0 ? "text-destructive" : "text-mod-finance"
          }`}
        >
          {formatAED(paymentMethod.balance)}
        </p>
      </div>

      {/* Status badge */}
      {!paymentMethod.is_active && (
        <Badge variant="secondary" className="text-xs shrink-0">
          Inactive
        </Badge>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onMoveUp}
          disabled={isFirst}
          aria-label="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onMoveDown}
          disabled={isLast}
          aria-label="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onEdit}
          aria-label="Edit wallet"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        {paymentMethod.is_active && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onAdjust}
            aria-label="Adjust balance"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs px-2"
          onClick={onToggleActive}
        >
          {paymentMethod.is_active ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </div>
  );
}
