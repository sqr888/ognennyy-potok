import { NextResponse } from "next/server";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { asc } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db
    .select()
    .from(topics)
    .orderBy(asc(topics.orderIndex));

  return NextResponse.json(rows);
}
