import {
  validatePasswordStrength,
  getPasswordStrengthScore,
  validatePasswordReset,
} from './passwordValidation';

describe('passwordValidation utilities', () => {
  test('accepts a strong password', () => {
    const result = validatePasswordStrength('StrongPass123!');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('rejects weak password and reports errors', () => {
    const result = validatePasswordStrength('abc');
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('returns max score for strong password', () => {
    expect(getPasswordStrengthScore('StrongPass123!')).toBe(5);
  });

  test('validatePasswordReset rejects mismatch', () => {
    const result = validatePasswordReset('StrongPass123!', 'DifferentPass123!');
    expect(result.isValid).toBe(false);
    expect(result.passwordsMatch).toBe(false);
  });
});
