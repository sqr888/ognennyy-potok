import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, answers, topics } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const topicIdParam = searchParams.get("topicId");

  // Fetch questions with their topic title and answers
  const qRows = await db.query.questions.findMany({
    where: topicIdParam
      ? eq(questions.topicId, parseInt(topicIdParam, 10))
      : undefined,
    with: {
      topic: true,
      answers: {
        orderBy: [asc(answers.id)],
      },
    },
    orderBy: [asc(questions.id)],
  });

  return NextResponse.json(qRows);
}

export async function POST(req: NextRequest) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { topicId, text, description, answersData } = body as {
      topicId: number;
      text: string;
      description?: string;
      answersData: { text: string; isCorrect: boolean }[];
    };

    if (!topicId || !text || !answersData || answersData.length === 0) {
      return NextResponse.json({ error: "Неверные данные" }, { status: 400 });
    }

    const correctCount = answersData.filter((a) => a.isCorrect).length;
    if (correctCount !== 1) {
      return NextResponse.json(
        { error: "Должен быть ровно один правильный ответ" },
        { status: 400 }
      );
    }

    const [newQ] = await db
      .insert(questions)
      .values({ topicId, text, description: description ?? null })
      .returning();

    await db.insert(answers).values(
      answersData.map((a) => ({
        questionId: newQ.id,
        text: a.text,
        isCorrect: a.isCorrect,
      }))
    );

    const full = await db.query.questions.findFirst({
      where: eq(questions.id, newQ.id),
      with: { topic: true, answers: true },
    });

    return NextResponse.json(full, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
