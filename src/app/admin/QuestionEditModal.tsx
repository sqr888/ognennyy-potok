"use client";

import { useEffect, useRef, useState } from "react";

interface Answer {
  id?: number;
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
  answers: Answer[];
}

interface Props {
  question: Question | null; // null = new question
  topics: Topic[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Textarea, которая автоматически растягивается по высоте содержимого.
 * Никаких внутренних скроллов — сколько строк, столько и высота.
 */
function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  className,
  minRows = 1,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Сбросить в auto, иначе scrollHeight не уменьшится при удалении текста
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={minRows}
      placeholder={placeholder}
      className={className}
    />
  );
}

export default function QuestionEditModal({
  question,
  topics,
  onClose,
  onSaved,
}: Props) {
  const isNew = question === null;

  const [topicId, setTopicId] = useState<number>(
    question?.topicId ?? (topics[0]?.id ?? 0)
  );
  const [text, setText] = useState(question?.text ?? "");
  const [description, setDescription] = useState(question?.description ?? "");
  const [answersData, setAnswersData] = useState<Answer[]>(
    question?.answers.length
      ? question.answers.map((a) => ({ id: a.id, text: a.text, isCorrect: a.isCorrect }))
      : [
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
          { text: "", isCorrect: false },
        ]
  );

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setCorrect = (idx: number) => {
    setAnswersData((prev) =>
      prev.map((a, i) => ({ ...a, isCorrect: i === idx }))
    );
  };

  const updateAnswerText = (idx: number, val: string) => {
    setAnswersData((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, text: val } : a))
    );
  };

  const addAnswer = () => {
    setAnswersData((prev) => [...prev, { text: "", isCorrect: false }]);
  };

  const removeAnswer = (idx: number) => {
    if (answersData.length <= 2) return;
    setAnswersData((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    setError("");

    if (!text.trim()) {
      setError("Текст вопроса обязателен");
      return;
    }
    if (!topicId) {
      setError("Выберите тему");
      return;
    }
    const filledAnswers = answersData.filter((a) => a.text.trim());
    if (filledAnswers.length < 2) {
      setError("Минимум 2 варианта ответа");
      return;
    }
    const correctCount = filledAnswers.filter((a) => a.isCorrect).length;
    if (correctCount !== 1) {
      setError("Выберите ровно один правильный ответ");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        topicId,
        text: text.trim(),
        description: description.trim() || null,
        answersData: filledAnswers.map(({ text: t, isCorrect }) => ({
          text: t.trim(),
          isCorrect,
        })),
      };

      let questionId = question?.id;

      if (isNew) {
        const res = await fetch("/api/admin/questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ошибка создания");
          return;
        }
        questionId = data.id;
      } else {
        const res = await fetch(`/api/admin/questions/${question!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Ошибка сохранения");
          return;
        }
      }

      // Upload image if selected
      if (imageFile && questionId) {
        const imgForm = new FormData();
        imgForm.append("image", imageFile);
        await fetch(`/api/admin/questions/${questionId}/image`, {
          method: "POST",
          body: imgForm,
        });
      }

      onSaved();
    } catch {
      setError("Ошибка соединения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">
            {isNew ? "Новый вопрос" : "Редактирование вопроса"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Тема
            </label>
            <select
              value={topicId}
              onChange={(e) => setTopicId(Number(e.target.value))}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[...topics]
                .sort((a, b) => a.orderIndex - b.orderIndex)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.orderIndex}. {t.title}
                  </option>
                ))}
            </select>
          </div>

          {/* Question text */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Текст вопроса
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Введите текст вопроса"
            />
          </div>

          {/* Answers */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Варианты ответов
              <span className="text-xs font-normal text-slate-400 ml-2">
                (отметьте один правильный)
              </span>
            </label>
            <div className="flex flex-col gap-2">
              {answersData.map((ans, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    checked={ans.isCorrect}
                    onChange={() => setCorrect(idx)}
                    className="flex-shrink-0 accent-green-500"
                    title="Отметить как правильный"
                  />
                  <div className="flex-1 min-w-0">
                    <AutoResizeTextarea
                      value={ans.text}
                      onChange={(v) => updateAnswerText(idx, v)}
                      minRows={1}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none overflow-hidden"
                      placeholder={`Вариант ${idx + 1}`}
                    />
                  </div>
                  <button
                    onClick={() => removeAnswer(idx)}
                    disabled={answersData.length <= 2}
                    className="text-red-400 hover:text-red-600 disabled:opacity-30 text-lg"
                    title="Удалить вариант"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addAnswer}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Добавить вариант
            </button>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Пояснение (опционально)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-sm"
              placeholder="Объяснение правильного ответа"
            />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Изображение (опционально)
            </label>
            {question?.imageUrl && !imageFile && (
              <div className="mb-2">
                <img
                  src={question.imageUrl}
                  alt=""
                  className="max-h-32 rounded-lg border border-slate-200"
                />
                <p className="text-xs text-slate-400 mt-1">{question.imageUrl}</p>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
              className="text-sm text-slate-600"
            />
            {imageFile && (
              <p className="text-xs text-slate-400 mt-1">
                Выбрано: {imageFile.name}
              </p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={onClose}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium py-2 px-5 rounded-lg text-sm transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-semibold py-2 px-6 rounded-lg text-sm transition-colors"
            >
              {saving ? "Сохранение…" : isNew ? "Создать" : "Сохранить"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
