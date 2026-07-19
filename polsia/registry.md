# Company & Asset Registry

What POLSIA-OMEGA operates, and where the code lives. Updated 2026-07-19 from
a full survey of the 23Duck16 GitHub account (see `polsia/REPO-SURVEY.md`).

## Parent

**Revolution Bytes** — the holding identity. Ecosystem blueprint lives in
`23Duck16/Revolution-Bytes` (GACAS docs: master-deploy / prompt-refinement /
efficiency-optimizer agent designs, portfolio definition). Blueprint only —
not a working codebase.

## Operator platform (the POLSIA-OMEGA concept in code)

| Rank | Repo | Status |
|---|---|---|
| **1 — best fit** | `23Duck16/DRAUPNIR` | Working supervised multi-agent engine: ODIN supervisor/approval gate, 9 primary agents × 9 micro-agents (81), QCGR candidate ranking, safety engine, audit logging, oversight reports, capability profiles, React operator console, Express API, persistence, tests. |
| 2 — runner-up | `23Duck16/REPLIT-GENES1S` | "GENESIS Protocol" orchestration dashboard: real-time agent monitoring, workflow builder, WebSocket telemetry, OpenAI brain. Strong UI shell, no supervision/approval model. |
| 3 — HQ (this repo) | `23Duck16/GENES1S` | POLSIA-OMEGA headquarters: charter, operating loop, agent federation, company workspaces. State, not product code. |

## Companies (products under management)

| Company | Repo | Status |
|---|---|---|
| **CourtFormAI** | `23Duck16/courtformai.com` | Flagship. Production Next.js 15 + Supabase + Stripe SaaS; launch-ready (CA launch plan, monitoring, n8n automation). Actively developed. First company POLSIA-OMEGA operates. Workspace: `companies/courtformai/`. |
| TaskFlow | — (blueprint only) | Task management. Defined in Revolution-Bytes ecosystem doc; no dedicated repo found. |
| Neon Rush | — (blueprint only) | AI-driven game. Blueprint only. |
| Blind Date True Connections | — (blueprint only) | Matchmaking. Blueprint only. |

## Superseded / inactive

- CourtFormAI earlier iterations: `COURT-FORMSAI`, `courtforms-ai`,
  `courtformsai`, `courtforms`, `Court-Forms.AI`, `lexai-frontend` (Lexia
  branding) — all predate `courtformai.com`; treat as archive.
- Empty stubs: `genesis-orchestrator`, `agentforce`, `GENESIS`, `GENES1SGO`,
  `GENES1SONE`, `GENES1S2`.
- Templates/scaffolds: `genes1s_vercecl`, `vite-react`, `nextjs-toolbox`,
  `nextjs-ai-chatbot`, `chatbot`, `coded`, `INDEX.HTML`.
- Fork: `adk-python` (Google Agent Development Kit — reference material).

## Standing security note

`Revolution-Bytes` contains `stripe_backup_code.txt` — a credential committed
to git. Rotate the Stripe backup codes and purge the file from history.
Flagged 2026-07-19; keep this note until confirmed done.
