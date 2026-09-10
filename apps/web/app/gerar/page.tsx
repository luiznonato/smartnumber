"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ExplanationPanel,
  GameCard,
  LotterySwitcher,
  StrategySelector,
} from "@atlas/ui";

type Lottery = "mega-sena" | "lotofacil" | "dia-de-sorte";
type Strategy =
  | "uniform"
  | "recent-frequency"
  | "historical-profile"
  | "diversified";
type Options = {
  sample: { n: number; firstContest: number | null; lastContest: number | null };
  freshnessStatus: string;
  strategies: Array<{
    id: Strategy;
    label: string;
    minimumSample: number;
    available: boolean;
    hasScore: boolean;
  }>;
};
type GeneratedGame = {
  id: string;
  numbers: number[];
  luckyMonth: number | null;
  score: number | null;
  scoreBreakdown: {
    method?: string;
    notice?: string;
    window?: number;
    numbers?: Array<{
      number: number;
      count: number;
      relative_weight: number;
    }>;
    observed?: {
      sum?: number;
      odd?: number;
      previous_overlap?: number;
    };
    component_percentiles?: Record<string, number>;
    diversity?: { max_with_selected: number; candidate_pool: number };
  };
};
type Batch = {
  id: string;
  status: string;
  targetContest: number;
  games: GeneratedGame[];
  strategyVersion: { strategy: { name: string } };
};

const descriptions: Record<Strategy, string> = {
  uniform: "Controle uniforme, sem score ou uso do histórico.",
  "recent-frequency":
    "Pondera frequências observadas com suavização explícita.",
  "historical-profile":
    "Compara soma, paridade, faixas e repetição a uma referência uniforme.",
  diversified:
    "Reduz a interseção entre jogos de uma estratégia base.",
};

function parseNumbers(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return [];
  return text
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);
}

function Explanation({ game }: { game: GeneratedGame }) {
  const detail = game.scoreBreakdown;
  const recent = detail.numbers?.slice(0, 3);
  return (
    <ExplanationPanel
      summary={
        <>
          {detail.method ? <p>{detail.method}</p> : null}
          {recent?.length ? (
            <p>
              Dezenas em destaque:{" "}
              {recent
                .map(
                  (item) =>
                    `${item.number} (${item.count} ocorrências; peso ${item.relative_weight.toFixed(2)})`,
                )
                .join(", ")}
              .
            </p>
          ) : null}
          {detail.observed ? (
            <p>
              Soma {detail.observed.sum}; {detail.observed.odd} ímpares;{" "}
              {detail.observed.previous_overlap} repetidas do concurso anterior.
            </p>
          ) : null}
          {detail.diversity ? (
            <p>
              Jaccard máximo com os jogos já escolhidos:{" "}
              {detail.diversity.max_with_selected.toFixed(2)}.
            </p>
          ) : null}
        </>
      }
    >
      {detail.component_percentiles ? (
        <p>
          Componentes:{" "}
          {Object.entries(detail.component_percentiles)
            .map(([key, value]) => `${key} ${value.toFixed(0)}`)
            .join(" · ")}
        </p>
      ) : null}
      <p>{detail.notice}</p>
    </ExplanationPanel>
  );
}

