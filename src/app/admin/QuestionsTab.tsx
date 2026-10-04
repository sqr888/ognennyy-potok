"use client";

import { useEffect, useState, useCallback } from "react";
import QuestionEditModal from "./QuestionEditModal";
import QuestionPreviewModal from "./QuestionPreviewModal";

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

export default function QuestionsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filterTopicId, setFilterTopicId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [previewQuestion, setPreviewQuestion] = useState<Question | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  // Счётчики вопросов: по темам и общее
  const [topicCounts, setTopicCounts] = useState<Record<number, number>>({});
  const [totalCount, setTotalCount] = useState(0);

  const fetchTopics = useCallback(async () => {
    const res = await fetch("/api/admin/topics");
    const data = await res.json();
    setTopics(data);
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterTopicId
        ? `/api/admin/questions?topicId=${filterTopicId}`
        : "/api/admin/questions";
      const res = await fetch(url);
      const data = await res.json();
      setQuestions(data);
    } finally {
      setLoading(false);
    }
  }, [filterTopicId]);

    // Отдельный запрос за всеми вопросами — только для счётчиков
  const fetchCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/questions");
      if (!res.ok) return;
      const data: Question[] = await res.json();
      const counts: Record<number, number> = {};
      for (const q of data) {
        counts[q.topicId] = (counts[q.topicId] ?? 0) + 1;
      }
      setTopicCounts(counts);
      setTotalCount(data.length);
    } catch {
      // не критично для работы — просто не будет цифр
    }
  }, []);

  useEffect(() => {
    fetchTopics();
    fetchCounts();
  }, [fetchTopics, fetchCounts]);

  useEffect(() => {
    fetchQuestions();
  }, [fetchQuestions]);

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить этот вопрос?")) return;
    setDeleteId(id);
    try {
      await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      fetchCounts();
    } finally {
      setDeleteId(null);
    }
  };

  const handleSaved = () => {
    setEditingQuestion(null);
    setCreatingNew(false);
    fetchQuestions();
    fetchCounts();
  };

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-xl font-bold text-slate-800">
            Вопросы
            <span className="ml-2 text-sm font-normal text-slate-400">
              {filterTopicId
                ? `${questions.length} в выбранной теме`
                : `${totalCount} всего`}
            </span>
          </h2>
          <select
            value={filterTopicId}
            onChange={(e) => setFilterTopicId(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Все темы ({totalCount})</option>
            {[...topics]
              .sort((a, b) => a.orderIndex - b.orderIndex)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.orderIndex}. {t.title} ({topicCounts[t.id] ?? 0})
                </option>
              ))}
          </select>
        </div>
        <button
          onClick={() => setCreatingNew(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
        >
          + Новый вопрос
        </button>
      </div>

      {/* Questions list */}
      {loading ? (
        <div className="text-slate-400 text-center py-8">Загрузка…</div>
      ) : questions.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          Вопросов нет
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <div
              key={q.id}
              className="bg-white border border-slate-200 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 mb-1">
                    {q.topic.orderIndex}. {q.topic.title}
                  </p>
                  <p className="font-medium text-slate-800 break-words">{q.text}</p>
                  <div className="flex gap-2 flex-wrap mt-2">
                    {q.answers.map((a) => (
                      <span
                        key={a.id}
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          a.isCorrect
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-slate-50 border-slate-200 text-slate-500"
                        }`}
                      >
                        {a.isCorrect ? "✓ " : ""}
                        {a.text.length > 40 ? a.text.slice(0, 40) + "…" : a.text}
                      </span>
                    ))}
                  </div>
                  {q.imageUrl && (
                    <p className="text-xs text-blue-500 mt-1">📷 {q.imageUrl}</p>
                  )}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setPreviewQuestion(q)}
                    className="text-slate-500 hover:text-slate-700 text-sm font-medium"
                  >
                    Просмотр
                  </button>
                  <button
                    onClick={() => setEditingQuestion(q)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    Изменить
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    disabled={deleteId === q.id}
                    className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                  >
                    {deleteId === q.id ? "…" : "Удалить"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewQuestion && (
        <QuestionPreviewModal
          question={previewQuestion}
          onClose={() => setPreviewQuestion(null)}
        />
      )}

      {/* Edit/Create modal */}
      {(editingQuestion || creatingNew) && (
        <QuestionEditModal
          question={editingQuestion ?? null}
          topics={topics}
          onClose={() => {
            setEditingQuestion(null);
            setCreatingNew(false);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}