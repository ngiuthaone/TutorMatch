import { safeMessage } from "../auth/error-mapper.js";
import { routeForRole } from "../auth/redirect-policy.js";

const pending = new WeakSet();
function element(tag, attributes = {}, text = "") {
  const node = document.createElement(tag); Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value)); node.textContent = text; return node;
}
function field(form, labelText, name, type, autocomplete) {
  const label = element("label", { class: "auth-field" }, labelText); const input = element("input", { name, type, autocomplete, required: "", maxlength: type === "password" ? "128" : "254" }); label.append(input); form.append(label); return input;
}
function shell(title, description) {
  const main = element("main", { class: "auth-page" }); const panel = element("section", { class: "auth-panel", "aria-labelledby": "auth-title" });
  panel.append(element("a", { class: "auth-brand", href: "#/" }, "Tutoria"), element("h1", { id: "auth-title" }, title), element("p", { class: "auth-intro" }, description)); main.append(panel); return { main, panel };
}
function statusNode(panel) { const status = element("div", { class: "auth-status", role: "status", "aria-live": "polite", tabindex: "-1" }); panel.append(status); return status; }
function submitButton(form, text) { const button = element("button", { type: "submit", class: "auth-primary" }, text); form.append(button); return button; }
async function submitOnce(form, button, task, status) {
  if (pending.has(form)) return; pending.add(form); button.disabled = true; button.setAttribute("aria-busy", "true"); status.textContent = "Working…";
  try { await task(); } catch (error) { status.textContent = safeMessage(error, form.dataset.operation); status.focus(); form.querySelectorAll('input[type="password"]').forEach((input) => { input.value = ""; }); }
  finally { pending.delete(form); button.disabled = false; button.removeAttribute("aria-busy"); }
}
function links(panel, entries) { const nav = element("nav", { class: "auth-links", "aria-label": "Authentication" }); entries.forEach(([href, label]) => nav.append(element("a", { href }, label))); panel.append(nav); }

export function createAuthUI({ authService, manager, navigate }) {
  function signIn() {
    const { main, panel } = shell("Sign in", "Use your verified Tutoria account."); const form = element("form", { class: "auth-form", "data-operation": "signIn" });
    const email = field(form, "Email", "email", "email", "email"), password = field(form, "Password", "password", "password", "current-password"); const button = submitButton(form, "Sign in"); panel.append(form); const status = statusNode(panel);
    form.addEventListener("submit", (event) => { event.preventDefault(); void submitOnce(form, button, async () => { const result = await authService.signIn({ email: email.value, password: password.value }); if (result.error || !result.data?.session) throw new Error("SIGN_IN_FAILED"); const next = await manager.synchronize(result.data.session); if (next.status !== "authenticated") throw new Error(next.safeErrorCode || "SIGN_IN_FAILED"); password.value = ""; navigate(routeForRole(next.profile.role)); }, status); });
    links(panel, [["#/auth/forgot-password", "Forgot password?"], ["#/auth/sign-up", "Create an account"]]); return main;
  }
  function signUp() {
    const { main, panel } = shell("Create your account", "Choose student or tutor. Administrative accounts cannot be created here."); const form = element("form", { class: "auth-form", "data-operation": "signUp" });
    const name = field(form, "Name", "name", "text", "name"), email = field(form, "Email", "email", "email", "email"), password = field(form, "Password", "password", "password", "new-password"), confirmPassword = field(form, "Confirm password", "confirmPassword", "password", "new-password");
    const roleLabel = element("label", { class: "auth-field" }, "Account type"), role = element("select", { name: "role" }); role.append(element("option", { value: "student" }, "Student or parent"), element("option", { value: "tutor" }, "Tutor")); roleLabel.append(role); form.append(roleLabel);
    const termsLabel = element("label", { class: "auth-terms" }), terms = element("input", { type: "checkbox", name: "terms" }); termsLabel.append(terms, document.createTextNode(" I accept the "), element("a", { href: "#/terms" }, "Terms"), document.createTextNode(" and "), element("a", { href: "#/privacy" }, "Privacy Policy")); form.append(termsLabel);
    const button = submitButton(form, "Create account"); panel.append(form); const status = statusNode(panel);
    form.addEventListener("submit", (event) => { event.preventDefault(); void submitOnce(form, button, async () => { const result = await authService.signUp({ name: name.value, email: email.value, password: password.value, confirmPassword: confirmPassword.value, role: role.value, acceptedTerms: terms.checked }); password.value = confirmPassword.value = ""; if (result.error || !result.session) { status.textContent = safeMessage(null, "signUp"); navigate("#/auth/check-email"); return; } const next = await manager.synchronize(result.session); if (next.status !== "authenticated") throw new Error(next.safeErrorCode); navigate(routeForRole(next.profile.role)); }, status); });
    links(panel, [["#/auth/sign-in", "Already registered? Sign in"]]); return main;
  }
  function emailAction(kind) {
    const forgot = kind === "reset", { main, panel } = shell(forgot ? "Reset your password" : "Check your email", forgot ? "We will send recovery instructions when possible." : "Verify your address before opening a private dashboard."); const form = element("form", { class: "auth-form", "data-operation": forgot ? "reset" : "resend" }); const email = field(form, "Email", "email", "email", "email"); const button = submitButton(form, forgot ? "Send reset instructions" : "Resend verification"); panel.append(form); const status = statusNode(panel); let availableAt = 0;
    form.addEventListener("submit", (event) => { event.preventDefault(); void submitOnce(form, button, async () => { if (Date.now() < availableAt) throw new Error("RATE_LIMITED"); availableAt = Date.now() + 30_000; if (forgot) await authService.requestPasswordReset(email.value); else await authService.resendVerification(email.value); status.textContent = safeMessage(null, forgot ? "reset" : "resend"); }, status); }); links(panel, [["#/auth/sign-in", "Return to sign in"]]); return main;
  }
  function updatePassword() {
    const { main, panel } = shell("Choose a new password", "This form is available only from a verified recovery session.");
    if (manager.getState().status !== "password_recovery") { panel.append(element("p", { class: "auth-error" }, "This recovery link is invalid or expired.")); links(panel, [["#/auth/forgot-password", "Request a new link"]]); return main; }
    const form = element("form", { class: "auth-form", "data-operation": "update" }); const password = field(form, "New password", "password", "password", "new-password"), confirmPassword = field(form, "Confirm password", "confirmPassword", "password", "new-password"), button = submitButton(form, "Update password"); panel.append(form); const status = statusNode(panel);
    form.addEventListener("submit", (event) => { event.preventDefault(); void submitOnce(form, button, async () => { const result = await authService.completePasswordRecovery({ password: password.value, confirmPassword: confirmPassword.value }); password.value = confirmPassword.value = ""; if (result.error) throw new Error("UPDATE_FAILED"); await authService.signOut(); manager.invalidate(); navigate("#/auth/sign-in"); }, status); }); return main;
  }
  return Object.freeze({
    render(container, hash, state) {
      container.replaceChildren();
      if (state.status === "initializing") { const { main, panel } = shell("Securing your session", "Please wait while Tutoria verifies your account."); panel.setAttribute("aria-busy", "true"); container.append(main); return; }
      if (hash.startsWith("#/auth/sign-up")) container.append(signUp());
      else if (hash.startsWith("#/auth/check-email")) container.append(emailAction("resend"));
      else if (hash.startsWith("#/auth/forgot-password")) container.append(emailAction("reset"));
      else if (hash.startsWith("#/auth/update-password")) container.append(updatePassword());
      else container.append(signIn());
    }
  });
}
