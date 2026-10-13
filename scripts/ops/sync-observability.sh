#!/usr/bin/env bash
# =============================================================================
#  Sincroniza la pila de observabilidad del servidor con el repositorio.
#
#  La pila NO la despliega el pipeline (se levanta a mano, una vez por host):
#  este script es la forma reproducible de aplicar cambios de
#  compose.observability.yml y config/ sin copiar ficheros a ojo — que es
#  exactamente como el 16/09 quedó un `.tmpl` en el sitio equivocado y
#  Alertmanager en bucle de reinicio durante un día.
#
#  Uso (en el servidor, desde un checkout actualizado del repo):
#      sudo bash scripts/ops/sync-observability.sh [/opt/helpdesk/observability]
#
#  Qué hace, en orden:
#    1. copia de seguridad de la configuración actual en /root
#    2. copia compose.observability.yml y config/ (sin config/nginx)
#    3. elimina restos conocidos: el directorio fantasma
#       config/alertmanager/alertmanager.yml.tmpl, el alertmanager.yml v1 y el
#       backups/metrics/restore.prom de cada entorno (tapaba la métrica nueva
#       del ensayo); y deja drills/ de cada entorno en manos de su usuario
#    4. crea config/prometheus/metrics_token_{prod,staging} a partir del
#       METRICS_TOKEN del .env de cada entorno (sin salto de línea)
#    5. `docker compose config` y `docker compose up -d`
#    6. comprobaciones: Alertmanager cargó la configuración, targets de la API
#       y antigüedad del último ensayo de restauración por entorno
# =============================================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OBS_DIR="${1:-/opt/helpdesk/observability}"
COMPOSE="docker compose -f $OBS_DIR/compose.observability.yml"

