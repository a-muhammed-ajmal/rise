'use client'

import { useEffect, useState } from 'react'

// RISE uses a single breakpoint: md = 768px (see CLAUDE.md design rules).
const DESKTOP_QUERY = '(min-width: 768px)'

/**
 * True at/above the `md` (768px) breakpoint.
 *
 * Client-only: returns `false` until mounted, so components that switch shells
 * (e.g. bottom sheet ↔ centered modal) should only render on user interaction,
 * never during SSR, to avoid a hydration flash.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    const update = () => setIsDesktop(mql.matches)
    update()
    mql.addEventListener('change', update)
    return () => mql.removeEventListener('change', update)
  }, [])

  return isDesktop
}
