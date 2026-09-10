# Segurança

Argon2id usa memória 19 MiB, duas iterações e paralelismo 1 como baseline a medir. Sessões usam tokens aleatórios e armazenam hash; produção deve usar cookie HttpOnly, Secure e SameSite. Helmet e CORS restrito estão habilitados. Importações aceitam apenas origem HTTPS da CAIXA e CSV exportado deve neutralizar fórmulas.

O schema separa recursos privados por `userId`, mas RLS e testes reais com role sem BYPASSRLS ainda dependem de PostgreSQL de aceite. Todo endpoint privado futuro deve derivar userId da sessão, nunca do corpo. Segredos ficam fora do Git. Billing rejeita webhooks sem segredo/assinatura e checkout sandbox falha fechado.

Antes de produção: threat model, CSRF no fluxo escolhido, rate limits distribuídos, rotação de segredos, RLS, teste entre usuários, política de retenção e revisão jurídica/LGPD.
