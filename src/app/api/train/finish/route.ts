import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attempts } from "@/db/schema";

interface IncomingRecord {
  questionId: number;
  answeredId: number;
  correctAnswerId: number;
  isCorrect: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const records: IncomingRecord[] = Array.isArray(body?.records)
      ? body.records
      : [];

    if (records.length === 0) {
      return NextResponse.json(
        { error: "Нет ответов для сохранения" },
        { status: 400 }
      );
    }

    const correctCount = records.filter((r) => r.isCorrect).length;
    const totalCount = records.length;

    const questionMap = records.map((r) => ({
      questionId: r.questionId,
      correctAnswerId: r.correctAnswerId,
    }));

    const answers = records.map((r) => ({
      questionId: r.questionId,
      answeredId: r.answeredId,
      isCorrect: r.isCorrect,
    }));

    const [attempt] = await db
      .insert(attempts)
      .values({
        totalCount,
        correctCount,
        finished: true,
        mode: "train",
        questionMap,
        answers,
      })
      .returning({ id: attempts.id });

    return NextResponse.json({ attemptId: attempt.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}