import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Огненный поток — тренажёр",
  description:
    "Тренажёр для подготовки: экзамен на время, тест из 14 вопросов, свободная тренировка по темам.",
  openGraph: {
    title: "Огненный поток — тренажёр",
    description: "Экзамен на время, тест из 14 вопросов, тренировка по темам.",
    url: "https://ognennyy-potok.relaxdev.ru",
    siteName: "Огненный поток",
    locale: "ru_RU",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}
