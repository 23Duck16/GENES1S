# POLSIA-OMEGA Autonomous Operation — Deployment Guide

How to wire up your companies so POLSIA-OMEGA runs 24/7 on their heartbeat, no schedule required.

## Architecture overview

```
GitHub events → GitHub Action (polsia-event-listener.yml)
Stripe events → Stripe webhooks → Webhook handler
Monitoring alerts → n8n poller → Webhook handler
                     ↓
                  Decision rules (decision-rules.yml)
                     ↓
              Auto-execute? → Invoke Claude session (via GitHub Actions API)
              Escalate?     → Notify founder (Slack + email)
                     ↓
              Log event + result to git
```

The **webhook handler** (`automation/webhook-handler.js`) is the central brain. It receives events, matches them to decision rules, and either executes (via Claude) or escalates (to you).

## Setup

### Step 1: GitHub Action for event listening

The file `.github/workflows/polsia-event-listener.yml` is already created.

**What it does:**
- Listens for workflow failures (CI/CD failures) in your product repos.
- Provides a manual trigger for testing.
- Parses events and invokes POLSIA-OMEGA.

**To activate:**
1. Commit the workflow file (already in your branch).
2. In your product repo (`courtformai.com`), go to **Settings → Actions → General**.
3. Enable **"Allow GitHub Actions to create and approve pull requests"** (optional, for CTO auto-fixes).

**Test it:**
```bash
# Manually trigger the workflow to test
gh workflow run polsia-event-listener.yml \
  -f event_type="git.deploy.fail" \
  -f company="courtformai"
```

### Step 2: Webhook handler service

The file `automation/webhook-handler.js` is your central decision-making service.

**Run locally (for testing):**
```bash
cd /home/user/GENES1S
npm install http express crypto yaml  # minimal deps; most are Node.js built-in
node automation/webhook-handler.js
# Listens on http://localhost:3000/webhook/{source}
```

**Deploy to production:**

#### Option A: Vercel Functions (recommended, free tier)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel deploy --prod

# Get your endpoint:
# https://your-project.vercel.app/webhook/github
# https://your-project.vercel.app/webhook/stripe
```

#### Option B: Railway (simple, $5/month)
```bash
# Create a new project at railway.app
# Connect your GENES1S repo
# Set start command: node automation/webhook-handler.js
# Deploy
```

#### Option C: AWS Lambda (advanced)
Wrap the handler in a Lambda-compatible function:
```javascript
// automation/lambda-handler.js
const server = require('./webhook-handler');
module.exports.handler = require('serverless-http')(server);
```

Deploy with Serverless Framework.

### Step 3: Configure event sources

#### GitHub webhooks

In each product repo (e.g., `courtformai.com`):

1. Go to **Settings → Webhooks → Add webhook**.
2. **Payload URL:** `https://your-webhook-handler/webhook/github`
3. **Content type:** `application/json`
4. **Secret:** Set to the same value as `WEBHOOK_SECRET` env var (see step 4).
5. **Events to trigger on:**
   - Workflow runs (CI/CD failures)
   - Push (for security alert parsing)
   - Issues (for product feedback)
   - Pull requests (optional)
6. **Active:** Yes

Test:
```bash
# Trigger a workflow failure in your product repo
# Watch the webhook handler logs for the event
```

#### Stripe webhooks

In Stripe Dashboard → Developers → Webhooks:

1. **Add endpoint:** `https://your-webhook-handler/webhook/stripe`
2. **Secret:** Generate and store as env var.
3. **Events to listen on:**
   - `customer.subscription.deleted` (churn)
   - `charge.succeeded` (new revenue)
   - `invoice.payment_failed` (payment failure)
4. **Save**

Test:
```bash
# Use Stripe's webhook tester in the dashboard
# Or trigger manually via Stripe CLI:
stripe listen --forward-to localhost:3000/webhook/stripe
```

#### Monitoring alerts (Sentry, Vercel, Supabase)

**Sentry:**
- Go to **Alerts → Integrations → Webhooks**.
- Add: `https://your-webhook-handler/webhook/alerts`
- Payload format: JSON (Sentry will POST `{"alert_type": "error", ...}`)

**Vercel:**
- Go to **Project Settings → Integrations → Create Custom Integration**.
- Webhook URL: `https://your-webhook-handler/webhook/alerts`
- Events: deployments, function errors.

**Supabase:**
- Set up n8n to poll `https://supabase.com/rest/v1/realtime_logs` every 5 min.
- If anomaly detected (error rate spike), POST to webhook handler.

#### n8n orchestrator (optional, for custom logic)

If you have n8n running (which you do for CourtFormAI automation):

1. Create a new workflow.
2. **Trigger:** Webhook or Cron (every 5 min).
3. **Action:** Query your metrics, check thresholds.
4. **Send:** Webhook request to `https://your-webhook-handler/webhook/n8n`.

Example n8n workflow:
```json
{
  "nodes": [
    {
      "name": "Trigger every 5 min",
      "type": "cronTrigger",
      "parameters": { "cronExpression": "*/5 * * * *" }
    },
    {
      "name": "Query Stripe MRR",
      "type": "httpRequest",
      "parameters": {
        "url": "https://api.stripe.com/v1/invoices?status=paid",
        "headers": { "Authorization": "Bearer {{$env.STRIPE_API_KEY}}" }
      }
    },
    {
      "name": "Check if MRR breached",
      "type": "ifStatement",
      "parameters": {
        "condition": "{{$node.Stripe.data.total}} < {{$env.MRR_TARGET}}"
      }
    },
    {
      "name": "POST to POLSIA webhook",
      "type": "httpRequest",
      "parameters": {
        "method": "POST",
        "url": "https://your-webhook-handler/webhook/n8n",
        "body": {
          "event_type": "metric.breach",
          "company": "courtformai",
          "data": { "metric": "mrr", "current": "{{...}}" }
        }
      }
    }
  ]
}
```

