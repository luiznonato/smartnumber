import "./globals.css";
import Link from "next/link";
import { AppShell } from "@atlas/ui";

export const metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME ?? "Atlas Loto",
  description: "Análise estatística transparente de loterias brasileiras",
};

const primary = [
  ["/", "Início"],
  ["/explorar", "Análises"],
  ["/gerar", "Gerar jogos"],
  ["/jogos", "Meus jogos"],
] as const;

export default function Layout({ children }: { children: React.ReactNode }) {
  const name = process.env.NEXT_PUBLIC_APP_NAME ?? "Atlas Loto";
  const navigation = (
    <nav className="bottom-nav" aria-label="Navegação principal móvel">
      {primary.map(([href, label]) => (
        <Link key={href} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
  const header = (
    <header className="site-header">
      <div className="header-inner">
        <Link href="/" className="brand">
          {name}
          <small>Análise responsável</small>
        </Link>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {primary.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <nav className="secondary-nav" aria-label="Navegação secundária">
          <Link href="/metodologia">Metodologia</Link>
          <Link href="/conta" className="account-link">
            Conta
          </Link>
        </nav>
      </div>
    </header>
  );
  return (
    <html lang="pt-BR">
      <body>
        <AppShell header={header} navigation={navigation}>
          <main>{children}</main>
          <footer>
            Software de análise e organização. Jogos salvos não são apostas
            registradas na CAIXA.
          </footer>
        </AppShell>
      </body>
    </html>
  );
}