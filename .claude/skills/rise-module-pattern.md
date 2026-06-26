---
name: rise-module-pattern
description: Enforce the RISE module page pattern — client component, Supabase hooks, AED formatting, shadcn/ui dialogs, animation classes
triggers:
  - "creating a new module"
  - "adding a page to RISE"
  - "new app route"
  - "adding a section to RISE"
---

# RISE Module Page Pattern

## When to apply
Creating or modifying any page under `app/(app)/`.

## Requirements

1. **Client component** — all module pages use `"use client"` at the top.
2. **Supabase client** — always import from `@/lib/supabase/client`, never inline credentials.
3. **Formatting** — currency via `formatAED()`, dates via `formatDate()`, times via `formatTime()` — all from `@/lib/format`. Never use `Intl` or `date-fns` inline.
4. **shadcn/ui** — use `Card`, `CardHeader`, `CardTitle`, `CardContent`, `Button`, `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `@/components/ui/`. Never write raw `<div class="card">`.
5. **Confirmation dialogs** — any destructive action (delete, bulk-update) must use `<ConfirmDialog>` from `@/components/ui/confirm-dialog` before executing.
6. **Animation** — use `animate-rise-in stagger-{n}` on section headings and cards (n = 1, 2, 3, 4).
7. **Icons** — all icons from `lucide-react`. Module heading uses a 7×7 rounded `bg-accent` badge with a 4×4 icon.
8. **Toast** — feedback via `toast.success()` / `toast.error()` from `sonner`. Never use `alert()`.
9. **RLS** — all Supabase writes must include `user_id: user.id` obtained from `supabase.auth.getUser()`.
10. **TypeScript** — no `any`. Use types from `@/lib/types/database`.

## Good example — page heading
```tsx
<h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2 animate-rise-in stagger-1">
  <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
    <Zap className="w-4 h-4 text-muted-foreground" />
  </div>
  Module Name
</h1>
```

## Bad example — heading
```tsx
<h1 className="text-2xl font-bold">Module Name</h1>  {/* ❌ wrong classes */}
```

## Good example — destructive action
```tsx
<ConfirmDialog
  open={confirmOpen}
  title="Delete item?"
  description="This cannot be undone."
  onConfirm={handleDelete}
  onCancel={() => setConfirmOpen(false)}
/>
```

## Bad example — destructive action
```tsx
if (window.confirm("Delete?")) await deleteItem(id);  {/* ❌ never use window.confirm */}
```

## Verification checklist
- [ ] `"use client"` at line 1
- [ ] No `any` types in TypeScript
- [ ] All currency uses `formatAED()` from `@/lib/format`
- [ ] All dates use `formatDate()` from `@/lib/format`
- [ ] Delete/bulk actions go through `<ConfirmDialog>`
- [ ] Toast used for feedback, not `alert()`
- [ ] Heading uses `animate-rise-in stagger-1` class
