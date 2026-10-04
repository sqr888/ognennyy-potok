import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attempts } from "@/db/schema";
import { eq } from "drizzle-orm";

interface AnswerEntry {
  questionId: number;
  answeredId: number;
  isCorrect: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { attemptId } = body as { attemptId: number };

    if (!attemptId) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }

    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId));

    if (!attempt) {
      return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
    }

    await db
      .update(attempts)
      .set({ finished: true })
      .where(eq(attempts.id, attemptId));

    const answersArr = attempt.answers as AnswerEntry[];

    return NextResponse.json({
      attemptId: attempt.id,
      correctCount: attempt.correctCount,
      totalCount: attempt.totalCount,
      answers: answersArr,
      createdAt: attempt.createdAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
