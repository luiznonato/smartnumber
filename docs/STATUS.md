# Status

Fundação e uma fatia vertical local foram criadas em 2026-09-10. O repositório original tinha somente um README. Implementados: monorepo, contratos, schema das entidades mínimas, API, worker, analytics, UI, Compose, segurança básica, geração uniforme e testes matemáticos.

Verificados: lockfiles, geração Prisma, migrations, typecheck, testes, builds, auditoria sem vulnerabilidades, CLI e benchmark sintético. PostgreSQL/Redis isolados, role real `atlas_app`, RLS entre usuários e autenticação persistente foram exercitados. Um teste de integração reproduz o ciclo dos concursos oficiais 1–3 de Mega-Sena, Lotofácil e Dia de Sorte. A API persiste revisão/outbox, chama o FastAPI, publica snapshot+lote atomicamente, salva o jogo, confere o resultado seguinte e vincula o novo lote ao anterior. O mês do Dia de Sorte usa seed separada, baseline uniforme 1/12 e conferência independente.

Demo estático publicado em 2026-09-10 em `https://smart.nonato.me` via SFTP/Hestia. HTTPS, páginas, ativos, favicon, geração local e layout mobile foram verificados. O demo não oferece contas, persistência, cobrança ou resultados oficiais.

O backend integrado não está publicado nessa VPS: o acesso fornecido é somente
SFTP, sem shell para Docker ou configuração Nginx. O demo público continua sendo
estático. `docs/VPS_DEPLOY.md` registra a configuração necessária para preservar
o Hestia e encaminhar `/api` ao backend local.

Pendências prioritárias: importar e reconciliar todo o histórico oficial; ampliar
RLS para todas as entidades privadas; publicar o backend na VPS; SMTP, billing,
backup e restauração.

O CLI agora importa arrays de payloads oficiais em ordem, registra progresso em
`ImportRun` e retoma pelo UUID do checkpoint. A sincronização remota também usa
lotes, atraso configurável e reconciliação de lacunas; a cobertura total ainda
depende de executar todos os lotes em um host aceito pela origem.

A interface JSON do portal CAIXA está integrada atrás de `CAIXA_ENABLED`.
Sincroniza o último concurso ou histórico em lotes de até 100, preservando
payload/hash/origem, premiação e próximo concurso. O painel administrativo expõe
sincronização, retomada e cobertura. O teste persistente de retomada passou; a
requisição real desta VM continua bloqueada com HTTP 403 e foi auditada em
`SourceFetch`.

O pós-importação agora é assíncrono: a API grava revisão+outbox, o worker consome
em ordem, chama um endpoint interno autenticado e marca publicação apenas após o
`JobRun` idempotente concluir. O ciclo foi exercitado localmente até zerar nove
eventos pendentes.

Próximo passo preciso: ampliar as políticas e testes RLS para entidades privadas
filhas (`GameRevision`, `TrackingSubscription`, assinatura e quotas) e implementar
gerenciamento de verificação de e-mail/recuperação de senha.
