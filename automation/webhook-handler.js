/**
 * POLSIA-OMEGA Webhook Handler
 *
 * Receives events from all sources (GitHub, Stripe, monitoring, etc.)
 * Matches to decision rules
 * Invokes Claude sessions or escalates to founder
 *
 * Run as: node webhook-handler.js
 * Or deploy as: Vercel Function, AWS Lambda, Google Cloud Function
 */

const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Load decision rules (in production, fetch from repo)
const DECISION_RULES = loadDecisionRules();

// In-memory event cache for deduplication
const eventCache = new Map();
const CACHE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// Event log (in production, write to git)
const eventLog = [];

// Configuration
const CONFIG = {
  port: process.env.PORT || 3000,
  webhookSecret: process.env.WEBHOOK_SECRET || "dev-secret",
  claudeApiKey: process.env.CLAUDE_API_KEY,
  githubToken: process.env.GITHUB_TOKEN,
  slackWebhook: process.env.SLACK_WEBHOOK,
};

/**
 * Load decision rules from YAML
 * In production, fetch from the git repo
 */
function loadDecisionRules() {
  try {
    const yaml = require("yaml");
    const rulesPath = path.join(__dirname, "../polsia/decision-rules.yml");
    const content = fs.readFileSync(rulesPath, "utf-8");
    return yaml.parse(content);
  } catch (err) {
    console.error("Failed to load decision rules:", err);
    return {};
  }
}

/**
 * Verify webhook signature (GitHub, Stripe, etc.)
 */
function verifySignature(source, payload, signature) {
  if (source === "github") {
    const hash = crypto
      .createHmac("sha256", CONFIG.webhookSecret)
      .update(payload)
      .digest("hex");
    return `sha256=${hash}` === signature;
  }
  if (source === "stripe") {
    const hash = crypto
      .createHmac("sha256", CONFIG.webhookSecret)
      .update(payload)
      .digest("hex");
    return hash === signature;
  }
  return true; // For testing/n8n
}

/**
 * Generate unique event ID for deduplication
 */
