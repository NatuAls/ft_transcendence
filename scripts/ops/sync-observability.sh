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
#       config/alertmanager/alertmanager.yml.tmpl y el alertmanager.yml v1
#    4. crea config/prometheus/metrics_token_{prod,staging} a partir del
#       METRICS_TOKEN del .env de cada entorno (sin salto de línea)
#    5. `docker compose config` y `docker compose up -d`
#    6. comprobaciones: Alertmanager cargó la configuración, targets de la API
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
if docker logs --since 2m helpdesk-alertmanager 2>&1 | grep -q "Completed loading of configuration file"; then
  echo "OK: Alertmanager ha cargado la configuración."
else
  echo "[aviso] Alertmanager no confirma la carga de configuración; revisa: docker logs helpdesk-alertmanager"
fi
echo "--- Prometheus: targets de la API (necesitan la imagen con /api/metrics desplegada) ---"
sleep 25
curl -s 127.0.0.1:9090/api/v1/targets 2>/dev/null \
  | python3 -c 'import sys,json
for t in json.load(sys.stdin)["data"]["activeTargets"]:
    if t["labels"]["job"].startswith("helpdesk-api"): print(" ", t["labels"]["job"], t["health"], t["lastError"][:90])' 2>/dev/null || true
echo "--- node-exporter: ficheros textfile leídos ---"
curl -s 127.0.0.1:9090/api/v1/query --data-urlencode 'query=node_textfile_mtime_seconds' 2>/dev/null \
  | python3 -c 'import sys,json; print(" ", [r["metric"]["file"] for r in json.load(sys.stdin)["data"]["result"]])' 2>/dev/null || true
echo
echo "Hecho. Para probar una alerta de verdad: docker stop helpdesk-redis-staging; esperar 6 min; docker start helpdesk-redis-staging."
