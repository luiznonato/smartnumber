"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Card,
  EmptyState,
  ErrorState,
  GameCard,
  LatestDrawPanel,
  LotterySwitcher,
} from "@atlas/ui";

type Lottery = "mega-sena" | "lotofacil" | "dia-de-sorte";
type LatestDraw = {
  lottery: Lottery;
  state: string;
  sourceLatestContest?: number | null;
  draw: null | {
    contestNumber: number;
    drawDate: string;
    numbers: number[];
    luckyMonth: number | null;
    accumulated: boolean | null;
    prizeState: string;
    sourceUrl: string;
    sourceVerifiedAt: string | null;
  };
  nextContest?: {
    contestNumber: number | null;
    drawDate: string | null;
  };
  coverage?: {
    confirmedDraws?: number;
    firstContest?: number | null;
    lastContest?: number | null;
    complete?: boolean;
  } | null;
};
type Batch = {
  id: string;
  targetContest: number;
  snapshot: { cutoffContest: number };
  strategyVersion: { strategy: { name: string } };
  games: Array<{
    id: string;
    numbers: number[];
    luckyMonth: number | null;
    score: number | null;
  }>;
};

const lotteryNames: Record<Lottery, string> = {
  "mega-sena": "Mega-Sena",
  lotofacil: "Lotofácil",
  "dia-de-sorte": "Dia de Sorte",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

export function HomeDashboard() {
  const [lottery, setLottery] = useState<Lottery>("mega-sena");
  const [latest, setLatest] = useState<LatestDraw | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [drawResponse, suggestionResponse] = await Promise.all([
        fetch(`/api/draws/${lottery}/latest`, { cache: "no-store" }),
        fetch(`/api/suggestions/${lottery}/latest`, { cache: "no-store" }),
      ]);
      if (!drawResponse.ok) throw new Error("draw unavailable");
      setLatest(await drawResponse.json());
      setBatch(suggestionResponse.ok ? await suggestionResponse.json() : null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [lottery]);

  useEffect(() => {
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 300_000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [load]);

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Análise de loterias</p>
        <h1>Histórico claro. Escolhas explicadas.</h1>
        <p className="muted">
          Consulte resultados, entenda cada estratégia e acompanhe combinações
          sem promessas de previsão.
        </p>
      </div>
      <LotterySwitcher value={lottery} onChange={setLottery} />

      {loading ? (
        <div className="state-panel" aria-live="polite">
          Carregando resultado…
        </div>
      ) : error ? (
        <ErrorState
          title="A API não respondeu"
          onRetry={() => void load()}
        />
      ) : !latest?.draw ? (
        <EmptyState title="Sem resultados na base">
          Importe resultados oficiais na administração. Nenhuma dezena fictícia
          será exibida.
        </EmptyState>
      ) : (
        <LatestDrawPanel
          title={lotteryNames[lottery]}
          contest={latest.draw.contestNumber}
          date={formatDate(latest.draw.drawDate)}
          numbers={latest.draw.numbers}
          luckyMonth={latest.draw.luckyMonth}
          freshness={latest.state}
          source={latest.draw.sourceUrl}
        >
          <p className="muted">
            {latest.draw.accumulated === null
              ? "Situação de acumulação não informada."
              : latest.draw.accumulated
                ? "Prêmio principal acumulado."
                : "Prêmio principal não acumulado."}
            {latest.draw.prizeState === "PENDING"
              ? " Premiação pendente."
              : ""}
          </p>
          {latest.nextContest?.contestNumber ? (
            <p className="muted">
              Próximo concurso {latest.nextContest.contestNumber}
              {latest.nextContest.drawDate
                ? ` · ${formatDate(latest.nextContest.drawDate)}`
                : ""}
            </p>
          ) : null}
        </LatestDrawPanel>
      )}

      <section className="section two-column">
        <Card>
          <p className="eyebrow">Próximo passo</p>
          <h2>Gere jogos no servidor</h2>
          <p className="muted">
            Escolha entre controle aleatório, frequência recente, perfil
            histórico e carteira diversificada.
          </p>
          <Link className="button" href="/gerar">
            Gerar jogos
          </Link>
        </Card>
        <Card>
          <p className="eyebrow">Base da análise</p>
          <h2>
            {latest?.coverage?.confirmedDraws ?? 0} concursos confirmados
          </h2>
          <p className="muted">
            {latest?.coverage?.complete
              ? "Cobertura contínua reconciliada com a fonte."
              : "Cobertura parcial ou ainda não reconciliada."}
          </p>
        </Card>
      </section>

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Sugestões atuais</p>
            <h2>Último lote publicado</h2>
          </div>
          {batch ? (
            <span className="muted">
              Corte no concurso {batch.snapshot.cutoffContest}
            </span>
          ) : null}
        </div>
        {!batch ? (
          <EmptyState title="Nenhuma sugestão atual">
            Estratégias históricas só são publicadas com amostra suficiente e
            base reconciliada.
          </EmptyState>
        ) : (
          <Card className="game-list">
            {batch.games.slice(0, 3).map((game) => (
              <GameCard
                key={game.id}
                numbers={game.numbers}
                luckyMonth={game.luckyMonth}
                strategy={batch.strategyVersion.strategy.name}
                score={game.score}
              />
            ))}
          </Card>
        )}
      </section>
    </>
  );
}
