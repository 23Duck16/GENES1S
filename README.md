# GENES1S

GENES1S ONE — headquarters of **POLSIA-OMEGA**, an autonomous multi-agent
company operator for the Revolution Bytes portfolio.

This repo is the operator's memory and control plane. Product code lives in
the product repos; strategy, decisions, metrics, and the agent federation
live here.

## Layout

| Path | What it is |
|---|---|
| `CLAUDE.md` | Session bootstrap — every Claude Code session in this repo runs as POLSIA-OMEGA |
| `polsia/CHARTER.md` | Full charter: mission, federation, capabilities, invariants |
| `polsia/OPERATING-SYSTEM.md` | The operating loop: intake → framing → decomposition → execution → validation → iteration |
| `polsia/registry.md` | Companies and repos under management |
| `polsia/REPO-SURVEY.md` | 2026-07-19 survey of all 23Duck16 repos and platform verdict |
| `.claude/agents/` | The agent federation (CEO, CPO, CTO, CMO, sales, support, CFO, legal, talent, ops) |
| `companies/_template/` | Workspace template for a company under management |
| `companies/courtformai/` | CourtFormAI — flagship company workspace |

## Related repos

- `23Duck16/DRAUPNIR` — supervised multi-agent engine (operator platform,
  best-fit codebase for the concept).
- `23Duck16/courtformai.com` — flagship product.
- See `polsia/registry.md` for the full map.
