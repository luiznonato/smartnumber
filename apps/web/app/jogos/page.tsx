"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  GameCard,
} from "@atlas/ui";

type SavedGame = {
  id: string;
  name: string;
  lotterySlug: string;
  numbers: number[];
  luckyMonth: number | null;
  archivedAt: string | null;
  tracking: Array<{ id: string; active: boolean; startContest: number }>;
  evaluations: Array<{
    id: string;
    numberHits: number;
    luckyMonthHit: boolean | null;
    drawRevision: { draw: { contestNumber: number } };
  }>;
};

export default function Page() {
  const [games, setGames] = useState<SavedGame[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/saved-games", {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        throw new Error("Entre na sua conta para consultar seus jogos.");
      }
      if (!response.ok) throw new Error("Não foi possível carregar seus jogos.");
      setGames(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function archive(game: SavedGame) {
    const response = await fetch(`/api/saved-games/${game.id}/archive`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !game.archivedAt }),
    });
    if (!response.ok) {
      setError("Não foi possível alterar o arquivamento.");
      return;
    }
    await load();
  }

  async function track(game: SavedGame) {
    const latest = await fetch(`/api/draws/${game.lotterySlug}/latest`).then(
      (response) => (response.ok ? response.json() : null),
    );
    const startContest = (latest?.draw?.contestNumber ?? 0) + 1;
    if (startContest < 1) {
      setError("Importe um resultado antes de iniciar o acompanhamento.");
      return;
    }
    const response = await fetch(`/api/saved-games/${game.id}/track`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ startContest }),
    });
    if (!response.ok) {
      setError("Não foi possível iniciar o acompanhamento.");
      return;
    }
    await load();
  }

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Meus jogos</p>
        <h1>Combinações preservadas.</h1>
        <p className="muted">
          Salvar não registra uma aposta na CAIXA. Cada combinação permanece
          imutável e suas conferências são vinculadas à revisão oficial usada.
        </p>
      </div>
      {loading ? (
        <div className="state-panel">Carregando jogos…</div>
      ) : error && games.length === 0 ? (
        <ErrorState title={error} onRetry={() => void load()} />
      ) : games.length === 0 ? (
        <EmptyState title="Nenhum jogo salvo">
          Gere um lote e escolha quais combinações deseja preservar.
        </EmptyState>
      ) : (
        <Card className="game-list">
          {error ? <p role="alert">{error}</p> : null}
          {games.map((game) => (
            <GameCard
              key={game.id}
              numbers={game.numbers}
              luckyMonth={game.luckyMonth}
              strategy={game.name}
              actions={
                <>
                  {game.tracking.some((item) => item.active) ? (
                    <span className="freshness freshness-verified">
                      Em acompanhamento
                    </span>
                  ) : (
                    <Button
                      className="secondary"
                      onClick={() => void track(game)}
                    >
                      Acompanhar
                    </Button>
                  )}
                  <Button
                    className="secondary"
                    onClick={() => void archive(game)}
                  >
                    {game.archivedAt ? "Restaurar" : "Arquivar"}
                  </Button>
                </>
              }
            >
              {game.archivedAt ? <p className="muted">Arquivado</p> : null}
              {game.evaluations.length ? (
                <div>
                  {game.evaluations.map((evaluation) => (
                    <p key={evaluation.id} className="muted">
                      Concurso {evaluation.drawRevision.draw.contestNumber}:{" "}
                      {evaluation.numberHits} acertos
                      {evaluation.luckyMonthHit === null
                        ? ""
                        : evaluation.luckyMonthHit
                          ? " · Mês da Sorte correto"
                          : " · Mês da Sorte diferente"}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="muted">Ainda sem concursos conferidos.</p>
              )}
            </GameCard>
          ))}
        </Card>
      )}
    </>
  );
}