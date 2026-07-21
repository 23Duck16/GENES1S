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
| `polsia/AUTONOMOUS-OPERATION.md` | Event-driven autonomous operation: no schedule needed, responds to changes 24/7 |
| `polsia/decision-rules.yml` | Rule engine: maps event types to agents and auto-execution vs. escalation |
| `polsia/registry.md` | Companies and repos under management |
| `polsia/REPO-SURVEY.md` | 2026-07-19 survey of all 23Duck16 repos and platform verdict |
| `.claude/agents/` | The agent federation (CEO, CPO, CTO, CMO, sales, support, CFO, legal, talent, ops) |
| `.github/workflows/polsia-event-listener.yml` | GitHub Action: listens for CI/CD failures, security alerts, manual triggers |
| `automation/webhook-handler.js` | Central decision engine: receives events, matches rules, invokes Claude |
| `automation/DEPLOYMENT-GUIDE.md` | Step-by-step setup for autonomous operation (Vercel, Stripe, GitHub webhooks, n8n, Slack) |
| `companies/_template/` | Workspace template for a company under management |
| `companies/courtformai/` | CourtFormAI — flagship company workspace |

## Related repos

- `23Duck16/DRAUPNIR` — supervised multi-agent engine (operator platform,
  best-fit codebase for the concept).
- `23Duck16/courtformai.com` — flagship product.
- See `polsia/registry.md` for the full map.
