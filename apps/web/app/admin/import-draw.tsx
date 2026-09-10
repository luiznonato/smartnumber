"use client";

import { FormEvent, useState } from "react";
import { Button, Card } from "@atlas/ui";

type Preview = {
  importRunId: string;
  fileHash: string;
  summary: {
    accepted: number;
    duplicate: number;
    conflict: number;
    invalid: number;
  };
  rows: Array<{
    row: number;
    status: string;
    input?: { contestNumber: number; drawDate: string };
    error?: string;
  }>;
};

export function ImportDraw() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      const file = data.get("file");
      if (!(file instanceof File) || !file.name) {
        throw new Error("Selecione um arquivo JSON ou CSV.");
      }
      if (file.size > 2_000_000) {
        throw new Error("O arquivo excede 2 MB.");
      }
      const format = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
      const response = await fetch("/api/admin/imports/preview", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lottery: data.get("lottery"),
          sourceUrl: data.get("sourceUrl"),
          fileName: file.name,
          content: await file.text(),
          format,
          delimiter: data.get("delimiter"),
          mapping:
            format === "csv"
              ? {
                  contestNumber: data.get("contestColumn"),
                  drawDate: data.get("dateColumn"),
                  numbers: data.get("numbersColumn"),
                  luckyMonth: data.get("monthColumn"),
                }
              : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Prévia indisponível.");
      setPreview(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!preview) return;
    setBusy(true);
    const response = await fetch(
      `/api/admin/imports/${preview.importRunId}/confirm`,
      { method: "POST", credentials: "include" },
    );
    const result = await response.json().catch(() => ({}));
    setMessage(
      response.ok
        ? `${result.imported} concursos enviados para processamento.`
        : result.message ?? "Não foi possível confirmar.",
    );
    setBusy(false);
  }

  return (
    <Card>
      <h2>Importar arquivo oficial</h2>
      <p className="muted">
        O arquivo é validado antes da persistência. Duplicatas, conflitos e
        linhas inválidas aparecem na prévia.
      </p>
      <form onSubmit={submit}>
        <label>
          Modalidade
          <select name="lottery">
            <option value="mega-sena">Mega-Sena</option>
            <option value="lotofacil">Lotofácil</option>
            <option value="dia-de-sorte">Dia de Sorte</option>
          </select>
        </label>
        <label>
          Arquivo JSON ou CSV
          <input name="file" type="file" accept=".json,.csv" required />
        </label>
        <label>
          URL oficial de origem
          <input
            name="sourceUrl"
            type="url"
            defaultValue="https://loterias.caixa.gov.br/"
            required
          />
        </label>
        <details className="explanation">
          <summary>Mapeamento CSV</summary>
          <label>
            Delimitador
            <select name="delimiter" defaultValue=";">
              <option value=";">Ponto e vírgula</option>
              <option value=",">Vírgula</option>
            </select>
          </label>
          <label>
            Coluna concurso
            <input name="contestColumn" defaultValue="concurso" />
          </label>
          <label>
            Coluna data
            <input name="dateColumn" defaultValue="data" />
          </label>
          <label>
            Coluna dezenas
            <input name="numbersColumn" defaultValue="dezenas" />
          </label>
          <label>
            Coluna mês (Dia de Sorte)
            <input name="monthColumn" defaultValue="mes" />
          </label>
        </details>
        <Button disabled={busy}>
          {busy ? "Validando…" : "Gerar prévia"}
        </Button>
      </form>
      {message ? <p role="status">{message}</p> : null}
      {preview ? (
        <div className="section">
          <div className="metric-row">
            {Object.entries(preview.summary).map(([label, value]) => (
              <div className="metric" key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Linha</th>
                  <th>Concurso</th>
                  <th>Data</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={row.row}>
                    <td>{row.row}</td>
                    <td>{row.input?.contestNumber ?? "—"}</td>
                    <td>{row.input?.drawDate ?? "—"}</td>
                    <td>{row.error ?? row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button
            disabled={busy || preview.summary.accepted === 0}
            onClick={() => void confirm()}
          >
            Confirmar {preview.summary.accepted} concursos
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
