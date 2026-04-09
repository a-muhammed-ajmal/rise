// ─── INPUT SANITIZER ─────────────────────────────────────────────────────────
// All user text inputs must pass through sanitize() before Firestore writes.

/**
 * Strip HTML tags, trim whitespace, and enforce max character length.
 */
export function sanitize(input: string, maxLength?: number): string {
  let clean = input
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .trim();

  if (maxLength && clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }

  return clean;
}

/**
 * Sanitize all string values in a plain object (one level deep).
 * Non-string values are left untouched.
 */
export function sanitizeObject<T extends Record<string, unknown>>(
  obj: T,
  limits?: Partial<Record<keyof T, number>>
): T {
  const result = { ...obj };
  for (const key in result) {
    const value = result[key];
    if (typeof value === 'string') {
      result[key] = sanitize(value, limits?.[key]) as T[typeof key];
    }
  }
  return result;
}

/**
 * Validate a URL — must start with https:// or http://
 */
export function isValidUrl(url: string): boolean {
  return /^https?:\/\/.+/.test(url.trim());
}

/**
 * Validate phone number (basic — allows digits, spaces, +, -, parentheses)
 */
export function isValidPhone(phone: string): boolean {
  return /^[\d\s+\-().]{7,20}$/.test(phone.trim());
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
