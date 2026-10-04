"use client";

import { useEffect, useState, useCallback } from "react";

interface Topic {
  id: number;
  title: string;
  orderIndex: number;
}

export default function TopicsTab() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Overwrite confirmation state
  const [pendingOverwrite, setPendingOverwrite] = useState<{
    file: File;
    topicName: string;
  } | null>(null);

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/topics");
      const data = await res.json();
      setTopics(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  const handleImport = async (file: File, overwrite = false) => {
    setImporting(true);
    setImportMsg(null);
    setPendingOverwrite(null);

    const formData = new FormData();
    formData.append("file", file);
    if (overwrite) formData.append("overwrite", "true");

    try {
      const res = await fetch("/api/admin/topics/import", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (res.status === 409 && data.exists) {
        // Ask user about overwrite
        setPendingOverwrite({ file, topicName: data.error?.match(/«(.+)»/)?.[1] ?? "эта тема" });
        setImporting(false);
        return;
      }

      if (!res.ok) {
        setImportMsg({ type: "err", text: data.error ?? "Ошибка импорта" });
      } else {
        setImportMsg({
          type: "ok",
          text: `✓ Импортировано: «${data.title}» — ${data.questionsImported} вопросов`,
        });
        await fetchTopics();
      }
    } catch {
      setImportMsg({ type: "err", text: "Ошибка соединения" });
    } finally {
      setImporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleImport(file, false);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Удалить тему и все её вопросы?")) return;
    setDeleteId(id);
    try {
      await fetch(`/api/admin/topics/${id}`, { method: "DELETE" });
      await fetchTopics();
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-slate-800">
          Темы ({topics.length}/14)
        </h2>
        <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm">
          {importing ? "Импорт…" : "Импортировать .md файл"}
          <input
            type="file"
            accept=".md,text/markdown"
            className="hidden"
            onChange={handleFileChange}
            disabled={importing}
          />
        </label>
      </div>

      {/* Import result */}
      {importMsg && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm border ${
            importMsg.type === "ok"
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          {importMsg.text}
          <button
            onClick={() => setImportMsg(null)}
            className="ml-3 text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Overwrite confirmation */}
      {pendingOverwrite && (
        <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg text-sm">
          <p className="font-medium text-amber-800 mb-3">
            ⚠️ Тема «{pendingOverwrite.topicName}» уже существует. Перезаписать её вместе со всеми вопросами?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => handleImport(pendingOverwrite.file, true)}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium py-1.5 px-4 rounded-lg text-sm"
            >
              Перезаписать
            </button>
            <button
              onClick={() => setPendingOverwrite(null)}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium py-1.5 px-4 rounded-lg text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Topics list */}
      {loading ? (
        <div className="text-slate-400 text-center py-8">Загрузка…</div>
      ) : topics.length === 0 ? (
        <div className="card text-center py-12 text-slate-400">
          <p className="text-lg mb-2">Темы ещё не загружены</p>
          <p className="text-sm">
            Используйте кнопку «Импортировать .md файл» для загрузки глав.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...topics]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((topic) => (
              <div
                key={topic.id}
                className="bg-white border border-slate-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-400 w-6 text-right">
                    {topic.orderIndex}
                  </span>
                  <span className="font-medium text-slate-800">{topic.title}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <a
                    href={`/api/admin/topics/${topic.id}/export`}
                    className="text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
                    title="Скачать эту главу как .md файл"
                  >
                    Экспорт
                  </a>
                  <button
                    onClick={() => handleDelete(topic.id)}
                    disabled={deleteId === topic.id}
                    className="text-red-500 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                  >
                    {deleteId === topic.id ? "…" : "Удалить"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Instructions */}
      <details className="mt-8 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 group">
        <summary className="cursor-pointer px-4 py-3 flex items-center justify-between gap-3 font-semibold text-slate-700 hover:text-slate-900 transition-colors select-none">
          <span className="flex items-center gap-2">
            <span className="text-xs text-slate-400 group-open:rotate-90 transition-transform inline-block">
              ▶
            </span>
            Как подготовить .md файл для импорта
          </span>
          <span className="text-xs text-slate-400 font-normal group-open:hidden">
            показать справку
          </span>
        </summary>

        <div className="px-4 pb-4">
          <p className="text-xs text-slate-500 mb-3">
            Ниже — пример и краткие правила. Один файл = одна глава (тема).
            Скопируйте пример в файл <code className="bg-white border border-slate-200 rounded px-1">.md</code> и отредактируйте под себя.
          </p>

          <pre className="text-xs bg-white border border-slate-200 rounded p-3 overflow-auto">
{`# Глава 1. Название главы

## Вопрос 1

Текст вопроса?

- [ ] Вариант 1
- [x] Вариант 2 (правильный)
- [ ] Вариант 3

**Описание:** Пояснение к ответу

## Вопрос 2

Следующий вопрос?`}
          </pre>

          <div className="mt-4 text-xs text-slate-500 space-y-1.5">
            <p>
              <span className="font-medium text-slate-600">Заголовок главы</span> — любая
              строка, начинающаяся со слова «Глава» или «Тема». Например:{" "}
              <code className="bg-white border border-slate-200 rounded px-1">
                # Глава 1. Название
              </code>
              ,{" "}
              <code className="bg-white border border-slate-200 rounded px-1">
                # Глава: Название
              </code>{" "}
              или{" "}
              <code className="bg-white border border-slate-200 rounded px-1">
                # Тема: Название
              </code>
              .
            </p>
            <p>
              <span className="font-medium text-slate-600">Вопрос</span> — строка вида{" "}
              <code className="bg-white border border-slate-200 rounded px-1">
                ## Вопрос N
              </code>{" "}
              или{" "}
              <code className="bg-white border border-slate-200 rounded px-1">
                ## Вопрос: Текст
              </code>
              . Текст самого вопроса — на следующей строке после заголовка.
            </p>
            <p>
              <span className="font-medium text-slate-600">Ответы</span> — список{" "}
              <code className="bg-white border border-slate-200 rounded px-1">- [ ]</code>{" "}
              (неверный) или{" "}
              <code className="bg-white border border-slate-200 rounded px-1">- [x]</code>{" "}
              (правильный). Правильный должен быть ровно один.
            </p>
            <p>
              <span className="font-medium text-slate-600">Пояснение</span> — строка{" "}
              <code className="bg-white border border-slate-200 rounded px-1">
                **Описание:** текст
              </code>{" "}
              после ответов. Опционально.
            </p>
            <p>
              <span className="font-medium text-slate-600">Картинка</span> — строка{" "}
              <code className="bg-white border border-slate-200 rounded px-1">
                ![image](путь/к/картинке.png)
              </code>{" "}
              в любом месте блока вопроса. Опционально.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              💾 Экспорт: скачать любую главу обратно в .md файл (например, для
              резервной копии или переноса в другой проект).
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
