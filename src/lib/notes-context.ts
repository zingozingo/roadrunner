import { getSupabaseClient } from "./db/client";
import { getTasksByPartner, getStandaloneCondensedDigests } from "./db/meeting-notes";
import { getPartnerContext, getPartnerScratchpad } from "./db/partner-context";
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
// Context assembly (UI-only — used by formatContextForDisplay,
// NOT consumed by any AI call)
// ============================================================

export async function buildPartnerContext(
  partnerId: string
): Promise<PartnerContext> {
  const db = getSupabaseClient();

  // Parallel fetch: partner, engagements, meetings, tasks, scratchpad
  const [
    { data: partnerData, error: partnerErr },
    { data: engData, error: engErr },
    { data: mtgData, error: mtgErr },
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

  // Resolve program/event names for engagements via typed junction tables
  const engagementIds = engagements.map((e) => e.id);
  const entityNames = await resolveEngagementEntities(db, engagementIds);

  // Fetch previous note summaries with note_type
  const { data: notesWithType } = await db
    .from("meeting_notes")
    .select("title, meeting_date, ai_summary, note_type")
    .eq("partner_id", partnerId)
    .eq("status", "complete")
    .not("ai_summary", "is", null)
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
    registryContacts: registryContacts.map((c) => ({
      name: c.name,
      email: c.email,
      title: c.title,
      role: c.role,
      org_type: c.org_type,
    })),
  };
}

// ============================================================
// Format for prompt (UI-only — used by formatContextForDisplay,
// NOT consumed by any AI call)
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
      const label = `[${n.meeting_date ?? "no date"}]`;
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
    contacts: context.registryContacts,
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
    scratchpadEntries: context.scratchpadEntries,
  };
}

// ============================================================
// Scoped context builder for meeting note summarization (Call 2)
// ============================================================

/**
 * Build a focused context string for meeting note summarization (Call 2).
 * Scoped to the specific engagement (or recent partner meetings if standalone):
 * - Condensed partner profile (3 fields)
 * - Key contacts
 * - PDM scratchpad notes
 * - Previous meeting digests scoped to the same engagement (condensed only)
 */
export async function buildMeetingNoteContext(
  partnerId: string,
  engagementId: string | null
): Promise<string> {
  const db = getSupabaseClient();

  // Parallel fetch: partner profile, contacts, scratchpad, previous condensed notes
  const [
    { data: partnerData, error: partnerErr },
    registryContacts,
    scratchpadEntries,
  ] = await Promise.all([
    db.from("partners").select("name, segment, what_they_do").eq("id", partnerId).single(),
    getContactsByPartner(partnerId),
    getPartnerContext(partnerId),
  ]);

  if (partnerErr) throw new Error(`Failed to fetch partner: ${partnerErr.message}`);
  const partner = partnerData as { name: string; segment: string | null; what_they_do: string | null };

  const sections: string[] = [];

  // 1. Partner profile (condensed)
  const profileLines = [`Partner: ${partner.name}`];
  if (partner.segment) profileLines.push(`Segment: ${partner.segment}`);
  if (partner.what_they_do) profileLines.push(`What They Do: ${partner.what_they_do}`);
  sections.push(profileLines.join("\n"));

  // 2. Key contacts
  const contacts = buildContactsFromRegistry(registryContacts);
  const contactLines: string[] = [];
  if (contacts.alliance_lead) contactLines.push(`Alliance Lead: ${contacts.alliance_lead}`);
  if (contacts.account_manager) contactLines.push(`Account Manager: ${contacts.account_manager}`);
  if (contacts.psa) contactLines.push(`PSA: ${contacts.psa}`);
  if (contacts.other_contacts.length > 0) contactLines.push(`Other: ${contacts.other_contacts.join("; ")}`);
  if (contactLines.length > 0) sections.push("KEY CONTACTS\n" + contactLines.join("\n"));

  // 3. Scratchpad (PDM notes)
  const contextEntries = scratchpadEntries.filter(
    (e) => e.source === "scratchpad" || e.source === "seed_dump"
  );
  if (contextEntries.length > 0) {
    const ctxLines = contextEntries.map((e) => `- ${e.content}`);
    sections.push("PARTNER CONTEXT (PDM NOTES)\n" + ctxLines.join("\n"));
  }

  // 4. Previous meeting context (condensed digests only)
  if (engagementId) {
    // Scoped: only meetings linked to this engagement
    const { data: notes } = await db
      .from("meeting_notes")
      .select("title, meeting_date, condensed, meeting_id, meetings!inner(engagement_id)")
      .eq("partner_id", partnerId)
      .not("condensed", "is", null)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .limit(20); // Over-fetch then filter by engagement

    const scoped = ((notes ?? []) as unknown as { title: string | null; meeting_date: string | null; condensed: string; meetings: { engagement_id: string | null } }[])
      .filter((n) => n.meetings?.engagement_id === engagementId)
      .slice(0, 5);

    if (scoped.length > 0) {
      const noteLines = scoped.map((n) => {
        const label = `[${n.meeting_date ?? "no date"}]`;
        const title = n.title ? ` ${n.title}` : "";
        return `${label}${title}\n${n.condensed}`;
      });
      sections.push("PREVIOUS MEETINGS (SAME ENGAGEMENT)\n" + noteLines.join("\n\n"));
    }
  } else {
    // Unscoped fallback: recent partner meetings
    const { data: notes } = await db
      .from("meeting_notes")
      .select("title, meeting_date, condensed")
      .eq("partner_id", partnerId)
      .not("condensed", "is", null)
      .order("meeting_date", { ascending: false, nullsFirst: false })
      .limit(3);

    if (notes && notes.length > 0) {
      const noteLines = (notes as { title: string | null; meeting_date: string | null; condensed: string }[]).map((n) => {
        const label = `[${n.meeting_date ?? "no date"}]`;
        const title = n.title ? ` ${n.title}` : "";
        return `${label}${title}\n${n.condensed}`;
      });
      sections.push("RECENT PARTNER MEETINGS\n" + noteLines.join("\n\n"));
    }
  }

  return sections.join("\n\n---\n\n");
}

