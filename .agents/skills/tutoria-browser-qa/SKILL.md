---
name: tutoria-browser-qa
description: Run evidence-based browser QA for Tutoria user flows, responsive behavior, accessibility smoke checks, console/network failures, and server-authoritative state. Use after user-facing implementation, ideally with agent-browser when approved/installed.
compatibility: Codex project skill for the Tutoria repository
---

# Tutoria browser QA

## Workflow
1. Start from the real running application/environment and record URL/build context.
2. Use an isolated browser session.
3. Exercise the user flow as learner/host roles require.
4. Inspect visible outcome, console errors, failed network requests, redirects/auth, and persisted state after refresh.
5. Check key mobile/desktop breakpoints and keyboard/accessibility basics.
6. Capture screenshots or other evidence for regressions.

For booking flows, verify the UI reflects server-authoritative capacity/status after retries, conflicts, cancellations, and refresh; do not accept client-only state as proof.

When `vercel-labs/agent-browser` is approved and installed, use it as the execution layer rather than recreating browser automation.
