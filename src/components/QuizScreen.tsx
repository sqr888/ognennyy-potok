"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  correctAnswerId?: number | null;
}

interface AnswerResult {
  isCorrect: boolean;
  correctAnswerId: number;
  description: string | null;
}

interface QuestionRecord {
  question: QuestionData;
  selectedAnswerId: number;
  result: AnswerResult;
}

type Phase = "selectTopic" | "loading" | "error" | "question" | "finished";

interface QuizScreenProps {
  startUrl: string;
  answerUrl?: string;
  finishUrl?: string;
  passingThreshold?: number;
  resultTitle?: string;
  accent?: "blue" | "emerald";
  showTopicPicker?: boolean;
  homeHref?: string;
  /** Лимит времени в секундах. Показывает таймер и авто-завершает по истечении. */
  timeLimit?: number;
  /** Экзамен-режим: без подсветки и пояснений во время прохождения. */
  hideFeedback?: boolean;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 90 → "01:30" */
function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function QuizScreen({
  startUrl,
  answerUrl,
  finishUrl,
  passingThreshold,
  resultTitle,
  accent = "blue",
  showTopicPicker = false,
  homeHref = "/",
  timeLimit,
  hideFeedback = false,
}: QuizScreenProps) {
  const [phase, setPhase] = useState<Phase>(
    showTopicPicker ? "selectTopic" : "loading"
  );
  const [attemptId, setAttemptId] = useState<number | null>(null);

  // Topic picker
  const [topics, setTopics] = useState<Topic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsError, setTopicsError] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<{
    id: number | null;
    title: string;
  }>({ id: null, title: "Все темы" });

  // Quiz
  const [errorMsg, setErrorMsg] = useState("");
  const [questions, setQuestions] = useState<QuestionData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [records, setRecords] = useState<QuestionRecord[]>([]);
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Timer
  const startTimeRef = useRef<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Accent classes
  const accentBg =
    accent === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-blue-600 hover:bg-blue-700";
  const accentBgSolid = accent === "emerald" ? "bg-emerald-600" : "bg-blue-600";
  const accentText = accent === "emerald" ? "text-emerald-600" : "text-blue-600";
  const accentBorder =
    accent === "emerald" ? "border-emerald-600" : "border-blue-600";

  // Порог сдачи — единая точка
  const hasThreshold = passingThreshold !== undefined;

  const timeLeft =
    timeLimit !== undefined ? Math.max(0, timeLimit - elapsedSeconds) : 0;
  
  // Подтверждение выхода из незавершённой попытки
  const confirmExit = (): boolean => {
    if (phase === "question" && records.length > 0) {
      return confirm(
        "Выйти? Прогресс текущей попытки будет потерян."
      );
    }
    return true;
  };