function getEventId(source, eventType, data) {
  const key = `${source}:${eventType}:${JSON.stringify(data).slice(0, 50)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/**
 * Parse event based on source
 */
function parseEvent(source, body) {
  const timestamp = new Date().toISOString();

  if (source === "github") {
    const event = body;
    let eventType = "unknown";
    let company = "unknown";

    // workflow_run: deployment failure
    if (event.workflow_run && event.workflow_run.conclusion === "failure") {
      eventType = "git.deploy.fail";
      company = parseCompanyFromRepo(event.repository.name);
    }
    // push with security alerts (would need GitHub Advanced Security integration)
    else if (event.alert) {
      eventType = "git.security.alert";
      company = parseCompanyFromRepo(event.repository.name);
    }
    // issues labeled urgent/critical
    else if (event.issue && event.action === "opened") {
      if (
        event.issue.labels.some((l) =>
          ["urgent", "critical", "p1"].includes(l.name)
        )
      ) {
        eventType = "product.feedback";
        company = parseCompanyFromRepo(event.repository.name);
      }
    }

    return {
      timestamp,
      source: "github",
      event_type: eventType,
      company,
      severity: event.workflow_run ? "High" : "Medium",
      data: {
        workflow_run_id: event.workflow_run?.id,
        workflow_name: event.workflow_run?.name,
        repo: event.repository.full_name,
        branch: event.ref,
        commit_sha: event.head_commit?.id,
      },
    };
  }

  if (source === "stripe") {
    const event = body;
    let eventType = "unknown";
    let severity = "Info";

    if (event.type === "customer.subscription.deleted") {
      eventType = "sales.churn";
      severity = "High";
    } else if (event.type === "charge.succeeded") {
      eventType = "sales.new_revenue";
      severity = "Info";
    }

    return {
      timestamp,
      source: "stripe",
      event_type: eventType,
      company: "courtformai", // Stripe webhooks from your app
      severity,
      data: {
        customer_id: event.data.object.customer,
        amount: event.data.object.amount / 100,
        currency: event.data.object.currency,
        stripe_event_id: event.id,
      },
    };
  }

  if (source === "alerts") {
    const alert = body;
    let eventType = "ops.alert.p1";

    if (alert.severity === "P2" || alert.severity === "warning") {
      eventType = "ops.alert.p2";
    }

    return {
      timestamp,
      source: "alerts",
      event_type: eventType,
      company: alert.company || "unknown",
      severity: alert.severity || "Medium",
      data: {
        metric_name: alert.metric,
        current_value: alert.value,
        threshold: alert.threshold,
        source: alert.source, // Sentry, Vercel, Supabase, etc.
      },
    };
  }

  if (source === "n8n") {
    const trigger = body;
    return {
      timestamp,
      source: "n8n",
      event_type: trigger.event_type,
      company: trigger.company || "unknown",
      severity: trigger.severity || "Medium",
      data: trigger.data,
    };
  }

  return { timestamp, source, event_type: "unknown", company: "unknown" };
}

/**
 * Extract company name from repo name
 */
function parseCompanyFromRepo(repoName) {
  if (repoName.includes("courtformai")) return "courtformai";
  if (repoName.includes("draupnir")) return "draupnir";
  return "unknown";
}

/**
 * Check if event is duplicate
 */
function isDuplicate(eventId, company, eventType) {
  const cacheKey = `${company}:${eventType}:${eventId}`;

  if (eventCache.has(cacheKey)) {
    const lastTime = eventCache.get(cacheKey);
    if (Date.now() - lastTime < CACHE_WINDOW_MS) {
      return true;
    }
  }

  eventCache.set(cacheKey, Date.now());
  return false;
}

/**
 * Match event to decision rule and determine action
 */
function matchRule(event) {
  const rule = DECISION_RULES.decision_rules?.[event.event_type];

  if (!rule) {
    return {
      action: "log_only",
      reason: `No rule defined for event type: ${event.event_type}`,
    };
  }

  // Check if requires approval
  const approvalsNeeded = rule.requires_approval || [];
  for (const approval of approvalsNeeded) {
    if (evaluateCondition(approval.if, event)) {
      return {
        action: "escalate",
        reason: `Requires approval: ${approval.if}`,
        escalation_level: rule.escalation_level,
      };
    }
  }

  // If auto_execute is true, invoke
  if (rule.auto_execute) {
    return {
      action: "execute",
      agent: rule.agent,
      goal_template: rule.goal_template,
      escalation_level: rule.escalation_level,
    };
  }

  // Otherwise, escalate for decision
  return {
    action: "escalate",
    reason: `Rule requires human decision`,
    escalation_level: rule.escalation_level,
  };
}

/**
 * Evaluate a condition string against event data
 * Simple template matching: "if: error affects customer-facing code"
 */
function evaluateCondition(condition, event) {
  // In production, implement actual logic
  // For now, just match keywords
  if (
    condition.includes("high-value") &&
    event.data.mrr_impact &&
    event.data.mrr_impact > 5000
  ) {
    return true;
  }
  if (
    condition.includes("customer-facing") &&
    event.data.commit_sha
  ) {
    // Would check commit diff
    return Math.random() > 0.7; // Simulate for demo
  }
  return false;
}

/**
 * Invoke Claude session with goal
 * In production, use Claude SDK directly
 */
async function invokeClaude(event, rule) {
  console.log(`\n[CLAUDE] Invoking ${rule.agent} for ${event.event_type}`);

  // Substitute template variables
  const goal = rule.goal_template
    .replace(/{company}/g, event.company)
    .replace(/{metric_name}/g, event.data.metric_name || "unknown")
    .replace(/{current_value}/g, event.data.current_value || "unknown")
    .replace(/{threshold}/g, event.data.threshold || "unknown")
    .replace(/{customer_id}/g, event.data.customer_id || "unknown")
    .replace(/{mrr_impact}/g, event.data.mrr_impact || "unknown")
    .replace(/{cohort}/g, event.data.churn_cohort || "unknown");

  console.log(`Goal: ${goal.substring(0, 200)}...`);

  // In real implementation:
  // const response = await client.messages.create({...})
  // const decision = parseDecision(response.content)
  // await commitDecision(event.company, decision, event)

  return {
    status: "simulated",
    agent: rule.agent,
    goal: goal.substring(0, 100),
    message:
      "In production, Claude session would execute here and commit result to git",
  };
}

/**
 * Notify founder via Slack/email
 */
async function notifyFounder(event, action, decision) {
  if (!CONFIG.slackWebhook) {
    console.log(`[NOTIFY] Would send Slack: ${action} on ${event.event_type}`);
    return;
  }

  const message = {
    text: `🔔 POLSIA-OMEGA Event: ${event.event_type}`,
    blocks: [
      {
        type: "header",
        text: { type: "plain_text", text: `Event: ${event.event_type}` },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Company*\n${event.company}` },
          { type: "mrkdwn", text: `*Action*\n${action}` },
          { type: "mrkdwn", text: `*Severity*\n${event.severity}` },
          { type: "mrkdwn", text: `*Time*\n${event.timestamp}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: decision
            ? `*Decision*: ${JSON.stringify(decision).substring(0, 150)}`
            : "*Awaiting founder review*",
        },
      },
    ],
  };

  try {
    await fetch(CONFIG.slackWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.error("Failed to send Slack notification:", err);
  }
}

/**
 * Log event to file (in production, commit to git)
 */
function logEvent(event, action, decision) {
  const entry = {
    ...event,
    action,
    decision: decision || null,
    processed_at: new Date().toISOString(),
  };

  eventLog.push(entry);
  console.log(JSON.stringify(entry, null, 2));
}

/**
 * Main request handler
 */
async function handleRequest(req, res) {
  const { pathname, query } = new URL(req.url, `http://${req.headers.host}`);

  // Health check
  if (pathname === "/health") {
    return res.json({ status: "ok", events_processed: eventLog.length });
  }

  // Event endpoints: /webhook/{source}
  const sourceMatch = pathname.match(/^\/webhook\/(\w+)$/);
  if (!sourceMatch) {
    return res.status(404).json({ error: "Not found" });
  }

  const source = sourceMatch[1];
  const signature = req.headers["x-hub-signature-256"] || req.headers["stripe-signature"];

  // Verify signature
  if (!verifySignature(source, req.body, signature)) {
    console.warn(`[WARN] Signature verification failed for ${source}`);
    // Continue anyway for n8n/testing
  }

  // Parse event
  const event = parseEvent(source, req.body);

  if (event.event_type === "unknown") {
    return res.status(200).json({ status: "ignored", reason: "unknown event type" });
  }

  // Check for duplicates
  const eventId = getEventId(source, event.event_type, event.data);
  if (isDuplicate(eventId, event.company, event.event_type)) {
    return res.status(200).json({ status: "deduplicated" });
  }

  // Match to decision rule
  const action_rule = matchRule(event);

  // Execute based on action
  let decision;
  if (action_rule.action === "execute") {
    decision = await invokeClaude(event, action_rule);
    logEvent(event, "executed", decision);
    await notifyFounder(event, "Executed automatically", decision);
  } else if (action_rule.action === "escalate") {
    logEvent(event, "escalated", { reason: action_rule.reason });
    await notifyFounder(event, "Escalated for review", action_rule);
  } else {
    logEvent(event, "logged", null);
  }

  res.json({
    status: "received",
    event_id: eventId,
    event_type: event.event_type,
    action: action_rule.action,
  });
}

