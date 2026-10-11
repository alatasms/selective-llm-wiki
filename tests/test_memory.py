"""Observable hook behavior and deliberately broken discovery routes."""
from pathlib import Path
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / f"{name}.py")
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


hook = module("session_start")
checker = module("check_memory")
guard = module("guard_memory")


class MemoryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "state.md").write_text("# State\n## Startup summary\n- Unique continuation.\n## Next\nDo next.\n")
        (self.root / "index.md").write_text("# Catalog\n")
        (self.root / "wiki").mkdir()
        (self.root / "raw").mkdir()

    def test_notice_lifecycle(self):
        for source in ["startup", "resume", "clear", "compact"]:
            result = hook.build_response(self.root, {"source": source})
            self.assertIn("Unique continuation.", result["hookSpecificOutput"]["additionalContext"])
            self.assertEqual("systemMessage" in result, source != "compact")

    def test_summary_section_boundary(self):
        result = hook.build_response(self.root, {})
        self.assertNotIn("Do next.", result["systemMessage"])
        self.assertIn("Do next.", result["hookSpecificOutput"]["additionalContext"])

    def test_missing_state(self):
        (self.root / "state.md").unlink()
        result = hook.build_response(self.root, {})
        self.assertIn("Could not read", result["systemMessage"])
        self.assertIn("do not invent", result["hookSpecificOutput"]["additionalContext"])

    def test_missing_and_empty_summaries(self):
        for body in ["# State\n", "## Startup summary\n\n## Next\nNext task\n"]:
            (self.root / "state.md").write_text(body)
            self.assertNotIn("Next task", hook.build_response(self.root, {})["systemMessage"])
            self.assertTrue(checker.check(self.root))

    def test_budget_and_unicode(self):
        (self.root / "state.md").write_text("## Startup summary\n" + "猫" * 5000)
        result = hook.build_response(self.root, {})
        self.assertIn("State truncated", result["hookSpecificOutput"]["additionalContext"])
        self.assertIn("Summary truncated", result["systemMessage"])
        self.assertLess(len(result["systemMessage"]), 1500)
        self.assertNotIn("�", result["systemMessage"])

    def test_terminal_controls(self):
        (self.root / "state.md").write_text("## Startup summary\n- Safe \x1b]52;payload\x07\n")
        notice = hook.build_response(self.root, {})["systemMessage"]
        self.assertNotIn("\x1b", notice)
        self.assertNotIn("\x07", notice)

    def test_no_writes(self):
        before = (self.root / "state.md").read_bytes()
        hook.build_response(self.root, {})
        self.assertEqual(before, (self.root / "state.md").read_bytes())
        self.assertEqual(sorted(p.name for p in self.root.iterdir()), ["index.md", "raw", "state.md", "wiki"])

    def test_broken_catalog_and_repair(self):
        (self.root / "index.md").write_text("[Decision](wiki/decision.md)\n")
        self.assertTrue(checker.check(self.root))
        (self.root / "wiki/decision.md").write_text("# Decision\n[Evidence](../raw/source.md)\n")
        self.assertTrue(checker.check(self.root))
        (self.root / "raw/source.md").write_text("# Evidence\n")
        self.assertEqual(checker.check(self.root), [])

    def test_wikilink_ambiguity_and_repair(self):
        (self.root / "wiki/a.md").write_text("[[topic|Topic]]\n")
        self.assertTrue(checker.check(self.root))
        (self.root / "wiki/topic.md").write_text("# Topic\n")
        self.assertEqual(checker.check(self.root), [])
        (self.root / "raw/topic.md").write_text("# Original\n")
        self.assertIn("ambiguous", "\n".join(checker.check(self.root)))
        (self.root / "wiki/a.md").write_text("[Original](../raw/topic.md) [[../wiki/topic#Details|Topic]]\n")
        self.assertEqual(checker.check(self.root), [])

    def test_workspace_boundary(self):
        (self.root / "wiki/a.md").write_text("[Outside](../../outside.md)\n")
        self.assertIn("leaves workspace", "\n".join(checker.check(self.root)))

    def test_cli_json_and_nested_session(self):
        command = json.loads((ROOT / ".claude/settings.json").read_text())["hooks"]["SessionStart"][0]["hooks"][0]["command"]
        for cwd in [ROOT, ROOT / "wiki/decisions"]:
            run = subprocess.run(command, shell=True, cwd=cwd, input='{"source":"startup"}', text=True, capture_output=True, check=True, timeout=10)
            self.assertIn("project scope has not been defined", json.loads(run.stdout)["systemMessage"])

    def test_front_matter_and_state_links(self):
        (self.root / "wiki/a.md").write_text("---\ntype: decision\n# never closed\n")
        self.assertIn("never closed", "\n".join(checker.check(self.root)))
        (self.root / "wiki/a.md").write_text("---\ntype: decision\n---\n# A\n")
        self.assertEqual(checker.check(self.root), [])
        (self.root / "state.md").write_text("## Startup summary\n- [gone](wiki/missing.md)\n")
        self.assertIn("missing link target", "\n".join(checker.check(self.root)))
        (self.root / "log.md").write_text("2026-10-11 [gone](wiki/none.md)\n")
        self.assertIn("log.md: missing link target", "\n".join(checker.check(self.root)))

    def test_notices_do_not_fail_the_check(self):
        (self.root / "wiki/orphan.md").write_text("# Orphan\n")
        (self.root / "state.md").write_text("Updated: soon\n## Startup summary\n" + "x" * 1500 + "\n" + "y" * 6000)
        self.assertEqual(checker.check(self.root), [])
        text = "\n".join(checker.notices(self.root))
        for expected in ["wiki/orphan.md", "first 6000", "exceeds 1400", "no YYYY-MM-DD"]:
            self.assertIn(expected, text)

    def test_guard_requires_confirmation_for_existing_originals(self):
        (self.root / "raw/source.md").write_text("original")
        def pre(path, tool="Edit"):
            return guard.decide(self.root, {"hook_event_name": "PreToolUse", "tool_name": tool, "tool_input": {"file_path": str(path)}})
        ask = pre(self.root / "raw/source.md")
        self.assertEqual(ask["hookSpecificOutput"]["permissionDecision"], "ask")
        self.assertIsNone(pre(self.root / "raw/new-source.md", "Write"))
        self.assertIsNone(pre(self.root / "wiki/a.md"))
        self.assertIsNone(pre(self.root / "../outside.md"))
        self.assertIsNone(guard.decide(self.root, {"hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": "x"}}))

    def test_guard_reports_broken_state_and_links_after_edit(self):
        def post(path):
            return guard.decide(self.root, {"hook_event_name": "PostToolUse", "tool_name": "Write", "tool_input": {"file_path": str(path)}})
        (self.root / "state.md").write_text("Updated: 2026-10-11\n## Startup summary\n- ok\n")
        self.assertIsNone(post(self.root / "state.md"))
        (self.root / "state.md").write_text("# State\n")
        out = post(self.root / "state.md")
        self.assertIn("Startup summary", out["hookSpecificOutput"]["additionalContext"])
        (self.root / "wiki/a.md").write_text("[x](missing.md)\n")
        self.assertIn("missing.md", post(self.root / "wiki/a.md")["hookSpecificOutput"]["additionalContext"])

    def test_guard_cli_is_silent_and_nonblocking(self):
        run = subprocess.run([sys.executable, str(ROOT / "scripts/guard_memory.py")], input="not json", text=True, capture_output=True, timeout=10)
        self.assertEqual((run.returncode, run.stdout), (0, ""))
        commands = json.loads((ROOT / ".claude/settings.json").read_text())["hooks"]
        for event in ["PreToolUse", "PostToolUse"]:
            command = commands[event][0]["hooks"][0]["command"]
            run = subprocess.run(command, shell=True, cwd=ROOT / "wiki", input="{}", text=True, capture_output=True, timeout=10)
            self.assertEqual(run.returncode, 0)

    def test_template_consistency(self):
        self.assertEqual(checker.check(ROOT), [])


if __name__ == "__main__":
    unittest.main()
