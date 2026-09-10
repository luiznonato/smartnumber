# Relatório de aceite

## Jornada funcional observada

Em 2026-09-10, o smoke local integrado executou cadastro com cookie de sessão,
geração de dois jogos Mega-Sena por `uniform-v2`, salvamento de uma sugestão e
nova leitura após outra requisição. O retorno observado foi
`{"status":"ok","latestHttp":200,"generated":2,"saved":1}`.

A suite persistente executou sete cenários em PostgreSQL/Redis: ciclo
resultado → snapshot → sugestão → jogo salvo → resultado seguinte → conferência
→ lote sucessor nas três modalidades; histórico CAIXA retomável; MFA
administrativo; isolamento RLS entre dois usuários, quota/idempotência; e
prévia/confirmação idempotente de CSV. Fixtures oficiais capturadas são
identificadas como fixtures e não representam cobertura histórica completa.

## Geração e explicações

- `uniform-v2`: amostragem uniforme sem reposição, seed persistida e sem score;
- `recent-frequency-v2`: frequência suavizada, mínimo de 10 concursos;
- `historical-profile-v1`: soma, paridade, faixas e interseção, mínimo de 25;
- `diversified-v1`: seleção de carteira por interseção Jaccard;
- indisponibilidade da API não aciona gerador local;
- estratégia histórica insuficiente ou desatualizada é bloqueada ou marcada
  explicitamente como simulação;
- nenhum teste demonstrou vantagem estatística sobre o aleatório.

As fórmulas e limitações estão em `docs/METHODOLOGY.md`; a lógica substituída
está em `docs/CURRENT_GENERATION_AUDIT.md`.

## Dados e fonte

O endpoint do último resultado escolhe o maior concurso canônico, preserva cache
em falhas e separa atualização da data de importação. A compatibilidade com dados
anteriores foi testada: um concurso canônico legado deixou de aparecer como
`NO_RESULTS`, passou a `UNVERIFIED`, e a cobertura calculada retornou concursos
1–3 sem afirmar reconciliação com a fonte.

A interface JSON do portal CAIXA é não documentada. A requisição desta VM recebeu
HTTP 403 e foi auditada em `SourceFetch`; isso não valida disponibilidade na VPS.
O importador administrativo CSV/JSON está funcional, mas o histórico oficial
completo não foi importado.

## Segurança e persistência

Cadastro/login, logout, expiração/revogação, verificação de e-mail e recuperação
de senha usam PostgreSQL. O backend deriva o usuário da sessão. RLS foi exercida
com a role `atlas_app` sem `BYPASSRLS`; A não leu nem alterou jogos de B.
Administrador exige senha e MFA TOTP ou código de recuperação. Cadastro público
não cria admin, suspensão revoga sessões e ações são auditadas.

## Interface

Inspeção manual confirmou geração e salvamento em desktop, foco visível e
navegação por teclado. Em viewports medidos de 390 e 360 CSS px,
`scrollWidth == innerWidth`; a navegação inferior apareceu, a navegação desktop
foi ocultada e quinze dezenas da Lotofácil quebraram em linhas. Não foram
encontrados dados fictícios ou fallback de sucesso quando a API falha.

## Verificações executadas

- `npm run db:generate`, `npm run lint`, `npm run typecheck`;
- 27 testes API, 2 worker, 2 contratos e 10 analytics;
- 7 testes integrados persistentes;
- 7 migrations aplicadas do zero em `atlas_loto_migration_test`;
- build das imagens `api`, `worker`, `web` e `analytics`;
- `npm audit --audit-level=high`: 0 vulnerabilidades;
- backup custom e restauração isolada: 1 concurso e 1 revisão preservados.

## Deploy e pendências

O Caddy está sob profile `standalone-proxy`; o Compose padrão não ocupa 80/443
do Hestia. As imagens e healthchecks individuais iniciaram, mas a bridge Docker
desta VM bloqueou tráfego entre containers, portanto a rede Compose completa
não foi declarada validada. O smoke funcional usou serviços equivalentes
expostos somente em loopback.

`smart.nonato.me` continua sendo o demo estático anterior. O acesso disponível é
SFTP sem shell, insuficiente para migrations, containers, worker e include do
Nginx. Também permanecem externos: histórico completo, SMTP, billing, backup
externo e revisão jurídica.
