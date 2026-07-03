# RISE OS - Component Architecture

## Standards
- **Strict Typing**: All component props must have an explicit TypeScript `interface`. The use of `any` is strictly forbidden [19, 21].
- **Named Exports**: Use named exports (`export const Component = ...`) rather than default exports for better IDE support and refactoring safety [20].
- **Class Merging**: Always use the `cn()` utility from `lib/cn.ts` for conditional Tailwind classes [19, 22].
- **Dynamic Colors**: If a color is data-driven (e.g., a project's custom hex), use the **Hex Alpha Trick** with inline `style={{ backgroundColor: color + '20' }}` [21, 22].

## Structure Pattern
1. Imports (External libraries -> Internal hooks/utils -> Types)
2. TypeScript Interface definition
3. Component definition
4. Sub-components (if small) or helper functions