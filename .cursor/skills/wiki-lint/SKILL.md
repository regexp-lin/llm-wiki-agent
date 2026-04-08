---
name: wiki-lint
description: >-
  Health-check the wiki for structural and semantic issues. Finds orphan pages,
  broken links, contradictions, and data gaps. Use when the user says "lint",
  "检查", "health check", or asks about wiki consistency and quality.
---

# Wiki Lint

Check the wiki for structural and semantic issues.

## Triggers
- `lint` / `lint the wiki`
- "检查 wiki" / "health check"

## Checks Performed

| Check | Description | API Required |
|-------|-------------|-------------|
| Orphan pages | No inbound [[links]] | No |
| Broken links | [[PageName]] target doesn't exist | No |
| Missing entities | Referenced 3+ times, no own page | No |
| Contradictions | Conflicting claims across pages | Yes |
| Stale content | Newer sources invalidate old pages | Yes |
| Data gaps | Questions the wiki can't answer | Yes |

## Steps

1. Collect all wiki pages (exclude index/log/lint-report)
2. Build name→path mapping for O(1) lookup
3. Structural checks (zero API calls): orphans, broken links, missing entities
4. Semantic checks (Claude API): contradictions, stale content, data gaps
5. Assemble complete report
6. Ask user if they want it saved to `wiki/lint-report.md`
7. Append `wiki/log.md`

## Agent Mode

When operating as an Agent (non-CLI), use Grep and Read tools to:
- Find all `[[wikilinks]]` across wiki pages
- Build a name→path mapping of all existing pages
- Check each link target exists
- Identify pages with no inbound links
- Count entity references to find missing entity pages
- Flag contradictions found during reading

For detailed execution flow, read `.cursor/skills/wiki-lint/workflow-detail.md`.
