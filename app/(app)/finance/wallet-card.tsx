"use client";

import type { PaymentMethod } from "@/lib/types/database";
import { formatAED } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronUp, MoreVertical, Pencil, Power, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * One wallet row: colour dot, name and balance, with every action in a single
 * 44px menu so the name and amount keep the full width on a phone.
 */
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
  const negative = paymentMethod.balance < 0;

  return (
    <li className={cn("flex min-h-16 items-center gap-3 py-2 pl-4", !paymentMethod.is_active && "opacity-70")}>
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: paymentMethod.color ?? "var(--muted-foreground)" }}
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
        {negative && <p className="text-label text-[var(--color-danger)]">Below zero</p>}
      </div>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums whitespace-nowrap",
          negative && "text-[var(--color-danger)]",
        )}
      >
        {formatAED(paymentMethod.balance)}
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Actions for ${paymentMethod.name}`}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent active:bg-accent"
        >
          <MoreVertical className="size-4" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11" onClick={onEdit}>
            <Pencil className="mr-2 size-4" aria-hidden="true" /> Edit wallet
          </DropdownMenuItem>
          {paymentMethod.is_active && (
            <DropdownMenuItem className="min-h-11" onClick={onAdjust}>
              <SlidersHorizontal className="mr-2 size-4" aria-hidden="true" /> Adjust balance
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="min-h-11" disabled={isFirst} onClick={onMoveUp}>
            <ChevronUp className="mr-2 size-4" aria-hidden="true" /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11" disabled={isLast} onClick={onMoveDown}>
            <ChevronDown className="mr-2 size-4" aria-hidden="true" /> Move down
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="min-h-11" onClick={onToggleActive}>
            <Power className="mr-2 size-4" aria-hidden="true" /> {paymentMethod.is_active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
