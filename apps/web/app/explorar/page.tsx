"use client";

import { useEffect, useState } from "react";
import {
  Card,
  EmptyState,
  ErrorState,
  LotterySwitcher,
  NumberChip,
} from "@atlas/ui";

type Lottery = "mega-sena" | "lotofacil" | "dia-de-sorte";
type Analysis = {
  cutoffContest: number;
  selectedWindow: number;
  formulaVersion: string;
  data: {
    n: number;
    numbers: Array<{
      number: number;
      count: number;
      frequency: number;
      expected: number;
      ema: number;
      gap: number | null;
    }>;
    sum?: { mean: number | null; p05: number | null; p95: number | null };
    odd?: { mean: number | null };
  };
};

export default function Page() {
  const [lottery, setLottery] = useState<Lottery>("mega-sena");
  const [windowSize, setWindowSize] = useState(50);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(`/api/analysis/${lottery}/latest?window=${windowSize}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("analysis unavailable");
        setAnalysis(await response.json());
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [lottery, windowSize]);

  const ranking = [...(analysis?.data?.numbers ?? [])]
    .sort((a, b) => b.frequency - a.frequency || a.number - b.number)
    .slice(0, 15);

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Análises</p>
        <h1>O histórico, sem extrapolações.</h1>
        <p className="muted">
          Frequência observada descreve a amostra. Ela não demonstra maior
          probabilidade no próximo sorteio.
        </p>
      </div>
      <LotterySwitcher value={lottery} onChange={setLottery} />
      <label style={{ maxWidth: 220 }}>
        Janela
        <select
          value={windowSize}
          onChange={(event) => setWindowSize(Number(event.target.value))}
        >
          {[10, 25, 50, 100, 250].map((value) => (
            <option key={value} value={value}>
              {value} concursos
            </option>
          ))}
        </select>
      </label>
      {loading ? (
        <div className="state-panel">Calculando visualização…</div>
      ) : error ? (
        <ErrorState />
      ) : !analysis?.data ? (
        <EmptyState title="Análise ainda indisponível">
          São necessários ao menos dois concursos confirmados para criar um
          snapshot descritivo.
        </EmptyState>
      ) : (
        <>
          <div className="metric-row section">
            <div className="metric">
              <strong>{analysis.data.n}</strong>
              <span>concursos na amostra</span>
            </div>
            <div className="metric">
              <strong>{analysis.cutoffContest}</strong>
              <span>concurso de corte</span>
            </div>
            <div className="metric">
              <strong>
                {analysis.data.sum?.mean?.toFixed(1) ?? "indisponível"}
              </strong>
              <span>soma média</span>
            </div>
            <div className="metric">
              <strong>
                {analysis.data.odd?.mean?.toFixed(1) ?? "indisponível"}
              </strong>
              <span>ímpares por concurso</span>
            </div>
          </div>
          <Card className="section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Frequência observada</p>
                <h2>Dezenas mais presentes na janela</h2>
              </div>
              <span className="muted">
                Janela efetiva: {analysis.selectedWindow}
              </span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table>
                <thead>
                  <tr>
                    <th>Dezena</th>
                    <th>Ocorrências</th>
                    <th>Frequência</th>
                    <th>Esperada</th>
                    <th>Intervalo atual</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((item) => (
                    <tr key={item.number}>
                      <td>
                        <NumberChip value={item.number} />
                      </td>
                      <td>{item.count}</td>
                      <td>{(item.frequency * 100).toFixed(1)}%</td>
                      <td>{(item.expected * 100).toFixed(1)}%</td>
                      <td>{item.gap ?? "não observado"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}