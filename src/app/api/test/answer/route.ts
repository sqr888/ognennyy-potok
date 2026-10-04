import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attempts, questions } from "@/db/schema";
import { eq } from "drizzle-orm";

interface QuestionMapEntry {
  questionId: number;
  correctAnswerId: number;
}

interface AnswerEntry {
  questionId: number;
  answeredId: number;
  isCorrect: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { attemptId, questionId, answerId } = body as {
      attemptId: number;
      questionId: number;
      answerId: number;
    };

    if (!attemptId || !questionId || !answerId) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }

    // Load attempt
    const [attempt] = await db
      .select()
      .from(attempts)
      .where(eq(attempts.id, attemptId));

    if (!attempt) {
      return NextResponse.json({ error: "Попытка не найдена" }, { status: 404 });
    }

    if (attempt.finished) {
      return NextResponse.json({ error: "Попытка уже завершена" }, { status: 400 });
    }

    const questionMap = attempt.questionMap as QuestionMapEntry[];
    const existingAnswers = attempt.answers as AnswerEntry[];

    // Find this question in the map
    const entry = questionMap.find((e) => e.questionId === questionId);
    if (!entry) {
      return NextResponse.json(
        { error: "Вопрос не входит в эту попытку" },
        { status: 400 }
      );
    }

    // Check if already answered
    const alreadyAnswered = existingAnswers.find(
      (a) => a.questionId === questionId
    );
    if (alreadyAnswered) {
      return NextResponse.json(
        { error: "На этот вопрос уже дан ответ" },
        { status: 400 }
      );
    }

    const isCorrect = answerId === entry.correctAnswerId;

    // Append to answers
    const newAnswers: AnswerEntry[] = [
      ...existingAnswers,
      { questionId, answeredId: answerId, isCorrect },
    ];

    const newCorrectCount =
      attempt.correctCount + (isCorrect ? 1 : 0);

    await db
      .update(attempts)
      .set({
        correctCount: newCorrectCount,
        answers: newAnswers,
      })
      .where(eq(attempts.id, attemptId));

    // Load the question description to return
    const [q] = await db
      .select({ description: questions.description })
      .from(questions)
      .where(eq(questions.id, questionId));

    return NextResponse.json({
      isCorrect,
      correctAnswerId: entry.correctAnswerId,
      description: q?.description ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
