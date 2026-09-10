# Backup e restauração

Sem `BACKUP_DESTINATION`, backup está pendente e não deve ser anunciado como ativo. Produção deve executar `pg_dump --format=custom`, criptografar antes de enviar a armazenamento externo, manter hashes e política de retenção.

Teste isolado: crie banco vazio, rode `pg_restore --clean --if-exists`, valide contagens, hashes de datasets, revisão canônica e acesso da role da aplicação. Registre data, duração e evidência. Redis não requer restauração canônica; filas derivam de outbox/checkpoints.
