// ─── FORM VALIDATION HELPERS ─────────────────────────────────────────────────

export type ValidationResult = { valid: boolean; error?: string };

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value?.trim()) {
    return { valid: false, error: `${fieldName} is required` };
  }
  return { valid: true };
}

export function validateMaxLength(
  value: string,
  max: number,
  fieldName: string
): ValidationResult {
  if (value.length > max) {
    return { valid: false, error: `${fieldName} must be ${max} characters or less` };
  }
  return { valid: true };
}

export function validateRange(
  value: number,
  min: number,
  max: number,
  fieldName: string
): ValidationResult {
  if (value < min || value > max) {
    return { valid: false, error: `${fieldName} must be between ${min} and ${max}` };
  }
  return { valid: true };
}

export function validateUrl(url: string): ValidationResult {
  if (!url) return { valid: true }; // optional
  if (!/^https?:\/\/.+/.test(url.trim())) {
    return { valid: false, error: 'URL must start with https:// or http://' };
  }
  return { valid: true };
}

export function validateAmount(value: string): ValidationResult {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Amount must be a positive number' };
  }
  return { valid: true };
}
