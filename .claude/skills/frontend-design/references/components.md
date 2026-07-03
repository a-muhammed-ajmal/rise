# RISE OS — Component Architecture

## Standards
- **Strict Typing**: All props must have an explicit TypeScript `interface`. `any` is forbidden.
- **Named Exports**: Use `export const Component = …` over default exports for IDE safety.
- **Class Merging**: Always use `cn()` from `lib/cn.ts` for conditional Tailwind classes.
- **Dynamic Colors**: Data-driven hex values use the **Hex Alpha Trick** with inline style — never arbitrary Tailwind:
  ```tsx
  style={{ backgroundColor: color + '20', borderColor: color + '40' }}
  ```
- **Font**: Every component inherits `var(--font-sans)` (Inter) from `body`. Never set a different font-family on any component.

## File Structure Pattern
1. Imports — external libs → internal hooks/utils → types
2. TypeScript interface definition
3. Component definition using `cn()`
4. Sub-components or helper functions (if small)
5. Named export

## Token Usage Pattern
```tsx
// Correct — semantic token
<div style={{ color: 'var(--brand-text)', background: 'var(--brand-tint)' }}>

// Wrong — hardcoded hex
<div style={{ color: '#D6450F', background: '#FFF0EB' }}>
```

## Priority Color Pattern
```tsx
import { PRIORITY_CONFIG } from '@/lib/constants';

// Correct
const { color, bgColor } = PRIORITY_CONFIG[task.priority];
<span style={{ color, backgroundColor: bgColor }}>

// Wrong — switch/case on priority string
```

## Button Usage
| Variant         | Context                              | Token used           |
|-----------------|--------------------------------------|----------------------|
| `btn--primary`  | Main CTA, destructive confirm        | `--brand` fill       |
| `btn--secondary`| Secondary actions on light sections  | `--border-subtle`    |
| `btn--ghost`    | Actions on dark/navy sections        | `--border-on-dark`   |

Every button and icon-only control must meet the `.tap-target` requirement (44×44px).
