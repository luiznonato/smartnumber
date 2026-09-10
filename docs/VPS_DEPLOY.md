# Deploy em VPS

Estimativa inicial, não garantia: 4 vCPU, 8 GiB RAM, 80 GiB SSD, Ubuntu LTS. Medir com histórico real e backtests. Configure DNS, `DOMAIN`, segredos longos, SMTP, billing e destino externo de backup. Execute `docker compose pull`, `docker compose build`, migration como job único e `docker compose up -d --wait`.

PostgreSQL, Redis e analytics não publicam portas. Caddy gerencia TLS. Imagens executam serviços de aplicação sem root. Faça deploy versionado e migrations expand/contract; rollback de imagem não deve reverter migrations destrutivas.
