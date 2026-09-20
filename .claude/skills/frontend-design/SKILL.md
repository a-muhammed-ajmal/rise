---
name: frontend-design
version: 3.0.0
description: RISE app design system. Navy and gold, Inter up to weight 600, shared page structure, calm cards, mobile touch controls, and theme-safe tokens.
---

# RISE Frontend Design

Read [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) before UI implementation. It is the single visual specification; app/globals.css is the runtime token source.

Apply it to new and changed components. Preserve product behavior, the three-leaf logo, module terminology and safety rules in AGENTS.md, SPEC.md and CLAUDE.md. User-authorized changes to the design must update the specification and runtime together.

Use the installed Next.js documentation, existing components/ui primitives and components/layout/page-shell.tsx. Verify responsive rendering, both themes and changed interactions before running coverage, lint and build in order.

The assets directory is a historical standalone demo, not a second design system. Do not copy its CSS into the application.
