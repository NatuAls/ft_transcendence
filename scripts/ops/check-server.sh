#!/usr/bin/env bash
# =============================================================================
#  Revisión completa del servidor, de SÓLO LECTURA.
#
#  Contesta de una vez a «¿está todo bien en la instancia?»: cada contenedor
#  de los dos entornos y de la observabilidad, sus errores recientes, lo que
#  Prometheus no consigue recolectar, las alertas que están sonando, la edad
#  de las copias y de los ensayos, y las desviaciones conocidas entre lo que
#  hay en /opt y lo que dice el repositorio (las que causaron
#  EnsayoDeRestauracionAntiguo y SondaTargetCaido en octubre).
#
#  No cambia NADA: no para, no borra, no reescribe. Cada AVISO o FALLO dice
#  qué comando lo arregla.
#
#  Uso (en el servidor, desde un checkout actualizado del repositorio):
#      bash scripts/ops/check-server.sh            # como deployer (grupo docker)
#      sudo bash scripts/ops/check-server.sh       # además lee lo que es de root
#      SINCE=6h bash scripts/ops/check-server.sh   # ventana de logs (24h)
#
#  Sale con 1 si hay algún FALLO, para poder encadenarlo.
# =============================================================================
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BASE="${HELPDESK_BASE:-/opt/helpdesk}"
OBS_DIR="$BASE/observability"
SINCE="${SINCE:-24h}"
PROM=http://127.0.0.1:9090
AM=http://127.0.0.1:9093
ENVS="prod staging"

ok=0 warns=0 fails=0
section() { printf '\n\033[0;36m==== %s\033[0m\n' "$*"; }
pass()    { printf '  \033[0;32mOK\033[0m     %s\n' "$*"; ok=$((ok + 1)); }
warn()    { printf '  \033[0;33mAVISO\033[0m  %s\n' "$*"; warns=$((warns + 1)); }
fail()    { printf '  \033[0;31mFALLO\033[0m  %s\n' "$*"; fails=$((fails + 1)); }
info()    { printf '         %s\n' "$*"; }

# Consulta instantánea a Prometheus; imprime «etiquetas<TAB>valor» por serie.
promq() {
  curl -s --max-time 10 "$PROM/api/v1/query" --data-urlencode "query=$1" 2>/dev/null \
    | python3 -c 'import sys,json
try: r=json.load(sys.stdin)["data"]["result"]
except Exception: sys.exit(1)
for s in r:
    m=s["metric"]; print(",".join("%s=%s"%(k,v) for k,v in sorted(m.items()) if k!="__name__")+"\t"+s["value"][1])'
}

section "Host"
echo "  $(uname -n) · $(uptime -p 2>/dev/null || uptime) · usuario $(id -un)"
disk_pct=$(df -P / | awk 'NR==2 { gsub("%","",$5); print $5 }')
if [ "$disk_pct" -ge 93 ]; then fail "disco / al ${disk_pct}% (DiscoCritico): docker image prune -f; revisar $BASE/*/backups"
elif [ "$disk_pct" -ge 85 ]; then warn "disco / al ${disk_pct}% (DiscoBajo)"
else pass "disco / al ${disk_pct}%"; fi
mem_pct=$(awk '/MemTotal/ {t=$2} /MemAvailable/ {a=$2} END { printf "%d", (1 - a/t) * 100 }' /proc/meminfo)
if [ "$mem_pct" -ge 90 ]; then warn "memoria al ${mem_pct}%"; else pass "memoria al ${mem_pct}%"; fi
docker info > /dev/null 2>&1 || { fail "este usuario no habla con Docker (¿grupo docker?)"; exit 1; }

# -----------------------------------------------------------------------------
section "Contenedores"
EXPECTED=""
for env in $ENVS; do
  [ -f "$BASE/$env/compose.prod.yml" ] || { warn "$env: no hay despliegue en $BASE/$env"; continue; }
  for s in db redis api web mailpit backup; do EXPECTED="$EXPECTED helpdesk-$s-$env"; done
done
for c in prometheus alertmanager node-exporter cadvisor pgexporter-prod pgexporter-staging \
         redisexporter-prod redisexporter-staging blackbox loki promtail grafana; do
  EXPECTED="$EXPECTED helpdesk-$c"
