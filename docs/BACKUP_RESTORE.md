# Backup e restauração

Sem `BACKUP_DESTINATION`, backup está pendente e não deve ser anunciado como ativo. Produção deve executar `pg_dump --format=custom`, criptografar antes de enviar a armazenamento externo, manter hashes e política de retenção.

Teste isolado: crie banco vazio, rode `pg_restore --clean --if-exists`, valide contagens, hashes de datasets, revisão canônica e acesso da role da aplicação. Registre data, duração e evidência. Redis não requer restauração canônica; filas derivam de outbox/checkpoints.

## Verificação reproduzível

Com o PostgreSQL do Compose em execução:

```bash
sudo env \
  POSTGRES_CONTAINER=atlas-loto-postgres-1 \
  SOURCE_DATABASE=atlas_loto_test \
  RESTORE_DATABASE=atlas_loto_restore_test \
  ./infra/test-backup-restore.sh
```

O script recusa destinos cujo nome não termine em `_restore_test`, produz dump
custom dentro do container, cria banco isolado, restaura sem alterar o banco de
origem e compara contagens de `Draw` e `DrawRevision`.

Executado em 2026-09-10: 1 concurso e 1 revisão restaurados com contagens
idênticas. Isso valida o mecanismo local; não comprova criptografia, retenção ou
envio externo. Produção continua bloqueada sem `BACKUP_DESTINATION`.
