---
name: add-tool
description: Scaffold a new AI tool in RISE — definition in tools.ts, handler in execute-tool.ts, test in execute-tool.test.ts
---

# /add-tool [tool-name]

Scaffold a new AI tool end-to-end following the RISE tool pattern.

## Steps

### 1. Determine tier
Ask: "Is this tool destructive (delete, bulk-update, bulk-delete)?"
- Yes → `APPROVAL_TOOLS` in `lib/ai/tools.ts`
- No → `AUTO_TOOLS` in `lib/ai/tools.ts`

### 2. Add tool definition to lib/ai/tools.ts
```ts
{
  name: "$TOOL_NAME",
  description: "One sentence — exactly what this tool does. Be specific so Claude uses it correctly.",
  input_schema: {
    type: "object" as const,
    properties: {
      // required fields first
      field: { type: "string", description: "What this field means" },
      // optional fields with default
      date: { type: "string", description: "ISO date YYYY-MM-DD, defaults to today" },
    },
    required: ["field"],
  },
}
```

### 3. Add handler to lib/ai/execute-tool.ts
Inside the `switch (name)` block, add:
```ts
case "$TOOL_NAME": {
  const { field, date } = input as { field: string; date?: string };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const targetDate = date ?? new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("target_table")
    .select("*")
    .eq("user_id", user.id)
    .eq("some_field", field);

  if (error) return { success: false, message: error.message };
  return { success: true, message: `Done: ${data?.length ?? 0} items`, data };
}
```

### 4. Write tests FIRST in lib/ai/__tests__/execute-tool.test.ts
Add a `describe("$TOOL_NAME")` block covering:
- Happy path (returns correct data)
- Not authenticated (returns `{ success: false }`)
- Supabase error (returns `{ success: false, message: error.message }`)
- Optional: edge cases (empty result, date defaulting to today)

### 5. Run /verify
All 3 gates must pass before done.

## Checklist
- [ ] Tool in correct tier (AUTO vs APPROVAL)
- [ ] Description is specific enough for Claude to call it at the right time
- [ ] Handler calls `getUser()` and returns early if no user
- [ ] All queries filter by `user_id`
- [ ] Tests written before handler (TDD)
- [ ] `/verify` passes (138+ tests, ≥85% coverage, 0 lint warnings, build clean)
