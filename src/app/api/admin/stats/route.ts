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

interface TopicTrainStat {
  topicId: number;
  topicTitle: string;
  topicOrder: number;
  attemptsCount: number;
  totalAnswers: number;
  totalCorrect: number;
  totalIncorrect: number;
  averagePercent: number;
  /** Лучшая попытка: количество правильных ответов */
  bestCorrect: number | null;
  /** Худшая попытка: количество правильных ответов */
  worstCorrect: number | null;
  lastAnswers: number | null;
  lastIncorrect: number | null;
  lastPercent: number | null;
  lastAt: string | null;
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
      modeParam === "test" || modeParam === "exam" || modeParam === "train"
        ? modeParam
        : null;

    // ── Сводка по попыткам (общая) ────────────────────────────────────────
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

    const modeFilter = mode ? sql`AND att.mode = ${mode}` : sql``;

    // ── Общая статистика по темам (для test/exam) ─────────────────────────
    let byTopic: TopicStat[] = [];

    if (mode !== "train") {
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

      byTopic = (topicRows.rows as Array<{
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
    }

    // ── Тренировка: статистика по темам (последняя + MAX/MIN) ─────────────
    let byTopicTrain: TopicTrainStat[] = [];

    if (mode === "train") {
      const trainRows = await db.execute(sql`
        WITH per_attempt_topic AS (
          SELECT
            att.id            AS attempt_id,
            att.created_at    AS created_at,
            t.id              AS topic_id,
            t.title           AS topic_title,
            t.order_index     AS topic_order,
            COUNT(*)::int     AS answered,
            SUM(CASE WHEN (a->>'isCorrect')::boolean = false THEN 1 ELSE 0 END)::int
                              AS incorrect
          FROM attempts att
          CROSS JOIN LATERAL jsonb_array_elements(att.answers) AS a
          JOIN questions q ON q.id = (a->>'questionId')::int
          JOIN topics    t ON t.id = q.topic_id
          WHERE att.finished = true
            AND att.mode = 'train'
            AND jsonb_array_length(att.answers) = att.total_count
          GROUP BY att.id, att.created_at, t.id, t.title, t.order_index
        ),
        with_correct AS (
          SELECT
            *,
            (answered - incorrect) AS correct
          FROM per_attempt_topic
        ),
        agg AS (
          SELECT
            topic_id,
            topic_title,
            topic_order,
            COUNT(*)::int                  AS attempts_count,
            SUM(answered)::int             AS total_answers,
            SUM(incorrect)::int            AS total_incorrect,
            SUM(correct)::int              AS total_correct,
            MAX(correct)::int              AS best_correct,
            MIN(correct)::int              AS worst_correct
          FROM with_correct
          GROUP BY topic_id, topic_title, topic_order
        ),
        last_attempt AS (
          SELECT DISTINCT ON (topic_id)
            topic_id,
            answered   AS last_answered,
            incorrect  AS last_incorrect,
            created_at AS last_at
          FROM with_correct
          ORDER BY topic_id, created_at DESC, attempt_id DESC
        )
        SELECT
          agg.topic_id,
          agg.topic_title,
          agg.topic_order,
          agg.attempts_count,
          agg.total_answers,
          agg.total_incorrect,
          agg.total_correct,
          agg.best_correct,
          agg.worst_correct,
          l.last_answered,
          l.last_incorrect,
          l.last_at
        FROM agg
        LEFT JOIN last_attempt l ON l.topic_id = agg.topic_id
        ORDER BY agg.topic_order ASC
      `);

      byTopicTrain = (trainRows.rows as Array<{
        topic_id: number;
        topic_title: string;
        topic_order: number;
        attempts_count: number;
        total_answers: number;
        total_incorrect: number;
        total_correct: number;
        best_correct: number;
        worst_correct: number;
        last_answered: number | null;
        last_incorrect: number | null;
        last_at: string | Date | null;
      }>).map((r) => {
        const totalAnswers = Number(r.total_answers ?? 0);
        const totalCorrect = Number(r.total_correct ?? 0);
        const averagePercent =
          totalAnswers > 0
            ? Math.round((totalCorrect / totalAnswers) * 100)
            : 0;

        const lastAnswers =
          r.last_answered === null ? null : Number(r.last_answered);
        const lastIncorrect =
          r.last_incorrect === null ? null : Number(r.last_incorrect);
        const lastPercent =
          lastAnswers && lastAnswers > 0 && lastIncorrect !== null
            ? Math.round((lastIncorrect / lastAnswers) * 100)
            : null;

        return {
          topicId: r.topic_id,
          topicTitle: r.topic_title,
          topicOrder: r.topic_order,
          attemptsCount: r.attempts_count,
          totalAnswers,
          totalCorrect,
          totalIncorrect: Number(r.total_incorrect ?? 0),
          averagePercent,
          bestCorrect:
            r.best_correct === null ? null : Number(r.best_correct),
          worstCorrect:
            r.worst_correct === null ? null : Number(r.worst_correct),
          lastAnswers,
          lastIncorrect,
          lastPercent,
          lastAt: r.last_at ? new Date(r.last_at).toISOString() : null,
        };
      });
    }

    // ── Топ самых ошибочных вопросов ──────────────────────────────────────
    // Сквозная статистика по всем режимам (test, exam, train) — не зависит
    // от выбранной вкладки. Фильтр mode здесь НЕ применяется.
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
      byTopicTrain,
      hardestQuestions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Ошибка сервера";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}