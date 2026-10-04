import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, questions, answers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { isAdminAuthenticated } from "@/lib/auth";
import { parseMarkdownChapter } from "@/lib/mdParser";

export async function POST(req: NextRequest) {
  const ok = await isAdminAuthenticated();
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const overwrite = formData.get("overwrite") === "true";

    if (!file) {
      return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
    }

    const content = await file.text();
    const parsed = parseMarkdownChapter(content);

    // Check if topic already exists
    const existing = await db
      .select()
      .from(topics)
      .where(eq(topics.title, parsed.title));

    if (existing.length > 0) {
      if (!overwrite) {
        return NextResponse.json(
          {
            error: `Тема «${parsed.title}» уже существует. Передайте overwrite=true для перезаписи.`,
            exists: true,
            topicId: existing[0].id,
          },
          { status: 409 }
        );
      }
      // Overwrite: delete existing topic (cascade deletes questions+answers)
      await db.delete(topics).where(eq(topics.id, existing[0].id));
    }

    // Determine next orderIndex
    const allTopics = await db
      .select({ orderIndex: topics.orderIndex })
      .from(topics);
    const maxOrder =
      allTopics.length === 0
        ? 0
        : Math.max(...allTopics.map((t) => t.orderIndex));
    const newOrderIndex = maxOrder + 1;

    // Insert topic
    const [newTopic] = await db
      .insert(topics)
      .values({ title: parsed.title, orderIndex: newOrderIndex })
      .returning();

    // Insert questions and answers
    for (const q of parsed.questions) {
      const [newQuestion] = await db
        .insert(questions)
        .values({
          topicId: newTopic.id,
          text: q.text,
          imageUrl: q.imageUrl,
          description: q.description,
        })
        .returning();

      if (q.answers.length > 0) {
        await db.insert(answers).values(
          q.answers.map((a) => ({
            questionId: newQuestion.id,
            text: a.text,
            isCorrect: a.isCorrect,
          }))
        );
      }
    }

    return NextResponse.json({
      ok: true,
      topicId: newTopic.id,
      title: newTopic.title,
      questionsImported: parsed.questions.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка импорта";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
