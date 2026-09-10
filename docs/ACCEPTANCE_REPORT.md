# Relatório de aceite

## Implementado e testável localmente

Contratos e regras; geração uniforme reproduzível; conferência do mês independente; validação de ingestão; fórmulas hipergeométrica/par; prevenção de leakage no backtest; autenticação criptográfica; quota idempotente; billing fail-closed; pipeline BullMQ; interface responsiva.

Executado em 2026-09-10: typecheck TypeScript; 17 testes Vitest; 6 testes pytest; build de API, web e worker; geração Prisma; CLI uniforme; auditoria npm (zero vulnerabilidades); benchmark sintético de 3.000 concursos em 0,012 s e pico RSS de 95.756 KiB neste host. O benchmark não mede produção nem usa histórico oficial.

## Implementado sem verificação externa

Schema e migrations PostgreSQL/RLS, Compose/Caddy, OpenAPI e imagens. O runtime Docker não existe neste host, portanto o smoke Compose e a restauração não foram executados.

## Pendente externo

Histórico oficial real e cobertura; endpoint/licença/limites da CAIXA; regras detalhadas e preços por vigência; billing real; SMTP; RLS com roles; backup externo/restauração; VPS/TLS; revisão jurídica.

## Resultado estatístico

Nenhum backtest com dados reais foi executado. Portanto não há evidência de vantagem sobre o acaso. Fixtures sintéticas não autorizam conclusão comercial.
