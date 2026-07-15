export const getPasswordStrength = (password: string): 'weak' | 'medium' | 'strong' => {
  if (password.length < 8) {
    return 'weak';
  }

  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const strengthScore = [hasLowerCase, hasUpperCase, hasNumbers, hasSpecialChar].filter(Boolean).length;

  if (strengthScore >= 3 && password.length >= 12) {
    return 'strong';
  } else if (strengthScore >= 2 && password.length >= 8) {
    return 'medium';
  }

  return 'weak';
};
