// Privacy Sanitizer: Removes personally identifiable information (PII) from text
// Used to sanitize AI context before sending to external LLMs

interface patterns {
  email: RegExp;
  phoneInternational: RegExp;
  phoneUAE: RegExp;
  creditCard: RegExp;
  longNumber: RegExp;
  // Add more patterns as needed
}

const PII_PATTERNS: patterns = {
  // Email pattern (basic)
  email: /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g,

  // International phone numbers with optional country code
  phoneInternational: /(\+\d{1,3}[\s.-]?)?\(?\d{3,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g,

  // UAE phone numbers (specific patterns)
  phoneUAE: /(\+971|971|0)?5[0-9]{8}/g,

  // Credit card numbers (simple 13-19 digits, may have spaces/hyphens)
  creditCard: /(?:\d{4}[-\s]?){3}\d{4}|\d{13,19}/g,

  // Long numeric sequences that could be account numbers (10+ digits)
  longNumber: /\b\d{10,}\b/g,
};

const REDACTED = '[REDACTED]';

/**
 * Recursively sanitizes an object by redacting PII from all string values.
 * Non-string values (numbers, booleans, null) are left untouched.
 * Arrays and objects are traversed.
 */
export function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    let result = obj;
    // Apply redaction patterns
    for (const [key, pattern] of Object.entries(PII_PATTERNS)) {
      result = result.replace(pattern, REDACTED);
    }
    return result;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj; // number, boolean, etc.
}

/**
 * Sanitizes a JSON string context by parsing, sanitizing, and re-stringifying.
 * If the JSON is invalid, returns the original string (to avoid breaking the flow).
 */
export function sanitizeContext(contextJson: string): string {
  try {
    const parsed = JSON.parse(contextJson);
    const sanitized = sanitizeObject(parsed);
    return JSON.stringify(sanitized, null, 0);
  } catch {
    // If not valid JSON, return as-is (fallback)
    return contextJson;
  }
}

/**
 * Checks if the context contains any PII patterns (for logging/debugging)
 */
export function contextContainsPII(contextJson: string): boolean {
  try {
    const parsed = JSON.parse(contextJson);
    const stringified = JSON.stringify(parsed);
    return Object.values(PII_PATTERNS).some(pattern => pattern.test(stringified));
  } catch {
    return false;
  }
}
