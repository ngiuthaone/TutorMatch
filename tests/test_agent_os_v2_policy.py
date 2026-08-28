#!/usr/bin/env python3
"""Regression guard for the Tutoria Agent OS V2 integration.

Covers the six bounded routing smoke scenarios (A-F), the production-specialist
team, phase activation, external-skill candidate registry separation from the
real OSS ledger, read-only guards, and the qa_engineer/qa_browser distinction.
"""
from __future__ import annotations
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
V2_AGENTS = {
    "database_engineer", "integration_engineer", "payments_engineer", "qa_engineer",
    "independent_verifier", "reliability_engineer", "context_scout",
}
V2_SKILLS = {
    "tutoria-task-routing", "tutoria-context-scout", "tutoria-evidence-map",
    "tutoria-handoff-contract", "tutoria-requirement-traceability", "tutoria-domain-modeling",
    "tutoria-capacity-concurrency", "tutoria-supabase-persistence", "tutoria-postgres-concurrency",
    "tutoria-rls-review", "tutoria-application-services", "tutoria-idempotency-outbox",
    "tutoria-payment-integration", "tutoria-payment-webhooks", "tutoria-backend-qa",
    "tutoria-browser-qa", "tutoria-independent-verification", "tutoria-server-authoritative-ui",
    "tutoria-production-reliability", "tutoria-product-policy", "tutoria-skill-ingestion",
    "tutoria-external-reference",
}
NEW_AGENTS = V2_AGENTS - {"context_scout"}  # context_scout already existed and was merged


def frontmatter(text: str) -> dict[str, str]:
    end = text.find("\n---\n", 4)
    out = {}
    for raw in text[4:end].splitlines():
        if ":" in raw:
            k, v = raw.split(":", 1)
            out[k.strip()] = v.strip().strip('"\'')
    return out


