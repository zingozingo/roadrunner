import { NextRequest, NextResponse } from "next/server";
import { getPartner, getSupabaseClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const partner = await getPartner(id);

    if (!partner) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const db = getSupabaseClient();

    // Fetch engagements by partner_id FK, falling back to partner_name text match
    const [{ data: engByFk }, { data: engByName }] = await Promise.all([
      db
        .from("engagements")
        .select("*")
        .eq("partner_id", id)
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false }),
      db
        .from("engagements")
        .select("*")
        .eq("partner_name", partner.name)
        .is("partner_id", null)
        .order("status", { ascending: true })
        .order("updated_at", { ascending: false }),
    ]);
    const engagements = [...(engByFk ?? []), ...(engByName ?? [])];

    // Fetch meetings by partner_id FK, falling back to partner_name text match
    const [{ data: mtgByFk }, { data: mtgByName }] = await Promise.all([
      db
        .from("meetings")
        .select("*")
        .eq("partner_id", id)
        .order("meeting_date", { ascending: false, nullsFirst: false }),
      db
        .from("meetings")
        .select("*")
        .eq("partner_name", partner.name)
        .is("partner_id", null)
        .order("meeting_date", { ascending: false, nullsFirst: false }),
    ]);
    const meetings = [...(mtgByFk ?? []), ...(mtgByName ?? [])];

    return NextResponse.json({
      partner,
      engagements: engagements ?? [],
      meetings: meetings ?? [],
    });
  } catch (error) {
    console.error("GET /api/partners/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch partner" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await getPartner(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.segment !== undefined) updates.segment = body.segment || null;
    if (body.focus_area !== undefined) updates.focus_area = Array.isArray(body.focus_area) ? body.focus_area : [];
    if (body.aws_stickiness !== undefined) updates.aws_stickiness = body.aws_stickiness || null;
    if (body.key_aws_services !== undefined) updates.key_aws_services = Array.isArray(body.key_aws_services) ? body.key_aws_services : [];
    if (body.alliance_lead !== undefined) updates.alliance_lead = body.alliance_lead || null;
    if (body.alliance_lead_email !== undefined) updates.alliance_lead_email = body.alliance_lead_email || null;
    if (body.psa !== undefined) updates.psa = body.psa || null;
    if (body.partner_contact_emails !== undefined) updates.partner_contact_emails = body.partner_contact_emails;

    const { data, error } = await getSupabaseClient()
      .from("partners")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ partner: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("PUT /api/partners/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to update partner: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getPartner(id);
    if (!existing) {
      return NextResponse.json(
        { error: "Partner not found" },
        { status: 404 }
      );
    }

    // partner_id FKs on engagements and meetings use ON DELETE SET NULL
    const { error } = await getSupabaseClient()
      .from("partners")
      .delete()
      .eq("id", id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ status: "deleted" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("DELETE /api/partners/[id] error:", message);
    return NextResponse.json(
      { error: `Failed to delete partner: ${message}` },
      { status: 500 }
    );
  }
}