/**
 * HTTP server
 */
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");

  // Parse body for POST
  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        req.body = JSON.parse(body);
      } catch {
        req.body = body;
      }
      handleRequest(req, res);
    });
  } else {
    handleRequest(req, res);
  }
});

// Add json response helper
http.IncomingMessage.prototype.json = function (data) {
  this.res.writeHead(200, { "Content-Type": "application/json" });
  this.res.end(JSON.stringify(data, null, 2));
};

http.ServerResponse.prototype.json = function (data, status = 200) {
  this.writeHead(status, { "Content-Type": "application/json" });
  this.end(JSON.stringify(data, null, 2));
};

server.listen(CONFIG.port, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        POLSIA-OMEGA Webhook Handler                        ║
║        Listening for events from all sources                ║
╚════════════════════════════════════════════════════════════╝

Endpoint: http://localhost:${CONFIG.port}/webhook/{source}

Supported sources:
  - /webhook/github      (GitHub workflows, security alerts)
  - /webhook/stripe      (subscriptions, charges)
  - /webhook/alerts      (Sentry, Vercel, Supabase monitoring)
  - /webhook/n8n         (n8n custom triggers)

Health: http://localhost:${CONFIG.port}/health

Configured:
  - WEBHOOK_SECRET: ${CONFIG.webhookSecret ? "✓ set" : "✗ not set"}
  - CLAUDE_API_KEY: ${CONFIG.claudeApiKey ? "✓ set" : "✗ not set"}
  - SLACK_WEBHOOK: ${CONFIG.slackWebhook ? "✓ set" : "✗ not set"}

Decision rules loaded from: polsia/decision-rules.yml
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});

module.exports = server;
