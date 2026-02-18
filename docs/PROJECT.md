# Roadrunner (Relay) — Project Overview

## What It Is

Roadrunner is an AI-powered email classification and partner engagement management system built for AWS Partner Development Managers (PDMs). It turns scattered partner email threads into structured, trackable engagement records.

**The core workflow:** Forward a partner email to a relay address → Claude AI reads it, classifies it, extracts participants, links it to known programs/events/relationships → everything surfaces on a dashboard where you manage your partner engagements.

Forwarding an email is the only input required. Everything else is automated or assisted.

## Who It's For

Steven Romero, PDM at AWS, managing ~20 ISV partner relationships across programs like ISV Accelerate, ACE, Security Competency, and Service Ready. The system is single-user but architected for potential team adoption.

## The Problem It Solves

PDMs manage dozens of ISV partnerships across multiple AWS programs, events, and internal relationships. All of that context lives scattered across email threads, spreadsheets, and Airtable bases. There's no way to see "everything happening with Partner X" without manually searching through email. Roadrunner eliminates that manual triage by making email forwarding the capture mechanism and AI classification the organization layer.

## Key Terminology

- **Engagement** — A trackable workstream with a partner. Examples: "Salt Security ISV Accelerate Onboarding", "Cloudaware re:Invent 2026 Planning". Has a living summary (current_state) that evolves as new emails arrive.
- **Meeting** — A calendar event extracted from ICS attachments or email context. Linked to a partner and optionally to an engagement, event, or program.
- **Partner** — An ISV in the portfolio. Catalog data owned by Airtable.
- **Program** — An AWS partner program (ISV Accelerate, Security Competency, etc.). Catalog data owned by Airtable.
- **Event** — A shared calendar anchor like re:Invent, a summit, or a workshop. NOT a partner-specific call or meeting. Catalog data owned by Airtable.
- **AWS Relationship** — A named relationship with an AWS person or team. Catalog data owned by Airtable.
- **Approval Queue** — Low-confidence classifications land here for human review via the Inbox UI.
- **Constrained Intelligence** — The core architectural principle: Claude matches emails to existing entities rather than fabricating new ones. Define the shape, then let AI fill it.

## Core Principles

1. **Email-in, insight-out.** The user never leaves Outlook to feed the system.
2. **AI proposes, user disposes.** Auto-classify when confident; ask when not.
3. **Summaries are the product.** Raw emails are stored but never the primary view.
4. **Editable everything.** User can rename engagements, reassign messages, correct participants, close items, override any AI decision.
5. **Connect, don't create.** The AI is biased toward linking new information to existing entities rather than spawning new ones.
6. **AI creates engagements only.** Programs, events, partners, and relationships are human-curated reference data.
7. **Empty fields are better than fabricated fields.** If Claude isn't sure, leave it blank.
8. **One persistence path, not two.** Auto-assign and approval-resolve share the same persistClassificationResult() function.
9. **Tags are the escape valve.** Anything that doesn't fit the entity model goes in tags — campaigns, strategic labels, workflow states.
10. **Ground truth sources only.** Claude matches by ID against real catalog data, never by fuzzy inference.

## Two-System Architecture

Roadrunner operates in a two-tier architecture with Airtable:

- **Airtable** is the strategic hub — portfolio management, partner plans, program enrollment, financial metrics, stakeholder tracking. It owns catalog data (partners, programs, events, AWS relationships).
- **Roadrunner** is the activity hub — real-time engagement tracking, email classification, meeting extraction. It owns activity data (engagements, meetings, messages, approvals).

Data flows one direction per entity type: catalog data pulls from Airtable into Roadrunner, activity data pushes from Roadrunner into Airtable. This prevents sync conflicts.

## What Was Intentionally Removed

**AI event creation** — Claude used to create events from email content. Removed because of fabrication risk (inventing events from vague language), duplicate events from fuzzy matching, and complex approval flows for low-value entities. Events are a small, stable set (~10-15/year) better managed by a human.

**Twilio SMS notifications** — The system used to text the user when low-confidence classifications needed review. Removed because the Inbox web UI handles review adequately, and the SMS layer added dependency complexity without proportional value.

**Initiative terminology** — The original entity was called "initiative." Renamed to "engagement" to better reflect the nature of partner workstreams.