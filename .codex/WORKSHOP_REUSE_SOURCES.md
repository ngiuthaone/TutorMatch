# Workshop External Sources

## OSS Libraries Used in Workshop Implementation

| Library | URL | License | Version | Purpose |
|---------|-----|---------|---------|---------|
| FullCalendar | https://fullcalendar.io/ | MIT | ^6.x | Session calendar UI for host workshop management |
| dnd-kit | https://dndkit.com/ | MIT | ^6.x | Drag-and-drop for image reordering in workshop creation |
| react-hook-form | https://react-hook-form.com/ | MIT | ^7.x | Form validation in workshop multi-step creation wizard |

## External Repositories Studied (Not Directly Copied)

| Repo | URL | License | Purpose |
|------|-----|---------|---------|
| Cal.diy (Cal.com fork) | https://github.com/calcom/cal.diy | MIT | Availability logic patterns, scheduling algorithms |
| Hi.Events | https://github.com/hi-events/hi-events | AGPL-3.0 | QR check-in patterns (studied, not copied due to license) |
| laravel-review-rateable | https://github.com/codebyray/laravel-review-rateable | MIT | Review rating patterns (studied) |

## Notes

- All libraries are used via npm packages, not source copying
- FullCalendar, dnd-kit, and react-hook-form are wrapped behind Tutoria abstractions
- No source code from external repositories was copied into Tutoria
- OSS policy compliance: packages installed via standard package managers

## License Compatibility

| Library | License | Commercial Use | Modification | Attribution |
|---------|---------|---------------|--------------|-------------|
| FullCalendar | MIT | ✅ | ✅ | ✅ Required |
| dnd-kit | MIT | ✅ | ✅ | ✅ Required |
| react-hook-form | MIT | ✅ | ✅ | ✅ Required |
| Cal.diy | MIT | ✅ | ✅ | ✅ Required |

All libraries use permissive MIT licenses compatible with Tutoria's commercial deployment.
