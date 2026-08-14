# Verified License Snapshot — 2026-08-11

This is a dated convenience snapshot. **Do not treat it as permanent approval.** Before use, verify the exact pinned ref and exact files with the repo-license-guard.

| Source | Snapshot status | Scope note |
|---|---|---|
| Supabase | Apache-2.0 | Preserve applicable notices; verify exact files/ref. |
| Tiptap core | MIT | Separate Pro/cloud/docs/assets may have different terms. |
| shadcn/ui | MIT | Preserve MIT notice conservatively for copied/substantial code. |
| Medusa | MIT | Verify exact files/ref and third-party material. |
| MapLibre GL JS | BSD-3-Clause | Preserve bundled third-party notices; no unauthorized proprietary Mapbox backports. |
| LiveKit server | Apache-2.0 | NOTICE exists and should be preserved where applicable. |
| Trigger.dev | Apache-2.0 | Verify exact ref/files. |
| FullCalendar Standard | MIT | Premium is separately licensed; do not auto-use Premium. |
| Cal.diy | MIT | Current public community repo; production/security self-hosting warning still applies operationally. |
| Cal.com production code | Private | Study public behavior/docs only unless separate rights are verified. |
| Meilisearch | MIT + BUSL-1.1 mixed | Community/MIT paths only; Enterprise/BUSL paths excluded absent commercial agreement. |
| Novu | MIT core + commercial Enterprise | Exclude `enterprise/`, `apps/web/src/ee/`, `apps/dashboard/src/ee/`. |
| PostHog | MIT outside `ee/` | Exclude `ee/`; verify third-party components separately. |

## Important Cal.com change

On 2026-04-15 Cal.com announced that its production codebase moved private and the public community version became `calcom/cal.diy` under MIT. Therefore older statements that the *current* public Cal.com repository is AGPL/open-core are stale. Historical AGPL/open-core source can still carry those historical obligations if deliberately reused.

## Evidence sources to re-check before use

- `https://github.com/supabase/supabase`
- `https://github.com/ueberdosis/tiptap`
- `https://github.com/shadcn-ui/ui`
- `https://github.com/medusajs/medusa`
- `https://github.com/maplibre/maplibre-gl-js`
- `https://github.com/livekit/livekit`
- `https://github.com/triggerdotdev/trigger.dev`
- `https://github.com/fullcalendar/fullcalendar`
- `https://github.com/calcom/cal.diy`
- `https://github.com/meilisearch/meilisearch`
- `https://github.com/novuhq/novu`
- `https://github.com/PostHog/posthog`
