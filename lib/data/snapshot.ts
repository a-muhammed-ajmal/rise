/**
 * Server-loaded initial data for a client page.
 *
 * Module pages load their first screen of data in the server component and
 * hand it to the client view, so the page arrives filled in rather than
 * mounting empty and fetching after hydration.
 *
 * `loadedAt` exists because of the client Router Cache (next.config.ts,
 * `staleTimes.dynamic`): revisiting a page within that window remounts it with
 * the cached server payload, which can be minutes old. A view uses the snapshot
 * as-is only while it is fresh, and refetches otherwise — so a revisit right
 * after the assistant logged an expense still shows that expense.
 */
export type ServerSnapshot<T> = { data: T; loadedAt: number };

// Long enough to cover the server render and hydration of a fresh load, short
// enough that a Router Cache revisit always refetches.
export const SNAPSHOT_MAX_AGE_MS = 15_000;

/**
 * Runs a server-side loader. A failure is logged and returns null, and the
 * view then fetches on mount exactly as it did before server loading existed.
 */
export async function takeSnapshot<T>(
  label: string,
  load: () => Promise<T>,
): Promise<ServerSnapshot<T> | null> {
  try {
    return { data: await load(), loadedAt: Date.now() };
  } catch (error) {
    console.error(`[${label}] server load failed:`, error);
    return null;
  }
}

export function isFreshSnapshot(
  snapshot: ServerSnapshot<unknown> | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!snapshot) return false;
  const age = now - snapshot.loadedAt;
  return age >= 0 && age <= SNAPSHOT_MAX_AGE_MS;
}
