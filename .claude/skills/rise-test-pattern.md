---
name: rise-test-pattern
description: Enforce Vitest + Testing Library patterns for lib/** tests in RISE — mocking Supabase, hook testing, coverage targets
triggers:
  - "writing tests"
  - "adding coverage"
  - "test file"
  - "vitest"
  - "testing library"
---

# RISE Test Pattern

## When to apply
Writing or modifying any file under `lib/**/__tests__/`.

## Rules

1. **Test runner** — Vitest. Import from `vitest`, not `jest`.
2. **React hooks** — use `renderHook` + `waitFor` + `act` from `@testing-library/react`.
3. **Supabase mock** — mock `@/lib/supabase/client` with a chainable query object. Never call real Supabase in tests.
4. **Hoisting** — `vi.mock()` calls are hoisted; never reference `const` variables inside factory functions. Put mock data inside `beforeEach` or use `vi.fn()` factories.
5. **Coverage target** — ≥85% line coverage on `lib/**` (excluding `lib/types/`). Run `npm run test:coverage` before committing.
6. **Test location** — co-locate tests in `lib/<module>/__tests__/<file>.test.ts(x)`.
7. **Naming** — describe blocks match the export name; `it()` descriptions are plain English "does X when Y".

## Supabase mock template
```ts
const mockQueryChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(() => mockQueryChain),
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } } }),
  },
};

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabase,
}));

// Resolve query with data
function setupQueryResolve(data: unknown) {
  Object.defineProperty(mockQueryChain, "then", {
    value: (resolve: (v: unknown) => void) =>
      Promise.resolve({ data, error: null }).then(resolve),
    writable: true,
    configurable: true,
  });
}
```

## Hook test template
```ts
describe("useMyHook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupQueryResolve([]);
  });

  it("returns initial loading state", () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current.loading).toBe(true);
  });

  it("fetches data and sets loading false", async () => {
    setupQueryResolve([{ id: "1", name: "Item" }]);
    const { result } = renderHook(() => useMyHook());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(1);
  });
});
```

## Bad examples
```ts
// ❌ Real Supabase call in test
const supabase = createBrowserClient(url, key);
const { data } = await supabase.from("tasks").select("*");

// ❌ jest import in vitest project
import { describe, it } from "jest";

// ❌ Variable in vi.mock factory (hoisting error)
const myVar = "x";
vi.mock("module", () => ({ fn: () => myVar }));  // ReferenceError at runtime
```

## Verification checklist
- [ ] `vi.mock()` factories don't reference top-level `const` variables
- [ ] All Supabase calls mocked — no real network calls
- [ ] `beforeEach` clears all mocks with `vi.clearAllMocks()`
- [ ] `npm run test:coverage` ≥85% on `lib/**`
- [ ] New test file in `lib/<module>/__tests__/`
