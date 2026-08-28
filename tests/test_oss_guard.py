#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[1] / "scripts" / "oss_guard.py"
spec = importlib.util.spec_from_file_location("oss_guard", MODULE_PATH)
oss_guard = importlib.util.module_from_spec(spec)
assert spec.loader
spec.loader.exec_module(oss_guard)


class GuardTests(unittest.TestCase):
    def base(self, **updates):
        data = {
            "id": "tiptap-core-example",
            "name": "Tiptap core",
            "source": "https://github.com/ueberdosis/tiptap",
            "ref": "3.23.6",
            "license": "MIT",
            "status": "PASS",
            "scope": ["packages/core/src/index.ts"],
            "planned_use": "dependency",
            "checked_on": "2026-08-11",
            "evidence": ["LICENSE.md at pinned version"],
            "required_actions": ["Preserve MIT notice"],
            "excluded_material": ["Pro/cloud services and unverified assets"]
        }
        data.update(updates)
        return data

    def test_valid_pass(self):
        errors = oss_guard.validate_entry(self.base(), set())
        self.assertEqual(errors, [])

    def test_unpinned_ref_fails(self):
        errors = oss_guard.validate_entry(self.base(ref="main"), set())
        self.assertTrue(any("pin" in x for x in errors))

    def test_busl_cannot_be_pass(self):
        errors = oss_guard.validate_entry(self.base(license="BUSL-1.1"), set())
        self.assertTrue(errors)

    def test_restricted_scope_fails(self):
        errors = oss_guard.validate_entry(self.base(scope=["ee/feature.ts"]), set())
        self.assertTrue(any("restricted path" in x for x in errors))

    def test_study_only_registry_cannot_be_incorporated(self):
        entry = self.base(
            source="https://cal.com",
            license="MIT",
            scope=["src/scheduling.ts"]
        )
        errors = oss_guard.validate_entry(entry, set())
        self.assertTrue(any("STUDY_ONLY" in x for x in errors))

    def test_notices_render_marker(self):
        old_sources = oss_guard.SOURCES
        try:
            with tempfile.TemporaryDirectory() as td:
                p = Path(td) / "sources.json"
                p.write_text(json.dumps({"schema_version": 1, "entries": [self.base()]}), encoding="utf-8")
                oss_guard.SOURCES = p
                text = oss_guard.render_notices()
                self.assertIn("<!-- OSS:tiptap-core-example -->", text)
                self.assertIn("Pinned ref/version", text)
        finally:
            oss_guard.SOURCES = old_sources


if __name__ == "__main__":
    unittest.main()
