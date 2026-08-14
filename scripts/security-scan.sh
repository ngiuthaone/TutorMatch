#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/.agents/skills/tutoria-security-guard/scripts/security-scan.sh"
if [[ ! -x "$TARGET" ]]; then
  echo "Tutoria Security Guard helper not found or not executable: $TARGET" >&2
  echo "Expected skill path: .agents/skills/tutoria-security-guard/" >&2
  exit 2
fi
exec "$TARGET" "$@"