  // ── Load topics ───────────────────────────────────────────────────────
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
      setTopics([...list].sort((a, b) => a.orderIndex - b.orderIndex));
    } catch {
      setTopicsError("Ошибка соединения");
    } finally {
      setTopicsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showTopicPicker) loadTopics();
  }, [showTopicPicker, loadTopics]);

  // ── Finish (для авто-завершения по таймеру и после последнего вопроса) ──
    const finishQuiz = useCallback(async () => {
    if (finishUrl) {
      try {
        if (attemptId) {
          // Тест / экзамен — финализируем запись на сервере
          await fetch(finishUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
          });
        } else if (records.length > 0) {
          // Тренировка — отправляем полную сводку
          const payload = {
            mode: "train",
            records: records.map((r) => ({
              questionId: r.question.id,
              answeredId: r.selectedAnswerId,
              correctAnswerId: r.result.correctAnswerId,
              isCorrect: r.result.isCorrect,
            })),
          };
          await fetch(finishUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        }
      } catch {
        // не критично — не блокируем UI
      }
    }
    setPhase("finished");
  }, [finishUrl, attemptId, records]);

  // ── Start ─────────────────────────────────────────────────────────────
  const startQuiz = useCallback(
    async (topicId?: number | null, topicTitle?: string) => {
      if (topicId !== undefined && topicTitle !== undefined) {
        setSelectedTopic({ id: topicId, title: topicTitle });
      }

      const url =
        showTopicPicker && topicId != null
          ? `${startUrl}?topicId=${topicId}`
          : startUrl;

      setPhase("loading");
      setErrorMsg("");
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error ?? "Ошибка запуска");
          setPhase("error");
          return;
        }

        const list: QuestionData[] = showTopicPicker
          ? shuffle([...data.questions])
          : data.questions;

        setAttemptId(data.attemptId ?? null);
        setQuestions(list);
        setCurrentIndex(0);
        setRecords([]);
        setSelectedAnswerId(null);
        setAnswerResult(null);
        startTimeRef.current = Date.now();
        setElapsedSeconds(0);
        setPhase("question");
      } catch {
        setErrorMsg("Ошибка соединения с сервером");
        setPhase("error");
      }
    },
    [startUrl, showTopicPicker]
  );

  // Guard от двойного запуска в React StrictMode (dev-режим)
  const startedOnce = useRef(false);

  useEffect(() => {
    if (showTopicPicker) return;
    if (startedOnce.current) return;
    startedOnce.current = true;
    startQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Таймер ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "question") return;
    if (startTimeRef.current === null) return;

    const interval = setInterval(() => {
      if (startTimeRef.current === null) return;
      const elapsed = Math.floor(
        (Date.now() - startTimeRef.current) / 1000
      );
      setElapsedSeconds(elapsed);
      if (timeLimit !== undefined && elapsed >= timeLimit) {
        clearInterval(interval);
        finishQuiz();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, timeLimit, finishQuiz]);

  // ── Submit answer ─────────────────────────────────────────────────────
  const handleSubmitAnswer = async () => {
    if (selectedAnswerId === null || submitting) return;
    if (!hideFeedback && answerResult !== null) return;

    const currentQuestion = questions[currentIndex];
    const currentAnswerId = selectedAnswerId;

    // Client-side check
    if (!answerUrl) {
      const correctId = currentQuestion.correctAnswerId ?? -1;
      const result: AnswerResult = {
        isCorrect: currentAnswerId === correctId,
        correctAnswerId: correctId,
        description: currentQuestion.description,
      };
      const newRecords = [
        ...records,
        {
          question: currentQuestion,
          selectedAnswerId: currentAnswerId,
          result,
        },
      ];
      setRecords(newRecords);

      if (hideFeedback) {
        advanceAfterAnswer(newRecords);
      } else {
        setAnswerResult(result);
      }
      return;
    }

    // Server-side check
    setSubmitting(true);
    try {
      const res = await fetch(answerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId: currentQuestion.id,
          answerId: currentAnswerId,
        }),
      });
      const data: AnswerResult = await res.json();
      const newRecords = [
        ...records,
        {
          question: currentQuestion,
          selectedAnswerId: currentAnswerId,
          result: data,
        },
      ];
      setRecords(newRecords);

      if (hideFeedback) {
        advanceAfterAnswer(newRecords);
      } else {
        setAnswerResult(data);
      }
    } catch {
      alert("Ошибка соединения");
    } finally {
      setSubmitting(false);
    }
  };

  const advanceAfterAnswer = (currentRecords: QuestionRecord[]) => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      finishQuiz();
    } else {
      setCurrentIndex(nextIndex);
      setSelectedAnswerId(null);
      setAnswerResult(null);
    }
  };

  const handleNextQuestion = () => {
    const nextIndex = currentIndex + 1;
    if (nextIndex >= questions.length) {
      finishQuiz();
    } else {
      setCurrentIndex(nextIndex);
      setSelectedAnswerId(null);
      setAnswerResult(null);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div
            className={`animate-spin w-10 h-10 border-4 ${accentBorder} border-t-transparent rounded-full mx-auto mb-4`}
          />
          <p className="text-slate-500">Загрузка…</p>
        </div>
      </div>
    );
  }

  // ── Topic picker ──────────────────────────────────────────────────────
  if (phase === "selectTopic") {
    return (
      <div className="min-h-screen p-4 md:p-8 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href={homeHref} className="text-slate-400 hover:text-slate-600 text-sm">
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
            <div
              className={`animate-spin w-8 h-8 border-4 ${accentBorder} border-t-transparent rounded-full mx-auto mb-3`}
            />
            <p className="text-slate-400 text-sm">Загрузка тем…</p>
          </div>
        ) : topicsError ? (
          <div className="card text-center py-8">
            <p className="text-red-500 mb-4">{topicsError}</p>
            <button
              onClick={loadTopics}
              className={`${accentBg} text-white font-medium py-2 px-5 rounded-lg text-sm transition-colors`}
            >
              Повторить
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => startQuiz(null, "Все темы")}
              className={`w-full text-left ${accentBgSolid} hover:opacity-90 text-white rounded-lg px-5 py-4 transition-colors shadow`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Все темы</p>
                  <p className="text-white/80 text-xs mt-0.5">
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
                onClick={() => startQuiz(t.id, t.title)}
                className="w-full text-left bg-white hover:bg-slate-50 border border-slate-200 rounded-lg px-5 py-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold">
                    {t.orderIndex}
                  </span>
                  <span className="font-medium text-slate-800">{t.title}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────
  if (phase === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full card text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">
            Невозможно начать
          </h2>
          <p className="text-slate-500 mb-6">{errorMsg}</p>
          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => startQuiz(selectedTopic.id, selectedTopic.title)}
              className={`${accentBg} text-white font-medium py-2 px-5 rounded-lg transition-colors`}
            >
              Попробовать снова
            </button>
            {showTopicPicker && (
              <button
                onClick={() => setPhase("selectTopic")}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-5 rounded-lg transition-colors"
              >
                Выбрать другую тему
              </button>
            )}
            <Link
              href={homeHref}
              className="text-slate-400 hover:text-slate-600 font-medium py-2 px-5 rounded-lg transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Finished ──────────────────────────────────────────────────────────
  if (phase === "finished") {
    const totalCount = records.length;
    const correctCount = records.filter((r) => r.result.isCorrect).length;
    const pct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

    const passed = hasThreshold && correctCount >= passingThreshold;

    const heading = hasThreshold
      ? passed
        ? "Тест сдан!"
        : "Тест не сдан"
      : resultTitle ?? "Тренировка завершена!";

    const emoji = hasThreshold ? (passed ? "🎉" : "📚") : pct >= 70 ? "🎉" : "📚";

    const timeRanOut =
      timeLimit !== undefined && elapsedSeconds >= timeLimit && totalCount < questions.length;

    return (
      <div className="min-h-screen p-6 max-w-3xl mx-auto">
        <div className="card mb-6 text-center">
          <div className="text-6xl mb-4">{emoji}</div>

          {showTopicPicker && (
            <p
              className={`text-xs uppercase tracking-wider ${accentText} font-semibold mb-2`}
            >
              {selectedTopic.title}
            </p>
          )}

          {hasThreshold && (
            <div
              className={`inline-block px-4 py-1.5 rounded-full text-sm font-bold mb-3 ${
                passed
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-red-100 text-red-700 border border-red-300"
              }`}
            >
              {passed ? "Тест сдан" : "Тест не сдан"}
            </div>
          )}

          <h2 className="text-2xl font-bold text-slate-800 mb-1">{heading}</h2>

          {timeRanOut && (
            <p className="text-sm text-red-500 font-medium mb-2">
              ⏰ Время истекло
            </p>
          )}

          <p className={`text-4xl font-bold ${accentText} mb-2`}>
            {correctCount} / {totalCount}
          </p>

          <p className="text-slate-500 mb-2">Правильных ответов: {pct}%</p>

          {timeLimit !== undefined && (
            <p className="text-sm text-slate-500 mb-2">
              ⏱ Время: {formatTime(elapsedSeconds)} из {formatTime(timeLimit)}
            </p>
          )}

          {hasThreshold && !timeLimit && (
            <p className="text-sm text-slate-400 mb-6">
              Проходной балл: {passingThreshold} из {totalCount}
            </p>
          )}

          <div className="flex gap-3 justify-center flex-wrap">
            <button
              onClick={() => startQuiz(selectedTopic.id, selectedTopic.title)}
              className={`${accentBg} text-white font-semibold py-2 px-6 rounded-lg transition-colors`}
            >
              {hasThreshold ? "Пройти снова" : "Продолжить тренировку"}
            </button>
            {showTopicPicker && (
              <button
                onClick={() => setPhase("selectTopic")}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-6 rounded-lg transition-colors"
              >
                Выбрать другую тему
              </button>
            )}
            <Link
              href={homeHref}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 px-6 rounded-lg transition-colors"
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
            const { question, selectedAnswerId: sel, result } = record;
            return (
              <div key={`${question.id}-${idx}`} className="card">
                <div className="flex items-start gap-3 mb-3">
                  <span
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      result.isCorrect
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {result.isCorrect ? "✓" : "✗"}
                  </span>
                  <div className="flex-1">
                    <p className="text-xs text-slate-400 mb-1">
                      Вопрос {idx + 1} · {question.topicTitle}
                    </p>
                    <p className="font-medium text-slate-800">{question.text}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pl-10">
                  {question.answers.map((ans) => {
                    let cls = "answer-option";
                    if (ans.id === result.correctAnswerId) cls += " correct";
                    else if (ans.id === sel && !result.isCorrect)
                      cls += " incorrect";
                    return (
                      <div
                        key={ans.id}
                        className={cls}
                        style={{ cursor: "default" }}
                      >
                        <span>{ans.text}</span>
                        {ans.id === result.correctAnswerId && (
                          <span className="ml-auto text-green-600 font-bold text-sm">
                            ✓
                          </span>
                        )}
                        {ans.id === sel && !result.isCorrect && (
                          <span className="ml-auto text-red-600 font-bold text-sm">
                            ✗
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {result.description && (
                  <div className="mt-3 pl-10 text-sm text-slate-600 bg-slate-50 rounded-lg p-3">
                    💡 {result.description}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Question ──────────────────────────────────────────────────────────
  const currentQuestion = questions[currentIndex];
  const answered = !hideFeedback && answerResult !== null;
  const radiosDisabled = answered || submitting;
  const correctId =
    answerResult?.correctAnswerId ?? currentQuestion.correctAnswerId ?? -1;
  const isCurrentCorrect = answered && answerResult?.isCorrect === true;

  const getAnswerClasses = (answerId: number): string => {
    const base =
      "flex items-center gap-3 w-full text-left px-3.5 py-1.5 rounded-lg border text-sm md:text-[15px] transition-colors";
    if (!answered) {
      return `${base} cursor-pointer ${
        selectedAnswerId === answerId
          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`;
    }
    if (answerId === correctId) {
      return `${base} border-green-400 bg-green-50`;
    }
    if (answerId === selectedAnswerId && !isCurrentCorrect) {
      return `${base} border-red-400 bg-red-50`;
    }
    return `${base} border-slate-200 bg-white opacity-60`;
  };

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-2xl mx-auto px-4 md:px-6 pt-4 md:pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={homeHref}
            onClick={(e) => {
              if (!confirmExit()) e.preventDefault();
            }}
            className="text-slate-400 hover:text-slate-600 text-sm transition-colors"
          >
            ← На главную
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">
              Вопрос{" "}
              <strong className="text-slate-700">{currentIndex + 1}</strong> из{" "}
              {questions.length}
            </span>
            {timeLimit !== undefined && (
              <span
                className={`text-sm font-mono font-semibold tabular-nums ${
                  timeLeft < 60 ? "text-red-500" : "text-slate-600"
                }`}
              >
                ⏱ {formatTime(timeLeft)}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-200 rounded-full h-1.5 mb-4">
          <div
            className={`${accentBgSolid} h-1.5 rounded-full transition-all`}
            style={{
              width: `${
                ((currentIndex + (answered ? 1 : 0)) / questions.length) * 100
              }%`,
            }}
          />
        </div>

        {/* Topic label */}
        <div className="flex items-center justify-between mb-2">
          <p
            className={`text-xs uppercase tracking-wider ${accentText} font-semibold`}
          >
            {currentQuestion.topicTitle}
          </p>
          {showTopicPicker && (
            <button
              onClick={() => {
                if (confirmExit()) setPhase("selectTopic");
              }}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Сменить тему
            </button>
          )}
        </div>

        {/* Question card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6 mb-4">
          <h2 className="text-lg md:text-xl font-semibold text-slate-800 mb-4 leading-snug">
            {currentQuestion.text}
          </h2>

          {currentQuestion.imageUrl && (
            <div className="mb-4 flex justify-center">
              <img
                src={currentQuestion.imageUrl}
                alt="Иллюстрация к вопросу"
                className="w-full max-h-96 object-contain rounded-lg border border-slate-200 bg-slate-50"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            {currentQuestion.answers.map((ans) => (
              <button
                key={ans.id}
                className={getAnswerClasses(ans.id)}
                onClick={() => {
                  if (!radiosDisabled) setSelectedAnswerId(ans.id);
                }}
                disabled={radiosDisabled}
                type="button"
              >
                <input
                  type="radio"
                  readOnly
                  checked={selectedAnswerId === ans.id}
                  className="flex-shrink-0 accent-blue-600"
                />
                <span className="flex-1 leading-snug">{ans.text}</span>
              </button>
            ))}
          </div>

          {/* Explanation */}
          {!hideFeedback && answered && answerResult?.description && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-700 leading-relaxed">
              <span className="font-semibold text-blue-700">
                Пояснение:
              </span>{" "}
              {answerResult.description}
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] z-20">
        <div className="max-w-2xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between gap-3">
          {/* Feedback */}
          <div className="flex items-center gap-2 text-sm font-medium min-h-[2.25rem]">
            {answered ? (
              isCurrentCorrect ? (
                <span className="inline-flex items-center gap-2 text-green-700">
                  <span className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-xs">
                    ✓
                  </span>
                  Верно!
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 text-red-700">
                  <span className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center text-red-600 text-xs">
                    ✗
                  </span>
                  Неверно
                </span>
              )
            ) : (
              <span className="text-slate-400 text-sm">
                {selectedAnswerId === null
                  ? "Выберите один из вариантов"
                  : "Нажмите «Ответить», чтобы проверить"}
              </span>
            )}
          </div>

          {/* Actions */}
          {!answered ? (
            <button
              onClick={handleSubmitAnswer}
              disabled={selectedAnswerId === null || submitting}
              className={`${accentBg} disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-colors shadow-sm`}
            >
              {submitting ? "…" : "Ответить"}
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className={`${accentBg} text-white font-semibold py-2.5 px-6 rounded-lg transition-colors shadow-sm`}
            >
              {currentIndex + 1 >= questions.length
                ? hasThreshold
                  ? "Завершить тест"
                  : "Завершить"
                : "Следующий →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}