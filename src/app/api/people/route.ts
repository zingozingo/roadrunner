import { NextRequest, NextResponse } from "next/server";
import {
  searchParticipants,
  getParticipantPartnerConnections,
  findParticipantByEmail,
  createParticipantRecord,
  linkPartnerParticipant,
} from "@/lib/db";

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

  try {
    const { participants, total } = await searchParticipants({
      q,
      orgType,
      partnerId,
      limit,
      offset,
    });

    // Enrich with partner connections
    const participantIds = participants.map((p) => p.id);
    const partnerConnections = await getParticipantPartnerConnections(participantIds);

    const people = participants.map((p) => ({
      ...p,
      partners: partnerConnections.get(p.id) ?? [],
    }));

    return NextResponse.json({ people, total });
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

  try {
    // Check for duplicate email
    const existing = await findParticipantByEmail(normalizedEmail);
    if (existing) {
      return NextResponse.json(
        { error: "A person with this email already exists", existing },
        { status: 409 }
      );
    }

    // Create participant
    let participant;
    try {
      participant = await createParticipantRecord({
        name: name.trim(),
        email: normalizedEmail,
        title: title?.trim() || null,
        organization: organization?.trim() || null,
        org_type: org_type || null,
      });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505") {
        return NextResponse.json({ error: "A person with this email already exists" }, { status: 409 });
      }
      throw err;
    }

    // Link to partner if provided
    if (partner_id) {
      await linkPartnerParticipant(partner_id, participant.id, role || null);
    }

    return NextResponse.json({ participant }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
