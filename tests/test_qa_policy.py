#!/usr/bin/env python3
"""Regression guard for the QA policy upgrade (QA preflight acceptance contracts + independent verification).

Ensures the dual-mode QA definition (Mode A preflight contract vs Mode B verification),
the QA/product boundary (PRODUCT_DECISION_REQUIRED), the browser specialty, and the
existing status vocabulary survive edits.
"""
from __future__ import annotations
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_VOCAB = ("PASS", "PARTIAL", "UNVERIFIED", "BLOCKED")
EXPECTED_AGENTS = {
    "product_planner", "product_designer", "code_explorer", "context_scout", "frontend_engineer",
    "backend_engineer", "qa_browser", "security_reviewer", "researcher", "license_guard",
    "database_engineer", "integration_engineer", "payments_engineer", "qa_engineer",
    "independent_verifier", "reliability_engineer",
}


class QaPolicyTest(unittest.TestCase):
    def test_qa_agent_keeps_name_and_browser_specialty(self):
        qa = (ROOT / ".codex/agents/qa-browser.toml").read_text()
        self.assertIn('name = "qa_browser"', qa)
        self.assertIn("BROWSER SPECIALTY", qa)
        for term in ("desktop and mobile widths", "console/runtime errors", "network failures"):
            self.assertIn(term, qa)

    def test_qa_agent_has_dual_modes_and_contract(self):
        qa = (ROOT / ".codex/agents/qa-browser.toml").read_text()
        self.assertIn("MODE A — ACCEPTANCE CONTRACT (preflight)", qa)
        self.assertIn("MODE B — VERIFICATION (post-implementation)", qa)
        self.assertIn("qa-contract", qa)
        self.assertIn("verify against the original acceptance contract, never a silently weakened re-derivation", qa.lower())
        self.assertIn("before the implementation agent starts", qa)

    def test_qa_agent_boundary_and_authority_order(self):
        qa = (ROOT / ".codex/agents/qa-browser.toml").read_text()
        self.assertIn("PRODUCT_DECISION_REQUIRED", qa)
        self.assertIn("Do not make product/domain decisions yourself", qa)
        self.assertIn("authoritative sources in this order", qa)
        self.assertIn("never automatically becomes a requirement", qa)

    def test_qa_agent_reports_existing_status_vocabulary(self):
        qa = (ROOT / ".codex/agents/qa-browser.toml").read_text()
        for status in STATUS_VOCAB:
            self.assertIn(status, qa)
        self.assertIn("FAIL is not a Tutoria run status", qa)

    def test_qa_agent_handles_external_reference_work(self):
        qa = (ROOT / ".codex/agents/qa-browser.toml").read_text()
        self.assertIn("Verify Tutoria-native outcomes rather than reference parity", qa)
        self.assertIn("no unjustified architecture transplant", qa)

    def test_agenda_md_encodes_preflight_and_proportionality(self):
        text = (ROOT / "AGENTS.md").read_text()
        self.assertIn("QA preflight acceptance contract", text)
        self.assertIn("PRODUCT_DECISION_REQUIRED", text)
        self.assertIn("Skip preflight for typo fixes, copy changes, isolated styling, and mechanical refactors", text)
        self.assertIn("QA expectations are established independently", text)
        for status in STATUS_VOCAB:
            self.assertIn(status, text)

    def test_orchestrator_skill_routes_qa_preflight(self):
        text = (ROOT / ".agents/skills/tutoria-orchestrator/SKILL.md").read_text()
        self.assertIn("QA preflight", text)
        self.assertIn("PRODUCT_DECISION_REQUIRED", text)
        self.assertIn("booking/payment/authorization flows", text)
        self.assertIn("contract-change", text)
        self.assertIn("requirements → acceptance contract → implementation → verification against the contract", text)

    def test_observability_supports_contract_records(self):
        script = (ROOT / "scripts/team-observability.py").read_text()
        self.assertIn("contract_path", script)
        self.assertIn("contract_changes", script)
        self.assertIn("def cmd_contract_change", script)
        self.assertIn("--contract-path", script)
        self.assertIn("--authorized-by", script)

    def test_example_contract_artifact_exists(self):
        contract = (ROOT / "docs/agent-team/qa-contracts/EXAMPLE-booking-cancel-reschedule-qa-contract.md")
        self.assertTrue(contract.exists())
        self.assertIn("PRODUCT_DECISION_REQUIRED", contract.read_text())

    def test_agent_roster_unchanged(self):
        seen = {p.stem.replace("-", "_") for p in (ROOT / ".codex/agents").glob("*.toml")}
        self.assertEqual(seen, EXPECTED_AGENTS)


if __name__ == "__main__":
    unittest.main()