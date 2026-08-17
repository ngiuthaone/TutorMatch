export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < 12) return "Choose a password of at least 12 characters.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}
