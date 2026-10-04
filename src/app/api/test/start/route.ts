import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, questions, answers, attempts } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";

type Mode = "test" | "exam";

export async function GET(req: NextRequest) {
  try {
    // Режим: ?mode=exam → сохраняем в attempts.mode = "exam"
    const modeParam = req.nextUrl.searchParams.get("mode");
    const mode: Mode = modeParam === "exam" ? "exam" : "test";

    // 1. Все темы по порядку
    const allTopics = await db
      .select()
      .from(topics)
      .orderBy(asc(topics.orderIndex));

    if (allTopics.length < 14) {
      return NextResponse.json(
        {
          error: `Не все главы загружены. Загружено ${allTopics.length} из 14 глав.`,
        },
        { status: 422 }
      );
    }

    // 2. Из каждой темы — 1 случайный вопрос
    const selectedQuestions: {
      questionId: number;
      correctAnswerId: number;
      topicId: number;
    }[] = [];

    const questionData: {
      id: number;
      topicId: number;
      text: string;
      imageUrl: string | null;
      description: string | null;
      answers: { id: number; text: string }[];
      topicTitle: string;
      topicOrder: number;
    }[] = [];

    for (const topic of allTopics) {
      const [randomQ] = await db
        .select()
        .from(questions)
        .where(eq(questions.topicId, topic.id))
        .orderBy(sql`RANDOM()`)
        .limit(1);

      if (!randomQ) {
        return NextResponse.json(
          { error: `Тема «${topic.title}» не содержит вопросов.` },
          { status: 422 }
        );
      }

      const questionAnswers = await db
        .select({
          id: answers.id,
          text: answers.text,
          isCorrect: answers.isCorrect,
        })
        .from(answers)
        .where(eq(answers.questionId, randomQ.id))
        .orderBy(asc(answers.id));

      const correctAnswer = questionAnswers.find((a) => a.isCorrect);
      if (!correctAnswer) {
        return NextResponse.json(
          { error: `Вопрос #${randomQ.id} не имеет правильного ответа.` },
          { status: 422 }
        );
      }

      selectedQuestions.push({
        questionId: randomQ.id,
        correctAnswerId: correctAnswer.id,
        topicId: topic.id,
      });

      questionData.push({
        id: randomQ.id,
        topicId: topic.id,
        text: randomQ.text,
        imageUrl: randomQ.imageUrl,
        description: null,
        answers: questionAnswers.map((a) => ({ id: a.id, text: a.text })),
        topicTitle: topic.title,
        topicOrder: topic.orderIndex,
      });
    }

    // 3. Создаём запись о попытке с указанием режима
    const questionMap = selectedQuestions.map(
      ({ questionId, correctAnswerId }) => ({ questionId, correctAnswerId })
    );

    const [attempt] = await db
      .insert(attempts)
      .values({
        totalCount: questionData.length,
        correctCount: 0,
        finished: false,
        mode,
        questionMap: questionMap,
        answers: [],
      })
      .returning({ id: attempts.id });

    return NextResponse.json({
      attemptId: attempt.id,
      questions: questionData,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}