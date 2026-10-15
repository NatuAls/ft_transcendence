#!/usr/bin/env bash
# =============================================================================
#  Prometheus y Grafana en local, contra la pila de desarrollo (plan B de M11)
#
#  `make` (= `make up-dev`) levanta sólo la pila de desarrollo: base de datos,
#  Redis, Mailpit, API y web. La monitorización vive en otro compose
#  (compose.observability.yml) pensado para el servidor: se cuelga de las redes
#  de prod y staging, monta rutas de /opt/helpdesk y vigila los contenedores de
#  esos entornos. En un portátil no tiene nada que vigilar, y no arranca.
#
#  Esto levanta lo mismo, en pequeño, contra la pila de desarrollo:
#    · Prometheus (misma versión que el servidor) con las 23 reglas de alerta del
#      repositorio, leyendo /api/metrics de dev_api con su METRICS_TOKEN;
#    · los exportadores de PostgreSQL y Redis de desarrollo;
#    · Grafana (misma versión) con el panel del repositorio, y `dev` como entorno.
#  Sólo escucha en 127.0.0.1. Nada de esto toca el repositorio: lo que genera va a
#  ~/.cache/helpdesk-obs-local.
#
#  Lo que en local sale vacío, porque sólo existe en el servidor: la sonda
#  HTTPS externa y el certificado (blackbox), las copias y los ensayos (los
#  dejan los scripts del servidor), el disco y los contenedores (node-exporter y
#  cAdvisor necesitan el host) y los logs (Loki). Varias alertas de ausencia
#  (SinMetricaDeBackup, SinMetricaDeEnsayo…) salen disparadas por lo mismo.
#
#  USO (desde la raíz del clon, con `make` ya hecho):
#      bash obs-local.sh up       # http://localhost:9090 y http://localhost:3000
#      bash obs-local.sh status   # objetivos y reglas
#      bash obs-local.sh down     # lo para y lo borra (los datos eran efímeros)
#
#  Puertos: PROM_PORT (9090) y GRAFANA_PORT (3000). Si el de por defecto está
#  ocupado (otro Grafana, un túnel SSH al servidor…), se usa el siguiente libre y
#  se dice cuál.
# =============================================================================
set -euo pipefail

NETWORK="${NETWORK:-helpdesk-dev_dev_network}"
WORK="${XDG_CACHE_HOME:-$HOME/.cache}/helpdesk-obs-local"
PROM_IMAGE=prom/prometheus:v3.14.0
GRAFANA_IMAGE=grafana/grafana:13.2.2
PG_EXPORTER_IMAGE=prometheuscommunity/postgres-exporter:v0.17.1
REDIS_EXPORTER_IMAGE=oliver006/redis_exporter:v1.69.0
CONTAINERS=(obs-prometheus obs-grafana obs-pgexporter obs-redisexporter)
STATE="$WORK/ports"

