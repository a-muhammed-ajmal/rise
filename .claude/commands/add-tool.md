---
name: add-tool
description: Scaffold a new AI tool in RISE — definition in tools.ts, schema + handler in its lib/ai/tool-handlers/ domain module, test in execute-tool.test.ts
---

# /add-tool [tool-name]

Scaffold a new AI tool end-to-end following the RISE tool pattern.

## Steps

### 1. Determine tier
Ask: "Does this tool destroy data for good, or act on many rows at once?"
- Yes → `APPROVAL_TOOLS` in `lib/ai/tools.ts`
- A soft delete (`delete_*`, recoverable with `restore_record`) → `REVERSIBLE_TOOLS`
  — also follow "Adding a new delete tool" in CLAUDE.md
- Neither → `AUTO_TOOLS` in `lib/ai/tools.ts`

### 2. Add tool definition to lib/ai/tools.ts

```ts
// Gemini FunctionDeclaration — NOT Anthropic input_schema, NOT OpenAI format.
// Import { Type } from '@google/genai'.
{
  name: '$TOOL_NAME',
  description: 'One sentence — exactly what this tool does. Be specific so the model calls it at the right time.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      // required fields first
      field: { type: Type.STRING, description: 'What this field means' },
      // optional fields with default
      date: { type: Type.STRING, description: 'ISO date YYYY-MM-DD, defaults to today' },
    },
    required: ['field'],
  },
}
```

### 3. Add the schema and handler to its domain module

Pick the module in `lib/ai/tool-handlers/` (tasks, projects, goals, wellness,
finance, crm, knowledge, reflection, insights, personal-memory, recycle-bin,
whatsapp). Declare the zod schema at the top of that module — or reuse a
primitive from `./schemas` — and add an entry to the module's handler map:

```ts
const $ToolNameInput = z.object({
  field: z.string().min(1),
  date: dateStr.optional(),
});

export const domainHandlers = {
  // …existing handlers…
  $TOOL_NAME: async ({ input, supabase, userId, today }) => {
    const p = $ToolNameInput.safeParse(input);
    if (!p.success) return badInput();

    const { data, error } = await supabase
      .from("target_table")
      .select("*")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .eq("some_field", p.data.field)
      .eq("date", p.data.date ?? today);
    if (error) return dbErr("$TOOL_NAME", error);

    return { success: true, message: `Done: ${data?.length ?? 0} items`, data };
  },
} satisfies ToolHandlers;
```

`executeTool` has already resolved the user — the handler receives `userId`,
the `supabase` client and `today` (the Dubai date). No `getUser()` call, no
`as` casts, no `toISOString().slice(0, 10)`. Every query filters by `user_id`
itself (the MCP path uses a service-role client), every read filters
`deleted_at IS NULL`, and every foreign key from input passes `isOwnedBy()`.
The registry in `index.ts` picks the handler up from the module's map — there
is nothing else to register.

### 4. Write tests FIRST in lib/ai/__tests__/execute-tool.test.ts

Add a `describe("$TOOL_NAME")` block covering:

- Happy path (returns correct data)
- Not authenticated (returns `{ success: false }`)
- Supabase error (returns the generic `dbErr()` message)
- Optional: edge cases (empty result, date defaulting to today)

`lib/ai/__tests__/tool-handlers.test.ts` fails until the declaration and the
handler both exist.

### 5. Run /verify
All 3 gates must pass before done.

## Checklist
- [ ] Tool in correct tier (AUTO / REVERSIBLE / APPROVAL)
- [ ] Description is specific enough for the model to call it at the right time
- [ ] Input validated with `safeParse`; `badInput()` on failure
- [ ] All queries filter by `user_id` and `deleted_at IS NULL`
- [ ] Tests written before handler (TDD)
- [ ] Tool count assertion in `lib/ai/__tests__/tools.test.ts` updated
- [ ] `/verify` passes (≥85% coverage, 0 lint warnings, build clean)