done
for name in $EXPECTED; do
  if ! docker inspect "$name" > /dev/null 2>&1; then
    case "$name" in
      *exporter*|*prometheus*|*alertmanager*|*cadvisor*|*blackbox*|*loki*|*promtail*|*grafana*)
        fail "$name NO EXISTE -> sudo bash scripts/ops/sync-observability.sh" ;;
      *) fail "$name NO EXISTE -> redesplegar el entorno (o esperar a helpdesk-ensure)" ;;
    esac
    continue
  fi
  read -r state health restarts started < <(docker inspect -f \
    '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}-{{end}} {{.RestartCount}} {{.State.StartedAt}}' "$name")
  detail="estado=$state salud=$health reinicios=$restarts desde=${started%%.*}"
  if [ "$state" != "running" ]; then fail "$name $detail"
  elif [ "$health" = "unhealthy" ]; then fail "$name $detail"
  elif [ "$health" = "starting" ] || [ "$restarts" -gt 3 ]; then warn "$name $detail"
  else pass "$name $detail"; fi
done
# El renderizador de Alertmanager es de un solo uso: debe haber salido con 0.
am_exit=$(docker inspect -f '{{.State.Status}}/{{.State.ExitCode}}' helpdesk-alertmanager-config 2>/dev/null) || am_exit="no existe"
case "$am_exit" in
  exited/0) pass "helpdesk-alertmanager-config terminó con 0 (configuración renderizada)" ;;
  *) fail "helpdesk-alertmanager-config: $am_exit -> docker logs helpdesk-alertmanager-config" ;;
esac
# Lo que corre y no está en la lista (Nginx Proxy Manager, restos de un ensayo…).
others=$(docker ps -a --format '{{.Names}}\t{{.Status}}' | while IFS=$'\t' read -r n st; do
  case " $EXPECTED helpdesk-alertmanager-config " in *" $n "*) ;; *) printf '%s (%s)\n' "$n" "$st" ;; esac
done)
if [ -n "$others" ]; then
  info "otros contenedores en el host:"
  printf '%s\n' "$others" | sed 's/^/           /'
  if printf '%s\n' "$others" | grep -q '^helpdesk-drill-'; then
    warn "hay un PostgreSQL de ensayo vivo (helpdesk-drill-*): si no hay un ensayo en curso, docker rm -f <nombre>"
  fi
fi

# -----------------------------------------------------------------------------
section "Errores en los logs (últimas $SINCE)"
# La API escribe JSON con "level"; el resto, texto. Se cuentan las líneas que
# parecen error y se enseñan las tres últimas, recortadas.
for name in $(docker ps --format '{{.Names}}' | grep '^helpdesk-' | sort); do
  lines=$(docker logs --since "$SINCE" "$name" 2>&1 \
    | grep -i -E '"level":"(error|fatal)"|\b(error|fatal|panic|exception|denied|refused)\b' \
    | grep -v -i -E 'level=(info|debug)|"level":"(info|warn|debug)"|error_page|errors=0|0 errors' || true)
  n=$(printf '%s' "$lines" | grep -c . || true)
  if [ "$n" -eq 0 ]; then pass "$name: sin errores"
  else
    warn "$name: $n líneas de error"
    printf '%s\n' "$lines" | tail -3 | cut -c1-220 | sed 's/^/           /'
  fi
done

# -----------------------------------------------------------------------------
section "Prometheus: objetivos de recolección (SondaTargetCaido)"
targets=$(curl -s --max-time 10 "$PROM/api/v1/targets?state=active" 2>/dev/null \
  | python3 -c 'import sys,json
for t in json.load(sys.stdin)["data"]["activeTargets"]:
    print("\t".join([t["health"], t["labels"]["job"], t["labels"].get("instance",""), t["lastError"][:150]]))' 2>/dev/null)
if [ -z "$targets" ]; then
  fail "no se puede leer $PROM (¿helpdesk-prometheus caído?)"
else
  while IFS=$'\t' read -r health job inst err; do
    if [ "$health" = "up" ]; then pass "$job ($inst)"
    else
      fail "$job ($inst) $health: $err"
      case "$err" in
        *401*) info "-> token distinto del METRICS_TOKEN del entorno: sudo bash scripts/ops/sync-observability.sh" ;;
        *"no such host"*|*"server misbehaving"*) info "-> el contenedor no existe o Prometheus no está en su red: sudo bash scripts/ops/sync-observability.sh" ;;
      esac
    fi
  done <<< "$targets"
fi
# El ejecutable responde pero no llega a lo que vigila (no lo ve SondaTargetCaido).
for q in pg_up redis_up; do
  while IFS=$'\t' read -r labels value; do
    [ -n "$labels" ] || continue
    if [ "$value" = "1" ]; then pass "$q $labels"; else fail "$q $labels = $value"; fi
  done < <(promq "$q")
