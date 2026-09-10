# Metodologia

Sob sorteios justos e independentes, toda combinação simples específica é equiprovável. Frequência observada não é probabilidade futura.

Para N dezenas, k sorteadas e bilhete com b dezenas, `P(H=h)=C(b,h)C(N-b,k-h)/C(N,k)`, no domínio `max(0,k-(N-b)) ≤ h ≤ min(b,k)`. Para um par específico, a chance nula é `k(k−1)/(N(N−1))`. O motor testa ambas em universos enumeráveis.

As janelas padrão são 10, 25, 50, 100, 250 e todo o histórico disponível. Cada saída informa n, frequência, baseline `k/N`, suavização beta simples, EMA, intervalo desde ocorrência, soma e paridade. “Quente” significa frequência/aderência elevada na janela declarada.

`adherence-v1` mede centralidade de características na distribuição histórica. A referência é a janela anterior ao alvo; 0–100 não é chance de ganhar. Estratégias iniciais: uniforme, frequência recente suavizada, aderência e diversidade por sobreposição. Restrições inviáveis geram erro; não são relaxadas.

Backtests são walk-forward. Para o concurso t, usam somente índices `<t`; seeds e custo/tamanho devem ser equivalentes. Concurso é unidade de avaliação. Múltiplas comparações futuras devem usar FDR. Carteiras sobrepostas exigem simulação conjunta. O estado atual é “avaliação insuficiente”; nenhum desempenho real foi medido.
