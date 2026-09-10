"use client";

import { useState } from "react";
import { Button, Card } from "@atlas/ui";

const lotteries = [
  ["mega-sena", "Mega-Sena"],
  ["lotofacil", "Lotofácil"],
  ["dia-de-sorte", "Dia de Sorte"],
] as const;

export function CaixaSync() {
  const [lottery, setLottery] = useState("mega-sena");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const [resumeId, setResumeId] = useState<string | null>(null);

  async function request(path: string, method = "GET", body?: unknown) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/draws/${lottery}/${path}`, {
        method,
        credentials: "include",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = await response.json();
      setResult(JSON.stringify(payload, null, 2));
      if (
        path === "sync-history" &&
        response.ok &&
        typeof payload.importRunId === "string"
      ) {
        setResumeId(payload.completed ? null : payload.importRunId);
      }
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2>Sincronização do portal CAIXA</h2>
      <p className="muted">
        A interface pertence ao portal CAIXA, mas não possui documentação pública
        ou SLA. Cada coleta preserva URL, payload, hash e versão do parser.
      </p>
      <label>
        Modalidade
        <select
          value={lottery}
          onChange={(event) => {
            setLottery(event.target.value);
            setResumeId(null);
          }}
        >
          {lotteries.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className="actions">
        <Button
          disabled={busy}
          onClick={() => void request("sync-latest", "POST")}
        >
          Sincronizar último
        </Button>
        <Button
          disabled={busy}
          onClick={() =>
            void request("sync-history", "POST", {
              limit: 25,
              ...(resumeId ? { resumeId } : {}),
            })
          }
        >
          {resumeId ? "Continuar histórico (25)" : "Iniciar histórico (25)"}
        </Button>
        <Button disabled={busy} onClick={() => void request("health")}>
          Ver cobertura
        </Button>
      </div>
      {busy && <p>Processando…</p>}
      {result && <pre>{result}</pre>}
    </Card>
  );
}
