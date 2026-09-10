# Fontes de dados

Consultadas em 2026-09-10:

- https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx — respondeu HTTP 403 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx — respondeu HTTP 409 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/Dia-de-Sorte.aspx — respondeu HTTP 403 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx — acessível; confirma universos/sorteios (Mega 6/60, Lotofácil 15/25, Dia de Sorte 7/31 e mês 1/12) e ausência de repetição.

Nenhuma interface de resultados foi tratada como API pública documentada. A cobertura precisa ser calculada no banco de cada ambiente. Arquivos JSON oficiais podem ser submetidos à prévia administrativa com URL de origem, instante, payload, hash e parser; persistência só deve ocorrer após reconciliação e migrations.

## Interface operacional observada

Em 2026-09-10 foi validada a resposta JSON de
`https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena`,
`.../lotofacil` e `.../diadesorte`. O host pertence ao domínio CAIXA, mas a
interface não possui documentação pública, contrato ou SLA encontrados. Portanto
ela é descrita como “interface operacional do portal CAIXA”, não como API pública
oficial. O adaptador `CaixaServiceBusProvider` usa somente caminhos fixos,
timeout, limite de 2 MB, retry apenas para 408/429/5xx, atraso configurável e
parser `caixa-portal-servicebus-v2`. Não aceita URL fornecida pelo usuário.

Campos normalizados:

- identidade, data, dezenas ordenadas e ordem de extração quando publicada;
- Mês da Sorte em nome português ou número de 1 a 12;
- faixas, ganhadores e valor por ganhador em centavos;
- próximo concurso, data e estimativa quando publicados;
- URL efetivamente consultada, instante, payload bruto, SHA-256 e parser.

Rateio ausente permanece `PENDING`; não vira zero. Valor zero só é persistido
quando o campo existe no payload. A modalidade e o número solicitado são
conferidos antes da persistência.

A validação de conteúdo ocorreu pelo coletor web isolado. Requisições originadas
diretamente desta VM receberam HTTP 403, inclusive com cabeçalhos de navegador.
Portanto a sincronização externa não foi declarada operacional neste runtime; os
endpoints administrativos respondem 502, registram a tentativa em `SourceFetch`
e o importador JSON continua sendo a alternativa controlada. Em hosts aceitos
pela origem, habilite explicitamente `CAIXA_ENABLED=true`.

A sincronização histórica é reiniciável via `ImportRun`, limitada a 100 concursos
por chamada e sequencial para respeitar a origem. Se houver lacuna entre os
concursos locais, registra `HISTORY_GAP` e bloqueia a publicação automática. A
saúde compara o primeiro/último concurso e as lacunas com o último concurso
observado na origem; continuidade parcial não é rotulada como cobertura completa.

## Fixtures de regressão

`apps/api/src/official-lifecycle-fixtures.ts` registra os campos de resultado dos
concursos 1–3 de Mega-Sena, Lotofácil e Dia de Sorte, coletados da interface
CAIXA acima em 2026-09-10. As URLs seguem o padrão fixo
`.../api/{modalidade}/{concurso}`. Os testes preservam a ordem de extração quando
publicada. No Dia de Sorte, o campo oficial observado para o mês contém números
de 1 a 12; o parser também aceita nomes em português.

Essas nove fixtures validam parsing e o ciclo persistente, mas não representam
histórico completo nem autorizam sugestões atuais.
