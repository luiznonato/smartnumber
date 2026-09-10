"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, ErrorState } from "@atlas/ui";

type Overview = {
  users: number;
  activeSessions: number;
  imports: number;
  qualityIssues: number;
  pendingOutbox: number;
  failedJobs: number;
  strategyVersions: number;
};
type User = {
  id: string;
  email: string;
  role: string;
  suspendedAt: string | null;
  createdAt: string;
};

export function AdminOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [overviewResponse, usersResponse] = await Promise.all([
        fetch("/api/admin/overview", { credentials: "include" }),
        fetch("/api/admin/users", { credentials: "include" }),
      ]);
      if (!overviewResponse.ok || !usersResponse.ok) {
        throw new Error("admin unavailable");
      }
      setOverview(await overviewResponse.json());
      setUsers(await usersResponse.json());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function suspend(user: User) {
    const response = await fetch(
      `/api/admin/users/${user.id}/suspension`,
      {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ suspended: !user.suspendedAt }),
      },
    );
    if (!response.ok) {
      setError(true);
      return;
    }
    await load();
  }

  if (error && !overview) {
    return <ErrorState title="Operações administrativas indisponíveis" />;
  }
  return (
    <>
      <div className="metric-row">
        {overview
          ? Object.entries(overview).map(([label, value]) => (
              <div className="metric" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))
          : null}
      </div>
      <Card>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Acesso</p>
            <h2>Usuários</h2>
          </div>
          <span className="muted">Sem acesso aos jogos privados</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Estado</th>
                <th>Ação</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.suspendedAt ? "Suspenso" : "Ativo"}</td>
                  <td>
                    <Button
                      className="secondary"
                      onClick={() => void suspend(user)}
                    >
                      {user.suspendedAt ? "Restaurar" : "Suspender"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
