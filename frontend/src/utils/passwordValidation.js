/**
 * Password validation utilities for consistent client/server validation
 */

/**
 * Validate password strength according to EROS security requirements
 * @param {string} password - Password to validate
 * @returns {Object} Validation result with details
 */
export const validatePasswordStrength = (password) => {
  const result = {
    isValid: false,
    errors: [],
    requirements: {
      minLength: false,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSpecial: false
    }
  };

  // Check minimum length (8 characters)
  if (password.length >= 8) {
    result.requirements.minLength = true;
  } else {
    result.errors.push('Password must be at least 8 characters long');
  }

  // Check for uppercase letter
  if (/[A-Z]/.test(password)) {
    result.requirements.hasUpper = true;
  } else {
    result.errors.push('Password must contain at least one uppercase letter');
  }

  // Check for lowercase letter
  if (/[a-z]/.test(password)) {
    result.requirements.hasLower = true;
  } else {
    result.errors.push('Password must contain at least one lowercase letter');
  }

  // Check for number
  if (/\d/.test(password)) {
    result.requirements.hasNumber = true;
  } else {
    result.errors.push('Password must contain at least one number');
  }

  // Check for special character
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    result.requirements.hasSpecial = true;
  } else {
    result.errors.push('Password must contain at least one special character');
  }

  // Determine if password is valid
  result.isValid = Object.values(result.requirements).every(Boolean);

  return result;
};

/**
 * Get password strength score (0-5)
 * @param {string} password - Password to score
 * @returns {number} Strength score
 */
export const getPasswordStrengthScore = (password) => {
  const validation = validatePasswordStrength(password);
  return Object.values(validation.requirements).filter(Boolean).length;
};

/**
 * Get password strength label
 * @param {string} password - Password to evaluate
 * @returns {string} Strength label
 */
export const getPasswordStrengthLabel = (password) => {
  const score = getPasswordStrengthScore(password);
  
  if (score < 2) return 'Very Weak';
  if (score < 3) return 'Weak';
  if (score < 4) return 'Fair';
  if (score < 5) return 'Good';
  return 'Strong';
};

/**
 * Get password strength color
 * @param {string} password - Password to evaluate
 * @returns {string} CSS color value
 */
export const getPasswordStrengthColor = (password) => {
  const score = getPasswordStrengthScore(password);
  
  if (score < 2) return 'var(--error-text)';
  if (score < 3) return 'var(--warning-text)';
  if (score < 4) return 'var(--info-text)';
  if (score < 5) return 'var(--success-text)';
  return 'var(--success-text)';
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
export const validateEmailFormat = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Common password patterns to avoid
 */
export const COMMON_PASSWORDS = [
  'password', 'password123', '123456', '123456789', 'qwerty',
  'abc123', 'password1', 'admin', 'letmein', 'welcome',
  '1234567890', 'password!', 'Password123', 'DemoPass123!'
];

/**
 * Check if password is too common
 * @param {string} password - Password to check
 * @returns {boolean} True if password is too common
 */
export const isCommonPassword = (password) => {
  return COMMON_PASSWORDS.includes(password.toLowerCase());
};

/**
 * Complete password validation for reset/change password
 * @param {string} password - Password to validate
 * @param {string} confirmPassword - Confirmation password
 * @returns {Object} Complete validation result
 */
export const validatePasswordReset = (password, confirmPassword) => {
  const validation = validatePasswordStrength(password);
  const passwordsMatch = password === confirmPassword;
  
  const result = {
    isValid: validation.isValid && passwordsMatch,
    errors: [...validation.errors],
    requirements: validation.requirements,
    passwordsMatch
  };

  if (!passwordsMatch) {
    result.errors.push('Passwords do not match');
  }

  if (isCommonPassword(password)) {
    result.errors.push('Password is too common. Please choose a more unique password.');
    result.isValid = false;
  }

  return result;
};
