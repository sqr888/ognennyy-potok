"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

// ─── Types ────────────────────────────────────────────────────────────────
interface Topic {
  id: number;
  title: string;
  orderIndex: number;
}

interface AnswerOption {
  id: number;
  text: string;
}

interface QuestionData {
  id: number;
  topicId: number;
  text: string;
  imageUrl: string | null;
  description: string | null;
  topicTitle: string;
  topicOrder: number;
  answers: AnswerOption[];
  correctAnswerId: number | null;
}

interface QuestionRecord {
  question: QuestionData;
  selectedAnswerId: number;
  isCorrect: boolean;
}

type Phase = "selectTopic" | "loading" | "error" | "question" | "finished";

/** Fisher–Yates shuffle */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function TrainScreen() {
  const [phase, setPhase] = useState<Phase>("selectTopic");

  // Список тем
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState("");

  // Выбранная тема (null = все темы)
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [selectedTopicTitle, setSelectedTopicTitle] = useState<string>("Все темы");

  // Прохождение
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [records, setRecords] = useState<QuestionRecord[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  // ── Загрузка тем ───────────────────────────────────────────────────────
  const loadTopics = useCallback(async () => {
    setTopicsLoading(true);
    setTopicsError("");
    try {
      const res = await fetch("/api/topics");
      if (!res.ok) {
        setTopicsError("Не удалось загрузить список тем");
        return;
      }
      const data = await res.json();
      const list: Topic[] = Array.isArray(data) ? data : data.topics ?? [];
      setTopics(
        [...list].sort((a, b) => a.orderIndex - b.orderIndex)
      );
    } catch {
      setTopicsError("Ошибка соединения");
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  // ── Старт тренировки с выбранной темой ─────────────────────────────────
  const startTraining = useCallback(
    async (topicId: number | null, topicTitle: string) => {
      setSelectedTopicId(topicId);
      setSelectedTopicTitle(topicTitle);
      setPhase("loading");
      setErrorMsg("");
      try {
        const url =
          topicId !== null
            ? `/api/train/start?topicId=${topicId}`
            : "/api/train/start";
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error ?? "Ошибка запуска");
          setPhase("error");
          return;
        }

        const shuffled: QuestionData[] = shuffle([...data.questions]);
        setQuestions(shuffled);
        setCurrentIndex(0);
        setRecords([]);
        setSelectedAnswerId(null);
        setCorrectCount(0);
        setPhase("question");
      } catch {
        setErrorMsg("Ошибка соединения с сервером");
        setPhase("error");
      }
    },
    []
  );

  // ── Обработка ответа и переход ─────────────────────────────────────────
  const handleSubmitAnswer = () => {
    if (selectedAnswerId === null) return;
    const q = questions[currentIndex];
    const isCorrect = selectedAnswerId === q.correctAnswerId;

    if (isCorrect) setCorrectCount((c) => c + 1);
    setRecords((prev) => [
      ...prev,
      { question: q, selectedAnswerId, isCorrect },
    ]);
  };

  const handleNextQuestion = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      setPhase("finished");
    } else {
      setCurrentIndex(nextIndex);
      setSelectedAnswerId(null);
    }
  };

  // ── Экран выбора темы ──────────────────────────────────────────────────
  if (phase === "selectTopic") {
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">
            ← На главную
          </Link>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 mb-1">
            Тренировка по вопросам
          </h1>
          <p className="text-slate-500 text-sm">
            Выберите главу или проходите все вопросы подряд
          </p>
        </div>

        {topicsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Загрузка тем…</p>
          </div>
        ) : topicsError ? (
          <div className="card text-center py-8">
            <p className="text-red-500 mb-4">{topicsError}</p>
            <button
              onClick={loadTopics}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors"
            >
              Повторить
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => startTraining(null, "Все темы")}
              className="w-full text-left bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-5 py-4 transition-colors shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Все темы</p>
                  <p className="text-emerald-100 text-xs mt-0.5">
                    Пройти все вопросы подряд
                  </p>
                </div>
                <span className="text-2xl">🎯</span>
              </div>
            </button>

            <div className="mt-2 mb-1 text-xs uppercase tracking-wider text-slate-400 px-1">
              Или выберите главу
            </div>

            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => startTraining(t.id, t.title)}
                className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold">
                    {t.orderIndex}
                  </span>
                  <span className="font-medium text-slate-800">
                    {t.title}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-500">Загрузка вопросов…</p>
          <p className="text-slate-400 text-xs mt-1">{selectedTopicTitle}</p>
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full card text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Невозможно начать тренировку
          </h2>
          <p className="text-slate-500 mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => startTraining(selectedTopicId, selectedTopicTitle)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-5 rounded-lg transition-colors"
            >
              Попробовать снова
            </button>
            <button
              onClick={() => setPhase("selectTopic")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-5 rounded-lg transition-colors"
            >
              Выбрать другую тему
            </button>
            <Link
              href="/"
              className="text-slate-400 hover:text-slate-600 font-medium py-2 px-5 rounded-lg transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Finished ───────────────────────────────────────────────────────────
  if (phase === "finished") {
    const total = records.length;
    const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const emoji = pct >= 70 ? "🎉" : "📚";

    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto">
        <div className="card mb-6 text-center">
          <div className="text-6xl mb-4">{emoji}</div>
          <p className="text-xs uppercase tracking-wider text-emerald-600 font-semibold mb-2">
            {selectedTopicTitle}
          </p>
          <h2 className="text-2xl font-bold text-slate-800 mb-1">
            Тренировка завершена!
          </h2>
          <p className="text-4xl font-bold text-emerald-600 mb-2">
            {correctCount} / {total}
          </p>
          <p className="text-slate-500 mb-6">Правильных ответов: {pct}%</p>

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() =>
                startTraining(selectedTopicId, selectedTopicTitle)
              }
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Пройти снова
            </button>
            <button
              onClick={() => setPhase("selectTopic")}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Выбрать другую тему
            </button>
            <Link
              href="/"
              className="text-slate-400 hover:text-slate-600 font-medium py-2 px-6 rounded-lg transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-700 mb-4">
          Разбор ответов
        </h3>
        <div className="flex flex-col gap-4">
          {records.map((record, idx) => {
            const { question, selectedAnswerId: sel, isCorrect } = record;
            return (
              <div key={`${question.id}-${idx}`} className="card">
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCorrect
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isCorrect ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 mb-1">
                      Вопрос {idx + 1} · {question.topicTitle}
                    </p>
                    <p className="font-medium text-slate-800">
                      {question.text}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pl-10">
                  {question.answers.map((ans) => {
                    let cls = "answer-option";
                    if (ans.id === question.correctAnswerId)
                      cls += " correct";
                    else if (ans.id === sel && !isCorrect)
                      cls += " incorrect";
                    return (
                      <div
                        key={ans.id}
                        className={cls}
                        style={{ cursor: "default" }}
                      >
                        <span>{ans.text}</span>
                        {ans.id === question.correctAnswerId && (
                          <span className="ml-auto text-green-600 font-bold text-sm">
                            ✓
                          </span>
                        )}
                        {ans.id === sel && !isCorrect && (
                          <span className="ml-auto text-red-600 font-bold text-sm">
                            ✗
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {question.description && (
                  <div className="mt-3 pl-10 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                    💡 {question.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Question ───────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIndex];
  const answered = selectedAnswerId !== null;
  const isCorrect =
    answered && selectedAnswerId === currentQuestion.correctAnswerId;

  const getAnswerClass = (answerId: number): string => {
    if (!answered) {
      return selectedAnswerId === answerId
        ? "answer-option selected"
        : "answer-option";
    }
    if (answerId === currentQuestion.correctAnswerId)
      return "answer-option correct";
    if (answerId === selectedAnswerId) return "answer-option incorrect";
    return "answer-option";
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link href="/" className="text-slate-400 hover:text-slate-600 text-sm">
          ← На главную
        </Link>
        <span className="text-sm font-medium text-slate-500">
          Вопрос {currentIndex + 1} из {questions.length}
        </span>
      </div>

      <div className="w-full bg-slate-200 rounded-full h-2 mb-6">
        <div
          className="bg-emerald-600 h-2 rounded-full transition-all"
          style={{
            width: `${
              ((currentIndex + (answered ? 1 : 0)) / questions.length) * 100
            }%`,
          }}
        />
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs uppercase tracking-wider text-emerald-600 font-semibold">
          {currentQuestion.topicTitle}
        </p>
        {selectedTopicId === null && (
          <button
            onClick={() => setPhase("selectTopic")}
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Сменить тему
          </button>
        )}
      </div>

      <div className="card mb-4">
        <h2 className="text-xl font-semibold text-slate-800 mb-5 leading-snug">
          {currentQuestion.text}
        </h2>

        {currentQuestion.imageUrl && (
          <div className="mb-5 flex justify-center">
            <img
              src={currentQuestion.imageUrl}
              alt="Иллюстрация к вопросу"
              className="max-w-full max-h-64 object-contain rounded-lg border border-slate-200"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          {currentQuestion.answers.map((ans) => (
            <button
              key={ans.id}
              className={getAnswerClass(ans.id)}
              onClick={() => {
                if (!answered) setSelectedAnswerId(ans.id);
              }}
              disabled={answered}
              type="button"
            >
              <input
                type="radio"
                readOnly
                checked={selectedAnswerId === ans.id}
                className="mt-0.5"
              />
              <span>{ans.text}</span>
            </button>
          ))}
        </div>

        {answered && currentQuestion.description && (
          <div className="mt-5 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-700">
            <span className="font-semibold text-blue-700">Пояснение:</span>{" "}
            {currentQuestion.description}
          </div>
        )}

        {answered && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm font-medium ${
              isCorrect
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {isCorrect ? "✅ Верно!" : "❌ Неверно!"}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        {!answered ? (
          <button
            onClick={handleSubmitAnswer}
            disabled={selectedAnswerId === null}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            Ответить
          </button>
        ) : (
          <button
            onClick={handleNextQuestion}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
          >
            {currentIndex + 1 >= questions.length
              ? "Завершить"
              : "Следующий вопрос →"}
          </button>
        )}
      </div>
    </div>
  );
}