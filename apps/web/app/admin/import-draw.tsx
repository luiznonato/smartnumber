"use client";

import { FormEvent, useState } from "react";
import { Button, Card } from "@atlas/ui";

const example = JSON.stringify(
  {
    lottery: "mega-sena",
    contestNumber: 1,
    drawDate: "1996-03-11",
    numbers: [4, 5, 30, 33, 41, 52],
    sourceUrl: "https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx",
    fetchedAt: new Date().toISOString(),
    parserVersion: "admin-official-json-v1",
  },
  null,
  2,
);

export function ImportDraw() {
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const data = new FormData(event.currentTarget);
    try {
      const payload = JSON.parse(String(data.get("payload")));
      const response = await fetch("/api/admin/draws/import", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      setResult(JSON.stringify(await response.json(), null, 2));
    } catch (error) {
      setResult(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2>Importar resultado oficial validado</h2>
      <p className="muted">
        Revise a origem. O exemplo mostra o formato, não deve ser importado como
        produção sem reconciliação com a fonte oficial.
      </p>
      <form onSubmit={submit}>
        <label>
          Payload JSON
          <textarea name="payload" rows={14} defaultValue={example} />
        </label>
        <Button disabled={busy}>{busy ? "Processando…" : "Importar"}</Button>
      </form>
      {result && <pre>{result}</pre>}
    </Card>
  );
}