export default function Generate() {
  const [lottery, setLottery] = useState<Lottery>("mega-sena");
  const [strategy, setStrategy] = useState<Strategy>("uniform");
  const [options, setOptions] = useState<Options | null>(null);
  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const loadOptions = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/generation/${lottery}/options`, {
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) {
        throw new Error("Entre na sua conta para gerar e salvar jogos.");
      }
      if (!response.ok) throw new Error("Não foi possível consultar a base.");
      const result: Options = await response.json();
      setOptions(result);
      const current = result.strategies.find((item) => item.id === strategy);
      if (!current?.available) setStrategy("uniform");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [lottery, strategy]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/generation", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lottery,
          strategy,
          count: Number(form.get("count")),
          window: Number(form.get("window")),
          alpha: Number(form.get("alpha")),
          tau: Number(form.get("tau")),
          fixed: parseNumbers(form.get("fixed")),
          excluded: parseNumbers(form.get("excluded")),
          baseStrategy: form.get("baseStrategy"),
          allowStaleSimulation: form.get("allowStaleSimulation") === "on",
          requestKey: crypto.randomUUID(),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.message ?? "A geração não pôde ser concluída.");
      }
      setBatch(result);
      setSaved(new Set());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function save(gameId: string) {
    const response = await fetch("/api/saved-games", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suggestedGameId: gameId, name: "Jogo sugerido" }),
    });
    if (!response.ok) {
      setError("Não foi possível salvar o jogo.");
      return;
    }
    setSaved((current) => new Set(current).add(gameId));
  }

  const strategyOptions =
    options?.strategies.map((item) => ({
      ...item,
      description: item.available
        ? descriptions[item.id]
        : `${descriptions[item.id]} Exige ${item.minimumSample} concursos.`,
    })) ?? [];

  return (
    <>
      <div className="page-intro">
        <p className="eyebrow">Gerar jogos</p>
        <h1>Escolha uma lógica que você entende.</h1>
        <p className="muted">
          Nenhum motor prevê o próximo sorteio. Estratégias históricas organizam
          escolhas e permanecem comparáveis ao controle aleatório.
        </p>
      </div>
      <LotterySwitcher
        value={lottery}
        onChange={(value) => {
          setLottery(value);
          setBatch(null);
        }}
      />
      {loading ? (
        <div className="state-panel">Consultando a base…</div>
      ) : error && !options ? (
        <ErrorState title={error} onRetry={() => void loadOptions()} />
      ) : (
        <div className="two-column">
          <Card>
            <form onSubmit={generate}>
              <StrategySelector
                value={strategy}
                options={strategyOptions}
                onChange={(value) => setStrategy(value as Strategy)}
              />
              <label>
                Quantidade de jogos
                <input
                  name="count"
                  type="number"
                  min="1"
                  max="20"
                  defaultValue="3"
                />
              </label>
              <details className="explanation">
                <summary>Parâmetros avançados</summary>
                <label>
                  Janela de concursos
                  <input name="window" type="number" min="10" max="500" defaultValue="50" />
                </label>
                <label>
                  Suavização alpha
                  <input name="alpha" type="number" min="0.1" max="100" step="0.1" defaultValue="10" />
                </label>
                <label>
                  Intensidade tau
                  <input name="tau" type="number" min="0" max="3" step="0.1" defaultValue="1" />
                </label>
                <label>
                  Dezenas fixas (separadas por vírgula)
                  <input name="fixed" inputMode="numeric" />
                </label>
                <label>
                  Dezenas excluídas
                  <input name="excluded" inputMode="numeric" />
                </label>
                {strategy === "diversified" ? (
                  <label>
                    Estratégia base
                    <select name="baseStrategy" defaultValue="recent-frequency">
                      <option value="uniform">Aleatório</option>
                      <option value="recent-frequency">Frequência recente</option>
                      <option value="historical-profile">Perfil histórico</option>
                    </select>
                  </label>
                ) : null}
              </details>
              {options?.freshnessStatus !== "VERIFIED" &&
              strategy !== "uniform" ? (
                <label className="strategy-option">
                  <input type="checkbox" name="allowStaleSimulation" />
                  <span>
                    <strong>Gerar como simulação com corte explícito</strong>
                    <small>
                      A base não está verificada como atual. O lote não será
                      apresentado como sugestão para o próximo concurso.
                    </small>
                  </span>
                </label>
              ) : null}
              {error ? <p role="alert">{error}</p> : null}
              <Button type="submit" disabled={busy}>
                {busy ? "Calculando…" : "Gerar no servidor"}
              </Button>
            </form>
          </Card>
          <Card>
            <p className="eyebrow">Amostra disponível</p>
            <h2>{options?.sample.n ?? 0} concursos</h2>
            <p className="muted">
              {options?.sample.firstContest && options.sample.lastContest
                ? `Do concurso ${options.sample.firstContest} ao ${options.sample.lastContest}.`
                : "Nenhum histórico confirmado na base."}
            </p>
            <p className="muted">
              A opção aleatória permanece disponível sem histórico e não recebe
              score.
            </p>
          </Card>
        </div>
      )}

      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Resultado</p>
            <h2>Jogos gerados</h2>
          </div>
          {batch ? <span className="muted">Concurso alvo {batch.targetContest}</span> : null}
        </div>
        {!batch ? (
          <EmptyState title="Nenhum lote gerado">
            Selecione uma estratégia e envie os parâmetros.
          </EmptyState>
        ) : (
          <Card className="game-list">
            {batch.status === "SIMULATION" ? (
              <p className="freshness freshness-behind_source">
                Simulação com base desatualizada
              </p>
            ) : null}
            {batch.games.map((game) => (
              <GameCard
                key={game.id}
                numbers={game.numbers}
                luckyMonth={game.luckyMonth}
                strategy={batch.strategyVersion.strategy.name}
                score={game.score}
                actions={
                  <Button
                    className={saved.has(game.id) ? "secondary" : ""}
                    disabled={saved.has(game.id)}
                    onClick={() => void save(game.id)}
                  >
                    {saved.has(game.id) ? "Salvo" : "Salvar jogo"}
                  </Button>
                }
              >
                <Explanation game={game} />
              </GameCard>
            ))}
          </Card>
        )}
      </section>
    </>
  );
}