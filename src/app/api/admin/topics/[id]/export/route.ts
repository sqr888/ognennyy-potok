import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, questions, answers } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { asc, eq, inArray } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Неверный id темы" }, { status: 400 });
  }

  // 1. Тема
  const [topic] = await db.select().from(topics).where(eq(topics.id, id));
  if (!topic) {
    return NextResponse.json({ error: "Тема не найдена" }, { status: 404 });
  }

  // 2. Вопросы темы (по возрастанию id — стабильный порядок)
  const topicQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.topicId, id))
    .orderBy(asc(questions.id));

  // 3. Ответы одним запросом
  const questionIds = topicQuestions.map((q) => q.id);
  const allAnswers =
    questionIds.length > 0
      ? await db
          .select()
          .from(answers)
          .where(inArray(answers.questionId, questionIds))
          .orderBy(asc(answers.id))
      : [];

  const answersByQuestion = new Map<number, typeof allAnswers>();
  for (const a of allAnswers) {
    if (!answersByQuestion.has(a.questionId)) {
      answersByQuestion.set(a.questionId, []);
    }
    answersByQuestion.get(a.questionId)!.push(a);
  }

  // 4. Собираем .md
  const lines: string[] = [];

  // Заголовок главы в формате, который понимает mdParser
  lines.push(`# Глава ${topic.orderIndex}. ${topic.title}`);
  lines.push("");

  topicQuestions.forEach((q, idx) => {
    lines.push(`## Вопрос ${idx + 1}`);
    lines.push("");
    lines.push(q.text);
    lines.push("");

    if (q.imageUrl) {
      lines.push(`![image](${q.imageUrl})`);
      lines.push("");
    }

    const qAnswers = answersByQuestion.get(q.id) ?? [];
    for (const a of qAnswers) {
      lines.push(`- [${a.isCorrect ? "x" : " "}] ${a.text}`);
    }
    lines.push("");

    if (q.description) {
      lines.push(`**Описание:** ${q.description}`);
      lines.push("");
    }
  });

  const md = lines.join("\n");

  // 5. Имя файла: "{orderIndex}. {title}.md", с заменой недопустимых символов
  const safeName = `${topic.orderIndex}. ${topic.title}`
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  // 6. Отдаём как download
  // filename="..." — для ASCII, filename*=UTF-8''... — для кириллицы
  const fallbackName = `chapter-${topic.orderIndex}.md`;
  const encodedName = encodeURIComponent(`${safeName}.md`);

  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition":
        `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`,
    },
  });
}