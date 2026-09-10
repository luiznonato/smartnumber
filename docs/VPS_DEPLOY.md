# Deploy em VPS

Estimativa inicial, não garantia: 4 vCPU, 8 GiB RAM, 80 GiB SSD, Ubuntu LTS. Medir com histórico real e backtests. Configure DNS, `DOMAIN`, segredos longos, SMTP, billing e destino externo de backup. Execute `docker compose pull`, `docker compose build`, migration como job único e `docker compose up -d --wait`.

PostgreSQL, Redis e analytics não publicam portas. Caddy gerencia TLS. Imagens executam serviços de aplicação sem root. Faça deploy versionado e migrations expand/contract; rollback de imagem não deve reverter migrations destrutivas.

## Hestia existente

O demo de `smart.nonato.me` está no `public_html` do Hestia. O deploy integrado
preserva esses arquivos e mantém o Nginx/SSL do painel:

1. Instale Docker no host e copie o repositório para um diretório fora de
   `public_html`.
2. Configure `.env` com duas URLs: a migration usa a role proprietária; a API
   e o worker conectam com a role de aplicação sem `BYPASSRLS`. Defina
   `WORKER_INTERNAL_SECRET` com valor aleatório de pelo menos 32 caracteres,
   compartilhado apenas entre API e worker.
3. Execute migrations como job único.
4. Suba somente `postgres redis analytics api worker`. A API publica apenas em
   `127.0.0.1:3001`.
5. Inclua `infra/hestia/atlas-loto-api.conf` no bloco HTTPS do domínio e recarregue
   o Nginx pelo Hestia.
6. Gere `apps/web/out` e sincronize seu conteúdo para o `public_html`.

O acesso disponível nesta execução é SFTP-only; ele permite atualizar o frontend,
mas não instalar Docker, iniciar processos ou alterar Nginx. Portanto o backend
integrado ainda não foi publicado na VPS.
