import { NextRequest, NextResponse } from "next/server";
import { saveAndSynthesize } from "@/lib/brain-synthesizer";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { synthesis, id: entryId } = await saveAndSynthesize(id);
    return NextResponse.json({ synthesis, id: entryId });
  } catch (err) {
    console.error("Failed to synthesize partner context:", err);
    return NextResponse.json(
      { error: "Failed to synthesize partner context" },
      { status: 500 }
    );
  }
}
