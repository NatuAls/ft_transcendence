#!/usr/bin/env bash
# =============================================================================
#  Restablece la contraseña del administrador de Nginx Proxy Manager.
#
#  NPM no tiene «olvidé mi contraseña»: la única vía es escribir un hash
#  bcrypt nuevo en su SQLite. Este script genera una contraseña aleatoria,
#  la cifra con el MISMO módulo bcrypt del contenedor (así el formato es el
#  que NPM espera), la escribe en la base y la guarda en /root/.npm-admin
#  (600), que es de donde la leen scripts/ops/npm-tls.py y quien tenga que
#  entrar en la interfaz (:81 por túnel). No la muestra por pantalla.
#
#  Uso (en el servidor):  sudo bash scripts/ops/npm-admin-reset.sh
#  Comprueba al final que la API de NPM acepta el login.
# =============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "ejecuta con sudo" >&2; exit 1; }
DB=/opt/helpdesk/proxy/data/database.sqlite
CONTAINER=$(docker ps --format '{{.Names}}' | grep -E '^proxy-app' | head -1)
OUT=/root/.npm-admin
[ -f "$DB" ] || { echo "no encuentro $DB" >&2; exit 1; }
[ -n "$CONTAINER" ] || { echo "el contenedor de NPM no está corriendo" >&2; exit 1; }

EMAIL=$(python3 -c "import sqlite3; c=sqlite3.connect('file:$DB?mode=ro', uri=True); r=c.execute(\"select email from user where is_deleted=0 and roles like '%admin%' order by id limit 1\").fetchone(); print(r[0] if r else '')")
[ -n "$EMAIL" ] || { echo "no hay ningún usuario admin en NPM" >&2; exit 1; }

PW=$(openssl rand -base64 24 | tr -d '=+/' | cut -c1-28)
HASH=$(docker exec -e P="$PW" "$CONTAINER" sh -c 'cd /app && node -e "process.stdout.write(require(\"bcrypt\").hashSync(process.env.P, 13))"')
case "$HASH" in '$2b$'*|'$2a$'*) ;; *) echo "hash inesperado: ${HASH:0:4}…" >&2; exit 1 ;; esac

cp -a "$DB" "$DB.bak-$(date +%Y%m%d-%H%M%S)"
python3 - "$DB" "$EMAIL" "$HASH" <<'PY'
import sqlite3, sys
db, email, h = sys.argv[1:]
c = sqlite3.connect(db)
n = c.execute("update auth set secret=?, modified_on=datetime('now') where type='password' and is_deleted=0 "
              "and user_id=(select id from user where email=? and is_deleted=0)", (h, email)).rowcount
c.commit()
if n != 1: sys.exit("no se ha actualizado ninguna fila (¿email?)")
PY

umask 077
{ grep -E '^CF_DNS_API_TOKEN=' "$OUT" 2>/dev/null || true; printf 'NPM_EMAIL=%s\nNPM_PASSWORD=%s\n' "$EMAIL" "$PW"; } > "$OUT.tmp"
mv "$OUT.tmp" "$OUT"; chmod 600 "$OUT"

code=$(curl -s -o /dev/null -w '%{http_code}' -XPOST 127.0.0.1:81/api/tokens -H 'Content-Type: application/json' \
  --data-binary "$(python3 -c "import json,sys; print(json.dumps({'identity': sys.argv[1], 'secret': sys.argv[2]}))" "$EMAIL" "$PW")")
if [ "$code" = "200" ]; then
  echo "Contraseña del admin de NPM (${EMAIL%%@*}…) restablecida y guardada en $OUT (600). Login por la API: OK."
  echo "Para entrar en la interfaz: túnel al :81 y 'sudo cat $OUT'."
else
  echo "La API de NPM ha devuelto $code al probar el login: revisa $OUT y la copia $DB.bak-*" >&2; exit 1
fi