c_ok() { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_info() { printf '\033[0;36m%s\033[0m\n' "$*"; }
die() { printf '\033[0;31m%s\033[0m\n' "$*" >&2; exit 1; }

[ -f config/prometheus/rules/alerts.yml ] && [ -f compose.dev.yml ] ||
  die "Lánzalo desde la raíz del clon de HelpDesk Lite."

# 0 si algo escucha ya en 127.0.0.1:<puerto>.
busy() { (exec 3<> "/dev/tcp/127.0.0.1/$1") 2> /dev/null; }
pick_port() {
  local port="$1"
  while busy "$port"; do port=$((port + 1)); done
  echo "$port"
}
prom_url() { echo "http://127.0.0.1:$(sed -n 's/^prom=//p' "$STATE" 2> /dev/null || echo 9090)"; }

down() {
  docker rm -f "${CONTAINERS[@]}" > /dev/null 2>&1 || true
  c_ok "Prometheus y Grafana locales parados."
}

status() {
  docker ps --filter name=obs- --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
  echo
  curl -s "$(prom_url)/api/v1/targets" 2> /dev/null |
    python3 -c 'import json,sys
for t in json.load(sys.stdin)["data"]["activeTargets"]:
    print("  %-22s %-6s %s" % (t["labels"]["job"], t["health"], t.get("lastError") or ""))' ||
    echo "  Prometheus no contesta en $(prom_url)"
  curl -s "$(prom_url)/api/v1/rules" 2> /dev/null |
    python3 -c 'import json,sys
g = json.load(sys.stdin)["data"]["groups"]
r = [x for grp in g for x in grp["rules"]]
print("  reglas: %d en %d grupos; disparadas ahora: %d" % (len(r), len(g), sum(1 for x in r if x.get("state") == "firing")))' ||
    true
}

up() {
  docker network inspect "$NETWORK" > /dev/null 2>&1 ||
    die "No existe la red $NETWORK: levanta antes la pila de desarrollo con: make"
  docker ps --format '{{.Names}}' | grep -qx dev_api ||
    die "dev_api no está en marcha: levanta antes la pila de desarrollo con: make"

  mkdir -p "$WORK/grafana/datasources" "$WORK/grafana/dashboards"
  chmod 700 "$WORK"

  # El mismo token que comprueba la API (se lee del contenedor: el .env puede
  # tener más de una línea METRICS_TOKEN y vale la que ve Compose).
  docker exec dev_api printenv METRICS_TOKEN | tr -d '\n' > "$WORK/metrics_token_dev"
  [ -s "$WORK/metrics_token_dev" ] || die "dev_api no tiene METRICS_TOKEN (¿.env sin generar?)"
  # Prometheus corre como nobody: tiene que poder leerlo. La carpeta es 700.
  chmod 644 "$WORK/metrics_token_dev"

  cat > "$WORK/prometheus.yml" << 'YAML'
global:
  scrape_interval: 15s
  evaluation_interval: 15s
rule_files:
  - /etc/prometheus/rules/*.yml
scrape_configs:
  - job_name: prometheus
    static_configs:
      - targets: ['localhost:9090']
  - job_name: helpdesk-api-dev
    metrics_path: /api/metrics
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/metrics_token_dev
    static_configs:
      - targets: ['dev_api:5000']
        labels: { env: dev }
  - job_name: postgres
    static_configs:
      - targets: ['obs-pgexporter:9187']
        labels: { env: dev }
  - job_name: redis
    static_configs:
      - targets: ['obs-redisexporter:9121']
        labels: { env: dev }
YAML

  cat > "$WORK/grafana/datasources/datasources.yml" << 'YAML'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://obs-prometheus:9090
    isDefault: true
    jsonData:
      timeInterval: 15s
YAML
  cat > "$WORK/grafana/dashboards/dashboards.yml" << 'YAML'
apiVersion: 1
providers:
  - name: HelpDesk Lite
    folder: HelpDesk Lite
    type: file
    options:
      path: /etc/grafana/provisioning/dashboards
YAML
  # El panel del repositorio, con `dev` como entorno (el del servidor sólo ofrece
  # prod y staging) y sin el panel de Loki, que en local no existe.
  python3 - config/grafana/provisioning/dashboards/helpdesk-overview.json \
    "$WORK/grafana/dashboards/helpdesk-overview.json" << 'PY'
import json, sys
d = json.load(open(sys.argv[1], encoding='utf8'))
for v in d.get('templating', {}).get('list', []):
    if v.get('name') == 'env':
        v['query'] = 'dev,prod,staging'
        v['current'] = {'text': 'dev', 'value': 'dev'}
        v['options'] = [{'text': e, 'value': e, 'selected': e == 'dev'} for e in ('dev', 'prod', 'staging')]
d['panels'] = [p for p in d['panels']
               if not (isinstance(p.get('datasource'), dict) and p['datasource'].get('type') == 'loki')]
d['title'] = d['title'] + ' (local)'
json.dump(d, open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False, indent=2)
PY

  # Contraseña de Grafana: una al azar la primera vez, guardada aquí (600).
  if [ ! -s "$WORK/grafana-admin-password" ]; then
    (umask 077 && openssl rand -base64 18 | tr -d '/+=' | head -c 20 > "$WORK/grafana-admin-password")
  fi

  # Credenciales de la base de desarrollo, del propio contenedor de la base.
  local pg_user pg_pass pg_db
  pg_user="$(docker exec dev_database printenv POSTGRES_USER)"
  pg_pass="$(docker exec dev_database printenv POSTGRES_PASSWORD)"
  pg_db="$(docker exec dev_database printenv POSTGRES_DB)"

  docker rm -f "${CONTAINERS[@]}" > /dev/null 2>&1 || true
  local prom_port grafana_port
  prom_port="$(pick_port "${PROM_PORT:-9090}")"
  grafana_port="$(pick_port "${GRAFANA_PORT:-3000}")"
  printf 'prom=%s\ngrafana=%s\n' "$prom_port" "$grafana_port" > "$STATE"

  docker run -d --name obs-pgexporter --network "$NETWORK" \
    -e DATA_SOURCE_NAME="postgresql://${pg_user}:${pg_pass}@db:5432/${pg_db}?sslmode=disable" \
    "$PG_EXPORTER_IMAGE" > /dev/null
  docker run -d --name obs-redisexporter --network "$NETWORK" \
    "$REDIS_EXPORTER_IMAGE" --redis.addr=redis://redis:6379 > /dev/null
  docker run -d --name obs-prometheus --network "$NETWORK" -p "127.0.0.1:$prom_port:9090" \
    -v "$WORK/prometheus.yml:/etc/prometheus/prometheus.yml:ro" \
    -v "$PWD/config/prometheus/rules:/etc/prometheus/rules:ro" \
    -v "$WORK/metrics_token_dev:/etc/prometheus/metrics_token_dev:ro" \
    "$PROM_IMAGE" --config.file=/etc/prometheus/prometheus.yml \
    --storage.tsdb.path=/prometheus --storage.tsdb.retention.time=2d --web.enable-lifecycle > /dev/null
  docker run -d --name obs-grafana --network "$NETWORK" -p "127.0.0.1:$grafana_port:3000" \
    -e GF_SECURITY_ADMIN_USER=admin \
    -e GF_SECURITY_ADMIN_PASSWORD="$(cat "$WORK/grafana-admin-password")" \
    -e GF_USERS_ALLOW_SIGN_UP=false -e GF_AUTH_ANONYMOUS_ENABLED=false \
    -e GF_ANALYTICS_REPORTING_ENABLED=false -e GF_ANALYTICS_CHECK_FOR_UPDATES=false \
    -v "$WORK/grafana:/etc/grafana/provisioning:ro" \
    "$GRAFANA_IMAGE" > /dev/null

  c_info "Esperando a Prometheus y Grafana…"
  for _ in $(seq 1 60); do
    curl -sf "http://127.0.0.1:$prom_port/-/ready" > /dev/null 2>&1 &&
      curl -sf "http://127.0.0.1:$grafana_port/api/health" > /dev/null 2>&1 && break
    sleep 2
  done
  # Hasta la primera recogida (cada 15 s) los objetivos salen como `unknown`.
  for _ in $(seq 1 15); do
    curl -s "http://127.0.0.1:$prom_port/api/v1/targets" 2> /dev/null | grep -q '"health":"unknown"' || break
    sleep 2
  done
  c_ok "Listo."
  [ "$prom_port" = "${PROM_PORT:-9090}" ] || c_info "  (el ${PROM_PORT:-9090} estaba ocupado: Prometheus va al $prom_port)"
  [ "$grafana_port" = "${GRAFANA_PORT:-3000}" ] || c_info "  (el ${GRAFANA_PORT:-3000} estaba ocupado: Grafana va al $grafana_port)"
  echo "  Prometheus  http://localhost:$prom_port   (Status → Targets, Alerts)"
  echo "  Grafana     http://localhost:$grafana_port   usuario admin, contraseña en $WORK/grafana-admin-password"
  echo "              panel: Dashboards → HelpDesk Lite → «HelpDesk Lite — Visión general (local)», entorno dev"
  echo
  status
}

case "${1:-up}" in
  up) up ;;
  down) down ;;
  status) status ;;
  *) die "uso: $0 [up|status|down]" ;;
esac
