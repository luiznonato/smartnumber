# Relatório de aceite

## Implementado e testável localmente

Contratos e regras; geração uniforme reproduzível; conferência do mês independente; validação de ingestão; fórmulas hipergeométrica/par; prevenção de leakage no backtest; autenticação criptográfica; quota idempotente; billing fail-closed; pipeline BullMQ; interface responsiva.

Executado em 2026-09-10: typecheck TypeScript; testes Vitest e pytest; build de API, web e worker; geração Prisma; auditoria npm; benchmark sintético de 3.000 concursos em 0,012 s e pico RSS de 95.756 KiB neste host. O benchmark não mede produção nem usa histórico oficial.

Também foram executados em PostgreSQL e Redis isolados:

- quatro migrations aplicadas e reaplicação idempotente;
- conexão da API sob `atlas_app`, role sem `BYPASSRLS`;
- teste com dois usuários: a consulta de A visualizou uma linha de A e nenhuma de B;
- cadastro e sessão persistentes;
- importação isolada dos concursos iniciais 1–3 da Mega-Sena;
- cálculo via FastAPI, snapshot e lote com dataset hash;
- salvamento imutável de uma sugestão;
- importação do concurso seguinte, conferência do jogo original com 1 acerto;
- novo lote ligado ao lote anterior por `previousBatchId`;
- replay do mesmo resultado sem duplicar revisão e recuperando a avaliação;
- build das quatro imagens Docker (`api`, `worker`, `web`, `analytics`).

Em seguida, o ciclo persistente foi automatizado em banco isolado
`atlas_loto_test` para as três modalidades. As três execuções usam os concursos
oficiais 1–3 registrados como fixtures: importam 1–2, calculam pelo FastAPI,
salvam uma sugestão, importam o concurso 3, conferem o jogo imutável e publicam
um lote sucessor vinculado. O teste do Dia de Sorte também verifica geração do
mês com seed separada e sua conferência independente. Resultado executado:
1 arquivo, 3 testes aprovados.

Os comandos CLI persistentes deixaram de ser placeholders. Foram executados
contra o banco de teste: reconferência do concurso 3 do Dia de Sorte, novo
snapshot/lote da Lotofácil e backtest walk-forward da Mega-Sena com duas seeds.
Esse backtest usa apenas três concursos para validar o encadeamento técnico; não
tem amostra suficiente para qualquer conclusão de desempenho.

O pós-importação foi retirado da conexão HTTP administrativa. Em teste integrado,
API e worker foram iniciados contra PostgreSQL/Redis isolados; o worker consumiu
os nove eventos `draw.confirmed` pendentes em ordem, obteve respostas idempotentes
do endpoint interno e reduziu a zero a contagem de eventos sem `publishedAt`.

## Integração com o portal CAIXA

Em 2026-09-10, respostas atuais das três modalidades foram verificadas pelo
coletor web isolado no domínio `servicebus2.caixa.gov.br`. A nova integração foi
testada com quatro testes persistentes: três ciclos de modalidade e um histórico
do Dia de Sorte em dois lotes retomáveis. O teste confirmou quatro `SourceFetch`,
cobertura contínua 1–3, metadados do próximo concurso e duas faixas de prêmio
persistidas.

A quinta migration foi aplicada em banco novo e no banco local existente. Uma
requisição real originada pela VM recebeu HTTP 403, conforme a limitação já
observada. A aplicação retornou falha, não persistiu resultado e registrou
`statusCode=403`, URL e erro em `SourceFetch`. Isso valida o modo seguro, não a
disponibilidade da origem para a VPS final.

## Implementado sem verificação externa

As imagens e os serviços de banco foram exercitados localmente. A restauração de backup e o Compose completo com proxy não foram executados.

## Pendente externo

Importação e reconciliação de todo o histórico oficial; estabilidade/licença/limites da interface CAIXA; preços e premiações por vigência; billing real; SMTP; backup externo/restauração; backend na VPS; revisão jurídica.

## Resultado estatístico

Nenhum backtest com dados reais foi executado. Portanto não há evidência de vantagem sobre o acaso. Fixtures sintéticas não autorizam conclusão comercial.
