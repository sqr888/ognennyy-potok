import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { topics, questions, answers } from "@/db/schema";
import { eq, ne, and, sql } from "drizzle-orm";
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

    // ── Проверка: существует ли тема с таким названием ───────────────────
    const existingByTitle = await db
      .select()
      .from(topics)
      .where(eq(topics.title, parsed.title));

    if (existingByTitle.length > 0 && !overwrite) {
      return NextResponse.json(
        {
          error: `Тема «${parsed.title}» уже существует. Передайте overwrite=true для перезаписи.`,
          exists: true,
          topicId: existingByTitle[0].id,
        },
        { status: 409 }
      );
    }

    const existingTopic = existingByTitle[0] ?? null;

    // ── Определяем итоговый orderIndex ───────────────────────────────────
    // Приоритет: номер из заголовка файла (# Глава 5. …). Если его нет —
    // берём MAX+1, как раньше.
    let targetOrderIndex: number;

    if (parsed.orderIndex !== null) {
      // Проверяем, не занят ли этот номер другой темой
      // (та, которую мы перезаписываем, не считается)
      const occupied = await db
        .select({ id: topics.id, title: topics.title })
        .from(topics)
        .where(
          existingTopic
            ? and(
                eq(topics.orderIndex, parsed.orderIndex),
                ne(topics.id, existingTopic.id)
              )
            : eq(topics.orderIndex, parsed.orderIndex)
        );

      if (occupied.length > 0) {
        return NextResponse.json(
          {
            error:
              `Позиция ${parsed.orderIndex} уже занята темой «${occupied[0].title}». ` +
              `Измените номер главы в файле или удалите конфликтующую тему.`,
          },
          { status: 409 }
        );
      }

      targetOrderIndex = parsed.orderIndex;
    } else {
      // Номера в файле нет — берём следующий свободный
      const allTopics = await db
        .select({ orderIndex: topics.orderIndex })
        .from(topics);
      const maxOrder =
        allTopics.length === 0
          ? 0
          : Math.max(...allTopics.map((t) => t.orderIndex));
      targetOrderIndex = maxOrder + 1;
    }

    // ── Всё в одной транзакции ───────────────────────────────────────────
    // Если что-то упадёт — БД откатится к состоянию до импорта.
    // Тема не пропадёт, даже если перезаписывали существующую.
    const result = await db.transaction(async (tx) => {
      // 1. Перезапись: удалить старую тему (каскадно снесутся вопросы и ответы)
      if (existingTopic) {
        await tx.delete(topics).where(eq(topics.id, existingTopic.id));
      }

      // 2. Создать новую тему с правильным номером
      const [newTopic] = await tx
        .insert(topics)
        .values({ title: parsed.title, orderIndex: targetOrderIndex })
        .returning();

      // 3. Создать вопросы и ответы
      for (const q of parsed.questions) {
        const [newQuestion] = await tx
          .insert(questions)
          .values({
            topicId: newTopic.id,
            text: q.text,
            imageUrl: q.imageUrl,
            description: q.description,
          })
          .returning();

        if (q.answers.length > 0) {
          await tx.insert(answers).values(
            q.answers.map((a) => ({
              questionId: newQuestion.id,
              text: a.text,
              isCorrect: a.isCorrect,
            }))
          );
        }
      }

      return newTopic;
    });

    return NextResponse.json({
      ok: true,
      topicId: result.id,
      title: result.title,
      orderIndex: result.orderIndex,
      questionsImported: parsed.questions.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка импорта";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}