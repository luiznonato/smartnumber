# Metodologia

Sob sorteios justos e independentes, toda combinação simples específica é equiprovável. Frequência observada não é probabilidade futura.

Para N dezenas, k sorteadas e bilhete com b dezenas, `P(H=h)=C(b,h)C(N-b,k-h)/C(N,k)`, no domínio `max(0,k-(N-b)) ≤ h ≤ min(b,k)`. Para um par específico, a chance nula é `k(k−1)/(N(N−1))`. O motor testa ambas em universos enumeráveis.

As janelas padrão são 10, 25, 50, 100, 250 e todo o histórico disponível. Cada saída informa n, frequência, baseline `k/N`, EMA, intervalo desde ocorrência, soma e paridade. “Quente” significa apenas frequência/aderência elevada na janela declarada.

## Geração

`uniform-v2` usa NumPy PCG64 e amostragem uniforme sem reposição. Não consulta
frequências, não produz score e aparece como “Aleatório — sem análise
histórica”.

`recent-frequency-v2` exige ao menos 10 concursos. Para janela efetiva `W`,
baseline `p0=k/N`, contagem `c_i`, `alpha>0` e `0≤tau≤3`:

`p_i = (c_i + alpha × p0) / (W + alpha)`

`w_i = (p_i / p0)^tau`

O NumPy seleciona sem reposição usando os `w_i` normalizados no conjunto ainda
disponível. `tau=0` produz pesos iguais. Os pesos são heurísticos de amostragem,
não probabilidades marginais do bilhete nem previsão do sorteio.

`historical-profile-v1` exige 25 concursos. Cada candidato recebe quatro
componentes: densidade local da soma (largura igual a um décimo da amplitude
observada, mínimo 1), frequência suavizada da quantidade de ímpares, frequência
suavizada do vetor de contagens nos três terços do universo e frequência
suavizada da interseção com o concurso anterior. As contribuições brutas são
combinadas com pesos 0,30, 0,25, 0,25 e 0,20.

O score final é o percentil desse valor combinado em 2.000 combinações uniformes
geradas por um fluxo PCG64 independente, derivado da seed do lote. Também são
informados percentis de cada componente. O tamanho da referência, a seed e a
versão são persistidos. Score 90 significa aderência maior que aproximadamente
90% da população de referência definida; não significa 90% de chance de prêmio.

`diversified-v1` gera uma população limitada pela estratégia base e escolhe
incrementalmente o jogo com menor Jaccard máximo em relação aos já escolhidos.
Empates usam score da estratégia base e ordem lexicográfica das dezenas. Isso
reduz sobreposição da carteira; não melhora a chance individual.

Restrições inviáveis geram erro e nunca são relaxadas. O Mês da Sorte usa seed
separada, SHA-256 em contador e baseline uniforme 1/12; não altera o score das
dezenas.

Backtests são walk-forward. Para o concurso t, usam somente índices `<t`; seeds e custo/tamanho devem ser equivalentes. Concurso é unidade de avaliação. Múltiplas comparações futuras devem usar FDR. Carteiras sobrepostas exigem simulação conjunta. O estado atual é “avaliação insuficiente”; nenhum desempenho real foi medido.
