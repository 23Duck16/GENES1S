# POLSIA-OMEGA Autonomous Operation

How the system works when you're not in the room. Event-driven, not schedule-driven.

## Core principle

Instead of recurring tasks, listen for **changes** in your companies and invoke the right agent when action is needed. No schedule; respond to reality.

## Event types

Every event carries: `timestamp`, `company`, `type`, `severity`, `data`.

| Event type | Source | Severity | Who handles | Action |
|---|---|---|---|---|
| `ops.alert.p1` | Sentry/Vercel/Supabase | P1 (critical) | Ops agent | Assess, mitigate, or escalate |
| `ops.alert.p2` | Monitoring | P2 (warning) | Ops agent | Log, add to runbook |
| `metric.breach` | Metrics engine | High/Medium | CFO agent | Analyze, recommend adjustment |
| `git.deploy.fail` | GitHub CI/CD | High | CTO agent | Diagnose, suggest rollback/fix |
| `git.security.alert` | GitHub Advanced Security | High | Ops agent | Triage, remediate |
| `sales.churn` | Stripe webhooks | High | CMO agent | Analyze churn reason, design win-back |
| `sales.new_revenue` | Stripe webhooks | Info | CFO agent | Log, update forecast |
| `support.spike` | Support queue (n8n poller) | Medium | Support agent | Triage tickets, suggest routing |
| `product.feedback` | Issue tracker / forms | Medium | CPO agent | Analyze, add to roadmap consideration |
| `milestone.deadline` | Calendar → n8n trigger | High | CEO agent | Assess status vs. plan, adjust roadmap |
| `approval.pending` | Company workspace watcher | Medium | Relevant agent | Execute if condition met, or escalate |

## Event sources and collectors

### GitHub webhooks (push, PR, CI/CD)
```
Events: git.deploy.fail, git.security.alert, git.pr.merged, git.issue.critical
Endpoint: POST https://<your-webhook-handler>/github
Payload: standard GitHub webhook (ref, action, pull_request, etc.)
```

### Stripe webhooks (subscriptions, charges)
```
Events: sales.churn (customer.subscription.deleted), sales.new_revenue (charge.succeeded)
Endpoint: POST https://<your-webhook-handler>/stripe
Payload: Stripe event JSON (type, data.object)
```

### Monitoring alerts (Sentry, Vercel, Supabase)
```
Events: ops.alert.p1, ops.alert.p2
Method 1 (Sentry/Vercel): native webhooks → POST to webhook handler
Method 2 (Supabase): n8n poller queries logs, POST if anomaly detected
Endpoint: POST https://<your-webhook-handler>/alerts
```

### Company workspace watcher (Git auto-pull)
```
Events: approval.pending, milestone.deadline, metrics.updated
Method: GitHub Action runs every 5 min, git pulls, checks if any .md files changed
If changed: POST event to webhook handler with file delta
Endpoint: POST https://<your-webhook-handler>/workspace
```

### n8n orchestrator (custom business logic)
```
Event types: custom triggers (Stripe balance, form submission counts, lead quality score)
Listener: n8n workflows, scheduled and event-driven
On trigger: POST event to webhook handler
Endpoint: POST https://<your-webhook-handler>/n8n
```

## Webhook handler logic (pseudocode)

```
on POST /webhook/{source}:
  event = parse_webhook(request)
  
  # Deduplication: don't fire if same event in last 5 min
  if cache.has(event.company + event.type + event.id):
    return 200  # ignore duplicate
  cache.set(..., 5min)
  
  # Match to decision rule
  rule = DECISION_RULES[event.type]
  
  # Log the event
  log_event(event, company_workspace)
  
  # Check if actionable
  if rule.auto_execute:
    # Decision rule says: execute immediately
    result = invoke_claude_session(
      company = event.company,
      agent = rule.agent,
      goal = rule.goal_template(event),
      context = event.data
    )
    
    # Write result to company workspace
    commit_decision(
      company = event.company,
      decision = result,
      trigger_event = event
    )
    
    # Check if needs escalation
    if result.requires_approval:
      notify_founder(result, escalation_level=result.level)
  
  else:
    # Needs founder input
    notify_founder(
      event = event,
      action = "review",
      context = rule.context_template(event)
    )
```

## Decision rules

### Example: Stripe churn (sales.churn)

