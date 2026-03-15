import { getSupabaseClient } from "./db/client";
import { getRecentNoteSummaries, getTasksByPartner } from "./db/meeting-notes";
import { getPartnerContext } from "./db/partner-context";
import { getContactsByPartner } from "./db/participants";
import type {
  Partner,
  Engagement,
  Meeting,
  PartnerContext,
  DisplayContext,
  Pillar,
} from "./types";

// ============================================================
// Context assembly
// ============================================================

export async function buildPartnerContext(
  partnerId: string
): Promise<PartnerContext> {
  const db = getSupabaseClient();

  // Parallel fetch: partner, engagements, meetings, notes, tasks, scratchpad
  const [
    { data: partnerData, error: partnerErr },
    { data: engData, error: engErr },
    { data: mtgData, error: mtgErr },
    noteSummaries,
    openTasks,
    scratchpadContext,
  ] = await Promise.all([
    db.from("partners").select("*").eq("id", partnerId).single(),
    db
      .from("engagements")
      .select("*")
      .eq("partner_id", partnerId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    db
      .from("meetings")
      .select("id, title, meeting_date, status")
      .eq("partner_id", partnerId)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .limit(5),
    getRecentNoteSummaries(partnerId, 5),
    getTasksByPartner(partnerId, { status: "open" }),
    getPartnerContext(partnerId),
  ]);

  if (partnerErr) throw new Error(`Failed to fetch partner: ${partnerErr.message}`);
  if (engErr) throw new Error(`Failed to fetch engagements: ${engErr.message}`);
  if (mtgErr) throw new Error(`Failed to fetch meetings: ${mtgErr.message}`);

  const partner = partnerData as Partner;
  const engagements = (engData ?? []) as Engagement[];
  const meetings = (mtgData ?? []) as { id: string; title: string; meeting_date: string | null; status: string }[];

  // Build contacts from canonical participants registry
  const registryContacts = await getContactsByPartner(partnerId);
  const contacts = buildContactsFromRegistry(registryContacts);

  // Resolve program/event names for engagements via entity_links
  const engagementIds = engagements.map((e) => e.id);
  const entityNames = await resolveEngagementEntities(db, engagementIds);

  // Fetch note_type for previous notes (getRecentNoteSummaries doesn't return it)
  // We need to re-query with note_type included
  const { data: notesWithType } = await db
    .from("meeting_notes")
    .select("title, meeting_date, ai_summary, note_type")
    .eq("partner_id", partnerId)
    .eq("status", "complete")
    .not("ai_summary", "is", null)
    .order("note_type", { ascending: false })
    .order("meeting_date", { ascending: false, nullsFirst: false })
    .limit(5);

  return {
    partner: {
      name: partner.name,
      segment: partner.segment,
      focus_area: partner.focus_area ?? [],
      what_they_do: partner.what_they_do ?? null,
      aws_stickiness: partner.aws_stickiness ?? null,
      key_aws_services: partner.key_aws_services ?? [],
      architecture: partner.architecture ?? null,
      listing_types: partner.listing_types ?? [],
      pricing_model: partner.pricing_model ?? [],
      isva_status: partner.isva_status ?? null,
      deployed_on_aws: partner.deployed_on_aws ?? null,
      prm_status: partner.prm_status ?? null,
      crm_status: partner.crm_status ?? null,
    },
    contacts,
    engagements: engagements.map((e) => ({
      id: e.id,
      name: e.name,
      pillar: e.pillar,
      status: e.status,
      topic: e.topic,
      program_name: entityNames.programs.get(e.id) ?? null,
      event_name: entityNames.events.get(e.id) ?? null,
    })),
    recentMeetings: meetings.map((m) => ({
      id: m.id,
      title: m.title,
      meeting_date: m.meeting_date,
      status: m.status,
    })),
    previousNotes: ((notesWithType ?? []) as { title: string | null; meeting_date: string | null; ai_summary: string; note_type: string }[]).map(
      (n) => ({
        title: n.title,
        meeting_date: n.meeting_date,
        ai_summary: n.ai_summary,
        note_type: n.note_type,
      })
    ),
    openTasks: openTasks.map((t) => ({
      description: t.description,
      owner: t.owner,
      owner_name: t.owner_name,
      status: t.status,
      due_date: t.due_date,
    })),
    scratchpadEntries: scratchpadContext.map((e) => ({
      content: e.content,
      source: e.source,
      created_at: e.created_at,
    })),
  };
}

// ============================================================
// Format for AI prompt
// ============================================================

export function formatContextForPrompt(context: PartnerContext): string {
  const sections: string[] = [];

  // Partner profile
  const p = context.partner;
  const profileLines = [`Partner: ${p.name}`];
  if (p.segment) profileLines.push(`Segment: ${p.segment}`);
  if (p.focus_area.length > 0) profileLines.push(`Focus Areas: ${p.focus_area.join(", ")}`);
  if (p.what_they_do) profileLines.push(`What They Do: ${p.what_they_do}`);
  if (p.aws_stickiness) profileLines.push(`AWS Stickiness: ${p.aws_stickiness}`);
  if (p.key_aws_services.length > 0) profileLines.push(`Key AWS Services: ${p.key_aws_services.join(", ")}`);
  if (p.architecture) profileLines.push(`Architecture: ${p.architecture}`);
  if (p.listing_types.length > 0) profileLines.push(`Listing Types: ${p.listing_types.join(", ")}`);
  if (p.pricing_model.length > 0) profileLines.push(`Pricing Model: ${p.pricing_model.join(", ")}`);
  if (p.isva_status) profileLines.push(`ISVa Status: ${p.isva_status}`);
  if (p.deployed_on_aws) profileLines.push(`Deployed on AWS: ${p.deployed_on_aws}`);
  if (p.prm_status) profileLines.push(`PRM Status: ${p.prm_status}`);
  if (p.crm_status) profileLines.push(`CRM Status: ${p.crm_status}`);
  sections.push(profileLines.join("\n"));

  // Contacts
  const c = context.contacts;
  const contactLines: string[] = [];
  if (c.alliance_lead) contactLines.push(`Alliance Lead: ${c.alliance_lead}`);
  if (c.account_manager) contactLines.push(`Account Manager: ${c.account_manager}`);
  if (c.psa) contactLines.push(`PSA: ${c.psa}`);
  if (c.other_contacts.length > 0) contactLines.push(`Other: ${c.other_contacts.join("; ")}`);
  if (contactLines.length > 0) sections.push("KEY CONTACTS\n" + contactLines.join("\n"));

  // Partner context (PDM scratchpad notes — most important context for AI)
  const contextEntries = context.scratchpadEntries.filter(
    (e) => e.source === "scratchpad" || e.source === "seed_dump"
  );
  if (contextEntries.length > 0) {
    const ctxLines = contextEntries.map((e) => `- ${e.content}`);
    sections.push("PARTNER CONTEXT (PDM NOTES)\n" + ctxLines.join("\n"));
  }

  // Active engagements
  if (context.engagements.length > 0) {
    const engLines = context.engagements.map((e) => {
      const parts = [`- ${e.name} [${e.status}]`];
      if (e.pillar) parts[0] += ` (${e.pillar})`;
      if (e.topic) parts.push(`  Topic: ${e.topic}`);
      if (e.program_name) parts.push(`  Program: ${e.program_name}`);
      if (e.event_name) parts.push(`  Event: ${e.event_name}`);
      return parts.join("\n");
    });
    sections.push("ACTIVE ENGAGEMENTS\n" + engLines.join("\n"));
  }

  // Recent meetings
  if (context.recentMeetings.length > 0) {
    const mtgLines = context.recentMeetings.map((m) => {
      const date = m.meeting_date ?? "no date";
      return `- ${m.title} (${date}) [${m.status}]`;
    });
    sections.push("RECENT MEETINGS\n" + mtgLines.join("\n"));
  }

  // Previous note summaries (key for continuity)
  if (context.previousNotes.length > 0) {
    const noteLines = context.previousNotes.map((n) => {
      const label = n.note_type === "seed" ? "[SEED]" : `[${n.meeting_date ?? "no date"}]`;
      const title = n.title ? ` ${n.title}` : "";
      return `${label}${title}\n${n.ai_summary}`;
    });
    sections.push("PREVIOUS NOTE SUMMARIES\n" + noteLines.join("\n\n"));
  }

  // Open tasks
  if (context.openTasks.length > 0) {
    const taskLines = context.openTasks.map((t) => {
      const owner = t.owner_name ? `${t.owner_name} (${t.owner})` : t.owner;
      const due = t.due_date ? ` due ${t.due_date}` : "";
      return `- [${owner}${due}] ${t.description}`;
    });
    sections.push("OPEN TASKS\n" + taskLines.join("\n"));
  }

  return sections.join("\n\n---\n\n");
}

// ============================================================
// Format for UI display
// ============================================================

export function formatContextForDisplay(context: PartnerContext): DisplayContext {
  return {
    profile: {
      name: context.partner.name,
      segment: context.partner.segment,
      focus_areas: context.partner.focus_area,
      what_they_do: context.partner.what_they_do,
      aws_stickiness: context.partner.aws_stickiness,
      key_aws_services: context.partner.key_aws_services,
      architecture: context.partner.architecture,
      listing_types: context.partner.listing_types,
      pricing_model: context.partner.pricing_model,
      isva_status: context.partner.isva_status,
      deployed_on_aws: context.partner.deployed_on_aws,
      prm_status: context.partner.prm_status,
      crm_status: context.partner.crm_status,
    },
    contacts: {
      alliance_lead: context.contacts.alliance_lead,
      account_manager: context.contacts.account_manager,
      psa: context.contacts.psa,
      others: context.contacts.other_contacts,
    },
    activeEngagements: context.engagements.map((e) => ({
      id: e.id,
      name: e.name,
      pillar: e.pillar,
      status: e.status,
    })),
    recentMeetings: context.recentMeetings.map((m) => ({
      id: m.id,
      title: m.title,
      date: m.meeting_date,
      status: m.status,
    })),
    openTaskCount: context.openTasks.length,
    openTasks: context.openTasks.map((t) => ({
      description: t.description,
      owner: t.owner,
      owner_name: t.owner_name,
    })),
    previousNotes: context.previousNotes.map((n) => ({
      title: n.title,
      meeting_date: n.meeting_date,
      ai_summary: n.ai_summary,
      note_type: n.note_type,
    })),
    hasSeedNote: context.previousNotes.some((n) => n.note_type === "seed"),
    scratchpadEntries: context.scratchpadEntries,
  };
}

// ============================================================
// Internal helpers
// ============================================================

/** Format a registry contact as "Name <email> (Title)" string */
function formatRegistryContact(c: { name: string | null; email: string; title: string | null }): string {
  const parts: string[] = [];
  if (c.name) parts.push(c.name);
  parts.push(`<${c.email}>`);
  if (c.title) parts.push(`(${c.title})`);
  return parts.join(" ");
}

function buildContactsFromRegistry(
  contacts: { name: string | null; email: string; title: string | null; org_type: string | null; role: string | null }[]
): PartnerContext["contacts"] {
  let allianceLead: string | null = null;
  let accountManager: string | null = null;
  let psa: string | null = null;
  const others: string[] = [];

  for (const c of contacts) {
    const rendered = formatRegistryContact(c);
    const role = (c.role ?? "").toLowerCase();

    if (c.org_type === "partner") {
      if (role.includes("alliance") || role.includes("alliances")) {
        allianceLead = rendered;
      } else {
        others.push(rendered);
      }
    } else if (c.org_type === "internal") {
      if (role.includes("psa") || role.includes("partner solutions architect")) {
        psa = rendered;
      } else if (role.includes("account manager") || role === "am") {
        accountManager = rendered;
      } else {
        others.push(rendered);
      }
    } else {
      others.push(rendered);
    }
  }

  return {
    alliance_lead: allianceLead,
    account_manager: accountManager,
    psa,
    other_contacts: others,
  };
}

/**
 * Resolve program and event names linked to engagements via entity_links.
 * Returns maps of engagement_id → first program name, engagement_id → first event name.
 */
async function resolveEngagementEntities(
  db: ReturnType<typeof getSupabaseClient>,
  engagementIds: string[]
): Promise<{ programs: Map<string, string>; events: Map<string, string> }> {
  const programs = new Map<string, string>();
  const events = new Map<string, string>();
  if (engagementIds.length === 0) return { programs, events };

  // Get entity_links where engagement is source
  const { data: links } = await db
    .from("entity_links")
    .select("source_id, target_type, target_id")
    .eq("source_type", "engagement")
    .in("source_id", engagementIds)
    .in("target_type", ["program", "event"]);

  if (!links || links.length === 0) return { programs, events };

  const typedLinks = links as { source_id: string; target_type: string; target_id: string }[];

  // Collect IDs by type
  const programIds = new Set<string>();
  const eventIds = new Set<string>();
  for (const l of typedLinks) {
    if (l.target_type === "program") programIds.add(l.target_id);
    if (l.target_type === "event") eventIds.add(l.target_id);
  }

  // Resolve names in parallel
  const [programRows, eventRows] = await Promise.all([
    programIds.size > 0
      ? db.from("programs").select("id, name").in("id", [...programIds])
      : { data: [] },
    eventIds.size > 0
      ? db.from("events").select("id, name").in("id", [...eventIds])
      : { data: [] },
  ]);

  const programNameMap = new Map<string, string>();
  for (const p of ((programRows.data ?? []) as { id: string; name: string }[])) {
    programNameMap.set(p.id, p.name);
  }
  const eventNameMap = new Map<string, string>();
  for (const e of ((eventRows.data ?? []) as { id: string; name: string }[])) {
    eventNameMap.set(e.id, e.name);
  }

  // Map back to engagement IDs (take first match per engagement)
  for (const l of typedLinks) {
    if (l.target_type === "program" && !programs.has(l.source_id)) {
      const name = programNameMap.get(l.target_id);
      if (name) programs.set(l.source_id, name);
    }
    if (l.target_type === "event" && !events.has(l.source_id)) {
      const name = eventNameMap.get(l.target_id);
      if (name) events.set(l.source_id, name);
    }
  }

  return { programs, events };
}
