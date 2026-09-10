# Deploy em VPS

Estimativa inicial, não garantia: 4 vCPU, 8 GiB RAM, 80 GiB SSD, Ubuntu LTS. Medir com histórico real e backtests. Configure DNS, `DOMAIN`, segredos longos, SMTP, billing e destino externo de backup. Não reutilize os valores de desenvolvimento de `.env.example`.

Imagens executam serviços de aplicação sem root. Faça deploy versionado e
migrations expand/contract; rollback de imagem não deve reverter migrations
destrutivas. O serviço `proxy` pertence ao profile `standalone-proxy` e não deve
ser ativado no host Hestia.

## Hestia existente

O demo de `smart.nonato.me` está no `public_html` do Hestia. O deploy integrado
preserva esses arquivos e mantém o Nginx/SSL do painel:

1. Instale Docker no host e copie o repositório para um diretório fora de
   `public_html`.
2. Configure `.env` com duas URLs: a migration usa a role proprietária; a API
   e o worker conectam com a role de aplicação sem `BYPASSRLS`. Defina
   `WORKER_INTERNAL_SECRET` com valor aleatório de pelo menos 32 caracteres,
   compartilhado apenas entre API e worker.
3. Faça um dump custom antes do deploy e valide espaço livre.
4. Construa as imagens e execute migrations como job único:

   ```bash
   docker compose build api worker analytics web
   docker compose run --rm \
     -e DATABASE_URL="$MIGRATION_DATABASE_URL" \
     api npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
   ```

5. Suba `postgres redis analytics api worker`. A API publica apenas em
   `127.0.0.1:3001`. Não use `--profile standalone-proxy`.
6. Inclua `infra/hestia/atlas-loto-api.conf` no bloco HTTPS do domínio e recarregue
   o Nginx pelo Hestia.
7. Gere `apps/web/out` e sincronize seu conteúdo para o `public_html`.
8. Valide `/api/health/ready`, cadastro/login, geração, salvamento após reload,
   importação administrativa e consumo da outbox pelo worker.
9. Execute `infra/test-backup-restore.sh` contra banco isolado e só então agende
   backup criptografado para armazenamento externo.

O acesso disponível nesta execução é SFTP-only; ele permite atualizar o frontend,
mas não instalar Docker, iniciar processos ou alterar Nginx. Portanto o backend
integrado ainda não foi publicado na VPS.

Não remova chave SSH ou regra de firewall mencionada em relatórios anteriores:
nenhum identificador verificável foi disponibilizado nesta execução. Preserve o
acesso legítimo e faça a limpeza somente depois de identificar chave, usuário,
porta e regra exatos no host.
