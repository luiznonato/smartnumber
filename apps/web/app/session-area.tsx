"use client";

import { useEffect, useState } from "react";
import { Button } from "@atlas/ui";

type CurrentUser = { id: string; email: string; role: string };

export function SessionArea({ admin = false }: { admin?: boolean }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(admin ? "/api/admin/auth/me" : "/api/auth/me", {
      credentials: "include",
    })
      .then(async (response) => {
        if (!response.ok) {
          window.location.assign(admin ? "/admin/login" : "/login");
          return;
        }
        setUser(await response.json());
      })
      .finally(() => setLoading(false));
  }, [admin]);

  async function logout() {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    window.location.assign(admin ? "/admin/login" : "/login");
  }

  if (loading) return <p>Validando sessão…</p>;
  if (!user) return null;
  return (
    <div className="session-strip">
      <div>
        <strong>{user.email}</strong>
        <span className="muted">
          {admin ? "Administrador" : "Conta autenticada"}
        </span>
      </div>
      <Button className="secondary" onClick={logout}>
        Sair
      </Button>
    </div>
  );
}
