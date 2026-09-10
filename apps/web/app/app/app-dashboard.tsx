"use client";

import { useEffect, useState } from "react";
import { Button, Card, NumberBall } from "@atlas/ui";

type Suggestion = {
  id: string;
  numbers: number[];
  score: number;
  scoreBreakdown: {
    sum_percentile?: number;
    window?: number;
    notice?: string;
  };
};
type Batch = {
  id: string;
  targetContest: number;
  datasetHash: string;
  seed: string;
  games: Suggestion[];
};
type SavedGame = {
  id: string;
  name: string;
  numbers: number[];
  evaluations: Array<{
    id: string;
    numberHits: number;
    luckyMonthHit: boolean | null;
    drawRevision: { revision: number };
  }>;
};

export function AppDashboard() {
  const [batch, setBatch] = useState<Batch | null>(null);
  const [saved, setSaved] = useState<SavedGame[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [suggestions, games] = await Promise.all([
      fetch("/api/suggestions/mega-sena/latest").then((r) =>
        r.ok ? r.json() : null,
      ),
      fetch("/api/saved-games", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : [],
      ),
    ]);
    setBatch(suggestions);
    setSaved(games);
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(suggestedGameId: string) {
    const response = await fetch("/api/saved-games", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suggestedGameId, name: "Mega-Sena sugerida" }),
    });
    if (!response.ok) {
      setError("Não foi possível salvar o jogo.");
      return;
    }
    await load();
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <h2>Sugestões rastreáveis</h2>
      {!batch ? (
        <Card>
          <p>Nenhum snapshot real foi publicado.</p>
        </Card>
      ) : (
        <Card>
          <p>
            Concurso alvo: {batch.targetContest} · dataset{" "}
            <code>{batch.datasetHash.slice(0, 12)}</code> · seed {batch.seed}
          </p>
          {batch.games.map((game) => (
            <div key={game.id}>
              <p>{game.numbers.map((n) => <NumberBall key={n} value={n} />)}</p>
              <p className="muted">
                Score de aderência histórica: {game.score}. Percentil de soma:{" "}
                {game.scoreBreakdown.sum_percentile} na janela{" "}
                {game.scoreBreakdown.window}.
              </p>
              <Button onClick={() => save(game.id)}>Salvar jogo imutável</Button>
            </div>
          ))}
        </Card>
      )}
      <h2>Jogos salvos e conferências</h2>
      {saved.map((game) => (
        <Card key={game.id}>
          <strong>{game.name}</strong>
          <p>{game.numbers.map((n) => <NumberBall key={n} value={n} />)}</p>
          {game.evaluations.map((evaluation) => (
            <p key={evaluation.id}>
              {evaluation.numberHits} acertos de dezenas
              {evaluation.luckyMonthHit === null
                ? ""
                : ` · Mês ${evaluation.luckyMonthHit ? "correto" : "incorreto"}`}
            </p>
          ))}
        </Card>
      ))}
    </>
  );
}
