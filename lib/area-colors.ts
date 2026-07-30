import type { ProjectCategory } from '@/lib/types/database'

/**
 * Life-area identity colors.
 *
 * Values are CSS custom properties (declared in `app/globals.css` under both
 * `:root` and `.dark`) rather than hex literals, so areas stay legible in dark
 * mode and no component ever hardcodes a color. `color` is the saturated
 * identity color (borders, dots); `bg` is a very light tint safe to use as a
 * whole-card background.
 */
export type AreaMeta = {
  value: ProjectCategory
  label: string
  /** Saturated identity color — `var(--area-*)` */
  color: string
  /** Very light card tint — `var(--area-*-tint)` */
  bg: string
}

const meta = (value: ProjectCategory, label: string): AreaMeta => ({
  value,
  label,
  color: `var(--area-${value})`,
  bg: `var(--area-${value}-tint)`,
})

export const AREA_META: Record<ProjectCategory, AreaMeta> = {
  default: meta('default', 'Default'),
  personal: meta('personal', 'Personal'),
  professional: meta('professional', 'Professional'),
  financial: meta('financial', 'Financial'),
  wellness: meta('wellness', 'Wellness'),
  relationship: meta('relationship', 'Relationship'),
  vision: meta('vision', 'Vision'),
  legal: meta('legal', 'Legal'),
}

/** Ordered for pickers — `default` first so the neutral option leads. */
export const AREA_LIST: AreaMeta[] = [
  AREA_META.default,
  AREA_META.personal,
  AREA_META.professional,
  AREA_META.financial,
  AREA_META.wellness,
  AREA_META.relationship,
  AREA_META.vision,
  AREA_META.legal,
]

/**
 * Card background tint for an area, or `undefined` when the card should keep
 * its base surface — that is the case for `default` (no area chosen) and for
 * any unrecognised value.
 */
export function areaTint(area: ProjectCategory): string | undefined {
  if (area === 'default') return undefined
  return AREA_META[area]?.bg
}
