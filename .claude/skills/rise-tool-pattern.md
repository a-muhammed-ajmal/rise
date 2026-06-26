---
name: rise-tool-pattern
description: Enforce AUTO_TOOLS vs APPROVAL_TOOLS structure and execute-tool handler pattern when adding or modifying AI tools in RISE
triggers:
  - "adding an AI tool"
  - "modifying tools.ts"
  - "new tool for the assistant"
  - "execute-tool"
---

# RISE AI Tool Pattern

## When to apply
Adding or modifying tools in `lib/ai/tools.ts` or `lib/ai/execute-tool.ts`.

## Two-tier system

| Tier | File | When to use |
|------|------|-------------|
| `AUTO_TOOLS` | `lib/ai/tools.ts` | Low-risk reads and creates (list, search, log, add) |
| `APPROVAL_TOOLS` | `lib/ai/tools.ts` | Destructive operations (delete, bulk-update, bulk-delete) |

**Never auto-execute a destructive tool.** Any tool that deletes or bulk-modifies data MUST be in `APPROVAL_TOOLS`.

## Tool definition structure (tools.ts)
```ts
{
  name: "my_tool",
  description: "Clear, specific description — Claude uses this to decide when to call it.",
  input_schema: {
    type: "object" as const,
    properties: {
      field_name: { type: "string", description: "What this field means" },
    },
    required: ["field_name"],
  },
}
```

## Execute-tool handler structure (execute-tool.ts)
```ts
case "my_tool": {
  const { field_name } = input as { field_name: string };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, message: "Not authenticated" };

  const { data, error } = await supabase
    .from("table_name")
    .select("*")
    .eq("user_id", user.id);

  if (error) return { success: false, message: error.message };
  return { success: true, message: `Found ${data?.length ?? 0} items`, data };
}
```

## Return type — always this shape
```ts
{ success: boolean; message: string; data?: unknown }
```

## Rules
1. Always call `supabase.auth.getUser()` — never trust client-provided user IDs.
2. Always filter by `user_id = user.id` — RLS enforces it but explicit is clearer.
3. Return `{ success: false, message: error.message }` on Supabase errors.
4. Use today's ISO date from `new Date().toISOString().slice(0, 10)` as default date where needed.
5. Add the tool to the correct array in `AUTO_TOOLS` or `APPROVAL_TOOLS`.
6. Write tests in `lib/ai/__tests__/execute-tool.test.ts` before committing.

## Bad examples
```ts
// ❌ Missing user auth
const { data } = await supabase.from("tasks").select("*");

// ❌ Wrong return shape
return "done";

// ❌ Destructive tool in AUTO_TOOLS
AUTO_TOOLS = [..., { name: "delete_all_tasks", ... }]
```

## Verification checklist
- [ ] Tool placed in correct tier (AUTO vs APPROVAL)
- [ ] Handler calls `getUser()` and checks `!user`
- [ ] All queries filter by `user_id`
- [ ] Returns `{ success, message, data? }` shape
- [ ] Test added in `execute-tool.test.ts`
- [ ] `npm run test:coverage` still ≥85%
