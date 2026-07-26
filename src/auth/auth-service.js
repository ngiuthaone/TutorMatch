import { validateEmail, validateSignup, validatePasswordUpdate } from "./validation.js";

export function createAuthService({ client, callbackUrl }) {
  return Object.freeze({
    async signUp(input) {
      const value = validateSignup(input);
      const result = await client.auth.signUp({ email: value.email, password: value.password, options: { data: { name: value.name, role: value.role }, emailRedirectTo: callbackUrl } });
      return { session: result.data?.session || null, error: result.error || null };
    },
    async signIn(input) { return client.auth.signInWithPassword({ email: validateEmail(input.email), password: input.password }); },
    async signOut() { return client.auth.signOut({ scope: "global" }); },
    async resendVerification(email) { return client.auth.resend({ type: "signup", email: validateEmail(email), options: { emailRedirectTo: callbackUrl } }); },
    async requestPasswordReset(email) { return client.auth.resetPasswordForEmail(validateEmail(email), { redirectTo: callbackUrl }); },
    async completePasswordRecovery(input) { return client.auth.updateUser({ password: validatePasswordUpdate(input) }); },
    async exchangeCode(code) { return client.auth.exchangeCodeForSession(code); }
  });
}
