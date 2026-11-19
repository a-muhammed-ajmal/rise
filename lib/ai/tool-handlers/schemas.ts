// Input schemas shared by more than one tool-handler module. Schemas used by
// a single module live in that module.
import { z } from "zod";

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const taskAreas = [
  "personal",
  "professional",
  "financial",
  "wellness",
  "relationship",
  "vision",
  "legal",
  "default",
] as const;

// ─── New input schemas ────────────────────────────────────────────────────────
export const uuid = z.string().uuid();

export const isoDatetime = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.Z+\-]+)?$/);

export const ByIdInput = z.object({ id: uuid });

// Transactions
export const offsetInput = z.number().int().nonnegative().max(10_000).optional();
