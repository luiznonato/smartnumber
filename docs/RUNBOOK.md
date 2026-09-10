# Runbook

Saúde: `/api/health`, `/api/health/ready` e `/health` no analytics interno. Alertar para atraso de concurso confirmado, outbox não publicada, fila morta, quarentena e disco.

Em falha de ingestão, não publicar sugestões atuais; preserve payload e abra `DataQualityIssue`. Em correção, crie revisão, emita `draw.corrected`, reconfira jogos e substitua snapshots sem apagar o publicado. Retry administrativo cria AuditLog e mantém idempotência.

Em indisponibilidade do analytics, API permanece disponível em modo degradado e não mistura snapshot/sugestões. Em incidente de billing, congele ativações automáticas e reconcilie eventos assinados.
