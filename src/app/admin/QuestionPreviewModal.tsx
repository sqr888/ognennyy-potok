"use client";

import { useState } from "react";

interface Answer {
  id: number;
  text: string;
  isCorrect: boolean;
}

interface Topic {
  id: number;
  title: string;
  orderIndex: number;
}

interface Question {
  id: number;
  topicId: number;
  text: string;
  imageUrl: string | null;
  description: string | null;
  topic: Topic;
  answers: Answer[];
}

interface Props {
  question: Question;
  onClose: () => void;
}

export default function QuestionPreviewModal({ question, onClose }: Props) {
  const [selectedAnswerId, setSelectedAnswerId] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);

  const correctAnswer = question.answers.find((a) => a.isCorrect);
  const isCorrect =
    answered &&
    correctAnswer !== undefined &&
    selectedAnswerId === correctAnswer.id;

  const reset = () => {
    setSelectedAnswerId(null);
    setAnswered(false);
  };

  const getAnswerClasses = (ansId: number): string => {
    const base =
      "flex items-center gap-3 w-full text-left px-3.5 py-1.5 rounded-lg border text-sm md:text-[15px] transition-colors";

    if (!answered) {
      return `${base} cursor-pointer ${
        selectedAnswerId === ansId
          ? "border-blue-500 bg-blue-50 ring-1 ring-blue-300"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`;
    }

    if (correctAnswer && ansId === correctAnswer.id) {
      return `${base} border-green-400 bg-green-50`;
    }
    if (ansId === selectedAnswerId && !isCorrect) {
      return `${base} border-red-400 bg-red-50`;
    }
    return `${base} border-slate-200 bg-white opacity-60`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-slate-800">
              Просмотр вопроса
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
              как в тесте
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
            title="Закрыть"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Progress bar (визуальная имитация) */}
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-4">
            <div className="bg-blue-600 h-1.5 rounded-full w-1/3" />
          </div>

          {/* Header info */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-slate-500">
              Вопрос <strong className="text-slate-700">1</strong> из N
            </span>
            <button
              onClick={reset}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              title="Сбросить выбранный ответ"
            >
              Сбросить
            </button>
          </div>

          {/* Topic */}
          <p className="text-xs uppercase tracking-wider text-blue-600 font-semibold mb-2">
            {question.topic.orderIndex}. {question.topic.title}
          </p>

          {/* Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold text-slate-800 mb-4 leading-snug">
              {question.text}
            </h2>

            {question.imageUrl && (
              <div className="mb-4 flex justify-center">
                <img
                  src={question.imageUrl}
                  alt="Иллюстрация к вопросу"
                  className="w-full max-h-96 object-contain rounded-lg border border-slate-200 bg-slate-50"
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              {question.answers.map((ans) => (
                <button
                  key={ans.id}
                  className={getAnswerClasses(ans.id)}
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
                    className="flex-shrink-0 accent-blue-600"
                  />
                  <span className="flex-1 leading-snug">{ans.text}</span>
                </button>
              ))}
            </div>

            {answered && question.description && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-slate-700 leading-relaxed">
                <span className="font-semibold text-blue-700">Пояснение:</span>{" "}
                {question.description}
              </div>
            )}

            {!question.description && answered && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                ⚠️ У этого вопроса нет пояснения. Добавьте его через «Изменить».
              </div>
            )}
          </div>

          {/* Footer info */}
          <p className="text-xs text-slate-400 mt-3 text-center">
            ID: {question.id} · правильный ответ помечен ✓
          </p>
        </div>

        {/* Sticky bottom bar */}
        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium min-h-[2.25rem]">
            {answered ? (
              isCorrect ? (
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
                  ? "Выберите вариант для проверки"
                  : "Нажмите «Ответить», чтобы проверить"}
              </span>
            )}
          </div>

          {!answered ? (
            <button
              onClick={() => setAnswered(true)}
              disabled={selectedAnswerId === null}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-6 rounded-lg transition-colors shadow-sm"
            >
              Ответить
            </button>
          ) : (
            <button
              onClick={reset}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 px-6 rounded-lg transition-colors"
            >
              Попробовать снова
            </button>
          )}
        </div>
      </div>
    </div>
  );
}