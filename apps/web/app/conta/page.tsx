"use client";

import { useEffect, useState } from "react";
import { Button, Card, ErrorState } from "@atlas/ui";

type User = {
  id: string;
  email: string;
  role: string;
  emailVerifiedAt: string | null;
};
type Session = { id: string; createdAt: string; expiresAt: string };

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [userResponse, sessionResponse] = await Promise.all([
        fetch("/api/auth/me", { credentials: "include" }),
        fetch("/api/auth/sessions", { credentials: "include" }),
      ]);
      if (!userResponse.ok || !sessionResponse.ok) throw new Error();
      setUser(await userResponse.json());
      setSessions(await sessionResponse.json());
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function requestVerification() {
    const response = await fetch("/api/auth/email-verification/request", {
      method: "POST",
      credentials: "include",
    });
    const result = await response.json().catch(() => ({}));
    setMessage(
      result.queued
        ? "Mensagem de verificação enfileirada."
        : "SMTP ainda não configurado; solicitação registrada.",
    );
  }

  async function revoke(id: string) {
    await fetch(`/api/auth/sessions/${id}/revoke`, {
      method: "POST",
      credentials: "include",
    });
    await load();
  }

  if (error) return <ErrorState title="Entre para gerenciar sua conta" />;
  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Conta</p>
        <h1>Plano, sessões e privacidade.</h1>
        <p className="muted">{user?.email}</p>
      </div>
      {message ? <p role="status">{message}</p> : null}
      <div className="grid">
        <Card>
          <h2>Plano</h2>
          <p>Sandbox — cobrança real desativada.</p>
          <p className="muted">
            Limites de geração são aplicados no servidor.
          </p>
        </Card>
        <Card>
          <h2>E-mail</h2>
          <p>{user?.emailVerifiedAt ? "Verificado" : "Não verificado"}</p>
          {!user?.emailVerifiedAt ? (
            <Button className="secondary" onClick={() => void requestVerification()}>
              Solicitar verificação
            </Button>
          ) : null}
        </Card>
        <Card>
          <h2>Notificações</h2>
          <p className="muted">
            Desativadas por padrão. Nenhum estímulo para recuperar perdas.
          </p>
        </Card>
      </div>
      <Card className="section">
        <h2>Sessões ativas</h2>
        {sessions.map((session) => (
          <div className="game-meta" key={session.id}>
            <span>
              Criada em {new Date(session.createdAt).toLocaleDateString("pt-BR")}
            </span>
            <Button
              className="secondary"
              onClick={() => void revoke(session.id)}
            >
              Revogar
            </Button>
          </div>
        ))}
      </Card>
    </>
  );
}