done
while IFS=$'\t' read -r labels value; do
  [ -n "$labels" ] || continue
  if [ "$value" = "1" ]; then pass "sonda externa $labels"; else fail "sonda externa $labels FALLA (SitioCaido)"; fi
done < <(promq 'probe_success{job="blackbox-http"}')

# -----------------------------------------------------------------------------
section "Alertas"
firing=$(curl -s --max-time 10 "$AM/api/v2/alerts?active=true&silenced=false&inhibited=false" 2>/dev/null \
  | python3 -c 'import sys,json
for a in json.load(sys.stdin):
    l=a["labels"]; print("%s · %s · %s · desde %s · %s" % (l.get("alertname"), l.get("env","-"), l.get("severity","-"), a["startsAt"][:16], a["annotations"].get("summary","")[:110]))' 2>/dev/null)
if [ -z "$firing" ]; then
  if curl -s --max-time 5 "$AM/-/ready" > /dev/null 2>&1; then pass "Alertmanager sin alertas activas"
  else fail "no se puede leer Alertmanager en $AM"; fi
else
  while IFS= read -r a; do fail "$a"; done <<< "$firing"
fi

# -----------------------------------------------------------------------------
section "Copias y ensayos de restauración"
while IFS=$'\t' read -r labels value; do
  [ -n "$labels" ] || continue
  h=$(python3 -c "print('%.1f' % (float('$value')/3600))")
  if python3 -c "import sys; sys.exit(0 if float('$value') < 36*3600 else 1)"; then pass "última copia correcta $labels: hace ${h} h"
  else fail "última copia correcta $labels: hace ${h} h (BackupAntiguo)"; fi
done < <(promq 'time() - helpdesk_backup_last_success_timestamp_seconds')
while IFS=$'\t' read -r labels value; do
  [ -n "$labels" ] || continue
  d=$(python3 -c "print('%.1f' % (float('$value')/86400))")
  if python3 -c "import sys; sys.exit(0 if float('$value') < 10*86400 else 1)"; then pass "último ensayo $labels: hace ${d} días"
  else fail "último ensayo $labels: hace ${d} días (EnsayoDeRestauracionAntiguo)"; fi
done < <(promq 'time() - helpdesk_restore_drill_last_timestamp_seconds')
for env in $ENVS; do
  [ -d "$BASE/$env" ] || continue
  # El restore.prom viejo de backups/metrics TAPA al de drills/ (node-exporter
  # se queda con la primera serie repetida): con él, la alerta no se apaga.
  if [ -f "$BASE/$env/backups/metrics/restore.prom" ]; then
    fail "$env: existe backups/metrics/restore.prom (de $(date -r "$BASE/$env/backups/metrics/restore.prom" +%d/%m/%Y)) y oculta la métrica del ensayo -> sudo bash scripts/ops/sync-observability.sh"
  else
    pass "$env: sin restore.prom antiguo en backups/metrics"
  fi
  if [ -d "$BASE/$env/drills" ]; then
    own=$(stat -c '%U' "$BASE/$env/drills"); envown=$(stat -c '%U' "$BASE/$env")
    if [ "$own" = "$envown" ]; then pass "$env: drills/ es de $own"
    else fail "$env: drills/ es de $own y no de $envown: el ensayo no puede escribir -> sudo chown -R $envown: $BASE/$env/drills"; fi
    last=$(find "$BASE/$env/drills" -maxdepth 1 -name 'RESTORE-DRILL-*.txt' 2>/dev/null | sort | tail -1)
    [ -n "$last" ] && info "$env: último informe $(basename "$last"): $(grep -h '^resultado=' "$last" 2>/dev/null)"
  else
    fail "$env: no existe drills/ -> redesplegar $env o sudo bash scripts/ops/sync-observability.sh"
  fi
  if [ -r "$BASE/$env/backups/cron.log" ]; then
    errs=$(tail -200 "$BASE/$env/backups/cron.log" | grep -c -E 'ERROR|aviso' || true)
    if [ "$errs" -gt 0 ]; then warn "$env: $errs líneas ERROR/aviso en las últimas 200 de backups/cron.log"
      tail -200 "$BASE/$env/backups/cron.log" | grep -E 'ERROR|aviso' | tail -2 | sed 's/^/           /'
    else pass "$env: backups/cron.log sin errores recientes"; fi
  fi
done
# node-exporter tiene que montar drills/ (compose.observability.yml desde el 05/10).
mounts=$(docker inspect -f '{{range .Mounts}}{{.Destination}} {{end}}' helpdesk-node-exporter 2>/dev/null)
for env in $ENVS; do
  case " $mounts " in
    *" /textfile/$env-drills "*) pass "node-exporter monta $env/drills" ;;
    *) fail "node-exporter NO monta $BASE/$env/drills: la métrica del ensayo no llega -> sudo bash scripts/ops/sync-observability.sh" ;;
  esac
