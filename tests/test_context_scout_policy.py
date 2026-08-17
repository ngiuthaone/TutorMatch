#!/usr/bin/env python3
"""Regression guard for the Context Scout agent (context sufficiency + input optimization).

Validates evidence integrity (verified / not found / hypothetical / inference / external),
MISSING_CONTEXT vs MISSING_DECISION, founder-request quality, INPUT_REQUIRED scarcity,
context-readiness vs run-outcome separation in observability, external-reference product-policy
protection, the representative routing cases A-G, and the unchanged roster semantics.
"""
from __future__ import annotations
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATES = ("READY", "READY_WITH_GAPS", "INPUT_RECOMMENDED", "INPUT_REQUIRED")
EVIDENCE_LABELS = ("VERIFIED_TUTORIA_EVIDENCE", "NOT_FOUND", "HYPOTHETICAL_EXAMPLE", "INFERENCE", "EXTERNAL_EVIDENCE")
GAP_TYPES = ("MISSING_CONTEXT", "MISSING_DECISION")
CLASSIFICATIONS = (
    "DOMAIN_INVARIANT", "EXISTING_TUTORIA_POLICY", "PROTOTYPE_EVIDENCE",
    "REVERSIBLE_DESIGN_CHOICE", "PRODUCT_DECISION_REQUIRED", "EXTERNAL_SOURCE_ASSUMPTION",
)
EXPECTED_AGENTS = {
    "product_planner", "product_designer", "code_explorer", "context_scout", "frontend_engineer",
    "backend_engineer", "qa_browser", "security_reviewer", "researcher", "license_guard",
    "database_engineer", "integration_engineer", "payments_engineer", "qa_engineer",
    "independent_verifier", "reliability_engineer",
}
EXAMPLE_REPORT = ROOT / "docs/agent-team/EXAMPLE-context-readiness-report.md"
QA_CONTRACT = ROOT / "docs/agent-team/qa-contracts/EXAMPLE-booking-cancel-reschedule-qa-contract.md"


