# Plano de implementação

## Sequência verificável

- A — Fundação: workspaces npm, Next.js, NestJS/OpenAPI, Prisma/PostgreSQL, BullMQ/Redis, FastAPI e Compose.
- B — Dados: contratos de modalidade, adaptador desativado por padrão, importação administrativa com prévia, revisão e qualidade no schema.
- C — Motor: estatísticas auditáveis, distribuição hipergeométrica, geração reproduzível e baseline uniforme.
- D — Produto: navegação responsiva, jogos imutáveis e pipeline de conferência/publicação modelado.
- E — Laboratório: backtest walk-forward por concurso e avaliação prospectiva modelada.
- F — SaaS: autenticação Argon2id, sessões, planos, quotas, cobrança fail-closed e privacidade.
- G — Operação: proxy TLS, limites, observabilidade, backup/restauração e benchmark.

Cada fase só é considerada externamente concluída após credenciais, importação real, smoke Compose e aceite. Implementação incremental deve preservar hashes, cortes temporais, revisões e eventos anteriores.
