import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { attempts } from "@/db/schema";
import { isAdminAuthenticated } from "@/lib/auth";
import { eq, sql } from "drizzle-orm";

interface TopicStat {
  topicId: number;
  topicTitle: string;
  topicOrder: number;
  totalAnswers: number;
  incorrectAnswers: number;
  errorRate: number;
}

interface HardestQuestion {
  questionId: number;
  questionText: string;
  topicTitle: string;
  totalAnswers: number;
  incorrectAnswers: number;
  errorRate: number;
}

type Mode = "test" | "exam" | "train";

export async function GET(req: NextRequest) {
  const ok = await isAdminAuthenticated();
  if (!ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const modeParam = req.nextUrl.searchParams.get("mode");
    const mode: Mode | null =
      modeParam === "test" ||
      modeParam === "exam" ||
      modeParam === "train"
        ? modeParam
        : null;

    // ── 1. Сводка по попыткам ─────────────────────────────────────────────
    const summaryBase = db
      .select({
        totalAttempts: sql<number>`COUNT(*)::int`,
        finishedAttempts: sql<number>`COUNT(*) FILTER (WHERE ${attempts.finished} = true)::int`,
        avgCorrect: sql<number | null>`AVG(${attempts.correctCount}) FILTER (WHERE ${attempts.finished} = true)`,
        avgTotal: sql<number | null>`AVG(${attempts.totalCount}) FILTER (WHERE ${attempts.finished} = true)`,
        bestScore: sql<number | null>`MAX(${attempts.correctCount}) FILTER (WHERE ${attempts.finished} = true)`,
        worstScore: sql<number | null>`MIN(${attempts.correctCount}) FILTER (WHERE ${attempts.finished} = true)`,
        passedCount: sql<number>`COUNT(*) FILTER (WHERE ${attempts.finished} = true AND ${attempts.correctCount} >= 12 AND ${attempts.mode} <> 'train')::int`,
      })
      .from(attempts);

    const summaryRows = mode
      ? await summaryBase.where(eq(attempts.mode, mode))
      : await summaryBase;
    const summaryRow = summaryRows[0];

    const avgCorrect = Number(summaryRow?.avgCorrect ?? 0);
    const avgTotal = Number(summaryRow?.avgTotal ?? 0);
    const averagePercent =
      avgTotal > 0 ? Math.round((avgCorrect / avgTotal) * 100) : 0;

    // Общий фрагмент WHERE для raw SQL — с фильтром по режиму, если задан
    const modeFilter = mode
      ? sql`AND att.mode = ${mode}`
      : sql``;

    // ── 2. Статистика по темам ────────────────────────────────────────────
    const topicRows = await db.execute(sql`
      SELECT
        t.id            AS topic_id,
        t.title         AS topic_title,
        t.order_index   AS topic_order,
        COUNT(*)::int   AS total_answers,
        SUM(CASE WHEN (a->>'isCorrect')::boolean = false THEN 1 ELSE 0 END)::int
                        AS incorrect_answers
      FROM attempts att
      CROSS JOIN LATERAL jsonb_array_elements(att.answers) AS a
      JOIN questions q ON q.id = (a->>'questionId')::int
      JOIN topics    t ON t.id = q.topic_id
      WHERE att.finished = true
        AND jsonb_array_length(att.answers) > 0
        ${modeFilter}
      GROUP BY t.id, t.title, t.order_index
      ORDER BY t.order_index ASC
    `);

    const byTopic: TopicStat[] = (topicRows.rows as Array<{
      topic_id: number;
      topic_title: string;
      topic_order: number;
      total_answers: number;
      incorrect_answers: number;
    }>).map((r) => ({
      topicId: r.topic_id,
      topicTitle: r.topic_title,
      topicOrder: r.topic_order,
      totalAnswers: r.total_answers,
      incorrectAnswers: r.incorrect_answers,
      errorRate:
        r.total_answers > 0
          ? Math.round((r.incorrect_answers / r.total_answers) * 1000) / 10
          : 0,
    }));

    // ── 3. Топ самых ошибочных вопросов ───────────────────────────────────
    const hardestRows = await db.execute(sql`
      SELECT
        q.id            AS question_id,
        q.text          AS question_text,
        t.title         AS topic_title,
        COUNT(*)::int   AS total_answers,
        SUM(CASE WHEN (a->>'isCorrect')::boolean = false THEN 1 ELSE 0 END)::int
                        AS incorrect_answers
      FROM attempts att
      CROSS JOIN LATERAL jsonb_array_elements(att.answers) AS a
      JOIN questions q ON q.id = (a->>'questionId')::int
      JOIN topics    t ON t.id = q.topic_id
      WHERE att.finished = true
        AND jsonb_array_length(att.answers) > 0
        ${modeFilter}
      GROUP BY q.id, q.text, t.title
      HAVING SUM(CASE WHEN (a->>'isCorrect')::boolean = false THEN 1 ELSE 0 END) > 0
      ORDER BY incorrect_answers DESC, total_answers DESC
      LIMIT 10
    `);

    const hardestQuestions: HardestQuestion[] = (hardestRows.rows as Array<{
      question_id: number;
      question_text: string;
      topic_title: string;
      total_answers: number;
      incorrect_answers: number;
    }>).map((r) => ({
      questionId: r.question_id,
      questionText: r.question_text,
      topicTitle: r.topic_title,
      totalAnswers: r.total_answers,
      incorrectAnswers: r.incorrect_answers,
      errorRate:
        r.total_answers > 0
          ? Math.round((r.incorrect_answers / r.total_answers) * 1000) / 10
          : 0,
    }));

    return NextResponse.json({
      mode: mode ?? "all",
      summary: {
        totalAttempts: summaryRow?.totalAttempts ?? 0,
        finishedAttempts: summaryRow?.finishedAttempts ?? 0,
        passedCount: summaryRow?.passedCount ?? 0,
        averagePercent,
        averageCorrect: avgCorrect > 0 ? Math.round(avgCorrect * 10) / 10 : 0,
        averageTotal: avgTotal > 0 ? Math.round(avgTotal * 10) / 10 : 0,
        bestScore: summaryRow?.bestScore ?? null,
        worstScore: summaryRow?.worstScore ?? null,
      },
      byTopic,
      hardestQuestions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}