done

# -----------------------------------------------------------------------------
section "Desviaciones entre /opt y el repositorio"
nets=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' helpdesk-prometheus 2>/dev/null)
for env in $ENVS; do
  case " $nets " in
    *" ${env}_backend_network "*) pass "Prometheus está en ${env}_backend_network (llega a helpdesk-api-$env)" ;;
    *) fail "Prometheus NO está en ${env}_backend_network: helpdesk-api-$env quedará caído -> sudo bash scripts/ops/sync-observability.sh" ;;
  esac
done
# Token de /api/metrics: se compara la huella, nunca el valor.
for env in $ENVS; do
  envfile="$BASE/$env/.env" tok="$OBS_DIR/config/prometheus/metrics_token_$env"
  if [ ! -r "$envfile" ] || [ ! -r "$tok" ]; then info "$env: no puedo leer el .env o el token de Prometheus (prueba con sudo)"; continue; fi
  a=$(grep -m1 '^METRICS_TOKEN=' "$envfile" | cut -d= -f2- | tr -d '\n' | sha256sum | cut -c1-12)
  b=$(tr -d '\n' < "$tok" | sha256sum | cut -c1-12)
  if [ "$a" = "$b" ]; then pass "$env: el token de Prometheus coincide con el METRICS_TOKEN del .env"
  else fail "$env: el token de Prometheus NO coincide con el del .env (401) -> sudo bash scripts/ops/sync-observability.sh"; fi
  if [ -s "$tok" ] && [ -z "$(tail -c1 "$tok")" ]; then warn "$env: metrics_token_$env termina en salto de línea (Prometheus lo envía y la API responde 401)"; fi
done
if [ -f "$REPO_DIR/compose.observability.yml" ]; then
  for f in compose.observability.yml config/prometheus/prometheus.yml config/prometheus/rules/alerts.yml \
           config/alertmanager/alertmanager.yml.tmpl config/blackbox/blackbox.yml config/promtail/promtail-config.yml; do
    if [ ! -r "$OBS_DIR/$f" ]; then info "no puedo leer $OBS_DIR/$f"
    elif cmp -s "$REPO_DIR/$f" "$OBS_DIR/$f"; then pass "observability/$f igual que el repositorio"
    else warn "observability/$f DISTINTO del repositorio ($(git -C "$REPO_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null)) -> sudo bash scripts/ops/sync-observability.sh"; fi
  done
  # Lo de cada entorno lo trae su despliegue (prod de main, staging de develop):
  # una diferencia aquí sólo dice que el checkout y el despliegue no coinciden.
  for env in $ENVS; do
    for f in compose.prod.yml scripts/backup.sh; do
      [ -r "$BASE/$env/$f" ] || continue
      if cmp -s "$REPO_DIR/$f" "$BASE/$env/$f"; then pass "$env/$f igual que este checkout"
      else info "$env/$f distinto de este checkout (normal si $env viene de otra rama; lo renueva su despliegue)"; fi
    done
    sha=$(grep -m1 '^GITHUB_SHA=' "$BASE/$env/.env" 2>/dev/null | cut -d= -f2- | cut -c1-7)
    [ -n "$sha" ] && info "$env desplegado en ${sha}"
  done
fi

# -----------------------------------------------------------------------------
section "Auto-recuperación (helpdesk-ensure)"
for env in $ENVS; do
  [ -d "$BASE/$env" ] || continue
  if systemctl is-active --quiet "helpdesk-ensure@$env.timer" 2>/dev/null; then pass "helpdesk-ensure@$env.timer activo"
  else warn "helpdesk-ensure@$env.timer inactivo -> sudo bash scripts/ops/ensure-stack.sh install $env"; fi
  [ -f "$BASE/$env/.maintenance" ] && warn "$env está en mantenimiento ($BASE/$env/.maintenance): el temporizador no lo levanta"
done

section "Resumen"
printf '  %d OK · %d AVISO · %d FALLO\n' "$ok" "$warns" "$fails"
[ "$fails" -eq 0 ]
