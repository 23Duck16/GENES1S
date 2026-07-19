# CourtFormAI — Profile

## One-liner
AI-powered court form assistant: upload a PDF court form, answer guided
questions in 170+ languages, receive the completed form by email — instantly.
Providers (attorneys, paralegals, notaries) subscribe for leads from users
who complete the workflow.

## Product
- Core offering: form completion for self-represented litigants + provider
  lead marketplace + county/niche ad inventory + white-label portals.
- Stage: launch-ready (CA launch plan and readiness checklist exist in repo).
- Repo: `23Duck16/courtformai.com` (canonical; older iterations archived —
  see `polsia/registry.md`).
- Stack: Next.js 15 App Router, Supabase (Auth/Postgres/RLS/Storage),
  Stripe (subscriptions + per-lead invoices), Resend, Twilio (US SMS),
  OpenAI GPT-4o + Whisper, Vercel, Sentry, n8n automation.

## Market
- ICP (demand side): self-represented litigants, esp. non-English speakers.
- ICP (supply side / who pays): attorneys, paralegals, notaries, accessory
  services buying leads and subscriptions; advertisers buying county/niche
  inventory.
- Problem intensity: court forms are mandatory, confusing, and
  language-gated; providers want warm, pre-qualified leads.

## Business model
- Provider subscriptions + per-lead invoicing (Stripe), premium ad zones,
  white-label revenue share.

## Constraints
- Legal-adjacent product: UPL (unauthorized practice of law) risk — output
  must stay "document preparation assistance," not legal advice. Court rule
  changes require form/rule ingestion discipline and audit trails.

## Current focus
- Execute the California launch per `VIRAL_DEPLOYMENT_PLAN_CA_LAUNCH.md`
  and `READY_FOR_LAUNCH_CHECKLIST.md` in the product repo.
