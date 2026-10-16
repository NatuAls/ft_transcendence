#!/usr/bin/env bash
# =============================================================================
#  HTTPS de confianza en el entorno local: https://localhost:5173
#
#  El enunciado no hace excepción con el entorno local: «Any connection to the
#  backend, from a browser, from a script, from an external API, etc., must use
#  HTTPS». Vite sirve la web por HTTPS cuando encuentra el certificado que deja
#  este script en config/local-tls/, y reenvía /api y /socket.io a la API por
#  la red de Docker, que es el «inside the backend» que sí puede ir sin cifrar.
#
#  Son dos piezas, y la diferencia es lo que importa al sobrescribir:
#
#    · La AUTORIDAD local (CA). Una por persona y máquina, FUERA del
#      repositorio (~/.local/share/helpdesk-lite/local-ca), para que todos los
#      clones de esa máquina la compartan. Es lo único que se importa en el
#      navegador, una vez. Sólo puede firmar para localhost, 127.0.0.1 y ::1
#      (nameConstraints): si su clave se escapase, no serviría para suplantar
#      ningún otro sitio. Este script no la rehace nunca: rehacerla obligaría a
#      importar la nueva en cada navegador y a borrar la vieja.
#    · El certificado de localhost. Uno por clon, en config/local-tls/ (fuera
#      de git), firmado por esa CA. Rehacerlo no tiene más consecuencia que
#      reiniciar la web: lo firma la misma CA, y el navegador lo sigue
#      aceptando sin tocar nada.
#
#  Uso:
#    make cert              lo crea si falta; si ya hay uno, pregunta antes de rehacerlo
#    make cert FORCE=1      lo rehace sin preguntar
#    make                   llama a este script con --ensure: lo crea si falta,
#                           lo rehace si caduca o no es de esta CA, y nunca pregunta
#
#  Además importa la autoridad en Chrome/Chromium y Firefox de esta cuenta (sus
#  bases NSS: ~/.pki/nssdb y los perfiles de Firefox), con el `certutil` del
#  sistema o, si no está —lo normal en los puestos de 42, sin sudo—, con el de un
#  contenedor. Lo reintenta en cada `make` hasta que sale, y anota la huella de
#  la autoridad importada para no repetirlo. Chrome la toma al volver a abrirlo.
#  Para quitarla: certutil -d sql:$HOME/.pki/nssdb -D -n "HelpDesk Lite local CA"
#
#  Necesita openssl (y Docker, que la pila ya exige, si no hay certutil).
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LEAF_DIR="$ROOT/config/local-tls"
LEAF_CRT="$LEAF_DIR/localhost.crt"
LEAF_KEY="$LEAF_DIR/localhost.key"
CA_DIR="${HELPDESK_LOCAL_CA:-${XDG_DATA_HOME:-$HOME/.local/share}/helpdesk-lite/local-ca}"
CA_CRT="$CA_DIR/ca.crt"
CA_KEY="$CA_DIR/ca.key"
CA_NICK="HelpDesk Lite local CA"
TRUST_MARK="$CA_DIR/trusted.sha256"
CERTUTIL_IMAGE="helpdesk-certutil:alpine-3.20"
ENV_FILE="$ROOT/.env"
DEV_PROJECT="${DEV_PROJECT:-helpdesk-dev}"
URL="https://localhost:5173"

MODE="ask"
case "${1:-}" in
  --ensure) MODE="ensure" ;;
  --force) MODE="force" ;;
  '') ;;
  *) echo "uso: $0 [--ensure | --force]" >&2; exit 2 ;;
esac

c_ok() { printf '\033[0;32m%s\033[0m\n' "$*"; }
c_info() { printf '\033[0;36m%s\033[0m\n' "$*"; }
c_warn() { printf '\033[0;33m%s\033[0m\n' "$*"; }

# Con `make` (--ensure), un fallo aquí no puede dejar a nadie sin entorno: se
# avisa y la web sigue por HTTP. Con `make cert`, el fallo es la respuesta.
fail() {
  if [ "$MODE" = "ensure" ]; then
    c_warn "  HTTPS local: $* (la web seguirá por http://localhost:5173)"
    exit 0
  fi
  printf '\033[0;31mHTTPS local: %s\033[0m\n' "$*" >&2
  exit 1
}

