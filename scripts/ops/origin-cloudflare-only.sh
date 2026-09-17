#!/usr/bin/env bash
# =============================================================================
#  Cierra el ORIGEN a Cloudflare en los puertos web — segunda capa (iptables).
#                                                   (auditoría B2 / N3)
#
#  La primera capa es la security list de la VCN de Oracle (80/443 sólo desde
#  los rangos de Cloudflare). Ésta vive en el host: Docker publica 80/443/81
#  por la cadena FORWARD y se salta INPUT y ufw; la única cadena que Docker
#  respeta para filtrar ese tráfico es DOCKER-USER.
#
#  Uso (en el servidor):
#      sudo bash scripts/ops/origin-cloudflare-only.sh --dry-run   # ver reglas
#      sudo bash scripts/ops/origin-cloudflare-only.sh --apply     # aplicar + persistir
#      sudo bash scripts/ops/origin-cloudflare-only.sh --remove    # deshacer
#
#  QUÉ NO TOCA: el puerto 22 (SSH: tú, el túnel de monitor y GitHub Actions
#  entran por INPUT, no por Docker). Los rangos de GitHub NO hacen falta.
#
#  Seguridad: tras aplicar, comprueba que el sitio (ORIGIN_CHECK_URL, por
#  defecto https://helpdesklite.me/) sigue respondiendo 200 a través de
#  Cloudflare; si no, deshace las reglas solo. La IP pública del origen NO se
#  escribe en este fichero: es precisamente lo que Cloudflare oculta.
#  Persistencia: unidad systemd que reaplica tras docker.service en cada
#  arranque (Docker recrea DOCKER-USER vacía al reiniciar).
# =============================================================================
set -euo pipefail
MODE="${1:---dry-run}"
[ "$(id -u)" -eq 0 ] || { echo "ejecuta con sudo" >&2; exit 1; }
IFACE="$(ip -4 route show default | awk '{print $5; exit}')"
[ -n "$IFACE" ] || { echo "no encuentro la interfaz por defecto" >&2; exit 1; }
CHAIN=HELPDESK-ORIGIN
SELF="$(readlink -f "${BASH_SOURCE[0]}")"
CHECK_URL="${ORIGIN_CHECK_URL:-https://helpdesklite.me/}"

fetch_ranges() {
  V4="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v4)" || { echo "no pude descargar los rangos IPv4 de Cloudflare; no se toca nada" >&2; exit 1; }
  V6="$(curl -fsS --max-time 15 https://www.cloudflare.com/ips-v6)" || { echo "no pude descargar los rangos IPv6 de Cloudflare; no se toca nada" >&2; exit 1; }
  [ "$(echo "$V4" | grep -c '/')" -ge 10 ] || { echo "lista IPv4 sospechosamente corta" >&2; exit 1; }
}

rules() { # imprime las reglas para $1 = iptables|ip6tables, $2 = lista de rangos
  local ipt="$1" list="$2"
  echo "$ipt -N $CHAIN 2>/dev/null || $ipt -F $CHAIN"
  # Tráfico ya establecido (respuestas): siempre.
  echo "$ipt -A $CHAIN -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN"
  # Sólo miramos conexiones NUEVAS que entran por la interfaz pública a los
  # puertos publicados por NPM. El resto (redes internas de Docker, salida)
  # no pasa por aquí.
  while read -r cidr; do
    [ -n "$cidr" ] && echo "$ipt -A $CHAIN -i $IFACE -p tcp -m multiport --dports 80,443 -s $cidr -j RETURN"
  done <<< "$list"
  # 81 (admin de NPM): nunca desde fuera. Se administra por túnel SSH.
  echo "$ipt -A $CHAIN -i $IFACE -p tcp -m multiport --dports 80,443,81 -m conntrack --ctstate NEW -j DROP"
  # Enganchar la cadena en DOCKER-USER (una sola vez).
  echo "$ipt -C DOCKER-USER -j $CHAIN 2>/dev/null || $ipt -I DOCKER-USER 1 -j $CHAIN"
}

remove() {
  for ipt in iptables ip6tables; do
    $ipt -D DOCKER-USER -j $CHAIN 2>/dev/null || true
    $ipt -F $CHAIN 2>/dev/null || true
    $ipt -X $CHAIN 2>/dev/null || true
  done
  systemctl disable --now helpdesk-origin-cloudflare.service 2>/dev/null || true
  rm -f /etc/systemd/system/helpdesk-origin-cloudflare.service
  systemctl daemon-reload
  echo "reglas eliminadas: 80/443/81 vuelven a estar abiertos a todo el mundo en el host (la VCN sigue mandando)."
}

case "$MODE" in
  --dry-run)
    fetch_ranges
    echo "# interfaz pública: $IFACE"
    rules iptables  "$V4"; rules ip6tables "$V6"
    echo "# (dry-run: no se ha aplicado nada)"
    ;;
  --remove) remove ;;
  --apply)
    fetch_ranges
    iptables -L DOCKER-USER -n >/dev/null 2>&1 || { echo "no existe la cadena DOCKER-USER: ¿está Docker arrancado?" >&2; exit 1; }
    rules iptables  "$V4" | sh -e
    rules ip6tables "$V6" | sh -e
    echo "reglas aplicadas en DOCKER-USER → $CHAIN ($(echo "$V4" | wc -l) rangos IPv4, $(echo "$V6" | wc -l) IPv6)."
    # Comprobación de que producción sigue viva a través de Cloudflare.
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -A 'helpdesk-origin-check' "$CHECK_URL" || echo 000)"
    if [ "$code" != "200" ]; then
      echo "$CHECK_URL responde $code tras aplicar: DESHACIENDO." >&2
      remove; exit 1
    fi
    echo "$CHECK_URL responde 200 a través de Cloudflare."
    echo "Comprobación desde FUERA del servidor (debe agotar el tiempo):"
    echo "    curl -sI --max-time 8 -H 'Host: <dominio>' http://<IP pública de la instancia>/"
    # Persistencia.
    install -m 0755 "$SELF" /usr/local/sbin/helpdesk-origin-cloudflare.sh
    cat > /etc/systemd/system/helpdesk-origin-cloudflare.service <<UNIT
[Unit]
Description=HelpDesk Lite: origen sólo desde Cloudflare (DOCKER-USER)
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/helpdesk-origin-cloudflare.sh --apply-no-persist
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload && systemctl enable helpdesk-origin-cloudflare.service >/dev/null
    echo "persistido: se reaplica en cada arranque tras docker.service."
    ;;
  --apply-no-persist)   # lo usa la unidad systemd
    fetch_ranges
    rules iptables  "$V4" | sh -e
    rules ip6tables "$V6" | sh -e
    ;;
  *) echo "uso: $0 --dry-run | --apply | --remove" >&2; exit 1 ;;
esac
