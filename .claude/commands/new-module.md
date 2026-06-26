---
name: new-module
description: Scaffold a new RISE module page following the established pattern — route, page component, sidebar link
---

# /new-module [module-name]

Scaffold a new module page in RISE end-to-end.

## Steps

### 1. Create the route directory and page
File: `app/(app)/[module-name]/page.tsx`

Template:
```tsx
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModuleIcon } from "lucide-react";  // pick relevant icon
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import type { SomeRow } from "@/lib/types/database";

export default function ModuleNamePage() {
  const [items, setItems] = useState<SomeRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("table_name")
      .select("*")
      .order("created_at", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  return (
    <div className="p-4 md:p-6 max-w-4xl space-y-6">
      <h1 className="text-step-2 font-heading font-bold tracking-tight flex items-center gap-2 animate-rise-in stagger-1">
        <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
          <ModuleIcon className="w-4 h-4 text-muted-foreground" />
        </div>
        Module Name
      </h1>

      {loading ? (
        <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
      ) : (
        <div className="grid gap-3 animate-rise-in stagger-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                {/* item content */}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 2. Add to Sidebar
File: `components/layout/Sidebar.tsx` (or wherever nav links live)

Add a new nav item with the module icon, label, and route path.

### 3. Add to BottomNav (mobile)
File: `components/layout/BottomNav.tsx`

Add the route if it's a primary navigation destination (max 5 items on mobile).

### 4. Add database types if needed
File: `lib/types/database.ts` — add `Row`, `Insert`, `Update` types for any new tables.

### 5. Update spec.md
Add the module to the Modules table in `spec.md` with its core capability.

## Checklist
- [ ] `"use client"` at line 1
- [ ] Page heading uses `animate-rise-in stagger-1` + accent badge + icon
- [ ] All currency via `formatAED()`, dates via `formatDate()`
- [ ] Sidebar + BottomNav links added
- [ ] Types in `lib/types/database.ts` if new table
- [ ] `spec.md` updated
- [ ] `/verify` passes