command -v openssl > /dev/null || fail "hace falta openssl"

ca_created=0
leaf_changed=0
env_changed=0

# -----------------------------------------------------------------------------
#  La autoridad local: se crea una vez y no se toca más
# -----------------------------------------------------------------------------
make_ca() {
  mkdir -p "$CA_DIR"
  chmod 700 "$CA_DIR"
  local cfg
  cfg="$(mktemp)"
  cat > "$cfg" <<EOF
[req]
distinguished_name = dn
prompt = no
x509_extensions = ca
[dn]
O = HelpDesk Lite (development)
CN = ${CA_NICK} ($(id -un)@$(hostname -s 2>/dev/null || echo local))
[ca]
basicConstraints = critical, CA:TRUE, pathlen:0
keyUsage = critical, keyCertSign, cRLSign
subjectKeyIdentifier = hash
nameConstraints = critical, permitted;DNS:localhost, permitted;IP:127.0.0.0/255.0.0.0, permitted;IP:0:0:0:0:0:0:0:1/FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF:FFFF
EOF
  (umask 077 && openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
    -out "$CA_KEY" 2> /dev/null)
  openssl req -new -x509 -config "$cfg" -key "$CA_KEY" -sha256 -days 3650 \
    -out "$CA_CRT" 2> /dev/null
  rm -f "$cfg"
  chmod 644 "$CA_CRT"
  ca_created=1
}

# -----------------------------------------------------------------------------
#  El certificado de localhost, firmado por esa autoridad
# -----------------------------------------------------------------------------
make_leaf() {
  mkdir -p "$LEAF_DIR"
  local cfg csr
  cfg="$(mktemp)"
  csr="$(mktemp)"
  cat > "$cfg" <<'EOF'
[req]
distinguished_name = dn
prompt = no
[dn]
O = HelpDesk Lite (development)
CN = localhost
[leaf]
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature
extendedKeyUsage = serverAuth
subjectAltName = DNS:localhost, IP:127.0.0.1, IP:::1
subjectKeyIdentifier = hash
authorityKeyIdentifier = keyid
EOF
  (umask 077 && openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 \
    -out "$LEAF_KEY.new" 2> /dev/null)
  openssl req -new -config "$cfg" -key "$LEAF_KEY.new" -out "$csr" 2> /dev/null
  # 825 días: el máximo que aceptan los sistemas que ponen límite a los
  # certificados de autoridades instaladas a mano.
  openssl x509 -req -in "$csr" -CA "$CA_CRT" -CAkey "$CA_KEY" \
    -set_serial "0x$(openssl rand -hex 16)" -days 825 -sha256 \
    -extfile "$cfg" -extensions leaf -out "$LEAF_CRT.new" 2> /dev/null
  rm -f "$cfg" "$csr"
  mv "$LEAF_KEY.new" "$LEAF_KEY"
  mv "$LEAF_CRT.new" "$LEAF_CRT"
  leaf_changed=1
}

# Vale si existe, no caduca en 30 días, lo firma ESTA autoridad y la clave es
# la suya. Cualquier otra cosa (un clon copiado de otra máquina, una CA
# rehecha a mano) se rehace sin preguntar: no tiene consecuencias.
leaf_ok() {
  [ -s "$LEAF_CRT" ] && [ -s "$LEAF_KEY" ] || return 1
  openssl x509 -in "$LEAF_CRT" -noout -checkend $((30 * 86400)) > /dev/null 2>&1 || return 1
  openssl verify -CAfile "$CA_CRT" "$LEAF_CRT" > /dev/null 2>&1 || return 1
  [ "$(openssl x509 -in "$LEAF_CRT" -noout -pubkey | openssl sha256)" = \
    "$(openssl pkey -in "$LEAF_KEY" -pubout | openssl sha256)" ]
}

