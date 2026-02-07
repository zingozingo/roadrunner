# Architecture Decision Log

## 2025-02-06: Project scaffold

Next.js 14 App Router + TypeScript + Tailwind. Supabase Postgres for data. Single-user app with service key auth (no RLS). Three core entities: Initiatives, Events, Programs linked via generic entity_links table. Intelligence lives in prompt, not code.

## 2026-02-07: Inbound Webhook Form Data Extraction with Fallback

**Decision:** Rewrote /api/inbound to try request.formData() first, fall back to URL-encoded text parsing. Signature fields are optional — log and warn if missing, never 406.

**Context:** Every Mailgun webhook returned 406 because the code checked for missing timestamp/token/signature fields BEFORE the signature bypass logic. formData() was also silently failing on some Vercel runtimes.

**Rationale:** Defense in depth. Mailgun's payload format can vary. Making signature fields optional during development lets us debug the rest of the pipeline independently.

**Impact:** Inbound pipeline works. Signature verification must be re-enabled with correct approach before production use.

## 2026-02-07: Events Restricted to Shared Calendar Anchors

**Decision:** Events table is ONLY for conferences, program deadlines, and shared milestones that exist independently of any initiative. Meetings, calls, and initiative-specific activities belong in the initiative summary timeline only.

**Context:** Claude created "CloudAware Cadence Call" as an Event entity from casual email language about setting up a recurring call. This pollutes the Events table with initiative-level activities.

**Rationale:** Events should be things that would matter even if you deleted every initiative. A cadence call between two people is not that. The test: "Would this appear on a public/team calendar regardless of partner work?"

**Impact:** Classification prompt Rule 8 needs tightening. Events page should stay lean (10-20 entries max). Existing incorrect events should be cleaned up.

## 2026-02-07: Meeting Invitations Identified by ICS Attachment Only

**Decision:** Meetings are only recognized when a forwarded email contains an .ics calendar attachment. Casual language like "let's set up a call" does NOT create a meeting — it becomes an open item in the initiative summary.

**Context:** The system was treating email prose about potential calls as confirmed meetings, which is inaccurate.

**Rationale:** An .ics file has structured data (title, time, attendees, location). This is ground truth. Email prose is aspirational. The distinction keeps timelines honest.

**Impact:** Email parser needs .ics detection. Classifier needs content_type: meeting_invitation. Summary timeline distinguishes [Email] entries from [Meeting] entries.

## 2026-02-07: Initiative Names Are for Humans, Summaries Are for Claude

**Decision:** Users can freely rename initiatives. Claude matches incoming emails using the full initiative summary, participant list, and metadata — not just the name string.

**Context:** User asked whether renaming an initiative would break future email matching.

**Rationale:** The summary contains the rich context (partner names, topics, history) that Claude uses for matching. The name is a UI convenience.

**Impact:** Safe to add initiative name editing. No matching logic changes needed.

## 2026-02-07: Forwarding User as Implicit Participant

**Decision:** The user's own email (the PDM forwarding emails to the relay) should be treated as a known constant, not extracted as a new participant each time.

**Context:** Steven Romero appears in the participants table without an organization, and shows up redundantly since he's the forwarding user on every single email.

**Rationale:** The PDM is always a participant by definition — they forwarded the email. Extracting them adds noise. They should be a system-level config, not a per-message discovery.

**Impact:** Need a USER_EMAIL or PDM_EMAIL env var. Classifier should exclude this email from participant extraction. Existing participant record for the user can be linked to all initiatives automatically.

## 2026-02-07: Dashboard as Primary Review Interface

**Decision:** The inbox page in the dashboard is the primary way to resolve pending reviews, not a fallback for SMS. SMS is a notification channel that supplements the dashboard.

**Context:** Twilio A2P 10DLC registration takes days. Can't block the entire project on SMS approval.

**Rationale:** Even after SMS works, the dashboard provides a richer review experience — you can see the full email, the confidence bar, create custom initiative names. SMS is for quick approvals on the go.

**Impact:** Inbox page must be robust and reliable. SMS becomes a "hey, check your inbox" notification rather than the sole resolution mechanism.

## 2026-02-07: Message Deduplication by Content Hash

**Decision:** Before storing a new message, check for existing message with same sender_email + subject + first 100 chars of body_text. Skip if duplicate.

**Context:** Mailgun retries on timeout (our classification takes >30s), and during testing the same email created multiple pending reviews.

**Rationale:** Simple content-based dedup catches retries and accidental re-forwards without requiring message-id tracking.

**Impact:** Prevents duplicate reviews. Mailgun timeout "failures" are harmless — the message was already processed.

## 2026-02-07: Git Push Deploys to Vercel

**Decision:** Use git push to trigger Vercel auto-deploys instead of npx vercel --prod CLI deploys.

**Context:** CLI deploys created a separate deployment from the Git-linked one, causing confusion about which deployment was live.

**Rationale:** Standard workflow. One deployment source of truth.

**Impact:** All future deploys via git push. CLI deploy only as fallback.
