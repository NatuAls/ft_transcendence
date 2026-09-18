#!/usr/bin/env bash
# =============================================================================
#  Auto-recuperación de la pila de un entorno.                 (incidente N43)
#
#  El 17/09 un `docker compose down` deliberado dejó producción parada 14 h 49
#  min: `restart: unless-stopped` no cubre un `down` (el contenedor deja de
#  existir) y la alerta llegó por Telegram a un chat que nadie miró. Este
#  temporizador la habría levantado a los 10 minutos.
#
#  Uso (en el servidor):
#      sudo bash scripts/ops/ensure-stack.sh install prod [staging]  # unidad + temporizador (cada 5 min)
#      sudo bash scripts/ops/ensure-stack.sh check prod              # lo que ejecuta el temporizador
#      sudo bash scripts/ops/ensure-stack.sh remove prod             # desinstalar
#
#  Parada DELIBERADA (mantenimiento, prueba de redespliegue…):
#      sudo touch /opt/helpdesk/prod/.maintenance     # el temporizador no toca nada
#      sudo rm    /opt/helpdesk/prod/.maintenance     # al terminar
#
#  Sólo actúa si api, web o db llevan DOS comprobaciones seguidas (≥ 5 min)
#  sin correr: un despliegue recrea los contenedores en menos de eso y no se
#  interfiere con él. Levanta con la configuración que hay en el directorio
#  (.env + compose.prod.yml), sin descargar nada nuevo.
# =============================================================================
set -euo pipefail
ACTION="${1:-}"; shift || true
BIN=/usr/local/bin/helpdesk-ensure
STATE_DIR=/run/helpdesk-ensure

check() {
  local env="$1" dir="/opt/helpdesk/$1" miss="$STATE_DIR/$1.miss" running
  mkdir -p "$STATE_DIR"
  if [ ! -f "$dir/compose.prod.yml" ] || [ ! -f "$dir/.env" ]; then
    echo "[$env] sin despliegue en $dir: nada que hacer"; return 0
  fi
  if [ -f "$dir/.maintenance" ]; then
    echo "[$env] en mantenimiento ($dir/.maintenance): no se toca"; rm -f "$miss"; return 0
  fi
  cd "$dir"
  running=$(docker compose -f compose.prod.yml ps -q --status running api web db 2>/dev/null | wc -l)
  if [ "$running" -ge 3 ]; then rm -f "$miss"; return 0; fi
  if [ ! -f "$miss" ]; then
    echo "[$env] $running/3 servicios esenciales corriendo; se espera a la siguiente comprobación"
    touch "$miss"; return 0
  fi
  echo "[$env] $running/3 servicios esenciales corriendo desde hace ≥ 5 min: levantando la pila"
  docker compose -f compose.prod.yml up -d --pull never
  rm -f "$miss"
}

do_install() {
  [ "$#" -ge 1 ] || { echo "uso: $0 install prod [staging]" >&2; exit 1; }
  install -m 755 "${BASH_SOURCE[0]}" "$BIN"
  cat > /etc/systemd/system/helpdesk-ensure@.service <<'UNIT'
[Unit]
Description=HelpDesk Lite: comprobar y levantar la pila de %i (scripts/ops/ensure-stack.sh)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/helpdesk-ensure check %i
UNIT
  cat > /etc/systemd/system/helpdesk-ensure@.timer <<'UNIT'
[Unit]
Description=HelpDesk Lite: auto-recuperación de %i cada 5 min

[Timer]
OnBootSec=3min
OnUnitActiveSec=5min
Unit=helpdesk-ensure@%i.service

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  for env in "$@"; do
    systemctl enable --now "helpdesk-ensure@$env.timer" > /dev/null
    echo "helpdesk-ensure@$env.timer activo (cada 5 min). Parada deliberada: touch /opt/helpdesk/$env/.maintenance"
  done
  systemctl list-timers 'helpdesk-ensure@*' --no-pager | head -4
}

do_remove() {
  for env in "$@"; do systemctl disable --now "helpdesk-ensure@$env.timer" 2>/dev/null || true; done
  if ! systemctl list-timers 'helpdesk-ensure@*' --no-pager 2>/dev/null | grep -q helpdesk-ensure; then
    rm -f /etc/systemd/system/helpdesk-ensure@.service /etc/systemd/system/helpdesk-ensure@.timer "$BIN"
    systemctl daemon-reload
  fi
  echo "desinstalado para: $*"
}

[ "$(id -u)" -eq 0 ] || { echo "ejecuta con sudo" >&2; exit 1; }
case "$ACTION" in
  check)   [ "$#" -eq 1 ] || { echo "uso: $0 check prod" >&2; exit 1; }; check "$1" ;;
  install) do_install "$@" ;;
  remove)  do_remove "$@" ;;
  *) sed -n '2,25p' "${BASH_SOURCE[0]}"; exit 1 ;;
esac
