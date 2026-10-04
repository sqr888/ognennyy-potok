"use client";

import { useEffect, useState, useCallback } from "react";

interface Summary {
  totalAttempts: number;
  finishedAttempts: number;
  passedCount: number;
  averagePercent: number;
  averageCorrect: number;
  averageTotal: number;
  bestScore: number | null;
  worstScore: number | null;
}

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

interface StatsResponse {
  mode: string;
  summary: Summary;
  byTopic: TopicStat[];
  hardestQuestions: HardestQuestion[];
}

type ModeFilter = "test" | "exam" | "train";

export default function StatsTab() {
  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);
  const [mode, setMode] = useState<ModeFilter>(() => {
    if (typeof window === "undefined") return "exam";
    const saved = window.localStorage.getItem("stats-mode");
    return saved === "exam" || saved === "train" || saved === "test"
      ? (saved as ModeFilter)
      : "exam";
  });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/stats?mode=${mode}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Не удалось загрузить статистику");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("stats-mode", mode);
  }, [mode]);

  const handleResetStats = async () => {
    if (
      !confirm(
        "Полностью удалить всю статистику по попыткам? Действие необратимо."
      )
    ) {
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin/stats/reset", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Не удалось сбросить статистику");
        return;
      }
      await fetchStats();
    } catch {
      alert("Ошибка соединения");
    } finally {
      setResetting(false);
    }
  };

  const Header = (
    <div className="flex items-center justify-between mb-6">
      <h2 className="text-xl font-bold text-slate-800">Статистика</h2>
      <div className="flex items-center gap-3">
        <button
          onClick={handleResetStats}
          disabled={resetting}
          className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
        >
          {resetting ? "Сброс…" : "Сбросить статистику"}
        </button>
        <button
          onClick={fetchStats}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Обновить
        </button>
      </div>
    </div>
  );

  const ModeTabs = (
    <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
      {(
        [
          { key: "exam", label: "Экзамен" },
          { key: "test", label: "Тест" },
          { key: "train", label: "Тренировка" },
        ] as { key: ModeFilter; label: string }[]
      ).map((t) => (
        <button
          key={t.key}
          onClick={() => setMode(t.key)}
          className={`py-2 px-4 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
            mode === t.key
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div>
        {Header}
        {ModeTabs}
        <div className="text-slate-400 text-center py-8">Загрузка…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {Header}
        {ModeTabs}
        <div className="card text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchStats}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, byTopic, hardestQuestions } = data;

  if (summary.totalAttempts === 0) {
    const modeLabel = (
      {
        test: "попытки в режиме «Тест»",
        exam: "попытки в режиме «Экзамен»",
        train: "завершённой тренировки",
      } as Record<ModeFilter, string>
    )[mode];

    return (
      <div>
        {Header}
        {ModeTabs}
        <div className="card text-center py-12 text-slate-400">
          Пока нет {modeLabel}.
        </div>
      </div>
    );
  }

  const passRate =
    summary.finishedAttempts > 0
      ? Math.round((summary.passedCount / summary.finishedAttempts) * 100)
      : 0;

  const showPassedCard = mode !== "train";
  const gridClass = showPassedCard
    ? "grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
    : "grid grid-cols-2 md:grid-cols-3 gap-3 mb-8";

  const avgTotalLabel =
    summary.averageTotal > 0
      ? `≈ ${summary.averageCorrect} из ${Math.round(summary.averageTotal)}`
      : `≈ ${summary.averageCorrect}`;

  const bestWorstHint =
    summary.averageTotal > 0
      ? `из ${Math.round(summary.averageTotal)}`
      : "из 14";

  return (
    <div>
      {Header}
      {ModeTabs}

      <div className={gridClass}>
        <SummaryCard
          label="Всего попыток"
          value={summary.totalAttempts}
          hint={`завершено: ${summary.finishedAttempts}`}
        />
        <SummaryCard
          label="Средний результат"
          value={`${summary.averagePercent}%`}
          hint={avgTotalLabel}
          accent="blue"
        />
        {showPassedCard && (
          <SummaryCard
            label="Сдали тест"
            value={`${summary.passedCount}`}
            hint={`${passRate}% от завершённых`}
            accent="green"
          />
        )}
        <SummaryCard
          label="Лучший / худший"
          value={`${summary.bestScore ?? 0} / ${summary.worstScore ?? 0}`}
          hint={bestWorstHint}
        />
      </div>

      <section className="mb-8">
        <h3 className="text-lg font-semibold text-slate-700 mb-3">
          Ошибки по темам
        </h3>
        {byTopic.length === 0 ? (
          <div className="card text-center py-8 text-slate-400">
            Нет данных по темам
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2 font-medium">Тема</th>
                  <th className="px-4 py-2 font-medium text-right w-24">
                    Ответов
                  </th>
                  <th className="px-4 py-2 font-medium text-right w-28">
                    Ошибок
                  </th>
                  <th className="px-4 py-2 font-medium text-right w-24">
                    % ошибок
                  </th>
                  <th className="px-4 py-2 font-medium w-40"> </th>
                </tr>
              </thead>
              <tbody>
                {byTopic.map((t) => (
                  <tr
                    key={t.topicId}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-2 text-slate-800">
                      {t.topicOrder}. {t.topicTitle}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {t.totalAnswers}
                    </td>
                    <td className="px-4 py-2 text-right text-slate-600">
                      {t.incorrectAnswers}
                    </td>
                    <td className="px-4 py-2 text-right font-medium">
                      <span className={errorColor(t.errorRate)}>
                        {t.errorRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <ErrorBar value={t.errorRate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className="text-lg font-semibold text-slate-700 mb-3">
          Самые сложные вопросы
        </h3>
        {hardestQuestions.length === 0 ? (
          <div className="card text-center py-8 text-slate-400">
            Пока никто не ошибался — либо вопросов ещё не проходили.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hardestQuestions.map((q, idx) => (
              <div
                key={q.questionId}
                className="bg-white border border-slate-200 rounded-lg p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-400 mb-1">
                      {q.topicTitle}
                    </p>
                    <p className="text-slate-800 mb-2">{q.questionText}</p>
                    <div className="flex items-center gap-4 flex-wrap text-xs text-slate-500">
                      <span>
                        Ошибок:{" "}
                        <span
                          className={`font-semibold ${errorColor(q.errorRate)}`}
                        >
                          {q.incorrectAnswers} из {q.totalAnswers} (
                          {q.errorRate.toFixed(1)}%)
                        </span>
                      </span>
                      <div className="flex-1 min-w-[120px] max-w-xs">
                        <ErrorBar value={q.errorRate} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  accent = "slate",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: "slate" | "blue" | "green";
}) {
  const colorMap = {
    slate: "text-slate-800",
    blue: "text-blue-600",
    green: "text-green-600",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold ${colorMap[accent]}`}>{value}</p>
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
}

function ErrorBar({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const color =
    clamped < 20
      ? "bg-green-500"
      : clamped < 40
      ? "bg-yellow-500"
      : clamped < 60
      ? "bg-orange-500"
      : "bg-red-500";
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function errorColor(rate: number): string {
  if (rate < 20) return "text-green-600";
  if (rate < 40) return "text-yellow-600";
  if (rate < 60) return "text-orange-600";
  return "text-red-600";
}