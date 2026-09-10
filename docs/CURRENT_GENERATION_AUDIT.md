# Auditoria atual da geração

Data: 2026-09-10. Branch inspecionada:
`cursor/atlas-loto-platform-f9de`.

## O que está publicado no navegador

`apps/web/app/gerar/page.tsx` ainda gera jogos no cliente. A seed é um
`crypto.randomUUID()`, transformado por FNV-1a e xorshift32. Um Fisher–Yates
embaralha o universo e seleciona 6, 15 ou 7 dezenas. O mês do Dia de Sorte usa o
mesmo fluxo pseudoaleatório. Esse código não consulta API, banco, histórico ou
FastAPI. É apenas uma amostra uniforme demonstrativa e será removido da jornada
conectada.

`apps/web/app/page.tsx` contém seis dezenas sintéticas fixas. O texto identifica
o exemplo, mas ele ocupa o lugar destinado ao último resultado real.

## Baseline da API

`apps/api/src/services.ts`, em `GameService.generate`, implementa
`random-baseline-v1`: hashes SHA-256 de seed, índice e dezena ordenam os
candidatos. Não usa histórico. Retorna `score: null` e `explanation: null`, o que
é semanticamente correto para o baseline, mas esse endpoint ainda não persiste
um lote.

## Gerador analítico conectado

`services/analytics/app/engine.py`, função `generate`, usa NumPy PCG64. A
estratégia `recent-frequency` conta ocorrências nos últimos 100 concursos, soma
1 a cada contagem e faz amostragem ponderada sem reposição. O score atual mede
somente a proximidade do percentil de soma a 50. Ele não implementa a fórmula
documentada de suavização `alpha/tau`, não calibra o score em uma população
uniforme independente e não possui estratégia completa de perfil histórico.

`apps/api/src/lottery-flow.service.ts`, método `recalculate`, envia o dataset
canônico ao FastAPI, persiste snapshot, estratégia, seed, PRNG, score e
decomposição. O mês do Dia de Sorte usa seed SHA-256 separada e baseline uniforme
1/12. O fluxo é real e rastreável, mas hoje só gera automaticamente cinco jogos
de frequência recente; o usuário não escolhe estratégia nem parâmetros.

## Persistência e conferência

`LotteryFlowService.saveGame` persiste a combinação sugerida. `processRevision`
e `evaluateGames` conferem jogos após `draw.confirmed`/`draw.corrected`, e o
worker em `apps/worker/src/main.ts` consome a outbox. O dashboard
`apps/web/app/app/app-dashboard.tsx` usa esses endpoints, mas está fixo em
Mega-Sena, expõe hash/seed na interface comum e não oferece arquivamento ou
acompanhamento configurável.

## Dados e ações demonstrativas

- `apps/web/app/page.tsx`: resultado sintético hardcoded.
- `apps/web/app/gerar/page.tsx`: geração exclusivamente local.
- `apps/web/app/explorar/page.tsx`, `laboratorio/page.tsx`, `jogos/page.tsx` e
  `conta/page.tsx`: conteúdo predominantemente informativo.
- `/login`, `/cadastro`, `/app`, `/admin/login` e `/admin`: autenticação e sessão
  persistentes existem; administração ainda cobre apenas importação e saúde.
- A interface do portal CAIXA está implementada, mas esta VM recebe HTTP 403. O
  banco local contém apenas fixtures oficiais isoladas usadas em testes e dados
  inseridos durante aceites; não há histórico completo reconciliado.

## Conclusão simples

Há um backend persistente funcional, mas a principal interface pública ainda é
um demo. A correção deve remover a geração local, consultar o último resultado
canônico no banco, permitir geração analítica sob demanda no servidor, explicar
valores calculados e completar ações persistentes de jogos.
