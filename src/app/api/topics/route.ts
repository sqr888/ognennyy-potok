import { NextResponse } from "next/server";
import { db } from "@/db";
import { topics } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const rows = await db.select().from(topics).orderBy(asc(topics.orderIndex));
  return NextResponse.json(rows);
}
