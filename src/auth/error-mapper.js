const messages = {
  INVALID_EMAIL: "Enter a valid email address.", INVALID_PASSWORD: "Use a password between 12 and 128 characters.",
  INVALID_NAME: "Enter a name between 1 and 120 characters.", INVALID_ROLE: "Choose student or tutor.",
  PASSWORD_MISMATCH: "Passwords do not match.", TERMS_REQUIRED: "Accept the Terms and Privacy Policy to continue.",
  UNAUTHORIZED: "Your session is no longer valid. Please sign in again.", PROFILE_NOT_FOUND: "Your account profile is not ready yet.",
  FORBIDDEN: "You do not have access to this area.", RATE_LIMITED: "Too many requests. Please try again later.",
  SERVICE_UNAVAILABLE: "The authentication service is temporarily unavailable.", INVALID_CALLBACK: "This sign-in link is invalid or expired."
};
export function safeMessage(error, operation) {
  if (operation === "signIn") return "Unable to sign in with those credentials.";
  if (["signUp", "resend"].includes(operation)) return "If this address can be registered, check your email to continue.";
  if (operation === "reset") return "If an account can receive email, password-reset instructions have been sent.";
  return messages[error?.code || error?.message] || "Something went wrong. Please try again.";
}