class AgentOsV2PolicyTest(unittest.TestCase):
    def setUp(self):
        self.agenda = (ROOT / "AGENTS.md").read_text()

    def agent(self, name: str) -> str:
        return (ROOT / ".codex/agents" / f"{name.replace('_', '-')}.toml").read_text()

    # --- Production-specialist team integration ---
    def test_new_agents_present(self):
        seen = {p.stem.replace("-", "_") for p in (ROOT / ".codex/agents").glob("*.toml")}
        self.assertTrue(NEW_AGENTS <= seen, f"missing new agents: {NEW_AGENTS - seen}")
        self.assertTrue(V2_AGENTS <= seen, f"missing V2 agents: {V2_AGENTS - seen}")

    def test_read_only_guards(self):
        for name in ("independent_verifier", "context_scout"):
            self.assertIn('sandbox_mode = "read-only"', self.agent(name))

    def test_qa_engineer_vs_qa_browser_distinction(self):
        agenda = self.agenda
        self.assertIn("qa_engineer", agenda)
        self.assertIn("backend/integration/concurrency/idempotency/failure-path QA", agenda)
        self.assertIn("Distinct from `qa_browser`, which remains the browser/UI/E2E specialist", agenda)
        self.assertIn("Pure unit tests do not prove database concurrency safety", agenda)
        qa = self.agent("qa_engineer")
        self.assertIn("qa_browser owns browser/UI/E2E", qa)
        self.assertIn("UNVERIFIED", qa)

    def test_payments_engineer_cannot_redefine_booking_status(self):
        payments = self.agent("payments_engineer")
        self.assertIn("BookingStatus", payments)
        self.assertIn("Do not add awaiting_payment", payments)
        self.assertIn("webhook is untrusted", payments)
        self.assertIn("PRODUCT_DECISION_REQUIRED", payments)

    def test_database_engineer_boundary(self):
        db = self.agent("database_engineer")
        self.assertIn("Do not redefine Booking", db)
        self.assertIn("capacity", db.lower())
        self.assertIn("serialization", db.lower())
        self.assertIn("Coordinate with security_reviewer", db)

    def test_authority_boundary_rule_in_agenda(self):
        self.assertIn("product policy ≠ domain invariant ≠ database enforcement strategy", self.agenda)

    # --- Scenario A: Capacity + Concurrency domain (no Supabase, no specialists by default) ---
    def test_routing_a_capacity_domain_does_not_spawn_whole_team(self):
        self.assertIn("no Supabase inside a capacity design-only task", self.agenda)
        self.assertIn("existing backend team + `independent_verifier`", self.agenda)
        self.assertIn("do not spawn them merely because they exist", self.agenda)
        phase = (ROOT / "docs/agent-team/AGENT_SKILL_PHASE_ACTIVATION_V2.md").read_text()
        self.assertIn("Phase 0 — Capacity/Domain Freeze", phase)
        self.assertIn("do not begin Supabase inside a capacity design-only task", phase)

    # --- Scenario B: Supabase persistence task ---
    def test_routing_b_supabase_persistence(self):
        self.assertIn("`database_engineer` primary, `backend_engineer` + `security_reviewer` + `qa_engineer` + verifier", self.agenda)
        matrix = (ROOT / "docs/agent-team/AGENT_ROUTING_MATRIX_V2.md").read_text()
        self.assertIn("Supabase schema/migration", matrix)
        self.assertIn("security_reviewer", matrix)

    # --- Scenario C: Payment webhook integration ---
    def test_routing_c_payment_webhook(self):
        self.assertIn("`payments_engineer` + `integration_engineer` + `security_reviewer` + `qa_engineer` + verifier", self.agenda)
        matrix = (ROOT / "docs/agent-team/AGENT_ROUTING_MATRIX_V2.md").read_text()
        self.assertIn("Payment provider/webhook", matrix)
        webhooks = (ROOT / ".agents/skills/tutoria-payment-webhooks/SKILL.md").read_text()
        self.assertIn("duplicate events, reordered events, invalid signatures", webhooks)

    # --- Scenario D: small frontend spacing/responsive bug ---
    def test_routing_d_small_frontend_fix(self):
        self.assertIn("Routine UI fix (styling, spacing, hover, small responsive bug)", self.agenda)
        self.assertIn("`frontend_engineer`, then `qa_browser`", self.agenda)
        self.assertIn("no `context_scout`, no preflight contract", self.agenda)
        routing = (ROOT / ".agents/skills/tutoria-task-routing/SKILL.md").read_text()
        self.assertIn("Do not add separate agents merely for Booking, Session, Capacity", routing)

    # --- Scenario E: external agent skill request ---
    def test_routing_e_external_skill_request(self):
        self.assertIn("external-reference/skill-ingestion workflows", self.agenda)
        ingestion = (ROOT / ".agents/skills/tutoria-skill-ingestion/SKILL.md").read_text()
        for step in ("Resolve exact source", "License/provenance gate", "Security scan",
                     "Semantic conflict review", "Least privilege", "Validate"):
            self.assertIn(step, ingestion)
        self.assertIn("Never install from an “awesome” list merely because it is popular", ingestion)
        self.assertIn("A blocked external source does not automatically block independent Tutoria implementation", ingestion)

    # --- Scenario F: missing historical context ---
    def test_routing_f_context_scout(self):
        self.assertIn("`context_scout`", self.agenda)
        self.assertIn("never blocked on for routine work", self.agenda)
        self.assertIn("Read-only; never codes", self.agenda)
        scout = self.agent("context_scout")
        self.assertIn("READY_WITH_GAPS", scout)
        self.assertIn("INPUT_REQUIRED", scout)
        self.assertIn("MISSING_DECISION", scout)
        self.assertIn("SEARCH BEFORE REQUEST", scout)

    # --- Skill library integrity ---
    def test_v2_skills_present_with_frontmatter_and_spec(self):
        for skill in V2_SKILLS:
            d = ROOT / ".agents/skills" / skill
            self.assertTrue((d / "SKILL.md").is_file(), f"{skill}: missing SKILL.md")
            self.assertTrue((d / "SPEC.md").is_file(), f"{skill}: missing SPEC.md")
            fm = frontmatter((d / "SKILL.md").read_text())
            self.assertEqual(fm.get("name"), skill, f"{skill}: frontmatter name mismatch")
            self.assertTrue(fm.get("description"), f"{skill}: missing description")

    def test_no_duplicate_canonical_workflow_skill(self):
        names = []
        for d in (ROOT / ".agents/skills").iterdir():
            p = d / "SKILL.md"
            if not p.is_file():
                continue
            fm = frontmatter(p.read_text())
            name = fm.get("name") or d.name
            names.append(name)
        self.assertEqual(len(names), len(set(names)), f"duplicate skill names: {names}")

    def test_skill_library_reference_in_agenda(self):
        self.assertIn("canonical Tutoria skill library", self.agenda)
        self.assertIn("Skills activate by task relevance", self.agenda)

    # --- External candidate registry separation ---
    def test_candidate_registry_separate_from_ledger(self):
        cand = (ROOT / "oss/AGENT_SKILL_CANDIDATES.json").read_text()
        self.assertIn("NOT the incorporated external-source ledger", cand)
        self.assertIn("no permanent approval", cand)
        ledger = (ROOT / "oss/EXTERNAL_SOURCES.json").read_text()
        self.assertNotIn("AGENT_SKILL_CANDIDATES", ledger)
        self.assertNotIn("agentskills/agentskills", ledger)

    def test_external_adoption_plan_not_a_ledger(self):
        plan = (ROOT / "docs/agent-team/EXTERNAL_AGENT_SKILL_ADOPTION_PLAN.md").read_text()
        self.assertIn("not incorporated", plan)
        self.assertIn("separate from `oss/EXTERNAL_SOURCES.json`", plan)


if __name__ == "__main__":
    unittest.main()