describe_leaf() {
  printf '  Certificado:  %s\n' "${LEAF_CRT#"$ROOT"/}"
  printf '  Caduca:       %s\n' "$(openssl x509 -in "$LEAF_CRT" -noout -enddate | cut -d= -f2)"
  printf '  Huella:       %s\n' "$(openssl x509 -in "$LEAF_CRT" -noout -fingerprint -sha256 | cut -d= -f2)"
  printf '  Autoridad:    %s\n' "$CA_CRT"
}

# -----------------------------------------------------------------------------
#  Confianza del navegador: con certutil (del sistema o de un contenedor)
#
#  El 15/10, en un puesto sin certutil y sin sudo, la autoridad no llegó nunca
#  a Chrome: el script sólo lo intentaba al crearla, explicaba los pasos a mano
#  una vez, y ni `make` ni `make cert` volvían a probar. Chrome seguía con
#  NET::ERR_CERT_AUTHORITY_INVALID por mucho que se rehiciese el certificado,
#  que no era el problema.
# -----------------------------------------------------------------------------
ca_fingerprint() { openssl x509 -in "$CA_CRT" -noout -fingerprint -sha256 | cut -d= -f2; }
trust_recorded() { [ -s "$TRUST_MARK" ] && [ "$(cat "$TRUST_MARK")" = "$(ca_fingerprint)" ]; }

# certutil sobre una base NSS: el del sistema o, si no está, el de un contenedor
# (Alpine con nss-tools, construido la primera vez). La autoridad va como /ca.crt.
nss() {
  local db="$1" arg args=()
  shift
  if command -v certutil > /dev/null; then
    for arg in "$@"; do
      [ "$arg" = /ca.crt ] && arg="$CA_CRT"
      args+=("$arg")
    done
    certutil -d "sql:$db" "${args[@]}"
    return
  fi
  command -v docker > /dev/null || return 1
  if ! docker image inspect "$CERTUTIL_IMAGE" > /dev/null 2>&1; then
    printf 'FROM alpine:3.20\nRUN apk add --no-cache nss-tools\n' |
      docker build -q -t "$CERTUTIL_IMAGE" - > /dev/null 2>&1 || return 1
  fi
  # Con Docker normal se entra como el propio usuario, para que la base siga
  # siendo suya. Con Docker sin root (los puestos de 42) el root del contenedor
  # YA es el usuario; con --user sería otro y no podría escribirla.
  local as_user=(--user "$(id -u):$(id -g)")
  docker info --format '{{.SecurityOptions}}' 2> /dev/null | grep -q rootless && as_user=()
  docker run --rm "${as_user[@]}" -v "$db:/nssdb" -v "$CA_CRT:/ca.crt:ro" \
    "$CERTUTIL_IMAGE" certutil -d sql:/nssdb "$@"
}