// ============================================================
// Dedicated context builder for partner brain synthesis (Call 3)
// ============================================================

/**
 * Build context for partner brain synthesis (Call 3).
 * Dedicated builder — separate from buildPartnerContext (legacy) and
 * buildMeetingNoteContext (Call 2).
 *
 * Reads condensed digests from the pyramid below, not raw prose.
 * Scratchpad is filtered to source='scratchpad' only (no ai_synthesis feedback loop).
 * Activity patterns are computed for the AI to synthesize.
 */
export async function buildBrainContext(partnerId: string): Promise<string> {
  const db = getSupabaseClient();

  // Parallel fetch everything the brain needs
  const [
    { data: partnerData, error: partnerErr },
    { data: engData, error: engErr },
    registryContacts,
    scratchpadEntries,
    standaloneMeetingDigests,
    openTasks,
    { data: meetingCountData },
  ] = await Promise.all([
    db.from("partners").select("*").eq("id", partnerId).single(),
    db.from("engagements")
      .select("id, name, pillar, status, topic, condensed, updated_at")
      .eq("partner_id", partnerId)
      .eq("status", "active")
      .order("updated_at", { ascending: false }),
    getContactsByPartner(partnerId),
    getPartnerScratchpad(partnerId),
    getStandaloneCondensedDigests(partnerId),
    getTasksByPartner(partnerId, { status: "open" }),
    db.from("meetings")
      .select("id, meeting_date")
      .eq("partner_id", partnerId)
      .order("meeting_date", { ascending: false })
      .limit(50),
  ]);

  if (partnerErr) throw new Error(`Failed to fetch partner: ${partnerErr.message}`);
  if (engErr) throw new Error(`Failed to fetch engagements: ${engErr.message}`);

  const partner = partnerData as Partner;
  const engagements = (engData ?? []) as (Engagement & { condensed: string | null })[];
  const meetings = (meetingCountData ?? []) as { id: string; meeting_date: string | null }[];

  const sections: string[] = [];

  // 1. Partner profile (full — brain is where this gets synthesized into insight)
  const profileLines = [`## Partner Profile\n`, `**Name:** ${partner.name}`];
  if (partner.segment) profileLines.push(`**Segment:** ${partner.segment}`);
  if (partner.what_they_do) profileLines.push(`**What They Do:** ${partner.what_they_do}`);
  if (partner.aws_stickiness) profileLines.push(`**AWS Stickiness:** ${partner.aws_stickiness}`);
  if (partner.key_aws_services && partner.key_aws_services.length > 0) {
    profileLines.push(`**Key AWS Services:** ${partner.key_aws_services.join(", ")}`);
  }
  if (partner.architecture) profileLines.push(`**Architecture:** ${partner.architecture}`);
  if (partner.deployed_on_aws) profileLines.push(`**Deployed on AWS:** ${partner.deployed_on_aws}`);
  if (partner.isva_status) profileLines.push(`**ISVa Status:** ${partner.isva_status}`);
  if (partner.prm_status) profileLines.push(`**PRM Status:** ${partner.prm_status}`);
  if (partner.crm_status) profileLines.push(`**CRM Status:** ${partner.crm_status}`);
  sections.push(profileLines.join("\n"));

  // 2. Key contacts
  const contacts = buildContactsFromRegistry(registryContacts);
  const contactLines: string[] = ["## Key Contacts\n"];
  if (contacts.alliance_lead) contactLines.push(`Alliance Lead: ${contacts.alliance_lead}`);
  if (contacts.account_manager) contactLines.push(`Account Manager: ${contacts.account_manager}`);
  if (contacts.psa) contactLines.push(`PSA: ${contacts.psa}`);
  if (contacts.other_contacts.length > 0) {
    contactLines.push(`Other: ${contacts.other_contacts.slice(0, 5).join("; ")}`);
  }
  if (contactLines.length > 1) sections.push(contactLines.join("\n"));

  // 3. Scratchpad — tribal knowledge (PRIMARY value for brain)
  if (scratchpadEntries.length > 0) {
    const lines = ["## PDM Scratchpad (Tribal Knowledge)\n"];
    for (const entry of scratchpadEntries) {
      const date = entry.created_at.split("T")[0];
      lines.push(`- [${date}] ${entry.content}`);
    }
    sections.push(lines.join("\n"));
  }

  // 4. Engagement digests (condensed only — not full current_state)
  if (engagements.length > 0) {
    const lines = ["## Active Engagements\n"];
    for (const eng of engagements) {
      const pillarTag = eng.pillar ? ` (${eng.pillar})` : "";
      const lastActivity = eng.updated_at ? eng.updated_at.split("T")[0] : "unknown";
      lines.push(`### ${eng.name}${pillarTag}`);
      lines.push(`Last activity: ${lastActivity}`);
      if (eng.condensed) {
        lines.push(eng.condensed);
      } else if (eng.topic) {
        lines.push(`Topic: ${eng.topic}`);
        lines.push("(No condensed digest available yet)");
      }
      lines.push("");
    }
    sections.push(lines.join("\n"));
  }

  // 5. Standalone meeting digests (not linked to any engagement)
  if (standaloneMeetingDigests.length > 0) {
    const lines = ["## Standalone Meeting Digests (Cross-Engagement)\n"];
    for (const d of standaloneMeetingDigests) {
      const date = d.meeting_date || "date unknown";
      lines.push(`### ${d.title} (${date})`);
      lines.push(d.condensed);
      lines.push("");
    }
    sections.push(lines.join("\n"));
  }

  // 6. Open tasks (titles + owners only)
  if (openTasks.length > 0) {
    const lines = ["## Open Tasks\n"];
    for (const t of openTasks) {
      const owner = t.owner_name ? `${t.owner_name} (${t.owner})` : t.owner;
      const due = t.due_date ? ` — due ${t.due_date}` : "";
      lines.push(`- [${owner}${due}] ${t.description}`);
    }
    sections.push(lines.join("\n"));
  }

  // 7. Activity pattern signals (computed for the AI to interpret)
  {
    const lines = ["## Activity Patterns\n"];

    // Pillar distribution
    const pillarCounts: Record<string, number> = {};
    for (const eng of engagements) {
      const p = eng.pillar || "Unclassified";
      pillarCounts[p] = (pillarCounts[p] || 0) + 1;
    }
    const pillarSummary = Object.entries(pillarCounts)
      .map(([p, c]) => `${p}: ${c}`)
      .join(", ");
    lines.push(`**Engagement count:** ${engagements.length} active`);
    lines.push(`**Pillar distribution:** ${pillarSummary}`);

    // Meeting frequency
    const meetingCount = meetings.length;
    const recentMeetings = meetings.filter(m => {
      if (!m.meeting_date) return false;
      const d = new Date(m.meeting_date);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return d >= thirtyDaysAgo;
    });
    lines.push(`**Total meetings tracked:** ${meetingCount}`);
    lines.push(`**Meetings in last 30 days:** ${recentMeetings.length}`);

    // Last engagement activity
    if (engagements.length > 0 && engagements[0].updated_at) {
      lines.push(`**Most recent engagement activity:** ${engagements[0].updated_at.split("T")[0]}`);
    }

    // Standalone meeting count
    lines.push(`**Standalone meeting digests available:** ${standaloneMeetingDigests.length}`);

    sections.push(lines.join("\n"));
  }

  return sections.join("\n\n---\n\n");
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
 * Resolve program and event names linked to engagements via typed junction tables.
 * Returns maps of engagement_id → first program name, engagement_id → first event name.
 */
async function resolveEngagementEntities(
  db: ReturnType<typeof getSupabaseClient>,
  engagementIds: string[]
): Promise<{ programs: Map<string, string>; events: Map<string, string> }> {
  const programs = new Map<string, string>();
  const events = new Map<string, string>();
  if (engagementIds.length === 0) return { programs, events };

  const [{ data: programLinks }, { data: eventLinks }] = await Promise.all([
    db
      .from("engagement_programs")
      .select("engagement_id, programs(name)")
      .in("engagement_id", engagementIds),
    db
      .from("engagement_events")
      .select("engagement_id, events(name)")
      .in("engagement_id", engagementIds),
  ]);

  // Take first match per engagement
  for (const link of (programLinks ?? []) as unknown as { engagement_id: string; programs: { name: string } | null }[]) {
    if (!programs.has(link.engagement_id) && link.programs?.name) {
      programs.set(link.engagement_id, link.programs.name);
    }
  }

  for (const link of (eventLinks ?? []) as unknown as { engagement_id: string; events: { name: string } | null }[]) {
    if (!events.has(link.engagement_id) && link.events?.name) {
      events.set(link.engagement_id, link.events.name);
    }
  }

  return { programs, events };
}
