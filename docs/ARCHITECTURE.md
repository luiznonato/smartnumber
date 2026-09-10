# Arquitetura

`apps/web` é a interface Next.js. `apps/api` concentra autorização, persistência Prisma, OpenAPI, autenticação e billing. `apps/worker` executa BullMQ em estágios idempotentes. `services/analytics` recebe datasets identificados por SHA-256, valida o hash e executa cálculos determinísticos sem acesso ao banco. `packages/contracts` contém regras e validações; `packages/ui`, tokens/componentes.

PostgreSQL é canônico. Redis contém apenas fila, locks e cache. O fluxo de resultado é collect → validate → persist+outbox → evaluate → features → snapshot → suggestions → atomic publish → notify. Chaves incluem modalidade, concurso, revisão, versão e estágio. O processamento por modalidade deve usar lock e corte monotônico. Correções criam revisão; nunca reescrevem conhecimento publicado.

Somente Caddy expõe portas públicas. Analytics, Redis e PostgreSQL permanecem na rede interna. API e migrations usarão roles distintas; RLS precisa ser instalada e validada em banco real antes de produção.
