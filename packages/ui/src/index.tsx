import type {
  ButtonHTMLAttributes,
  PropsWithChildren,
  ReactNode,
} from "react";

export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`button ${className}`} />;
}

export function Card({
  children,
  className = "",
}: PropsWithChildren<{ className?: string }>) {
  return <section className={`surface ${className}`}>{children}</section>;
}

export function NumberChip({
  value,
  selected = false,
}: {
  value: number;
  selected?: boolean;
}) {
  return (
    <span
      className={`number-chip ${selected ? "selected" : ""}`}
      aria-label={`Dezena ${value}`}
    >
      {String(value).padStart(2, "0")}
    </span>
  );
}

export const NumberBall = NumberChip;

export function AppShell({
  header,
  children,
  navigation,
}: PropsWithChildren<{ header: ReactNode; navigation: ReactNode }>) {
  return (
    <div className="app-shell">
      {header}
      <div className="app-content">{children}</div>
      {navigation}
    </div>
  );
}

export function LotterySwitcher({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: "mega-sena" | "lotofacil" | "dia-de-sorte") => void;
}) {
  const options = [
    ["mega-sena", "Mega-Sena"],
    ["lotofacil", "Lotofácil"],
    ["dia-de-sorte", "Dia de Sorte"],
  ] as const;
  return (
    <div className="lottery-switcher" role="group" aria-label="Modalidade">
      {options.map(([id, label]) => (
        <button
          type="button"
          key={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const freshnessLabels: Record<string, string> = {
  VERIFIED: "Atualização verificada",
  VERIFICATION_UNAVAILABLE: "Verificação indisponível",
  BEHIND_SOURCE: "Base em atualização",
  UNVERIFIED: "Atualidade não verificada",
  NO_RESULTS: "Sem resultados",
};

export function DataFreshnessLabel({ state }: { state: string }) {
  return (
    <span className={`freshness freshness-${state.toLowerCase()}`}>
      {freshnessLabels[state] ?? state}
    </span>
  );
}

export function LatestDrawPanel({
  title,
  contest,
  date,
  numbers,
  luckyMonth,
  freshness,
  source,
  children,
}: PropsWithChildren<{
  title: string;
  contest: number;
  date: string;
  numbers: number[];
  luckyMonth?: number | null;
  freshness: string;
  source?: string;
}>) {
  return (
    <section className="latest-draw">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h1>Concurso {contest}</h1>
          <p className="muted">{date}</p>
        </div>
        <DataFreshnessLabel state={freshness} />
      </div>
      <div className="number-list">
        {numbers.map((number) => (
          <NumberChip key={number} value={number} />
        ))}
      </div>
      {luckyMonth ? (
        <p className="lucky-month">Mês da Sorte: {luckyMonth}</p>
      ) : null}
      {children}
      {source ? (
        <a className="source-link" href={source} rel="noreferrer" target="_blank">
          Consultar origem
        </a>
      ) : null}
    </section>
  );
}

export function StrategySelector({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
    available: boolean;
  }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="strategy-list" role="radiogroup" aria-label="Estratégia">
      {options.map((option) => (
        <label
          key={option.id}
          className={`strategy-option ${!option.available ? "disabled" : ""}`}
        >
          <input
            type="radio"
            name="strategy"
            value={option.id}
            checked={value === option.id}
            disabled={!option.available}
            onChange={() => onChange(option.id)}
          />
          <span>
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </span>
        </label>
      ))}
    </div>
  );
}

export function ExplanationPanel({
  summary,
  children,
}: PropsWithChildren<{ summary: ReactNode }>) {
  return (
    <details className="explanation">
      <summary>Por que este jogo?</summary>
      <div>{summary}</div>
      {children}
    </details>
  );
}

export function GameCard({
  numbers,
  luckyMonth,
  strategy,
  score,
  actions,
  children,
}: PropsWithChildren<{
  numbers: number[];
  luckyMonth?: number | null;
  strategy: string;
  score?: number | null;
  actions?: ReactNode;
}>) {
  return (
    <article className="game-card">
      <div className="game-meta">
        <span>{strategy}</span>
        {score === null || score === undefined ? null : (
          <span>Aderência {score.toFixed(0)}</span>
        )}
      </div>
      <div className="number-list compact">
        {numbers.map((number) => (
          <NumberChip key={number} value={number} />
        ))}
      </div>
      {luckyMonth ? <p>Mês da Sorte: {luckyMonth}</p> : null}
      {children}
      {actions ? <div className="actions">{actions}</div> : null}
    </article>
  );
}

export function EmptyState({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  return (
    <div className="state-panel">
      <h2>{title}</h2>
      <div className="muted">{children}</div>
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar",
  onRetry,
}: {
  title?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-panel error" role="alert">
      <h2>{title}</h2>
      <p>Os dados salvos foram preservados. Tente novamente em instantes.</p>
      {onRetry ? <Button onClick={onRetry}>Tentar novamente</Button> : null}
    </div>
  );
}

export function AdminShell({ children }: PropsWithChildren) {
  return <div className="admin-shell">{children}</div>;
}
