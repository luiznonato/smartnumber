"use client";

import { FormEvent, useState } from "react";
import { Button, Card } from "@atlas/ui";

export function AuthForm({
  admin = false,
  register = false,
}: {
  admin?: boolean;
  register?: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const endpoint = admin
      ? "/api/admin/auth/login"
      : register
        ? "/api/auth/register"
        : "/api/auth/login";
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: data.get("email"),
        password: data.get("password"),
      }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.message ?? "Não foi possível autenticar.");
      setBusy(false);
      return;
    }
    window.location.assign(admin ? "/admin" : "/app");
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <label>
          E-mail
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            required
            minLength={12}
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy}>
          {busy ? "Aguarde…" : register ? "Criar conta" : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}
