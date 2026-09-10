# Fontes de dados

Consultadas em 2026-09-10:

- https://loterias.caixa.gov.br/Paginas/Mega-Sena.aspx — respondeu HTTP 403 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/Lotofacil.aspx — respondeu HTTP 409 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/Dia-de-Sorte.aspx — respondeu HTTP 403 neste ambiente.
- https://loterias.caixa.gov.br/Paginas/regras-sorteios.aspx — acessível; confirma universos/sorteios (Mega 6/60, Lotofácil 15/25, Dia de Sorte 7/31 e mês 1/12) e ausência de repetição.

Nenhuma interface de resultados foi tratada como API pública documentada. Cobertura histórica: zero concursos importados. O provider automático permanece desativado. Arquivos JSON oficiais podem ser submetidos à prévia administrativa com URL de origem, instante, payload, hash e parser; persistência só deve ocorrer após reconciliação e migrations.
