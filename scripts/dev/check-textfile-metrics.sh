#!/usr/bin/env bash
# =============================================================================
#  Que la métrica LLEGUE, comprobado sin desplegar nada.
#
#  `promtool test rules` comprueba que las alarmas reaccionan bien a una
#  métrica. Lo que no puede comprobar es que la métrica llegue hasta
#  Prometheus, y ahí estuvo el fallo que costó días: el ensayo de restauración
#  escribía su métrica, node-exporter la leía, y Prometheus seguía viendo el
#  valor viejo. Diez días después, correo.
#
#  Este script levanta node-exporter —misma imagen y mismo glob que
#  `compose.observability.yml`— sobre árboles de mentira, y comprueba dos
#  cosas que sabemos de su comportamiento:
#
#    1. Con una sola fuente por serie, publica lo que hay.
#    2. Con DOS directorios publicando la misma serie, se queda con el que
#       ordena antes alfabéticamente y descarta el otro EN SILENCIO: responde
#       200 y deja `node_textfile_scrape_error` en 0. Si el que ordena antes
#       es el viejo, Prometheus nunca se entera del nuevo.
#
#  El segundo es el que mordió en el servidor: `backups/metrics/` ordena antes
#  que `prod-drills/`, así que un `restore.prom` olvidado allí tapaba el del
#  ensayo bueno. `sync-observability.sh` lo borra.
#
#      bash scripts/dev/check-textfile-metrics.sh     ·     make test-alerts
#
#  Sale 0 si node-exporter se comporta como está descrito arriba. Si algún día
#  cambia —al subir de versión, por ejemplo— esto se pone en rojo y nos
#  enteramos aquí y no por un correo a los diez días.
# =============================================================================
set -euo pipefail

IMAGEN='prom/node-exporter:v1.12.1'
PUERTO=19100
CONTENEDOR='helpdesk-textfile-probe'
SERIE='helpdesk_restore_drill_last_timestamp_seconds'

verde() { printf '\033[0;32m  %s\033[0m\n' "$*"; }
rojo()  { printf '\033[0;31m  %s\033[0m\n' "$*"; }
gris()  { printf '\033[0;90m  %s\033[0m\n' "$*"; }

RAIZ=$(mktemp -d)
limpiar() {
  docker rm -f "$CONTENEDOR" > /dev/null 2>&1 || true
  rm -rf "$RAIZ"
}
trap limpiar EXIT

# Escribe una métrica de ensayo en un directorio del árbol.
sembrar() { # sembrar <arbol> <directorio> <valor>
  mkdir -p "$1/$2"
  {
    echo "# HELP ${SERIE} Último ensayo de restauración."
    echo "# TYPE ${SERIE} gauge"
    echo "${SERIE}{env=\"prod\"} $3"
  } > "$1/$2/restore.prom"
}

# Qué valor publica node-exporter sobre ese árbol.
publicado() { # publicado <arbol>
  # node-exporter corre como `nobody`: sin esto no lee nada y el resultado
  # parece una colisión sin serlo.
  chmod -R a+rX "$1"
  docker rm -f "$CONTENEDOR" > /dev/null 2>&1 || true
  docker run -d --name "$CONTENEDOR" -p "127.0.0.1:${PUERTO}:9100" \
    -v "$1:/textfile:ro" "$IMAGEN" \
    --collector.textfile.directory='/textfile/*' \
    --web.listen-address=':9100' > /dev/null
  for _ in $(seq 1 40); do
    curl -sf "http://127.0.0.1:${PUERTO}/metrics" > /dev/null 2>&1 && break
    sleep 0.5
  done
  curl -sf "http://127.0.0.1:${PUERTO}/metrics" || true
}

fallos=0

# --- 1) Una sola fuente: se publica lo que hay ------------------------------
printf '\n'
gris '1 · una sola fuente por serie'
uno="$RAIZ/uno"
sembrar "$uno" 'prod-drills' 200
salida=$(publicado "$uno")
valor=$(printf '%s\n' "$salida" | awk -v s="$SERIE" '$0 ~ "^"s"{" {print $NF}')
error=$(printf '%s\n' "$salida" | awk '/^node_textfile_scrape_error/ {print $NF}' | head -1)
if [ "${error:-1}" != "0" ]; then
  rojo "node_textfile_scrape_error = ${error:-ausente}: no pudo leer el árbol"
  fallos=$((fallos + 1))
elif [ "${valor%%.*}" = "200" ] || [ "${valor}" = "200" ]; then
  verde "publica 200, que es lo que hay en disco"
else
  rojo "esperaba 200 y publica ${valor:-nada}"
  fallos=$((fallos + 1))
fi

# --- 2) Dos fuentes: gana la que ordena antes, en silencio ------------------
printf '\n'
gris '2 · dos directorios publicando la misma serie'
gris '    backups-metrics/ = 100 (viejo)   ·   prod-drills/ = 200 (nuevo)'
dos="$RAIZ/dos"
sembrar "$dos" 'backups-metrics' 100
sembrar "$dos" 'prod-drills' 200
salida=$(publicado "$dos")
valor=$(printf '%s\n' "$salida" | awk -v s="$SERIE" '$0 ~ "^"s"{" {print $NF}')
error=$(printf '%s\n' "$salida" | awk '/^node_textfile_scrape_error/ {print $NF}' | head -1)
cuantas=$(printf '%s\n' "$salida" | grep -c "^${SERIE}{" || true)
if [ "${valor%%.*}" = "100" ] && [ "$cuantas" = "1" ] && [ "${error:-1}" = "0" ]; then
  verde 'publica 100: gana el directorio que ordena antes, aunque sea el viejo'
  verde "y lo hace sin quejarse — node_textfile_scrape_error = 0"
  gris  'Por esto el ensayo bueno no se veía: un restore.prom olvidado en'
  gris  'backups/metrics tapaba el de drills/. Lo borra sync-observability.sh.'
else
  rojo "node-exporter ya no se comporta así: publica ${valor:-nada} en ${cuantas} serie(s), error=${error:-ausente}"
  rojo "Revisa si ${IMAGEN} ha cambiado de criterio; el runbook asume el anterior."
  fallos=$((fallos + 1))
fi

printf '\n'
if [ "$fallos" -eq 0 ]; then
  verde 'node-exporter se comporta como el runbook describe.'
  exit 0
fi
rojo "$fallos comprobación(es) no cuadran."
exit 1
