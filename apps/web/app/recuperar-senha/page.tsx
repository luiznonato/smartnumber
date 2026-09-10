"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@atlas/ui";

export default function PasswordRecoveryPage() {
  const [requested, setRequested] = useState(false);
  const [message, setMessage] = useState("");

  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password-reset/request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: form.get("email") }),
    });
    if (response.ok) {
      setRequested(true);
      setMessage(
        "Se a conta existir, a recuperação foi registrada. O envio depende do SMTP.",
      );
    }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/password-reset/confirm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        token: form.get("token"),
        password: form.get("password"),
      }),
    });
    const result = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? "Senha alterada. Todas as sessões anteriores foram revogadas."
        : result.message ?? "Não foi possível alterar a senha.",
    );
  }

  return (
    <div className="two-column">
      <div className="page-intro">
        <p className="eyebrow">Recuperação</p>
        <h1>Recupere o acesso com segurança.</h1>
        <p className="muted">
          O token expira em uma hora e revoga sessões anteriores após a troca.
        </p>
        <Link href="/login">Voltar ao login</Link>
      </div>
      <Card>
        {!requested ? (
          <form onSubmit={request}>
            <label>
              E-mail
              <input name="email" type="email" required />
            </label>
            <Button>Solicitar recuperação</Button>
          </form>
        ) : (
          <form onSubmit={confirm}>
            <label>
              Token recebido
              <input name="token" required />
            </label>
            <label>
              Nova senha
              <input name="password" type="password" minLength={12} required />
            </label>
            <Button>Alterar senha</Button>
          </form>
        )}
        {message ? <p role="status">{message}</p> : null}
      </Card>
    </div>
  );
}