### Step 4: Environment variables

Set these on your webhook handler service:

```bash
# .env or Vercel/Railway/Lambda environment
WEBHOOK_SECRET=your-github-webhook-secret-32-char-min
CLAUDE_API_KEY=sk-ant-...  # Your Claude API key
GITHUB_TOKEN=ghp_...       # GitHub personal access token (for invoking workflows)
SLACK_WEBHOOK=https://hooks.slack.com/services/...
DECISION_RULES_URL=https://raw.githubusercontent.com/23Duck16/GENES1S/main/polsia/decision-rules.yml
```

### Step 5: Wire up Claude invocation

When a decision rule says `auto_execute: true`, the webhook handler invokes Claude.

**Current implementation:** Simulated (logs the goal, doesn't actually call Claude).

**To activate real Claude calls:**

1. In `automation/webhook-handler.js`, replace the `invokeClaude` function:

```javascript
async function invokeClaude(event, rule) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: CONFIG.claudeApiKey });

  const goal = rule.goal_template
    .replace(/{company}/g, event.company)
    // ... substitutions ...

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    system: `You are POLSIA-OMEGA, an autonomous company operator.
      Company: ${event.company}
      Event: ${event.event_type}
      Read the company workspace at companies/${event.company}/.
      Make a decision and commit it.`,
    messages: [{ role: "user", content: goal }],
  });

  const decision = response.content[0].text;

  // Commit decision to git
  await commitDecisionToGit(event.company, decision, event);

  return { status: "executed", agent: rule.agent, decision };
}
```

2. Implement `commitDecisionToGit`:

```javascript
async function commitDecisionToGit(company, decision, event) {
  // Clone the GENES1S repo
  // Parse the decision
  // Append to companies/{company}/02-decisions.md
  // Commit: "Decision auto-logged: {event_type}"
  // Push
}
```

Or use GitHub's API to create a commit directly:

```javascript
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: CONFIG.githubToken });

await octokit.repos.createOrUpdateFileContents({
  owner: "23Duck16",
  repo: "GENES1S",
  path: `companies/${company}/02-decisions.md`,
  message: `Auto-decision: ${event.event_type}`,
  content: Buffer.from(decisionText).toString("base64"),
  // ... sha, branch, etc. ...
});
```

### Step 6: Slack/email notifications

Webhook handler sends Slack messages on events.

**To set up Slack integration:**

1. Create an incoming webhook in your Slack workspace:
   - Go to **Your workspace → API → Create New App**.
   - Enable **Incoming Webhooks**.
   - Generate a new webhook URL.
   - Copy to `SLACK_WEBHOOK` env var.

2. Test:
   ```bash
   curl -X POST $SLACK_WEBHOOK -H 'Content-Type: application/json' \
     -d '{"text": "POLSIA-OMEGA is ready!"}'
   ```

**Email:** Forward Slack messages via zapier or use a simple email service (Resend, SendGrid).

## Monitoring & validation

Once live, check these daily:

### Event log
```bash
# On your webhook handler service
tail -f event-log.json

# Or in git (if you commit events):
git log --grep="Event logged" --oneline
```

### Decision log
```bash
# In GENES1S
cat companies/courtformai/02-decisions.md | tail -20
```

### Webhook handler health
```bash
curl https://your-webhook-handler/health
# Response: {"status": "ok", "events_processed": 42}
```

### Failure modes

| Scenario | What happens |
|---|---|
| Webhook handler down | Events queue in source system (GitHub retries, Stripe retries). Handler comes back, reprocesses. |
| Claude API fails | Handler logs error, escalates to founder. Does NOT retry automatically. |
| Git commit fails | Handler logs error, escalates to founder with the decision. |
| Duplicate event | Handler deduplicates within 5-min window. No double-execution. |

## Testing

### Test 1: GitHub deployment failure
```bash
# In your product repo, cause a test failure
echo "failing_line" >> src/index.ts
git push
# Watch: GitHub Action runs → fails → webhook fires → POLSIA invoked
```

### Test 2: Stripe churn
```bash
# Use Stripe's webhook tester
# Simulate: customer.subscription.deleted
# Watch: Webhook handler receives → matches to sales.churn rule → CMO agent invoked
```

### Test 3: Manual event
```bash
# Via GitHub Actions UI or CLI
gh workflow run polsia-event-listener.yml -f event_type=git.deploy.fail -f company=courtformai
```

## Cost & resource estimate

| Component | Cost | Notes |
|---|---|---|
| Vercel Functions | Free | Up to 3 concurrent invocations |
| n8n (self-hosted) | Free | On your infrastructure |
| Stripe webhooks | Included | No extra cost |
| GitHub Actions | Free | 2000 min/month included |
| Claude API | Usage-based | ~$1–5/event (depending on complexity) |
| Slack | Free | With incoming webhooks |
| **Total** | **~$5–50/month** | Depends on event volume |

If you use Railway instead of Vercel: add $5/month.

## Next steps

1. **Deploy webhook handler** to Vercel (Step 2, Option A).
2. **Wire up GitHub webhooks** on your product repos (Step 3).
3. **Set environment variables** (Step 4).
4. **Test one event** (Testing, Test 1).
5. **Enable real Claude calls** (Step 5).
6. **Monitor** for a week (Monitoring & validation).
7. **Iterate on decision rules** based on real events.

That's it. After that, POLSIA-OMEGA runs continuously, responding to changes in your companies without any schedule or manual intervention.
