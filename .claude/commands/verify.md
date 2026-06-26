---
name: verify
description: Run RISE's full quality gate — tests, coverage, build, lint — and summarise failures
---

# /verify — RISE Quality Gate

Run these steps in order. Stop and report on the first failure.

## Steps

1. **Tests + coverage**
   ```bash
   npm run test:coverage
   ```
   Success: all tests pass AND line coverage on `lib/**` ≥ 85%.
   If coverage is below 85%, identify which files are uncovered and suggest which cases to add.

2. **Lint**
   ```bash
   npm run lint
   ```
   Success: 0 errors, 0 warnings.
   If warnings exist, fix them (remove unused imports, add `// eslint-disable-next-line` only for intentional single-dep useEffect hooks).

3. **Build**
   ```bash
   npm run build
   ```
   Success: exits 0, no TypeScript errors.

## Output format

```
✅ Tests: 138 passed, 96.47% line coverage
✅ Lint: 0 errors, 0 warnings
✅ Build: compiled successfully (17 routes)

Ready to commit.
```

Or on failure:
```
❌ Tests: 2 failed
  - lib/ai/__tests__/execute-tool.test.ts: "get_analytics returns monthly summary" — expected X, got Y
  
Suggested fix: ...
```

## Do not mark verify as complete until all 3 gates pass.