class ContextScoutPolicyTest(unittest.TestCase):
    def test_agent_defined_with_conventional_name_and_read_only(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn('name = "context_scout"', scout)
        self.assertIn('sandbox_mode = "read-only"', scout)
        self.assertIn("Read-only; never codes", scout)

    def test_readiness_states_present(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        for state in STATES:
            self.assertIn(state, scout)

    # --- Section 2: evidence integrity ---
    def test_evidence_integrity_labels_present(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("EVIDENCE INTEGRITY", scout)
        for label in EVIDENCE_LABELS:
            self.assertIn(label, scout)
        self.assertIn("Never present hypothetical, inferred, example, or external evidence as if it was actually discovered in Tutoria", scout)
        self.assertIn("Never ask the founder for an artifact that already exists", scout)

    # --- Section 5: missing context vs missing decision ---
    def test_gap_type_distinction(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        for gap in GAP_TYPES:
            self.assertIn(gap, scout)
        self.assertIn("search existing Tutoria sources first", scout)
        self.assertIn("never to have established the policy", scout)
        self.assertIn("surface a focused product decision rather than asking the founder to upload more files", scout)
        self.assertIn('Never emit "please provide more documentation"', scout)

    # --- Section 6: founder questions reduce decision surface ---
    def test_founder_requests_reduce_decision_surface(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("FOUNDER REQUESTS", scout)
        self.assertIn("Never ask open questions like", scout)
        self.assertIn("recommended default", scout)
        self.assertIn("This decision affects", scout)

    # --- Section 7: INPUT_REQUIRED scarcity ---
    def test_input_required_is_rare(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("Missing information alone is never enough to interrupt the founder", scout)
        for risk in ("incorrect authorization/ownership", "irreversible data design", "financial loss", "destructive migration", "security/privacy issues"):
            self.assertIn(risk, scout)

    # --- Section 8: founder effort vs expected improvement ---
    def test_effort_vs_improvement_principle(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("INPUT VALUE VS EFFORT", scout)
        self.assertIn("founder effort against expected outcome improvement", scout)
        self.assertIn("40 screenshots", scout)

    # --- Section 9: top-request limits ---
    def test_top_request_limit_and_deferred_grouping(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("no more than the few highest-value inputs (about three)", scout)
        self.assertIn("Other deferred context", scout)

    # --- Sections 4/12: observability separation ---
    def test_observability_separates_readiness_from_outcome(self):
        script = (ROOT / "scripts/team-observability.py").read_text()
        self.assertIn("CONTEXT_READINESS_VALUES", script)
        self.assertIn('"context_readiness": None', script)
        self.assertIn("--context-readiness", script)
        self.assertIn("distinct from run outcome and generic per-activity verdict", script)
        skill = (ROOT / ".agents/skills/tutoria-team-observability/SKILL.md").read_text()
        self.assertIn("--context-readiness", skill)
        self.assertIn("distinct from the run outcome status", skill)

    # --- Section 11: external-reference separation ---
    def test_external_reference_protection(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        for label in CLASSIFICATIONS:
            self.assertIn(label, scout)
        self.assertIn("must not silently become Tutoria product policy", scout)
        self.assertIn("Never conclude", scout)
        for section in ("VERIFIED TUTORIA EVIDENCE", "EXTERNAL OBSERVATION", "ABSTRACTED PRINCIPLE", "TUTORIA POLICY STATUS", "PRODUCT DECISION REQUIRED"):
            self.assertIn(section, scout)

    # --- Section 3: example evidence integrity ---
    def test_example_is_hypothetical_and_evidence_labeled(self):
        self.assertTrue(EXAMPLE_REPORT.exists())
        text = EXAMPLE_REPORT.read_text()
        self.assertIn("HYPOTHETICAL EXAMPLE", text)
        self.assertIn("VERIFIED TUTORIA EVIDENCE", text)
        self.assertIn("NOT FOUND IN TUTORIA", text)
        self.assertIn("EXTERNAL EVIDENCE", text)

    def test_example_verified_paths_exist(self):
        text = EXAMPLE_REPORT.read_text()
        verified_section = text.split("VERIFIED TUTORIA EVIDENCE", 1)[1].split("NOT FOUND IN TUTORIA", 1)[0]
        paths = re.findall(r"`([^`]+)`", verified_section)
        self.assertTrue(paths, "expected backticked verified paths in the example")
        for rel in paths:
            self.assertTrue((ROOT / rel).exists(), f"verified path missing from repo: {rel}")

    def test_example_does_not_list_fictional_evidence_as_verified(self):
        text = EXAMPLE_REPORT.read_text()
        verified_section = text.split("VERIFIED TUTORIA EVIDENCE", 1)[1].split("NOT FOUND IN TUTORIA", 1)[0]
        for fabricated in ("paper-inbox", "migrations/000", "booking tables", "routes/services", "tutoria-notifications"):
            self.assertNotIn(fabricated, verified_section, f"fictional evidence leaked into verified section: {fabricated}")
        not_found = text.split("NOT FOUND IN TUTORIA", 1)[1].split("GAPS:", 1)[0]
        self.assertIn("0001_profiles", not_found)
        self.assertIn("routes", not_found)

    def test_example_distinguishes_gap_types_and_decision_surface(self):
        text = EXAMPLE_REPORT.read_text()
        self.assertIn("MISSING_DECISION", text)
        self.assertIn("MISSING_CONTEXT", text)
        self.assertIn("Recommended default:", text)
        self.assertIn("EXTERNAL_SOURCE_ASSUMPTION", text)

    def test_qa_contract_example_evidence_claims_are_honest(self):
        self.assertTrue(QA_CONTRACT.exists())
        text = QA_CONTRACT.read_text()
        self.assertIn("HYPOTHETICAL EXAMPLE", text)
        self.assertIn("booking-lifecycle.ts", text)
        self.assertIn("0001_profiles", text)
        self.assertIn("Explicitly not verified", text)

    # --- Section 12: routing cases encoded in policy ---
    def test_case_a_trivial_styling_skips_scout(self):
        agenda = (ROOT / "AGENTS.md").read_text()
        self.assertIn("Routine UI fix (styling, spacing, hover, small responsive bug)", agenda)
        self.assertIn("no `context_scout`", agenda)
        self.assertIn("never block routine reversible work", agenda)

    def test_case_b_external_styling_inspiration_is_not_gated(self):
        orchestrator = (ROOT / ".agents/skills/tutoria-orchestrator/SKILL.md").read_text()
        self.assertIn("styling, spacing, typography, hover, small responsive fixes", orchestrator)
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("Never block low-risk or reversible work", scout)

    def test_case_c_product_sensitive_external_reference_triggers_scout(self):
        agenda = (ROOT / "AGENTS.md").read_text()
        orchestrator = (ROOT / ".agents/skills/tutoria-orchestrator/SKILL.md").read_text()
        self.assertIn("external-reference work", agenda)
        self.assertIn("Complex booking architecture: `context_scout`", orchestrator)
        self.assertIn("booking/cancellation/rescheduling", agenda)

    def test_case_d_missing_context(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("likely already exists somewhere but has not been located or supplied", scout)
        self.assertIn("request the relevant artifact only if necessary", scout)

    def test_case_e_missing_decision(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("Tutoria appears never to have established the policy", scout)
        self.assertIn("surface a focused product decision rather than asking the founder to upload more files", scout)

    def test_case_f_high_risk_payment_ambiguity(self):
        scout = (ROOT / ".codex/agents/context-scout.toml").read_text()
        self.assertIn("financial loss", scout)
        report = EXAMPLE_REPORT.read_text()
        self.assertIn("refund", report)
        self.assertIn("PRODUCT DECISION REQUIRED", report)

    def test_case_g_examples_cannot_claim_uninspected_facts(self):
        for artifact in (EXAMPLE_REPORT, QA_CONTRACT):
            text = artifact.read_text()
            self.assertIn("HYPOTHETICAL EXAMPLE", text)
            self.assertTrue(
                "inspected" in text or "verified in this repository" in text,
                f"{artifact.name}: no verification/inspection honesty marker found",
            )

    # --- Integration ---
    def test_agenda_md_integrates_context_scout(self):
        text = (ROOT / "AGENTS.md").read_text()
        self.assertIn("`context_scout`", text)
        for state in STATES:
            self.assertIn(state, text)
        self.assertIn("DISCOVER TUTORIA CONTEXT → STUDY → ABSTRACT → CLASSIFY PRODUCT POLICY", text)
        self.assertIn("MISSING_CONTEXT", text)
        self.assertIn("MISSING_DECISION", text)

    def test_orchestrator_skill_routes_context_scout_early(self):
        text = (ROOT / ".agents/skills/tutoria-orchestrator/SKILL.md").read_text()
        self.assertIn("## Context Scout (context sufficiency)", text)
        self.assertIn("--context-readiness", text)
        self.assertIn("context_scout: invoked YES/NO", text)

    def test_agent_roster_is_full_team(self):
        seen = {p.stem.replace("-", "_") for p in (ROOT / ".codex/agents").glob("*.toml")}
        self.assertEqual(seen, EXPECTED_AGENTS)


if __name__ == "__main__":
    unittest.main()