# Status

Fundação e uma fatia vertical local foram criadas em 2026-09-10. O repositório original tinha somente um README. Implementados: monorepo, contratos, schema das entidades mínimas, API, worker, analytics, UI, Compose, segurança básica, geração uniforme e testes matemáticos.

Verificados: lockfiles, geração Prisma, migrations, typecheck, testes, builds, auditoria sem vulnerabilidades, CLI e benchmark sintético. PostgreSQL/Redis isolados, role real `atlas_app`, RLS entre usuários, autenticação persistente e o ciclo Mega-Sena de três concursos foram exercitados. A API persiste revisão/outbox, chama o FastAPI, publica snapshot+lote atomicamente, salva o jogo, confere o resultado seguinte e vincula o novo lote ao anterior.

Demo estático publicado em 2026-09-10 em `https://smart.nonato.me` via SFTP/Hestia. HTTPS, páginas, ativos, favicon, geração local e layout mobile foram verificados. O demo não oferece contas, persistência, cobrança ou resultados oficiais.

O backend integrado não está publicado nessa VPS: o acesso fornecido é somente
SFTP, sem shell para Docker ou configuração Nginx. O demo público continua sendo
estático. `docs/VPS_DEPLOY.md` registra a configuração necessária para preservar
o Hestia e encaminhar `/api` ao backend local.

Pendências prioritárias: importar e reconciliar todo o histórico oficial; mover a
orquestração síncrona para o worker/outbox; validar os ciclos persistentes de
Lotofácil e Dia de Sorte com fixtures oficiais registradas; publicar o backend na
VPS; SMTP, billing, backup e restauração.

Próximo passo preciso: subir PostgreSQL/Redis em host com Docker, aplicar as migrations com roles separadas e validar RLS entre dois usuários. Depois realizar um import de arquivo oficial reconciliado antes de habilitar sugestões atuais.
