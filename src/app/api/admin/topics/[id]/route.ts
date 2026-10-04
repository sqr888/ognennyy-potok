import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const topicId = parseInt(id, 10);
  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  await db.delete(topics).where(eq(topics.id, topicId));
  return NextResponse.json({ ok: true });
}
