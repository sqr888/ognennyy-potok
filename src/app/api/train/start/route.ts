import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, questions, answers } from "@/db/schema";
import { asc, eq, inArray, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const topicIdStr = url.searchParams.get("topicId");
    const topicId =
      topicIdStr && !Number.isNaN(Number(topicIdStr))
        ? Number(topicIdStr)
        : null;

    // 1. Вопросы (с фильтром по теме, если задан)
    const baseQuery = db
      .select({
        id: questions.id,
        topicId: questions.topicId,
        text: questions.text,
        imageUrl: questions.imageUrl,
        description: questions.description,
        topicTitle: topics.title,
        topicOrder: topics.orderIndex,
      })
      .from(questions)
      .innerJoin(topics, eq(questions.topicId, topics.id));

    const allQuestions =
      topicId !== null
        ? await baseQuery
            .where(eq(questions.topicId, topicId))
            .orderBy(asc(questions.id))
        : await baseQuery.orderBy(asc(topics.orderIndex), asc(questions.id));

    if (allQuestions.length === 0) {
      return NextResponse.json(
        {
          error:
            topicId !== null
              ? "В выбранной теме нет вопросов."
              : "В базе нет вопросов.",
        },
        { status: 422 }
      );
    }

    // 2. Ответы — стабильный порядок по id
    const questionIds = allQuestions.map((q) => q.id);
    const allAnswers = await db
      .select()
      .from(answers)
      .where(inArray(answers.questionId, questionIds))
      .orderBy(asc(answers.id));

    const answersByQuestion = new Map<
      number,
      { id: number; text: string; isCorrect: boolean }[]
    >();
    for (const a of allAnswers) {
      if (!answersByQuestion.has(a.questionId)) {
        answersByQuestion.set(a.questionId, []);
      }
      answersByQuestion.get(a.questionId)!.push(a);
    }

    // 3. Собираем ответ
    const questionData = allQuestions.map((q) => {
      const qAnswers = answersByQuestion.get(q.id) ?? [];
      const correct = qAnswers.find((a) => a.isCorrect);
      return {
        id: q.id,
        topicId: q.topicId,
        text: q.text,
        imageUrl: q.imageUrl,
        description: q.description,
        topicTitle: q.topicTitle,
        topicOrder: q.topicOrder,
        answers: qAnswers.map((a) => ({ id: a.id, text: a.text })),
        correctAnswerId: correct?.id ?? null,
      };
    });

    return NextResponse.json({ questions: questionData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}