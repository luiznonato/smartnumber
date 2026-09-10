# Plano de correção funcional

## 1. Dados e jornada conectada

- Expor último concurso canônico por modalidade, estado da fonte, cobertura e
  premiação sem substituir cache em falhas.
- Expor geração autenticada por estratégia usando snapshot confirmado.
- Completar salvar, listar, arquivar e acompanhar jogos.

Aceite: trocar modalidade altera dados; API indisponível produz erro explícito;
reload não apaga jogo; resultado seguinte cria avaliação sem alterar combinação.

## 2. Motores explicáveis

- Manter baseline uniforme sem score.
- Implementar frequência recente com `alpha`, `tau`, janela e amostragem
  ponderada sem reposição.
- Implementar perfil histórico com população uniforme de referência e
  componentes explícitos.
- Implementar seleção diversificada por Jaccard sobre uma estratégia base.

Aceite: seed reproduz lote; histórico insuficiente bloqueia estratégia; cada
explicação contém janela, valores observados e limitações; score nunca é descrito
como probabilidade.

## 3. Importação e operação

- Criar prévia e confirmação de arquivo oficial com hash, limites, conflitos e
  auditoria.
- Manter sincronização do portal CAIXA atrás de configuração explícita e
  scheduler independente do navegador.

Aceite: inválidos não persistem; duplicatas são identificadas; confirmação é
idempotente; lacunas aparecem na saúde da base.

## 4. Interface

- Criar shell branco, compacto, mobile-first e componentes reutilizáveis.
- Conectar Início, Análises, Gerar e Meus jogos ao backend.
- Remover resultado sintético e fallback local.

Aceite: 360/390 px sem rolagem horizontal, alvos de 44 px, foco visível,
dezenas da Lotofácil quebrando em linhas e estados vazio/erro/carregando.

## 5. Administração e segurança

- Completar MFA TOTP e códigos de recuperação para administradores.
- Adicionar operações auditadas de usuários, dados, jobs e estratégias.
- Ampliar RLS e testes de acesso cruzado.

Aceite: administrador sem MFA não obtém sessão administrativa; usuário comum
recebe 401; suporte/admin não lê jogos privados por padrão.

## 6. Verificação e deploy

- Executar migrations, testes, E2E, Compose, backup/restauração e inspeção visual.
- Atualizar configuração Hestia sem disputar portas 80/443.

Aceite: artefatos visuais demonstram a jornada; relatório separa o que foi
verificado localmente do que depende da VPS e da origem CAIXA.
