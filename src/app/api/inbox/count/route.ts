import { NextResponse } from "next/server";
import { getInboxGroupCount } from "@/lib/db";

export async function GET() {
  try {
    const count = await getInboxGroupCount();
    return NextResponse.json({ count });
  } catch (error) {
    console.error("Inbox count error:", error);
    return NextResponse.json({ count: 0 });
  }
}
