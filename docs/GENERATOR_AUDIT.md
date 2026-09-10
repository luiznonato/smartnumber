# Auditoria do gerador

Data da auditoria: 2026-09-10.

## Gerador publicado no demo

- Local: `apps/web/app/gerar/page.tsx`, funções `seeded`, `generate` e `Generate`.
- Execução: exclusivamente no navegador. Não chama `apps/api` nem `services/analytics`.
- Seed: `crypto.randomUUID()` a cada envio do formulário.
- PRNG: a string da seed passa por uma derivação FNV-1a de 32 bits e alimenta um
  xorshift de 32 bits implementado em `seeded`.
- Seleção: Fisher–Yates sobre todo o universo e corte das primeiras 6, 15 ou 7
  dezenas. Não entram histórico, frequências, snapshots ou resultados oficiais.
- Dia de Sorte: o mês é retirado do mesmo fluxo pseudoaleatório, depois das dezenas.
- Score: não existe.
- Explicação: informa somente que é amostragem aleatória sem reposição. Isso é uma
  referência de comparação, não análise histórica.

## Gerador da API

- Local: `apps/api/src/services.ts`, método `GameService.generate`.
- Seed: 16 bytes criptograficamente aleatórios quando o cliente não fornece uma.
- Seleção: cada dezena recebe SHA-256 de `seed:índice-do-candidato:dezena`; os menores
  hashes são selecionados, respeitando dezenas fixas e excluídas.
- Dados de entrada: modalidade, quantidade, seed opcional e restrições. Não recebe
  histórico nem snapshot.
- Integração analítica: nenhuma.
- Score: sempre `null`.
- Explicação: descreve apenas a amostra aleatória. A estratégia passa a ser
  identificada como `random-baseline-v1`.

## Gerador do serviço analítico

- Local: `services/analytics/app/engine.py`, função `generate`; contrato em
  `services/analytics/app/models.py`; endpoint em `services/analytics/app/main.py`.
- Seed/PRNG: inteiro fornecido pelo chamador e `numpy.random.PCG64`.
- Estratégia `random-baseline`: amostragem uniforme sem reposição.
- Estratégia `recent-frequency`: pesos `contagem histórica + 1`, normalizados, com
  amostragem ponderada sem reposição.
- Score atual: centralidade do percentil de soma na janela de até 100 concursos.
  É calculado com o dataset enviado pela API. O fluxo integrado persiste dataset
  hash, corte temporal, snapshot, versão, seed, PRNG e decomposição antes de
  publicar o lote.
- Explicação atual: percentil real de soma, janela e aviso metodológico. No demo
  publicado ela não é utilizada.
- Dia de Sorte: as dezenas continuam usando PCG64 e frequência recente. O mês é
  derivado separadamente pela API em `lottery-flow.service.ts`, com seed própria,
  contador SHA-256 e baseline uniforme 1/12. O mês não altera o score das dezenas.

## Conclusão

O produto mantém três implementações distintas de geração. O demo e o endpoint
de baseline da API são aleatórios e não análises. O fluxo persistente integrado
usa o serviço Python e publica scores somente junto de dataset hash, concurso de
corte, versão, seed, estratégia, decomposição e snapshot. “Aleatório — referência
de comparação” permanece separado das sugestões por frequência recente.
