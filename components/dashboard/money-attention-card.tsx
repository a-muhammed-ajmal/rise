import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionItem } from "@/lib/finance/attention";
import { cn } from "@/lib/utils";

const VISIBLE_COUNT = 4;

/**
 * Money items worth acting on today, most urgent first (lib/finance/attention.ts):
 * overdue debts, budgets over their limit, debts due within 7 days, budgets at
 * 75–100%. The same list as the Finance page's Needs attention card. Hidden
 * when nothing needs attention.
 */
export function MoneyAttentionCard({
  items,
}: {
  items: readonly AttentionItem[];
}) {
  if (items.length === 0) return null;

  const visible = items.slice(0, VISIBLE_COUNT);
  const remaining = items.length - visible.length;

  return (
    <Card className="home-card tone-finance slide-up stagger-3" aria-label="Needs attention">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-md bg-mod-finance-tint"
            aria-hidden="true"
          >
            <Wallet
              className="h-3.5 w-3.5 text-mod-finance"
              aria-hidden="true"
            />
          </div>
          Needs attention
        </CardTitle>
        <Link
          href="/finance"
          className="inline-flex min-h-11 items-center text-label text-brand-text hover:underline active:opacity-80"
        >
          Finance
        </Link>
      </CardHeader>
      <CardContent>
        <ul className="divide-y divide-border">
          {visible.map((item) => (
            <li key={item.key}>
              <Link
                href="/finance"
                className="home-row -mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 py-2.5 active:opacity-80"
              >
                <span
                  className={cn(
                    "finance-dot",
                    item.level === "danger"
                      ? "finance-dot--danger"
                      : "finance-dot--warning",
                  )}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium break-words">
                    {item.title}
                  </span>
                  <span className="block text-label text-muted-foreground break-words">
                    {item.detail}
                  </span>
                </span>
                <span className="sr-only">
                  {item.level === "danger" ? "Urgent." : "Soon."}
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
        {remaining > 0 && (
          <Link
            href="/finance"
            className="flex min-h-11 items-center justify-center text-label text-brand-text hover:underline active:opacity-80"
          >
            +{remaining} more in Finance
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
