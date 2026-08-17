#!/usr/bin/env python3
"""Regression guard for the external-reference policy (STUDY -> ABSTRACT -> TUTORIA-NATIVE).

Ensures the mode distinction (INCORPORATE / ADAPT / STUDY_ONLY / HARD_BLOCK),
the STUDY_ONLY information boundary, and the unchanged nine-agent roster survive edits.
"""
from __future__ import annotations
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODES = ("INCORPORATE", "ADAPT", "STUDY_ONLY", "HARD_BLOCK")
EXPECTED_AGENTS = {
    "product_planner", "product_designer", "code_explorer", "context_scout", "frontend_engineer",
    "backend_engineer", "qa_browser", "security_reviewer", "researcher", "license_guard",
    "database_engineer", "integration_engineer", "payments_engineer", "qa_engineer",
    "independent_verifier", "reliability_engineer",
}


class ReferencePolicyTest(unittest.TestCase):
    def test_agenda_md_encodes_default_philosophy(self):
        text = (ROOT / "AGENTS.md").read_text()
        self.assertIn("External reference philosophy", text)
        self.assertIn("STUDY → ABSTRACT → TUTORIA-NATIVE IMPLEMENTATION", text)
        for mode in MODES:
            self.assertIn(mode, text)
        self.assertIn("must not cancel a Tutoria feature by default", text)

    def test_license_guard_keeps_anti_laundering_and_study_only_flow(self):
        text = (ROOT / ".agents/skills/repo-license-guard/SKILL.md").read_text()
        self.assertIn("No license laundering", text)
        self.assertIn("Source status vs feature action", text)
        self.assertIn("STUDY_ONLY continuation", text)
        for mode in MODES:
            self.assertIn(mode, text)
        self.assertIn("rewritten by AI", text)

    def test_orchestrator_routes_modes_and_minimal_teams(self):
        text = (ROOT / ".agents/skills/tutoria-orchestrator/SKILL.md").read_text()
        self.assertIn("STUDY → ABSTRACT → TUTORIA-NATIVE IMPLEMENTATION", text)
        for mode in MODES:
            self.assertIn(mode, text)
        self.assertIn("research budget", text)
        self.assertIn("Simple UI reference", text)
        self.assertIn("Existing safe dependency", text)
        self.assertIn("Complex booking architecture", text)

    def test_agent_roster_unchanged(self):
        seen = {p.stem.replace("-", "_") for p in (ROOT / ".codex/agents").glob("*.toml")}
        self.assertEqual(seen, EXPECTED_AGENTS)

    def test_researcher_and_license_guard_roles_updated(self):
        researcher = (ROOT / ".codex/agents/researcher.toml").read_text()
        self.assertIn("STUDY_ONLY", researcher)
        self.assertIn("license_guard", researcher)
        guard = (ROOT / ".codex/agents/license-guard.toml").read_text()
        for mode in MODES:
            self.assertIn(mode, guard)
        self.assertIn("does not cancel a Tutoria feature by default", guard)

    def test_engineers_implement_from_spec_only(self):
        for rel in (".codex/agents/frontend-engineer.toml", ".codex/agents/backend-engineer.toml"):
            text = (ROOT / rel).read_text()
            self.assertIn("STUDY_ONLY", text)
            self.assertIn("do not reopen or reconstruct restricted external implementation", text)


if __name__ == "__main__":
    unittest.main()
