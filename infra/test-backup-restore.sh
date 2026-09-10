#!/usr/bin/env sh
set -eu

container="${POSTGRES_CONTAINER:-atlas-loto-postgres-1}"
source_database="${SOURCE_DATABASE:-atlas_loto_test}"
restore_database="${RESTORE_DATABASE:-atlas_loto_restore_test}"

case "$restore_database" in
  *_restore_test) ;;
  *) echo "RESTORE_DATABASE deve terminar em _restore_test" >&2; exit 2 ;;
esac

dump_file="/tmp/${source_database}-restore-check.dump"
docker exec "$container" pg_dump \
  --username atlas \
  --format custom \
  --file "$dump_file" \
  "$source_database"

docker exec "$container" psql --username atlas --dbname postgres \
  --set ON_ERROR_STOP=1 \
  --command "DROP DATABASE IF EXISTS \"$restore_database\" WITH (FORCE);" \
  --command "CREATE DATABASE \"$restore_database\";"

docker exec "$container" pg_restore \
  --username atlas \
  --dbname "$restore_database" \
  --no-owner \
  "$dump_file"

source_draws="$(docker exec "$container" psql --username atlas --dbname "$source_database" --tuples-only --no-align --command 'SELECT count(*) FROM "Draw";')"
restored_draws="$(docker exec "$container" psql --username atlas --dbname "$restore_database" --tuples-only --no-align --command 'SELECT count(*) FROM "Draw";')"
source_revisions="$(docker exec "$container" psql --username atlas --dbname "$source_database" --tuples-only --no-align --command 'SELECT count(*) FROM "DrawRevision";')"
restored_revisions="$(docker exec "$container" psql --username atlas --dbname "$restore_database" --tuples-only --no-align --command 'SELECT count(*) FROM "DrawRevision";')"

test "$source_draws" = "$restored_draws"
test "$source_revisions" = "$restored_revisions"

docker exec "$container" rm -f "$dump_file"
printf '{"status":"ok","draws":%s,"revisions":%s,"restoredDatabase":"%s"}\n' \
  "$restored_draws" "$restored_revisions" "$restore_database"
