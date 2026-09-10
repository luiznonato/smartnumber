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

## Correção funcional e visual concluída localmente

Auditoria atual e plano registrados em `CURRENT_GENERATION_AUDIT.md` e
`CORRECTION_PLAN.md`. Implementados nesta etapa: endpoint do último resultado
canônico com freshness/cobertura; estratégias uniform-v2, recent-frequency-v2,
historical-profile-v1 e diversified-v1; geração autenticada/persistida com quota
atômica; arquivamento e acompanhamento; importação administrativa com
prévia/confirmação; MFA TOTP administrativo; scheduler de coleta no worker; e
novo shell branco conectado para Início, Análises, Gerar e Meus jogos.

Concluídos nesta etapa: sete migrations em banco novo, lint, typecheck, 31 testes
TypeScript, 10 testes Python, sete testes integrados em PostgreSQL/Redis,
construção das quatro imagens, restauração isolada, smoke HTTP de cadastro →
geração uniforme → salvamento → nova leitura e inspeção visual em desktop,
390 px e 360 px. A migration de compatibilidade corrige loterias antigas que
tinham resultado canônico, mas permaneciam marcadas como `NO_RESULTS`.

O Compose deixa o Caddy no profile explícito `standalone-proxy`; por padrão não
ocupa 80/443 do Hestia. As imagens iniciaram e os healthchecks individuais
passaram. Nesta VM Cloud, porém, o tráfego entre containers na bridge Docker
sofreu timeout, de modo que o smoke funcional foi concluído com os mesmos
serviços expostos somente em loopback e um proxy local. Isso não deve ser
registrado como validação integral da rede Compose na VPS.

Pendências externas permanecem: importar/reconciliar o histórico oficial
completo; obter acesso shell autorizado à VPS para subir API, worker, analytics,
PostgreSQL e Redis e configurar o include do Hestia; configurar SMTP, billing e
backup externo. `smart.nonato.me` ainda aponta para o demo estático anterior.
