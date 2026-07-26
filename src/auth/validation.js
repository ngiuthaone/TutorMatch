export function validateEmail(value) {
  const email = String(value || "").trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("INVALID_EMAIL");
  return email;
}
export function validatePassword(password) {
  if (typeof password !== "string" || password.length < 12 || password.length > 128) throw new Error("INVALID_PASSWORD");
  return password;
}
export function validateSignup(input) {
  const name = String(input.name || "").trim();
  if (!name || name.length > 120) throw new Error("INVALID_NAME");
  if (!new Set(["student", "tutor"]).has(input.role)) throw new Error("INVALID_ROLE");
  if (input.password !== input.confirmPassword) throw new Error("PASSWORD_MISMATCH");
  if (input.acceptedTerms !== true) throw new Error("TERMS_REQUIRED");
  return { name, email: validateEmail(input.email), password: validatePassword(input.password), role: input.role };
}
export function validatePasswordUpdate(input) {
  if (input.password !== input.confirmPassword) throw new Error("PASSWORD_MISMATCH");
  return validatePassword(input.password);
}
