import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, answers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const qId = parseInt(id, 10);

  const q = await db.query.questions.findFirst({
    where: eq(questions.id, qId),
    with: { topic: true, answers: true },
  });

  if (!q) return NextResponse.json({ error: "Не найден" }, { status: 404 });
  return NextResponse.json(q);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const qId = parseInt(id, 10);

  try {
    const body = await req.json();
    const { topicId, text, description, answersData } = body as {
      topicId?: number;
      text?: string;
      description?: string | null;
      answersData?: { id?: number; text: string; isCorrect: boolean }[];
    };

    // Update question fields
    const updateFields: Partial<{
      topicId: number;
      text: string;
      description: string | null;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (topicId !== undefined) updateFields.topicId = topicId;
    if (text !== undefined) updateFields.text = text;
    if (description !== undefined) updateFields.description = description;

    await db.update(questions).set(updateFields).where(eq(questions.id, qId));

    // Replace answers if provided
    if (answersData && answersData.length > 0) {
      const correctCount = answersData.filter((a) => a.isCorrect).length;
      if (correctCount !== 1) {
        return NextResponse.json(
          { error: "Должен быть ровно один правильный ответ" },
          { status: 400 }
        );
      }

      // Delete old answers and re-insert
      await db.delete(answers).where(eq(answers.questionId, qId));
      await db.insert(answers).values(
        answersData.map((a) => ({
          questionId: qId,
          text: a.text,
          isCorrect: a.isCorrect,
        }))
      );
    }

    const full = await db.query.questions.findFirst({
      where: eq(questions.id, qId),
      with: { topic: true, answers: true },
    });

    return NextResponse.json(full);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const qId = parseInt(id, 10);

  await db.delete(questions).where(eq(questions.id, qId));
  return NextResponse.json({ ok: true });
}
