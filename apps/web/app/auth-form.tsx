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
  const [challenge, setChallenge] = useState("");
  const [setup, setSetup] = useState<{
    secret: string;
    uri: string;
  } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const endpoint = admin
      ? challenge
        ? setup
          ? "/api/admin/auth/mfa/setup"
          : "/api/admin/auth/mfa/verify"
        : "/api/admin/auth/login"
      : register
        ? "/api/auth/register"
        : "/api/auth/login";
    const response = await fetch(endpoint, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        challenge
          ? { challenge, code: data.get("code") }
          : {
              email: data.get("email"),
              password: data.get("password"),
            },
      ),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      setError(result.message ?? "Não foi possível autenticar.");
      setBusy(false);
      return;
    }
    const result = await response.json();
    if (admin && !challenge && result.challenge) {
      setChallenge(result.challenge);
      setSetup(result.setup ?? null);
      setBusy(false);
      return;
    }
    if (result.recoveryCodes?.length) {
      setRecoveryCodes(result.recoveryCodes);
      setBusy(false);
      return;
    }
    window.location.assign(admin ? "/admin" : "/app");
  }

  if (recoveryCodes.length) {
    return (
      <Card>
        <h2>Guarde seus códigos de recuperação</h2>
        <p className="muted">
          Cada código funciona uma única vez. Eles não serão mostrados novamente.
        </p>
        <ul>
          {recoveryCodes.map((code) => (
            <li key={code}>
              <code>{code}</code>
            </li>
          ))}
        </ul>
        <Button onClick={() => window.location.assign("/admin")}>
          Concluir acesso
        </Button>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={submit}>
        {challenge ? (
          <>
            <h2>
              {setup ? "Configure a autenticação em duas etapas" : "Código MFA"}
            </h2>
            {setup ? (
              <>
                <p className="muted">
                  Adicione esta chave ao seu aplicativo autenticador:
                </p>
                <p>
                  <code>{setup.secret}</code>
                </p>
              </>
            ) : (
              <p className="muted">
                Informe o código do autenticador ou um código de recuperação.
              </p>
            )}
            <label>
              Código
              <input
                name="code"
                required
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </label>
          </>
        ) : (
          <>
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
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <Button disabled={busy}>
          {busy
            ? "Aguarde…"
            : challenge
              ? "Verificar código"
              : register
                ? "Criar conta"
                : "Entrar"}
        </Button>
      </form>
    </Card>
  );
}
