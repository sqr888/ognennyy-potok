"use client";

import { useState } from "react";
import TopicsTab from "./TopicsTab";
import QuestionsTab from "./QuestionsTab";
import StatsTab from "./StatsTab";

interface Props {
  onLogout: () => void;
}

type Tab = "topics" | "questions" | "stats";

export default function Dashboard({ onLogout }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("topics");

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    onLogout();
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "topics", label: "Темы / Импорт" },
    { key: "questions", label: "Вопросы" },
    { key: "stats", label: "Статистика" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center">
            <span className="text-white text-sm font-bold">🔥</span>
          </div>
          <h1 className="text-lg font-bold text-slate-800">
            Огненный поток — Администрирование
          </h1>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Выйти
        </button>
      </header>

      {/* Tabs */}
      <div className="border-b border-slate-200 bg-white px-6">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto p-6">
        {activeTab === "topics" && <TopicsTab />}
        {activeTab === "questions" && <QuestionsTab />}
        {activeTab === "stats" && <StatsTab />}
      </main>
    </div>
  );
}