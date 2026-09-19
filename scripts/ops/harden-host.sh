#!/usr/bin/env bash
# =============================================================================
#  Endurecimiento del host — HelpDesk Lite   (auditoría N28, N31, N32, B9)
#
#  Uso (en el servidor):  sudo bash scripts/ops/harden-host.sh
#
#  Idempotente. NO toca el puerto 22 ni la autenticación por clave: sólo
#    1. fail2ban sobre sshd (2.184 intentos fallidos/24 h el 17/09)
#    2. PermitRootLogin no (ubuntu tiene sudo; root no necesita entrar)
#    3. Match User deployer: sin túneles, sin agente, sin X11, sin PTY
#       (appleboy/ssh-action no usa nada de eso; monitor ya está así)
#    4. rpcbind desactivado (escuchaba en 0.0.0.0:111 sin ningún uso)
#  Cada cambio de sshd se valida con `sshd -t` antes de recargar, y la sesión
#  actual no se corta (reload, no restart).
# =============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "ejecuta con sudo" >&2; exit 1; }
log() { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }

log "1. fail2ban (sshd)"
if ! command -v fail2ban-client >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y -q fail2ban >/dev/null
fi
cat > /etc/fail2ban/jail.d/sshd-helpdesk.local <<'JAIL'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
# La IP del túnel de los compañeros y de GitHub Actions NO se listan: con clave
# obligatoria no generan fallos de autenticación. Si alguien se bloquea a sí
# mismo: fail2ban-client set sshd unbanip <ip>
JAIL
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban
# El socket tarda un par de segundos en aparecer tras el restart; sin esta
# espera, `status` fallaba y `set -e` abortaba el script antes del paso 2.
for _ in 1 2 3 4 5 6 7 8 9 10; do
  fail2ban-client ping >/dev/null 2>&1 && break
  sleep 1
done
fail2ban-client status sshd | sed -n '1,6p' || echo "[aviso] fail2ban aún arrancando; comprobar luego con: fail2ban-client status sshd"

log "2-3. sshd: PermitRootLogin no + restricciones para deployer"
cat > /etc/ssh/sshd_config.d/90-helpdesk.conf <<'SSHD'
# HelpDesk Lite — endurecimiento (scripts/ops/harden-host.sh)
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
X11Forwarding no

# El usuario del pipeline sólo ejecuta comandos: sin túneles, sin agente,
# sin terminal. (Pertenece al grupo docker, que equivale a root en el host:
# esto acota la superficie SSH, no ese hecho. Ver Audit/audit3.md §4.1.)
Match User deployer
    AllowTcpForwarding no
    AllowAgentForwarding no
    PermitTunnel no
    X11Forwarding no
    PermitTTY no
SSHD
if sshd -t; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  echo "sshd recargado. Comprobación:"
  sshd -T -C user=deployer,host=x,addr=127.0.0.1 | grep -E '^(permitrootlogin|allowtcpforwarding|permittty|passwordauthentication)'
else
  rm -f /etc/ssh/sshd_config.d/90-helpdesk.conf
  echo "sshd -t ha fallado: no se aplica nada." >&2; exit 1
fi

log "4. rpcbind"
systemctl disable --now rpcbind.socket rpcbind.service 2>/dev/null || true
ss -tlnp | grep -q ':111 ' && echo "[aviso] :111 sigue escuchando" || echo "rpcbind parado: :111 cerrado"

echo
echo "Hecho. Recuerda: la clave del pipeline sigue funcionando (sólo comandos, sin túnel)."
