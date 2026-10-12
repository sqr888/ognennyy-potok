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
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const topicId = parseInt(id, 10);
  if (isNaN(topicId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    // Удаляем и проверяем, что действительно что-то удалили
    const deleted = await db
      .delete(topics)
      .where(eq(topics.id, topicId))
      .returning({ id: topics.id });

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: "Тема не найдена" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, deletedId: deleted[0].id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка удаления";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}