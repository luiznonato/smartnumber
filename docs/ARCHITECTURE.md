# Arquitetura

`apps/web` é a interface Next.js. `apps/api` concentra autorização, persistência Prisma, OpenAPI, autenticação e billing. `apps/worker` executa BullMQ em estágios idempotentes. `services/analytics` recebe datasets identificados por SHA-256, valida o hash e executa cálculos determinísticos sem acesso ao banco. `packages/contracts` contém regras e validações; `packages/ui`, tokens/componentes.

PostgreSQL é canônico. Redis contém apenas fila, locks e cache. O fluxo de
resultado é collect → validate → persist+outbox → evaluate → features → snapshot
→ suggestions → atomic publish → notify. A requisição de importação encerra após
a transação de revisão+outbox. O worker consulta a outbox, publica
`atlas-draw-events` em ordem e chama um endpoint interno autenticado da API. A API
usa `JobRun` por revisão/versão para impedir reprocessamento concluído; o worker
só marca `publishedAt` depois da resposta bem-sucedida. Após três falhas, o evento
vai para `atlas-dead-letter`.

A concorrência atual é 1, preservando a ordem global e, portanto, por modalidade.
Um particionamento futuro pode aumentar paralelismo, mas deve manter concorrência
1 dentro de cada modalidade. Correções criam revisão; nunca reescrevem
conhecimento publicado.

Somente Caddy expõe portas públicas. Analytics, Redis e PostgreSQL permanecem na rede interna. API e migrations usarão roles distintas; RLS precisa ser instalada e validada em banco real antes de produção.
