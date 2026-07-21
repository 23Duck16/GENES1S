# POLSIA-OMEGA Operating System

The loop every goal runs through. Sessions are ephemeral; this loop plus the
company workspaces under `companies/` are what make POLSIA-OMEGA continuous.

## 1. Goal intake

- Restate the founder's goal in one or two sentences.
- Classify: which company (see `polsia/registry.md`), which horizon
  (this-session / this-quarter / multi-quarter), which domains it touches.
- If the company has no workspace yet, create `companies/<name>/` from
  `companies/_template/` before anything else.

## 2. Strategic framing

- Why this goal matters now; what success looks like, stated as a measurable
  outcome.
- Ruthless prioritization: impact × effort × risk. Kill or defer weak
  workstreams explicitly — say what is NOT being done.

## 3. Decomposition

- Break into workstreams by domain (product, engineering, growth, sales,
  support, finance, legal, talent, ops).
- Order by dependency. Mark what can run in parallel.
- Deep single-domain work goes to the matching subagent in `.claude/agents/`;
  cross-domain synthesis stays with the orchestrating session.

## 4. Execution

Per workstream, produce the real artifact — not a recommendation:

| Domain | Artifact |
|---|---|
| Product | Spec, flow, schema, UX copy, edge cases |
| Engineering | Files written, APIs, data models, migrations, tests |
| Growth | Campaign with channel, audience, message, cadence |
| Sales | Pipeline stages, playbook, outbound scripts |
| Support | Macros, FAQ drafts, escalation paths |
| Finance | Metric definitions, dashboard spec, pricing logic |
| Legal | Policy drafts, compliance checklist, audit trail design |
| Talent | Role definition, JD, interview loop |
| Ops | Monitoring plan, SLOs, incident runbook |

Everything lands in the company workspace or the product codebase — committed.

## 5. Validation

- Engineering: run the tests/build; paste real output. Never claim green
  without running.
- Non-engineering: state exactly how the founder verifies (what to open,
  what to look for) and which metric will confirm success later.

## 6. Iteration

- Log decisions in `companies/<name>/02-decisions.md` (date, decision,
  rationale, revisit-when).
- Update the roadmap in `companies/<name>/01-roadmap.md` with what shipped
  and what's next.
- End every turn with committed work and a short list of the next three
  highest-leverage moves.

## Recurring work

POLSIA-OMEGA runs only during sessions. Anything that must happen on a
schedule (weekly metrics review, campaign checks) needs an explicit Routine —
propose one when a goal implies recurrence, and record it in the company's
workspace so future sessions know it exists.
