#!/usr/bin/env bash
# =============================================================================
#  Saca del servidor el material personal al alcance de `deployer` (que, por
#  el grupo docker, es root).                        (auditoría §4.1, N26)
#
#  Uso (en el servidor):  sudo bash scripts/ops/cleanup-host-personal-data.sh
#
#  Pregunta ANTES de cada acción. No toca nada de /opt/helpdesk salvo los
#  volcados en claro de backups antiguos (último paso). Lo que hace, si dices
#  que sí:
#    1. Clave SSH personal del administrador (~/.ssh/id_ed25519, registrada en
#       su cuenta de GitHub): se borra del servidor. Si ~/repo necesita hacer
#       git pull, se genera una DEPLOY KEY de sólo lectura para ese repo.
#    2. Login de ghcr.io guardado en ~ubuntu/.docker/config.json (PAT ghp_ de
#       otro usuario): docker logout.
#    3. Claves privadas GPG en ~ubuntu/.gnupg: se exportan cifradas a un
#       fichero que te llevas, y se borran del servidor.
#    4. ~ubuntu/.bash_history con secretos tecleados: se vacía y se deja de
#       guardar líneas que empiecen por espacio (HISTCONTROL=ignorespace).
#    5. Clave PRIVADA de deployer en /home/deployer/.ssh (no hace falta en el
#       servidor; sólo la pública en authorized_keys).
#    6. Volcados en claro de /opt/helpdesk/prod/backups (v1, sin cifrar).
#
#  Después, fuera del servidor: valorar rotar esa clave en GitHub → Settings →
#  SSH and GPG keys (estuvo al alcance de terceros), y que el dueño del PAT
#  ghp_ lo revoque.
#
#  Este script es específico de ESTE host (administrador `ubuntu`, un único
#  repo en ~/repo). No hace falta llevarlo a otros repositorios.
# =============================================================================
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "ejecuta con sudo" >&2; exit 1; }
H=/home/ubuntu
ask() { read -r -p "$1 [s/N] " a; [ "${a,,}" = "s" ] || [ "${a,,}" = "y" ]; }
log() { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }

log "1. Clave SSH personal de ubuntu"
if [ -f "$H/.ssh/id_ed25519" ]; then
  echo "Huella: $(ssh-keygen -lf "$H/.ssh/id_ed25519" | awk '{print $2}')  (comentario: $(ssh-keygen -y -f "$H/.ssh/id_ed25519" | awk '{print $3}'))"
  if ask "¿Borrar $H/.ssh/id_ed25519 (y .pub) del servidor?"; then
    shred -u "$H/.ssh/id_ed25519" 2>/dev/null || rm -f "$H/.ssh/id_ed25519"
    rm -f "$H/.ssh/id_ed25519.pub"
    echo "borrada. Valora rotarla en GitHub → Settings → SSH and GPG keys (estuvo al alcance de terceros)."
    if ask "¿Generar una deploy key de SÓLO LECTURA para ~/repo (para poder hacer git pull)?"; then
      sudo -u ubuntu ssh-keygen -t ed25519 -N '' -C "deploy-key-ro-helpdesk-$(hostname)" -f "$H/.ssh/helpdesk_deploy_ro" >/dev/null
      sudo -u ubuntu sh -c "printf 'Host github.com\n  User git\n  IdentityFile ~/.ssh/helpdesk_deploy_ro\n  IdentitiesOnly yes\n' > $H/.ssh/config"
      echo "Pública (añadir en el repo → Settings → Deploy keys, SIN 'Allow write access'):"
      cat "$H/.ssh/helpdesk_deploy_ro.pub"
    fi
  fi
else
  echo "no existe (ya limpio)"
fi

log "2. Login de ghcr.io en ~ubuntu/.docker/config.json"
if [ -f "$H/.docker/config.json" ] && grep -q ghcr.io "$H/.docker/config.json"; then
  user="$(python3 -c "import json,base64;d=json.load(open('$H/.docker/config.json'));print(base64.b64decode(d['auths']['ghcr.io']['auth']).decode().split(':')[0])" 2>/dev/null || echo '?')"
  echo "Hay un login de ghcr.io del usuario '$user' con token en claro (base64)."
  if ask "¿docker logout ghcr.io (como ubuntu)?"; then
    sudo -u ubuntu docker logout ghcr.io >/dev/null && echo "hecho. Que '$user' revoque ese token en GitHub → Settings → Developer settings → Personal access tokens."
  fi
else
  echo "sin login guardado (ya limpio)"
fi

log "3. Claves privadas GPG en ~ubuntu/.gnupg"
if [ -d "$H/.gnupg/private-keys-v1.d" ] && [ -n "$(ls -A "$H/.gnupg/private-keys-v1.d" 2>/dev/null)" ]; then
  sudo -u ubuntu gpg --list-secret-keys --keyid-format short 2>/dev/null | grep -E '^(sec|uid)' || true
  if ask "¿Exportar las claves privadas a /root/gnupg-backup-$(hostname).asc (cifrado simétrico, te pedirá una frase) y borrar ~/.gnupg?"; then
    sudo -u ubuntu gpg --armor --export-secret-keys 2>/dev/null | gpg --symmetric --armor -o "/root/gnupg-backup-$(hostname).asc"
    rm -rf "$H/.gnupg"
    echo "exportadas a /root/gnupg-backup-$(hostname).asc (llévatelo con scp y bórralo del servidor). ~/.gnupg eliminado."
  fi
else
  echo "sin claves privadas (ya limpio)"
fi

log "4. ~ubuntu/.bash_history"
if [ -s "$H/.bash_history" ]; then
  echo "$(grep -cE '(PASSWORD|SECRET|TOKEN|PEPPER|KEY)=|ghp_|github_pat_|docker login' "$H/.bash_history") líneas con patrón de secreto."
  if ask "¿Vaciar el historial y configurar HISTCONTROL=ignorespace?"; then
    : > "$H/.bash_history"
    grep -q 'HISTCONTROL=ignorespace' "$H/.bashrc" || echo 'export HISTCONTROL=ignorespace   # una línea que empieza por espacio no se guarda' >> "$H/.bashrc"
    echo "hecho (la sesión actual aún tiene el historial en memoria: cierra sesión sin guardar con 'kill -9 \$\$' o 'history -c')."
  fi
fi

log "5. Clave PRIVADA de deployer en el servidor"
if ls /home/deployer/.ssh/id_* >/dev/null 2>&1; then
  ls -la /home/deployer/.ssh/id_*
  if ask "¿Borrar la clave privada de deployer del servidor (sólo hace falta authorized_keys)?"; then
    shred -u /home/deployer/.ssh/id_ed25519 2>/dev/null || rm -f /home/deployer/.ssh/id_ed25519
    rm -f /home/deployer/.ssh/id_ed25519.pub
    echo "hecho. authorized_keys intacto: el pipeline sigue entrando."
  fi
else
  echo "no hay claves privadas en /home/deployer/.ssh (ya limpio)"
fi

log "6. Volcados de backup en claro (v1) en /opt/helpdesk/prod/backups"
for d in /opt/helpdesk/*/backups/20*; do
  [ -f "$d/database.dump" ] || continue
  echo "$d: database.dump en claro ($(wc -c < "$d/database.dump") bytes)"
  if ask "¿Borrar $d?"; then rm -rf "$d"; echo "borrado"; fi
done

echo
echo "Listo. Comprobación rápida de lo que queda a la vista de deployer vía docker:"
docker run --rm -v "$H:/x:ro" alpine:3.20 sh -c 'ls -a /x /x/.ssh 2>/dev/null' | tr '\n' ' '; echo
