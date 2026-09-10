# Decisões

1. Node 22 e Python 3.13 são baselines; Next 16/Nest 12/FastAPI 0.141 foram verificados em 2026-09-10. Prisma 7.10 foi escolhido como versão estável anterior porque o `latest` do registro apontava para 8.0.0-rc; releases candidatas não foram adotadas.
2. Sem endpoint público documentado e SLA da CAIXA confirmado, o provider automático falha fechado. O importador administrativo aceita somente payloads com origem oficial registrada.
3. O PRNG de domínio TypeScript usa SHA-256 counter; analytics usa PCG64. Implementação e seed fazem parte da reprodutibilidade.
4. Scores são aderência histórica e podem ser nulos. Baseline uniforme existe desde a primeira versão.
5. Billing começa em sandbox indisponível. Escolha de provedor real, preços e textos jurídicos exigem decisão do proprietário e revisão profissional.
