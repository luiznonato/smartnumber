# Status

Fundação e uma fatia vertical local foram criadas em 2026-09-10. O repositório original tinha somente um README. Implementados: monorepo, contratos, schema das entidades mínimas, API, worker, analytics, UI, Compose, segurança básica, geração uniforme e testes matemáticos.

Verificados: lockfiles, geração Prisma, migrations, typecheck, testes, builds, auditoria sem vulnerabilidades, CLI e benchmark sintético. PostgreSQL/Redis isolados, role real `atlas_app`, RLS entre usuários e autenticação persistente foram exercitados. Um teste de integração reproduz o ciclo dos concursos oficiais 1–3 de Mega-Sena, Lotofácil e Dia de Sorte. A API persiste revisão/outbox, chama o FastAPI, publica snapshot+lote atomicamente, salva o jogo, confere o resultado seguinte e vincula o novo lote ao anterior. O mês do Dia de Sorte usa seed separada, baseline uniforme 1/12 e conferência independente.

Demo estático publicado em 2026-09-10 em `https://smart.nonato.me` via SFTP/Hestia. HTTPS, páginas, ativos, favicon, geração local e layout mobile foram verificados. O demo não oferece contas, persistência, cobrança ou resultados oficiais.

O backend integrado não está publicado nessa VPS: o acesso fornecido é somente
SFTP, sem shell para Docker ou configuração Nginx. O demo público continua sendo
estático. `docs/VPS_DEPLOY.md` registra a configuração necessária para preservar
o Hestia e encaminhar `/api` ao backend local.

Pendências prioritárias: importar e reconciliar todo o histórico oficial; mover a
orquestração síncrona para o worker/outbox; ampliar RLS para todas as entidades
privadas; publicar o backend na VPS; SMTP, billing, backup e restauração.

Próximo passo preciso: implementar um importador histórico paginado e reiniciável,
com checkpoint e reconciliação de lacunas, usando arquivo oficial administrado
enquanto a origem remota bloquear esta VPS.
