# Fontes de dados

Consultadas em 2026-09-10:

- https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx — respondeu HTTP 403 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx — respondeu HTTP 409 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/Dia-de-Sorte.aspx — respondeu HTTP 403 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx — acessível; confirma universos/sorteios (Mega 6/60, Lotofácil 15/25, Dia de Sorte 7/31 e mês 1/12) e ausência de repetição.

Nenhuma interface de resultados foi tratada como API pública documentada. A cobertura precisa ser calculada no banco de cada ambiente. Arquivos JSON oficiais podem ser submetidos à prévia administrativa com URL de origem, instante, payload, hash e parser; persistência só deve ocorrer após reconciliação e migrations.

## Interface operacional observada

Em 2026-09-10 foi validada a resposta JSON de
`https://servicebus2.caixa.gov.br/portaldeloterias/api/megasena`. O host pertence
ao domínio CAIXA, mas a interface não possui documentação pública, contrato ou
SLA encontrados. O adaptador `CaixaServiceBusProvider` usa caminhos fixos para
Mega-Sena, Lotofácil e Dia de Sorte, timeout, tentativas limitadas e parser
versionado. Não aceita URL fornecida pelo usuário.

A validação de conteúdo ocorreu pelo coletor web isolado. Requisições originadas
diretamente desta VM receberam HTTP 403, inclusive com cabeçalhos de navegador.
Portanto a sincronização externa não foi declarada operacional neste runtime; o
endpoint administrativo responde 502 e o importador JSON continua sendo a
alternativa controlada.

A sincronização do último concurso persiste payload bruto e revisão. Se houver
lacuna entre os concursos locais, registra `HISTORY_GAP` e bloqueia a publicação
automática de nova análise. Isso não torna a cobertura histórica completa.
