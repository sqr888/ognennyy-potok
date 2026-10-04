import { NextResponse } from "next/server";
import { db } from "@/db";
import { attempts } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";

export async function POST() {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.delete(attempts);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}