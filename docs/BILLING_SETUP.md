# Configuração de cobrança

`BillingProvider` desacopla checkout e webhook. O provider sandbox não ativa assinatura nem fornece URL fictícia. Para produção, o proprietário deve escolher provedor que aceite este software, criar credenciais e preços, e validar termos.

O adaptador real deverá usar checkout hospedado, assinatura do corpo bruto, janela anti-replay, chave `(provider, externalId)`, ordenação por `occurredAt` e reconciliação. Redirect nunca ativa plano. Cobrir trial, renovação, atraso, cancelamento, estorno e downgrade sem apagar jogos.
