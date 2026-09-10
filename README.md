# Atlas Loto

Plataforma SaaS em português para análise estatística transparente de Mega-Sena, Lotofácil e Dia de Sorte. O nome é configurável por `APP_NAME`/`NEXT_PUBLIC_APP_NAME`.

> O histórico não torna uma combinação específica mais provável. A aplicação não registra apostas na CAIXA e não vende apostas, bolões ou prêmios.

## Requisitos

Node.js 22+, Python 3.13+, PostgreSQL 17, Redis 8 e Docker Compose. Copie `.env.example` para `.env` e substitua todos os segredos antes de uso fora de desenvolvimento.

## Desenvolvimento

```bash
npm ci
python3 -m venv services/analytics/.venv
services/analytics/.venv/bin/pip install -r services/analytics/requirements-dev.txt
npm run db:generate
npm run dev
```

Serviços: web `:3000`, API/OpenAPI `:3001/docs`, analytics interno `:8001` e worker BullMQ.

## Banco e comandos

```bash
DATABASE_URL="$MIGRATION_DATABASE_URL" npm run db:migrate
npm run db:seed
npm run cli -- generate lottery=mega-sena count=3 seed=aceite
npm run cli -- import-history lottery=mega-sena file=/caminho/oficial.json
npm run cli -- sync-result lottery=mega-sena
npm run cli -- snapshot lottery=mega-sena
npm run cli -- backtest lottery=mega-sena
npm run cli -- evaluate-games lottery=mega-sena contest=0
```

Os cinco últimos comandos falham de modo seguro até `DATABASE_URL` e arquivo/fonte oficial estarem configurados; não criam dados fictícios. Essa limitação está registrada em `docs/STATUS.md`.

Endpoints integrados disponíveis após subir API, analytics e banco:

- `POST /api/auth/register` e `POST /api/auth/login`;
- `POST /api/admin/auth/login`;
- `POST /api/admin/draws/import`;
- `POST /api/admin/draws/:lottery/sync-latest`;
- `GET /api/suggestions/:lottery/latest`;
- `GET/POST /api/saved-games`.

## Verificação

```bash
npm run typecheck
npm test
npm run build
docker compose config
```

## Demonstração Cloudflare

`apps/web` gera uma exportação estática sem persistência. Após autenticar uma conta que administre `nonato.me`, publique o domínio configurado:

```bash
cd apps/web
npx wrangler login
npm run deploy:cloudflare
```

## Demonstração no Hestia

O build estático pode ser enviado por SFTP diretamente ao domínio:

```bash
npm run build -w @atlas/web
sftp -P 22022 usuario@servidor
# envie o conteúdo de apps/web/out para:
# /home/usuario/web/smart.nonato.me/public_html
```

Consulte `docs/IMPLEMENTATION_PLAN.md`, `docs/ARCHITECTURE.md`, `docs/METHODOLOGY.md` e `docs/ACCEPTANCE_REPORT.md`.
