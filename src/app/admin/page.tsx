"use client";

import { useEffect, useState } from "react";
import Login from "./Login";
import Dashboard from "./Dashboard";

export default function AdminPage() {
  const [authState, setAuthState] = useState<"loading" | "login" | "dashboard">("loading");

  const checkAuth = async () => {
    try {
      const res = await fetch("/api/admin/me");
      if (res.ok) {
        setAuthState("dashboard");
      } else {
        setAuthState("login");
      }
    } catch {
      setAuthState("login");
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  if (authState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (authState === "login") {
    return <Login onLoginSuccess={() => setAuthState("dashboard")} />;
  }

  return <Dashboard onLogout={() => setAuthState("login")} />;
}
