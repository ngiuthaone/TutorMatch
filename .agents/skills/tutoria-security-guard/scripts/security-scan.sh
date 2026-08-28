#!/usr/bin/env bash
set -euo pipefail

MODE="quick"
TARGET=""
PROD="false"
OUT_DIR="${TMPDIR:-/tmp}/tutoria-security-$(date +%Y%m%d-%H%M%S)"

usage() {
  cat <<'USAGE'
Usage: security-scan.sh [--quick|--full] [--target URL] [--prod] [--out DIR]

Safe baseline runner for tools that are ALREADY installed.
- Installs nothing.
- No remote target is scanned unless --target is supplied.
- --prod refuses active/fuzzing scanners; only passive/baseline-compatible checks are considered.
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --quick) MODE="quick"; shift ;;
    --full) MODE="full"; shift ;;
    --target) TARGET="${2:-}"; shift 2 ;;
    --prod) PROD="true"; shift ;;
    --out) OUT_DIR="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done

mkdir -p "$OUT_DIR"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

STATUS_FILE="$OUT_DIR/status.tsv"
printf 'check\tstatus\tnote\n' > "$STATUS_FILE"

record() {
  printf '%s\t%s\t%s\n' "$1" "$2" "$3" | tee -a "$STATUS_FILE" >/dev/null
}

run_capture() {
  local name="$1"; shift
  local logfile="$OUT_DIR/${name}.log"
  echo "==> $name"
  set +e
  "$@" >"$logfile" 2>&1
  local rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    record "$name" "PASS" "exit=0; see $logfile"
  else
    record "$name" "REVIEW" "exit=$rc; see $logfile"
  fi
  return 0
}

skip() {
  echo "==> $1 (skipped: $2)"
  record "$1" "SKIPPED" "$2"
}

# Never print environment values. Only record repository metadata.
{
  echo "root=$ROOT"
  echo "mode=$MODE"
  echo "prod=$PROD"
  echo "target_supplied=$([[ -n "$TARGET" ]] && echo yes || echo no)"
  echo "commit=$(git rev-parse --verify HEAD 2>/dev/null || echo unknown)"
  if [[ -f pnpm-lock.yaml ]]; then echo "package_manager=pnpm";
  elif [[ -f yarn.lock ]]; then echo "package_manager=yarn";
  elif [[ -f package-lock.json ]]; then echo "package_manager=npm";
  else echo "package_manager=unknown"; fi
} > "$OUT_DIR/context.txt"

# Secrets
if command -v gitleaks >/dev/null 2>&1; then
  run_capture "gitleaks" gitleaks git --redact --no-banner
elif command -v detect-secrets >/dev/null 2>&1; then
  run_capture "detect-secrets" detect-secrets scan --all-files
else
  skip "secrets" "gitleaks and detect-secrets are not installed"
fi

# Dependency / filesystem vulnerabilities
if command -v osv-scanner >/dev/null 2>&1; then
  run_capture "osv-scanner" osv-scanner scan source -r .
else
  skip "osv-scanner" "not installed"
fi

if command -v trivy >/dev/null 2>&1; then
  # Filesystem scan only; no automatic fixes/installation.
  run_capture "trivy" trivy fs --scanners vuln,secret,misconfig --exit-code 1 .
else
  skip "trivy" "not installed"
fi

# Existing project checks without installing packages.
if [[ -f package.json ]]; then
  if [[ -x node_modules/.bin/tsc ]]; then
    run_capture "typescript" node_modules/.bin/tsc --noEmit
  else
    skip "typescript" "local TypeScript binary not installed"
  fi

  if [[ -x node_modules/.bin/eslint ]]; then
    run_capture "eslint" node_modules/.bin/eslint .
  else
    skip "eslint" "local ESLint binary not installed"
  fi
fi

# GitHub Actions
if [[ -d .github/workflows ]]; then
  if command -v actionlint >/dev/null 2>&1; then
    run_capture "actionlint" actionlint
  else
    skip "actionlint" "not installed"
  fi

  if command -v zizmor >/dev/null 2>&1; then
    run_capture "zizmor" zizmor .github/workflows
  else
    skip "zizmor" "not installed"
  fi
fi

# Supabase linting — invoke only if repo + CLI expose this command.
if [[ -d supabase ]] && command -v supabase >/dev/null 2>&1; then
  if supabase db lint --help >/dev/null 2>&1; then
    run_capture "supabase-db-lint" supabase db lint
  else
    skip "supabase-db-lint" "installed Supabase CLI does not expose db lint"
  fi
fi

# Optional full-mode local source tools.
if [[ "$MODE" == "full" ]]; then
  if command -v semgrep >/dev/null 2>&1; then
    # Avoid pulling arbitrary remote rules here. Use local/configured rules only when available.
    if [[ -f .semgrep.yml || -f .semgrep.yaml ]]; then
      run_capture "semgrep" semgrep scan --config "$([[ -f .semgrep.yml ]] && echo .semgrep.yml || echo .semgrep.yaml)" .
    else
      skip "semgrep" "installed but no repository-local .semgrep.yml/.semgrep.yaml; refusing to fetch arbitrary rules automatically"
    fi
  else
    skip "semgrep" "not installed"
  fi

  if command -v syft >/dev/null 2>&1; then
    run_capture "syft-sbom" syft dir:. -o cyclonedx-json="$OUT_DIR/sbom.cdx.json"
  else
    skip "syft-sbom" "not installed"
  fi
fi

# Remote checks: intentionally conservative.
if [[ -n "$TARGET" ]]; then
  if [[ "$TARGET" != http://* && "$TARGET" != https://* ]]; then
    echo "Invalid --target: must be http(s) URL" >&2
    exit 2
  fi

  if command -v zap-baseline.py >/dev/null 2>&1; then
    run_capture "zap-baseline" zap-baseline.py -t "$TARGET"
  else
    skip "zap-baseline" "zap-baseline.py not installed"
  fi

  if [[ "$PROD" == "true" ]]; then
    skip "nuclei" "production mode: active template scanning disabled by this helper"
    skip "schemathesis" "production mode: generative API testing disabled by this helper"
    skip "ffuf" "production mode: fuzzing disabled by this helper"
  else
    # Nuclei is not launched automatically because safe template selection must be reviewed.
    skip "nuclei" "requires an explicitly reviewed safe template allowlist"
    skip "schemathesis" "requires an explicit OpenAPI/GraphQL schema and side-effect-safe configuration"
    skip "ffuf" "requires explicit scoped wordlist/rate/concurrency configuration"
  fi
fi

echo
echo "Reports: $OUT_DIR"
echo "Status summary:"
column -t -s $'\t' "$STATUS_FILE" 2>/dev/null || cat "$STATUS_FILE"
echo
echo "IMPORTANT: PASS only means the invoked check returned success. Business-logic, RLS, auth, payment, upload, and authorization review is still required."
