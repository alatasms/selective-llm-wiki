"""Guard the shipped reader profiles against accidental privilege expansion."""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent.parent


def profile(path):
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("Missing frontmatter")
    header = text.split("---", 2)[1]
    # Shipped definitions deliberately use flat scalar YAML only.
    result = {}
    for line in header.strip().splitlines():
        key, value = line.split(":", 1)
        if key in result:
            raise ValueError("Duplicate field")
        result[key] = value.strip()
    return result


def boundary_issues(config):
    issues = []
    if set(x.strip() for x in config.get("tools", "").split(",")) != {"Read", "Grep", "Glob"}:
        issues.append("Read-only tools must be explicit")
    if "memory" in config:
        issues.append("Persistent memory enables writes")
    if config.get("model") != "inherit":
        issues.append("Respect parent model choice")
    if config.get("omitClaudeMd") != "true":
        issues.append("Explicit instruction handoff expected")
    if not config.get("maxTurns", "").isdigit() or not 1 <= int(config["maxTurns"]) <= 20:
        issues.append("Bounded worker turns required")
    for field in ["skills", "hooks", "mcpServers", "initialPrompt", "isolation", "background"]:
        if field in config:
            issues.append(f"Unexpected worker startup capability: {field}")
    return issues


class AgentBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.profiles = [profile(ROOT / ".claude/agents" / f"{name}.md") for name in ["wiki-reader", "wiki-auditor"]]

    def test_shipped_boundaries(self):
        for config in self.profiles:
            with self.subTest(agent=config["name"]):
                self.assertEqual(boundary_issues(config), [])
                self.assertTrue(config.get("description"))

    def test_missing_allowlist_and_write_expansion_are_caught(self):
        for tools in [None, "Read, Grep, Glob, Write", "Read, Grep, Glob, Bash", "Read, Grep, Glob, Agent", "Read, Grep, Glob, Skill"]:
            bad = dict(self.profiles[0])
            if tools is None:
                bad.pop("tools")
            else:
                bad["tools"] = tools
            self.assertIn("Read-only tools must be explicit", boundary_issues(bad))

    def test_memory_escalation_is_caught(self):
        for scope in ["user", "project", "local"]:
            bad = dict(self.profiles[0], memory=scope)
            self.assertIn("Persistent memory enables writes", boundary_issues(bad))

    def test_preloaded_skills_and_nested_hooks_are_caught(self):
        for field in ["skills", "hooks", "mcpServers", "background"]:
            bad = dict(self.profiles[0]);bad[field] = "unsafe"
            self.assertTrue(boundary_issues(bad))

    def test_parent_model_and_turn_budget_are_preserved(self):
        for field, value in [("model", "sonnet"), ("maxTurns", "0"), ("maxTurns", "999")]:
            bad = dict(self.profiles[0]);bad[field] = value
            self.assertTrue(boundary_issues(bad))


if __name__ == "__main__":
    unittest.main()
