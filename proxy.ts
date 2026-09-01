import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  // sw.js and offline MUST stay excluded. A service worker script served behind
  // a redirect is rejected by the browser outright ("The script resource is
  // behind a redirect, which is disallowed"), so routing /sw.js through the auth
  // redirect stops the worker registering at all — which silently disables web
  // push too, since push requires a registered worker. /offline is the worker's
  // navigation fallback and is fetched with no session by definition.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|sw.js|offline|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