log()  { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }
die()  { echo "ERROR: $*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "ejecuta con sudo: la pila corre como root y $OBS_DIR es de root."
[ -f "$REPO_DIR/compose.observability.yml" ] || die "no encuentro compose.observability.yml en $REPO_DIR"
[ -f "$OBS_DIR/.env" ] || die "falta $OBS_DIR/.env (ver .env-observabilidad.example)."

log "1. Copia de seguridad de la configuración actual"
stamp="$(date +%Y%m%d-%H%M%S)"
tar -C "$OBS_DIR" -czf "/root/observability-config-${stamp}.tgz" compose.observability.yml config 2>/dev/null \
  && echo "/root/observability-config-${stamp}.tgz"

log "2. Copiando compose.observability.yml y config/"
install -m 0644 "$REPO_DIR/compose.observability.yml" "$OBS_DIR/compose.observability.yml"
mkdir -p "$OBS_DIR/config"
for d in alertmanager blackbox grafana loki prometheus promtail; do
  [ -d "$REPO_DIR/config/$d" ] || continue
  # `cp -r` sobre un directorio existente: los ficheros que ya no están en el
  # repo se limpian en el paso 3 (sólo los conocidos; el resto se conserva).
  rm -rf "$OBS_DIR/config/$d.new"
  cp -r "$REPO_DIR/config/$d" "$OBS_DIR/config/$d.new"
  # Conservar los ficheros locales que NO se versionan.
  if [ -d "$OBS_DIR/config/$d" ]; then
    for keep in metrics_token_prod metrics_token_staging metrics_token; do
      [ -f "$OBS_DIR/config/$d/$keep" ] && cp -p "$OBS_DIR/config/$d/$keep" "$OBS_DIR/config/$d.new/$keep"
    done
    rm -rf "$OBS_DIR/config/$d"
  fi
  mv "$OBS_DIR/config/$d.new" "$OBS_DIR/config/$d"
done
chown -R root:root "$OBS_DIR/config"

log "3. Limpiando restos conocidos"
if [ -d "$OBS_DIR/config/alertmanager/alertmanager.yml.tmpl" ]; then
  rmdir "$OBS_DIR/config/alertmanager/alertmanager.yml.tmpl"
  echo "eliminado el DIRECTORIO fantasma alertmanager.yml.tmpl"
fi
[ -f "$OBS_DIR/config/alertmanager/alertmanager.yml.tmpl" ] || die "config/alertmanager/alertmanager.yml.tmpl no es un fichero tras la copia."
[ -f "$OBS_DIR/config/alertmanager/alertmanager.yml" ] && rm -f "$OBS_DIR/config/alertmanager/alertmanager.yml" && echo "eliminado alertmanager.yml v1 (\${VAR})"
[ -f "$OBS_DIR/config/prometheus/metrics_token" ] && rm -f "$OBS_DIR/config/prometheus/metrics_token" && echo "eliminado metrics_token (ahora hay uno por entorno)"
# La métrica del ensayo de restauración vive en drills/ desde el 05/10. El
# restore.prom que quedó en backups/metrics (el ensayo hecho a mano como root
# el 17/09) publica las MISMAS series, y node-exporter, ante dos series
# iguales, se queda con la primera que lee —/textfile/prod va antes que
# /textfile/prod-drills— y descarta la otra sin más rastro que una línea en su
# log. Mientras ese fichero exista, EnsayoDeRestauracionAntiguo no se apaga
# por bien que vaya el ensayo. El ensayo no puede borrarlo (el directorio es
# de root); este script, sí.
for env in prod staging; do
  stale="/opt/helpdesk/$env/backups/metrics/restore.prom"
  [ -f "$stale" ] && rm -f "$stale" && echo "eliminado $stale (la métrica del ensayo está en drills/)"
done
# node-exporter monta /opt/helpdesk/<env>/drills. Si no existe cuando se crea
# el contenedor, Docker lo crea de root y el ensayo —que entra por SSH como el
# usuario del despliegue— ya no puede escribir ni el informe ni la métrica. Se
# crea (o se devuelve) con el dueño del directorio del entorno.
for env in prod staging; do
  envdir="/opt/helpdesk/$env"
  [ -d "$envdir" ] || continue
  owner="$(stat -c '%u:%g' "$envdir")"
  if [ ! -d "$envdir/drills" ]; then
    install -d -o "${owner%:*}" -g "${owner#*:}" "$envdir/drills"
    echo "creado $envdir/drills ($owner)"
  elif [ "$(stat -c '%u:%g' "$envdir/drills")" != "$owner" ]; then
    chown -R "$owner" "$envdir/drills"
    echo "$envdir/drills devuelto a $owner (lo había creado otro usuario)"
  fi
done

log "4. Tokens de /api/metrics, uno por entorno (desde el .env de cada uno)"
for env in prod staging; do
  envfile="/opt/helpdesk/$env/.env"
  target="$OBS_DIR/config/prometheus/metrics_token_$env"
  if [ -d "$target" ]; then rmdir "$target"; fi   # otro directorio fantasma posible
  if [ -f "$envfile" ]; then
    token="$(grep -m1 '^METRICS_TOKEN=' "$envfile" | cut -d= -f2- || true)"
    if [ -n "$token" ]; then
      printf '%s' "$token" > "$target"
      chmod 644 "$target"   # Prometheus corre como nobody (65534)
      echo "$target: $(wc -c < "$target") bytes"
    else
      echo "[aviso] $envfile no tiene METRICS_TOKEN; el target helpdesk-api-$env quedará caído"
      : > "$target"
    fi
  else
    echo "[aviso] no existe $envfile; se crea un token vacío para que compose no cree un directorio"
    : > "$target"
  fi
done

log "5. Validando y levantando la pila"
$COMPOSE config --quiet && echo "docker compose config: OK"
$COMPOSE pull --quiet 2>&1 | tail -2 || true
# --force-recreate: los montajes bind de ficheros y directorios se resuelven
# por inodo al crear el contenedor. Como el paso 2 sustituye los directorios
# de config/, un contenedor que siga corriendo vería la versión ANTERIOR.
# Los datos (Prometheus, Loki, Grafana) viven en volúmenes: no se pierden.
$COMPOSE up -d --remove-orphans --force-recreate

log "6. Comprobaciones"
sleep 8
docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'helpdesk-(alertmanager|prometheus|node-exporter|cadvisor|promtail)' || true

echo "--- Alertmanager ---"
# Por la API y no por el registro: 0.34 dejó de escribir «Completed loading of
# configuration file», así que el grep de antes daba un aviso con la pila
# perfectamente sana. El estado sí dice qué configuración tiene cargada.
estado_am=$(docker exec helpdesk-alertmanager \
  wget -qO- http://127.0.0.1:9093/api/v2/status 2>/dev/null || true)
if printf '%s' "$estado_am" | grep -q '"receivers"'; then
  echo "OK: Alertmanager tiene configuración cargada."
elif [ -n "$estado_am" ]; then
  echo "[aviso] Alertmanager responde pero su configuración no trae receptores."
else
  echo "[aviso] Alertmanager no responde todavía; revisa: docker logs helpdesk-alertmanager"
fi

# --- node-exporter, preguntándole a ÉL -------------------------------------
# Antes esto se le preguntaba a Prometheus, que a los pocos segundos de
# arrancar aún no ha rascado nada: devolvía una lista vacía y parecía que
# node-exporter no leía ningún fichero, con la pila recién levantada y bien.
echo "--- node-exporter: ficheros textfile que lee ahora mismo ---"
ip_ne=$(docker inspect -f \
  '{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' \
  helpdesk-node-exporter 2>/dev/null | awk '{print $1}')
metricas_ne=''
if [ -n "$ip_ne" ]; then
  for _ in $(seq 1 20); do
    metricas_ne=$(curl -sf --max-time 3 "http://${ip_ne}:9100/metrics" || true)
    [ -n "$metricas_ne" ] && break
    sleep 1
  done
fi
if [ -z "$metricas_ne" ]; then
  echo "  [aviso] no se ha podido consultar a node-exporter en ${ip_ne:-sin IP}"
else
  leidos=$(printf '%s\n' "$metricas_ne" | grep '^node_textfile_mtime_seconds' || true)
  if [ -z "$leidos" ]; then
    echo "  ninguno. Con los montajes puestos esto significa que no hay ficheros"
    echo "  .prom todavía: el ensayo aún no ha escrito su métrica."
  else
    printf '%s\n' "$leidos" | sed -E 's/.*file="([^"]+)".*/  \1/'
  fi
  err_ne=$(printf '%s\n' "$metricas_ne" | awk '/^node_textfile_scrape_error/ {print $NF}' | head -1)
  if [ "${err_ne:-0}" != "0" ]; then
    echo "  [AVISO] node_textfile_scrape_error = ${err_ne}: no puede leer el árbol."
    echo "  Suele ser permisos: corre como nobody y los directorios han de ser legibles."
  fi
fi

echo "--- Prometheus: targets de la API y cualquier otro que no esté UP (= SondaTargetCaido) ---"
# Se espera a que Prometheus haya rascado de verdad en vez de dormir a ciegas:
# un target en «unknown» sólo quiere decir que todavía no le ha tocado el
# turno, y salía por pantalla como si estuviera caído.
for _ in $(seq 1 30); do
  pendientes=$(curl -s --max-time 3 127.0.0.1:9090/api/v1/targets 2>/dev/null \
    | python3 -c 'import sys,json
try: t=json.load(sys.stdin)["data"]["activeTargets"]
except Exception: print(99); raise SystemExit
print(sum(1 for x in t if x["health"]=="unknown"))' 2>/dev/null || echo 99)
  [ "${pendientes:-99}" = "0" ] && break
  sleep 2
done
[ "${pendientes:-99}" = "0" ] || echo "  (aún quedan targets sin rascar; lo de abajo puede estar incompleto)"
curl -s 127.0.0.1:9090/api/v1/targets 2>/dev/null \
  | python3 -c 'import sys,json
for t in json.load(sys.stdin)["data"]["activeTargets"]:
    if t["labels"]["job"].startswith("helpdesk-api") or t["health"] != "up":
        print(" ", t["labels"]["job"], t["labels"].get("instance",""), t["health"], t["lastError"][:90])' 2>/dev/null || true
echo "--- Último ensayo de restauración que ve Prometheus (EnsayoDeRestauracionAntiguo salta a los 10 días) ---"
curl -s 127.0.0.1:9090/api/v1/query --data-urlencode 'query=(time() - helpdesk_restore_drill_last_timestamp_seconds) / 86400' 2>/dev/null \
  | python3 -c 'import sys,json
r=json.load(sys.stdin)["data"]["result"]
print("  ninguno: lanza el workflow «Ensayo de restauración»" if not r else "")
for s in r: print("  %-8s hace %.1f días" % (s["metric"].get("env","?"), float(s["value"][1])))' 2>/dev/null || true
echo
echo "Hecho. Para probar una alerta de verdad: docker stop helpdesk-redis-staging; esperar 6 min; docker start helpdesk-redis-staging."
