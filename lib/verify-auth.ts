/**
 * Server-side Firebase ID token verification.
 * Uses the Firebase Auth REST API — no firebase-admin SDK needed.
 * Returns the verified user's UID, or throws if the token is invalid/missing.
 */
export async function verifyIdToken(authHeader: string | null | undefined): Promise<string> {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Unauthorized: missing or malformed Authorization header');
  }

  const idToken = authHeader.slice(7);
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey || apiKey === 'demo-key') {
    throw new Error('Server misconfiguration: Firebase API key not set');
  }

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!res.ok) {
    throw new Error('Unauthorized: invalid or expired token');
  }

  const data = await res.json();
  const uid = data.users?.[0]?.localId as string | undefined;

  if (!uid) {
    throw new Error('Unauthorized: token did not resolve to a user');
  }

  return uid;
}
