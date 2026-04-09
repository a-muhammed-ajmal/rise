import type { NextRequest } from 'next/server';

/**
 * Extract and verify Firebase ID token from Authorization header (server-side).
 * Uses Firebase REST API — does NOT import the client Firebase SDK.
 * Returns the userId (uid) if valid, null if invalid/missing.
 */
export async function verifyAuthToken(
  req: NextRequest
): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  if (!token) return null;

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
        cache: 'no-store',
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const userId = data?.users?.[0]?.localId;
    return userId ?? null;
  } catch {
    return null;
  }
}

/**
 * Get the current Firebase user's ID token (client-side only).
 * Import dynamically to avoid server-side Firebase SDK init.
 */
export async function getIdToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    // Dynamic import to keep Firebase client SDK out of server bundles
    const { auth } = await import('./firebase');
    const user = auth.currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch {
    return null;
  }
}