trust_ca() {
  local dbs=("$HOME/.pki/nssdb") db imported=1
  for db in "$HOME"/.mozilla/firefox/*/; do
    [ -f "$db/cert9.db" ] && dbs+=("${db%/}")
  done
  for db in "${dbs[@]}"; do
    if [ ! -f "$db/cert9.db" ] &&
      ! { mkdir -p "$db" && nss "$db" -N --empty-password > /dev/null 2>&1; }; then
      continue
    fi
    nss "$db" -D -n "$CA_NICK" > /dev/null 2>&1 || true
    nss "$db" -A -t "C,," -n "$CA_NICK" -i /ca.crt > /dev/null 2>&1 && imported=0
  done
  [ "$imported" = 0 ] && ca_fingerprint > "$TRUST_MARK"
  return "$imported"
}

trust_by_hand() {
  c_warn "  ${1:-No se ha podido importar la autoridad local: hay que hacerlo a mano, una vez por navegador.}"
  printf '    Chrome / Chromium: chrome://certificate-manager → certificados importados de Linux\n'
  printf '                       → Autoridades → Importar → %s\n' "$CA_CRT"
  printf '                       → «Confiar en este certificado para identificar sitios web»\n'
  printf '    Firefox:           about:preferences#privacy → Ver certificados → Autoridades\n'
  printf '                       → Importar → %s → «Confiar en esta CA para identificar sitios web»\n' "$CA_CRT"
}

# -----------------------------------------------------------------------------
#  El .env de antes de HTTPS
#
#  gen-secrets.sh escribía para desarrollo APP_PUBLIC_ORIGIN=http://localhost:5173,
#  el origen de los enlaces que viajan por correo. Con HTTPS saldrían por http
#  hacia un puerto que ya sólo habla https. Vacío, la API lo deduce de la
#  petición: Vite le pasa X-Forwarded-Proto y X-Forwarded-Host, así que el
#  enlace sale con el esquema por el que se está usando la web.
# -----------------------------------------------------------------------------
migrate_env() {
  [ -f "$ENV_FILE" ] || return 0
  grep -qx 'APP_PUBLIC_ORIGIN=http://localhost:5173' "$ENV_FILE" || return 0
  local backup
  backup="$ENV_FILE.bak.$(date +%Y%m%d-%H%M%S)"
  cp -p "$ENV_FILE" "$backup"
  sed -i 's|^APP_PUBLIC_ORIGIN=http://localhost:5173$|APP_PUBLIC_ORIGIN=|' "$ENV_FILE"
  env_changed=1
  c_info "  .env: APP_PUBLIC_ORIGIN vaciado (los enlaces de los correos siguen al esquema de la web)."
  c_info "        Copia del anterior: $(basename "$backup")"
}

# -----------------------------------------------------------------------------
#  Ejecución
# -----------------------------------------------------------------------------
[ -s "$CA_CRT" ] && [ -s "$CA_KEY" ] || make_ca

if leaf_ok; then
  case "$MODE" in
    ensure) ;;
    force) make_leaf ;;
    ask)
      c_info "Ya hay un certificado HTTPS local en vigor:"
      describe_leaf
      printf '\n  Rehacerlo genera otra clave y otro certificado para localhost, firmados\n'
      printf '  por la MISMA autoridad: el navegador lo sigue aceptando sin hacer nada,\n'
      printf '  y la web se reinicia para usarlo. La autoridad no se toca.\n\n'
      if [ -t 0 ]; then
        printf '  ¿Rehacerlo? [s/N] '
        read -r answer || answer=''
        case "$answer" in
          s | S | si | sí | SI) make_leaf ;;
          *) c_ok "  Se queda el que hay." ;;
        esac
      else
        c_ok "  Se queda el que hay (sin terminal para preguntar; para rehacerlo: make cert FORCE=1)."
      fi
      ;;
  esac
else
  make_leaf
fi

openssl verify -CAfile "$CA_CRT" "$LEAF_CRT" > /dev/null 2>&1 ||
  fail "el certificado no se verifica contra la autoridad local"

migrate_env

if [ "$leaf_changed" = 1 ]; then
  c_ok "Certificado HTTPS local listo para $URL"
  describe_leaf
fi

[ "$ca_created" = 1 ] && c_info "  Autoridad local nueva en $CA_DIR (su clave no sale de ahí)."
if ! trust_recorded; then
  if trust_ca; then
    c_ok "  Autoridad local importada en los navegadores de esta cuenta (Chrome/Chromium y, si tiene perfiles, Firefox)."
    c_info "  Cierra Chrome del todo y vuelve a abrirlo: la toma al arrancar."
  else
    trust_by_hand
  fi
elif [ "$MODE" = "ask" ]; then
  c_ok "  La autoridad local ya está importada en los navegadores de esta cuenta."
  printf '  Si Chrome todavía avisa, ciérralo del todo y vuelve a abrirlo.\n'
fi

# La web sólo lee el certificado al arrancar; la API, el .env al crearse. Con
# `make` (--ensure) el `up` que viene detrás ya recrea la API si cambió el .env.
if [ "$leaf_changed" = 1 ] && docker ps --format '{{.Names}}' 2> /dev/null | grep -qx dev_web; then
  docker restart dev_web > /dev/null && c_info "  Web reiniciada con el certificado nuevo."
fi
if [ "$env_changed" = 1 ] && [ "$MODE" != "ensure" ] &&
  docker ps --format '{{.Names}}' 2> /dev/null | grep -qx dev_api; then
  docker compose -p "$DEV_PROJECT" -f "$ROOT/compose.dev.yml" up --detach --no-deps api > /dev/null 2>&1 &&
    c_info "  API recreada con el .env nuevo."
fi
