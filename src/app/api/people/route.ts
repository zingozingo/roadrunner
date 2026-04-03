import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/db/client";

/**
 * GET /api/people — Search and filter participants across all partners.
 * Query params: q (search), org_type, partner_id, limit, offset
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.toLowerCase().trim() || null;
  const orgType = searchParams.get("org_type") || null;
  const partnerId = searchParams.get("partner_id") || null;
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  const db = getSupabaseClient();

  try {
    // Base query: all participants
    let query = db
      .from("participants")
      .select("id, name, email, title, organization, org_type", { count: "exact" });

    // Org type filter
    if (orgType) {
      query = query.eq("org_type", orgType);
    }

    // Partner filter: get participant IDs linked to this partner
    if (partnerId) {
      const { data: partnerLinks } = await db
        .from("partner_participants")
        .select("participant_id")
        .eq("partner_id", partnerId);

      const { data: engLinks } = await db
        .from("engagement_participants")
        .select("participant_id, engagement:engagements!inner(partner_id)")
        .eq("engagement.partner_id", partnerId);

      const participantIds = new Set<string>();
      for (const l of partnerLinks ?? []) participantIds.add(l.participant_id);
      for (const l of (engLinks ?? []) as unknown as { participant_id: string }[]) participantIds.add(l.participant_id);

      if (participantIds.size === 0) {
        return NextResponse.json({ people: [], total: 0 });
      }
      query = query.in("id", [...participantIds]);
    }

    // Search filter — use ilike on name, email, organization, title
    if (q) {
      query = query.or(
        `name.ilike.%${q}%,email.ilike.%${q}%,organization.ilike.%${q}%,title.ilike.%${q}%`
      );
    }

    // Order and paginate
    query = query
      .order("name", { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    const { data: participants, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with partner connections from BOTH paths
    const participantIds = (participants ?? []).map((p) => p.id);

    let partnerConnections = new Map<string, { id: string; name: string; role: string | null; source: "curated" | "engagement" }[]>();
    if (participantIds.length > 0) {
      // Path 1: curated partner_participants links
      const { data: ppLinks } = await db
        .from("partner_participants")
        .select("participant_id, role, partner:partners!inner(id, name)")
        .in("participant_id", participantIds);

      for (const row of (ppLinks ?? []) as unknown as { participant_id: string; role: string | null; partner: { id: string; name: string } }[]) {
        const existing = partnerConnections.get(row.participant_id) ?? [];
        existing.push({ id: row.partner.id, name: row.partner.name, role: row.role, source: "curated" });
        partnerConnections.set(row.participant_id, existing);
      }

      // Path 2: engagement-derived partner connections
      const { data: epLinks } = await db
        .from("engagement_participants")
        .select("participant_id, engagement:engagements!inner(partner_id, partner:partners!inner(id, name))")
        .in("participant_id", participantIds);

      for (const row of (epLinks ?? []) as unknown as { participant_id: string; engagement: { partner_id: string; partner: { id: string; name: string } } }[]) {
        const existing = partnerConnections.get(row.participant_id) ?? [];
        const partner = row.engagement.partner;
        // Skip if this participant already has a curated link to this partner
        if (!existing.some((e) => e.id === partner.id)) {
          existing.push({ id: partner.id, name: partner.name, role: null, source: "engagement" });
          partnerConnections.set(row.participant_id, existing);
        }
      }
    }

    const people = (participants ?? []).map((p) => ({
      ...p,
      partners: partnerConnections.get(p.id) ?? [],
    }));

    return NextResponse.json({ people, total: count ?? people.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/people — Create a new participant with optional partner link.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, title, organization, org_type, partner_id, role } = body;

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const db = getSupabaseClient();

  try {
    // Check for duplicate email
    const { data: existing } = await db
      .from("participants")
      .select("id, name, email")
      .eq("email", normalizedEmail)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "A person with this email already exists", existing: existing[0] },
        { status: 409 }
      );
    }

    // Create participant
    const { data: participant, error: insertErr } = await db
      .from("participants")
      .insert({
        name: name.trim(),
        email: normalizedEmail,
        title: title?.trim() || null,
        organization: organization?.trim() || null,
        org_type: org_type || null,
      })
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === "23505") {
        return NextResponse.json({ error: "A person with this email already exists" }, { status: 409 });
      }
      throw insertErr;
    }

    // Link to partner if provided
    if (partner_id && participant) {
      await db.from("partner_participants").insert({
        partner_id,
        participant_id: participant.id,
        role: role || null,
      });
    }

    return NextResponse.json({ participant }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