```
trigger: customer.subscription.deleted
agent: CMO (Growth & Marketing Agent)
severity: High
auto_execute: True (if not high-value customer)
escalation: True (if MRR impact > $5K)

goal_template: "Analyze why customer $CUSTOMER left. 
  Check: last login, support tickets, feature usage.
  Design a win-back campaign if applicable."

context_for_agent:
  customer_id: event.data.customer_id
  mrr_impact: event.data.annual_value / 12
  churn_cohort: cohort(customer.signup_date)

escalation_rule:
  if mrr_impact > 5000:
    notify: founder (Slack + email)
    context: "High-value customer churn — requires founder review"
```

### Example: Deployment failure (git.deploy.fail)

```
trigger: GitHub CI job on main branch fails
agent: CTO (Engineering Agent)
severity: High
auto_execute: True

goal_template: "Deployment to production failed.
  Check: test logs, error message, last commit.
  Diagnose root cause. If rollback is safe, recommend it.
  If fixable in 30 min, create a PR."

context_for_agent:
  workflow_run_id: event.data.workflow_run_id
  branch: event.data.ref
  commit_sha: event.data.head_commit.id
  error_log: fetch from GitHub (limit 2000 chars)

escalation_rule:
  always notify founder if:
    - error affects customer-facing code
    - requires database migration
    - requires manual rollback
```

### Example: Metrics breach (metric.breach)

```
trigger: KPI drops > 20% from baseline, or misses target by > 10%
agent: CFO (Finance & Analytics Agent)
severity: Medium
auto_execute: False (requires founder judgment)

goal_template: "Metric BREACH_NAME has crossed threshold.
  Current: VALUE, Target: TARGET.
  Analyze: what changed? What's the root cause?
  Recommend: what levers can we pull?"

context_for_agent:
  metric_name: event.data.metric
  current_value: event.data.current
  target_value: event.data.target
  historical_data: last 30 days of metric
  related_events: what else changed around this time?

escalation_rule:
  notify: founder immediately
  context: "Metric breach — awaiting founder approval to act"
```

## Session invocation

When webhook handler decides to auto_execute:

```bash
# Option 1: GitHub Actions API (free, no infrastructure)
curl -X POST https://api.github.com/repos/23Duck16/GENES1S/actions/workflows/run-goal.yml/dispatches \
  -H "Authorization: token $GITHUB_TOKEN" \
  -d '{
    "ref": "main",
    "inputs": {
      "company": "courtformai",
      "agent": "cmo-growth",
      "goal": "Analyze churn of customer ABC...",
      "event_id": "evt_xyz123"
    }
  }'

# Option 2: Claude SDK (if running a backend service)
import anthropic
client = anthropic.Anthropic()
response = client.messages.create(
  model="claude-opus-4-8",
  max_tokens=4096,
  system="You are POLSIA-OMEGA operating autonomously...",
  messages=[{"role": "user", "content": goal}]
)
```

## Execution guarantee

1. Event arrives → webhook handler deduplicates and logs.
2. Decision rule matches → auto_execute or escalate.
3. If auto_execute → invoke Claude session with goal + context.
4. Session runs (5-10 min typical).
5. Result written to company workspace (commit to git).
6. Founder is notified of what executed (Slack/email digest, once daily or immediately if P1).

## Failure modes and recovery

| Scenario | Response |
|---|---|
| Webhook handler is down | Events queue in source system (GitHub Actions, Stripe retries). Handler comes back up, reprocesses. |
| Claude session times out | Handler retries once after 60 sec. If still fails, escalates to founder with partial result. |
| Git commit fails (merge conflict) | Handler logs error, escalates to founder with the decision that couldn't be written. |
| Founder approval is required but no response after 24 hours | System repeats escalation. Does NOT auto-retry the decision. |

## Monitoring the system

Check these daily (or set up alerts):

1. **Event log** → `companies/<name>/events.log` (append-only JSON)
2. **Decision log** → `companies/<name>/02-decisions.md` (auto-updated)
3. **Escalations** → `polsia/escalations-pending.md` (awaiting founder action)
4. **System health** → webhook handler uptime, recent session invocations

## To activate

1. Set up webhook handler (GitHub Action, n8n, or backend service).
2. Configure event sources to POST to handler.
3. Copy DECISION_RULES to `polsia/decision-rules.yml`.
4. Deploy.
5. Run a test event (e.g., manually trigger a GitHub workflow, watch it invoke POLSIA-OMEGA).

Once live, POLSIA-OMEGA runs 24/7 on your companies' heartbeat, no schedule required.
