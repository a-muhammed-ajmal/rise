/**
 * Wallet identity colors.
 *
 * Green and red are reserved for money semantics on the Finance page (income /
 * spent / saved / deficit), so wallets never take them. The picker offers only
 * the hues below, and the two legacy swatches (`#10b981`, `#ef4444`) that older
 * wallets may still carry are remapped at display time to the nearest
 * non-semantic hue — no data migration needed.
 */
export const WALLET_COLORS = [
  "#0C2443", // navy (brand)
  "#2563EB", // blue
  "#4F46E5", // indigo
  "#7C3AED", // violet
  "#0891B2", // cyan
  "#D97706", // amber
  "#DB2777", // pink
  "#64748B", // slate
] as const;

const BRAND_NAVY = "#0c2443";

const LEGACY_REMAP: Record<string, string> = {
  "#10b981": "#0891B2", // green → cyan
  "#ef4444": "#DB2777", // red → pink
};

/**
 * Resolve the color a wallet is drawn with.
 *
 * - legacy green/red → remapped non-semantic hue
 * - brand navy → `var(--brand-action)`, which lifts in dark mode where raw
 *   navy is invisible on the charcoal background
 * - no color → a palette hue picked by position, so tiles stay distinct
 */
export function walletColor(color: string | null | undefined, index = 0): string {
  const fallback = WALLET_COLORS[1 + (Math.abs(index) % (WALLET_COLORS.length - 1))];
  if (!color) return fallback;
  const key = color.trim().toLowerCase();
  if (key === BRAND_NAVY) return "var(--brand-action)";
  return LEGACY_REMAP[key] ?? color;
}

/** Normalize a stored color for the picker: legacy green/red show as their remap. */
export function walletPickerColor(color: string | null | undefined): string | null {
  if (!color) return null;
  return LEGACY_REMAP[color.trim().toLowerCase()] ?? color;
}

/** Share of the total (0–100) a wallet holds; 0 when the total is not positive. */
export function walletShare(balance: number, total: number): number {
  if (!(total > 0) || !(balance > 0)) return 0;
  return Math.min(100, Math.round((balance / total) * 100));
}
