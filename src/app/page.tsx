import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-3xl font-bold">🔥</span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 mb-3">
          Наш тренажер «Огненный поток»
        </h1>
        <p className="text-slate-500 mb-8 text-lg">
          Проверь свои знания — экзамен, тест и свободная тренировка.
        </p>

        <div className="flex flex-col gap-3 items-center">
          <Link
            href="/test"
            className="w-full max-w-xs inline-block text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors shadow"
          >
            Начать тест (14 вопросов)
          </Link>

          <Link
            href="/exam"
            className="w-full max-w-xs inline-block text-center bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors shadow"
          >
            🕐 Экзамен на время (30 минут)
          </Link>

          <Link
            href="/train"
            className="w-full max-w-xs inline-block text-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-8 rounded-lg text-lg transition-colors shadow"
          >
            Тренировка по всем вопросам
          </Link>

          <Link
            href="/admin"
            className="text-sm text-slate-400 hover:text-slate-600 transition-colors mt-2"
          >
            Панель администратора
          </Link>
        </div>
      </div>
    </main>
  );
}