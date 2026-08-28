# Tutoria Agent Model & Cost Policy V2

Use model specialization to preserve quality without making every subagent an expensive deep-reasoning worker.

## Suggested defaults in this pack

- `gpt-5.6` + high: database, integration, payments — high-consequence implementation and cross-system reasoning.
- `gpt-5.6-terra` + high: QA, independent verification, reliability — read/review/test-heavy work requiring strong edge-case reasoning.
- `gpt-5.6-luna` + medium: context scout — bounded evidence gathering.

Existing roles should retain their current live settings unless measured results justify changing them.

## Runtime verification rule

Never assume a configured subagent model actually ran merely because the TOML requested it. When cost/routing matters, inspect the Codex activity/session evidence available in the current client and report the actual provider/model if exposed. If it cannot be verified, report `MODEL_RUNTIME_UNVERIFIED` rather than guessing.

## Quota discipline

- Do not spawn the entire team.
- Prefer read-heavy parallel work, then serialize implementation.
- Reuse prior evidence within the same run instead of asking multiple agents to rediscover the same files.
- Use the context scout only for genuine context gaps.
- Stop specialists once their bounded output is sufficient for the orchestrator.
