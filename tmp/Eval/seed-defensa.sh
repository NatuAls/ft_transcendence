#!/usr/bin/env bash
# =============================================================================
#  Datos de prueba ADICIONALES para la defensa — HelpDesk Lite (entorno local)
#
#  Va DESPUÉS de `make seed-dev` y se apoya en lo que éste crea (las cuentas
#  demo-*, la organización de Vilanova y sus 8 tickets). La siembra de
#  desarrollo deja cuentas, organizaciones, categorías y tickets; esto añade lo
#  que hace falta para que cada módulo tenga algo que enseñar nada más entrar:
#
#    · comentarios públicos y notas INTERNAS (sólo las ven AGENT y superiores)
#    · un ticket abierto asignado al agente
#    · amistades: laura ↔ marc aceptada, y una solicitud pendiente agent → laura
#    · una conversación de chat laura ↔ marc con mensajes
#    · una clave de la API pública de Vilanova (el secreto va a un fichero 600)
#    · opcional: N tickets de relleno para enseñar la paginación y la búsqueda
#
#  Todo por la API real (las mismas validaciones, permisos y eventos que una
#  persona en la interfaz), nada por SQL.
#
#  USO (desde la raíz del clon: las rutas relativas parten de ahí)
#      make seed-dev                                    # primero, siempre
#      bash tmp/Eval/seed-defensa.sh doc/seed.txt       # el fichero de make seed-dev
#      EXTRA_TICKETS=30 bash tmp/Eval/seed-defensa.sh doc/seed.txt
#
#  En la defensa, `tmp/` no está en el clon (no se entrega): se copia antes
#  fuera del repositorio y se lanza desde la raíz del clon limpio:
#      git show origin/docs:tmp/Eval/seed-defensa.sh > ~/defensa/seed-defensa.sh
#      bash ~/defensa/seed-defensa.sh ../seed.txt
#  La hoja pide revisar juntos los scripts que ayudan a corregir: enseñarlo
#  antes de lanzarlo.
#
#  Variables: API (def. https://localhost:5173/api/v1, por HTTPS con la autoridad
#                  local de `make cert`; sin ella, http://127.0.0.1:5000/api/v1)
#             CA (def. ~/.local/share/helpdesk-lite/local-ca/ca.crt)
#             KEY_FILE (def. ../defensa-api-key.txt, FUERA del repositorio)
#             EXTRA_TICKETS (def. 0)
#
#  Por HTTPS a propósito: el enunciado pide HTTPS para «any connection to the
#  backend, from a browser, from a script…», y este script se enseña a quien
#  evalúa antes de lanzarlo. Va por el mismo proxy que el navegador (Vite en el
#  5173), que reenvía a la API por la red interna de Docker.
#
#  Se puede repetir: no duplica comentarios (sólo comenta tickets que no tienen
#  ninguno), las amistades y la conversación ya existentes se reutilizan y la
#  clave «Defensa» sólo se crea si no existe. Los tickets de relleno SÍ se
#  añaden en cada pasada en que se pidan.
#
#  Necesita curl y jq.
# =============================================================================
set -euo pipefail

SEED_FILE="${1:-doc/seed.txt}"
CA="${CA:-${XDG_DATA_HOME:-$HOME/.local/share}/helpdesk-lite/local-ca/ca.crt}"
if [ -z "${API:-}" ]; then
  if [ -f "$CA" ]; then API="https://localhost:5173/api/v1"; else API="http://127.0.0.1:5000/api/v1"; fi
fi
TLS=()
case "$API" in https://*) [ -f "$CA" ] && TLS=(--cacert "$CA") ;; esac
KEY_FILE="${KEY_FILE:-../defensa-api-key.txt}"
EXTRA_TICKETS="${EXTRA_TICKETS:-0}"

log()  { printf '\033[0;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m    %s\033[0m\n' "$*"; }
die()  { printf '\033[0;31mERROR: %s\033[0m\n' "$*" >&2; exit 1; }

command -v curl > /dev/null || die "hace falta curl."
command -v jq > /dev/null || die "hace falta jq (sudo apt install jq / brew install jq)."
[ -f "$SEED_FILE" ] || die "no encuentro $SEED_FILE. Ejecuta antes: make seed-dev"

# --- Peticiones -------------------------------------------------------------
# call <método> <ruta> <token|-> [json]: deja el cuerpo en BODY y el código en
# STATUS. Sin subshells, para que STATUS llegue a quien llama y para que un
# `die` pare el script entero.
TMP_BODY="$(mktemp)"
trap 'rm -f "$TMP_BODY"' EXIT
STATUS=0
BODY=''
call() {
  local method="$1" path="$2" token="$3" data="${4:-}"
  local args=(-s "${TLS[@]}" -X "$method" "$API$path" -o "$TMP_BODY" -w '%{http_code}')
  [ "$token" != "-" ] && args+=(-H "authorization: Bearer $token")
  [ -n "$data" ] && args+=(-H 'content-type: application/json' -d "$data")
  STATUS="$(curl "${args[@]}")" || STATUS=000
  BODY="$(cat "$TMP_BODY")"
}
# must "<códigos aceptados>" <qué> -- <argumentos de call>
must() {
  local ok="$1" what="$2"
  shift 3
  call "$@"
  case " $ok " in
    *" $STATUS "*) ;;
    *) die "$what: HTTP $STATUS $(printf '%s' "$BODY" | head -c 300)" ;;
  esac
}

# La contraseña de una cuenta, leída del fichero de make seed-dev. Sólo la
# PRIMERA línea que la nombra: la sección «Organizaciones» repite el correo.
password_of() { awk -v e="$1" '$0 ~ e { print $NF; exit }' "$SEED_FILE"; }

# login <correo>: deja el token en TOKEN y el id de la cuenta en USER_ID.
login() {
  local pass
  pass="$(password_of "$1")"
  [ -n "$pass" ] || die "no encuentro la contraseña de $1 en $SEED_FILE"
  local payload attempt
  payload="$(jq -nc --arg e "$1" --arg p "$pass" '{email: $e, password: $p}')"
  # Las rutas de credenciales están limitadas a 10 por minuto y por IP
  # (RATE_LIMIT_AUTH_PER_MIN). El limitador es una protección real y no se
  # toca: se espera a que se abra la ventana, como hace make seed-dev.
  for attempt in 1 2 3; do
    call POST /auth/login - "$payload"
    [ "$STATUS" = "429" ] || break
    warn "limitador de credenciales: esperando 61 s (intento $attempt de 3)"
    sleep 61
  done
  [ "$STATUS" = "200" ] || die "entrar como $1: HTTP $STATUS $(printf '%s' "$BODY" | head -c 300)"
  TOKEN="$(jq -r .accessToken <<< "$BODY")"
  USER_ID="$(jq -r .user.id <<< "$BODY")"
}

curl -sf "${TLS[@]}" "${API%/api/v1}/api/health" > /dev/null \
  || die "la API no responde en ${API%/api/v1}. Levanta el entorno con: make up-dev"
case "$API" in
  https://*) echo "    API por HTTPS: $API" ;;
  *) warn "API por HTTP ($API): no hay autoridad local (make cert). No lanzarlo así delante de quien evalúa." ;;
esac

# --- 1. Sesiones --------------------------------------------------------------
log "Entrando con las cuentas de la siembra"
login demo-admin@helpdesklite.me; ADMIN="$TOKEN"
login demo-agent@helpdesklite.me; AGENT="$TOKEN"; AGENT_ID="$USER_ID"
login demo-laura@helpdesklite.me; LAURA="$TOKEN"; LAURA_ID="$USER_ID"
login demo-marc@helpdesklite.me; MARC="$TOKEN"; MARC_ID="$USER_ID"
token_of() { case "$1" in demo-laura) echo "$LAURA" ;; demo-marc) echo "$MARC" ;; *) echo "$AGENT" ;; esac; }

must "200" "listar organizaciones" -- GET /organizations "$ADMIN"
ORG="$(jq -r '[.[] | select(.name | startswith("Ayuntamiento de Vilanova"))][0].id // empty' <<< "$BODY")"
[ -n "$ORG" ] || die "no encuentro la organización de Vilanova: ¿se ejecutó make seed-dev?"
echo "    organización Vilanova: $ORG"

# --- 2. Comentarios, notas internas y una asignación --------------------------
log "Comentarios y notas internas"
must "200" "listar tickets" -- GET "/tickets?organizationId=$ORG&take=100" "$AGENT"
TICKETS="$BODY"
commented=0
while IFS=$'\t' read -r id ref status author count; do
  [ "$count" = "0" ] || continue
  author_token="$(token_of "$author")"
  must "201" "comentar $ref" -- POST "/tickets/$id/comments" "$AGENT" \
    "$(jq -nc --arg r "$ref" '{body: ("Hola, soy Jordi, del equipo de soporte. Revisamos " + $r + " y te contamos en cuanto tengamos novedades.")}')"
  must "201" "responder en $ref" -- POST "/tickets/$id/comments" "$author_token" \
    '{"body":"Gracias. Si necesitáis algo más de información, decídmelo por aquí."}'
  if [ "$status" != "OPEN" ]; then
    must "201" "nota interna en $ref" -- POST "/tickets/$id/comments" "$AGENT" \
      "$(jq -nc --arg r "$ref" '{body: ("NOTA INTERNA (" + $r + "): revisado el registro del equipo; no compartir con la persona usuaria."), isInternal: true}')"
  fi
  commented=$((commented + 1))
done < <(jq -r '.data[] | [.id, .reference, .status, .authorUsername, (.commentCount|tostring)] | @tsv' <<< "$TICKETS")
echo "    tickets comentados en esta pasada: $commented"

# Uno de los abiertos queda asignado al agente; el otro se deja SIN asignar
# para hacer la asignación en directo delante de quien evalúa.
FIRST_OPEN="$(jq -r '[.data[] | select(.status == "OPEN" and .assigneeUsername == null)][0].id // empty' <<< "$TICKETS")"
OPEN_COUNT="$(jq -r '[.data[] | select(.status == "OPEN" and .assigneeUsername == null)] | length' <<< "$TICKETS")"
if [ -n "$FIRST_OPEN" ] && [ "$OPEN_COUNT" -gt 1 ]; then
  must "200" "asignar un ticket abierto" -- PATCH "/tickets/$FIRST_OPEN/assignee" "$AGENT" \
    "$(jq -nc --arg a "$AGENT_ID" '{assigneeId: $a}')"
  echo "    un ticket abierto asignado a demo-agent (queda otro sin asignar)"
fi

# --- 3. Amistades --------------------------------------------------------------
log "Amistades"
call POST /friends/requests "$LAURA" '{"username":"demo-marc"}'
case "$STATUS" in 200|201) echo "    laura → marc: solicitud enviada" ;; 409) echo "    laura → marc: ya existía" ;; *) warn "laura → marc: HTTP $STATUS" ;; esac
must "200" "solicitudes de marc" -- GET /friends/requests "$MARC"
REQ="$(jq -r --arg l "$LAURA_ID" '[.incoming[]? | select(.requester.id == $l)][0].id // empty' <<< "$BODY")"
if [ -n "$REQ" ]; then
  must "200 204" "marc acepta a laura" -- PATCH "/friends/requests/$REQ" "$MARC" '{"action":"ACCEPT"}'
  echo "    marc ha aceptado: laura y marc son amigos"
fi
call POST /friends/requests "$AGENT" '{"username":"demo-laura"}'
case "$STATUS" in 200|201) echo "    agent → laura: solicitud PENDIENTE (para aceptarla en directo)" ;; 409) echo "    agent → laura: ya existía" ;; *) warn "agent → laura: HTTP $STATUS" ;; esac

# --- 4. Chat ----------------------------------------------------------------
log "Conversación laura ↔ marc"
must "200 201" "abrir la conversación" -- POST /conversations "$LAURA" \
  "$(jq -nc --arg u "$MARC_ID" '{userId: $u}')"
CONV="$(jq -r '.id // .conversation.id' <<< "$BODY")"
must "200" "leer mensajes" -- GET "/conversations/$CONV/messages?take=5" "$LAURA"
MSGS="$(jq -r 'if type == "array" then length else (.data | length) end' <<< "$BODY")"
if [ "$MSGS" = "0" ]; then
  must "201" "mensaje" -- POST "/conversations/$CONV/messages" "$LAURA" '{"body":"Marc, ¿te funciona ya la impresora de Llicències?"}'
  must "201" "mensaje" -- POST "/conversations/$CONV/messages" "$MARC" '{"body":"Todavía no, he abierto un ticket. Jordi dice que hoy lo mira."}'
  must "201" "mensaje" -- POST "/conversations/$CONV/messages" "$LAURA" '{"body":"Perfecto, gracias. Avísame si necesitas imprimir algo urgente."}'
  echo "    3 mensajes enviados"
else
  echo "    la conversación ya tenía mensajes"
fi

# --- 5. Clave de la API pública -------------------------------------------------
log "Clave de la API pública"
must "200" "listar claves" -- GET "/organizations/$ORG/api-keys" "$ADMIN"
HAS_KEY="$(jq -r '[(if type == "array" then . else .data end)[] | select(.name == "Defensa" and .revokedAt == null)] | length' <<< "$BODY")"
if [ "$HAS_KEY" = "0" ]; then
  must "201" "crear la clave" -- POST "/organizations/$ORG/api-keys" "$ADMIN" \
    '{"name":"Defensa","scopes":["tickets:read","tickets:write","comments:read","comments:write","categories:read","categories:write","stats:read"]}'
  SECRET="$(jq -r '.secret // .apiKey.secret' <<< "$BODY")"
  ( umask 077; printf 'X-API-Key: %s\n# organización: %s\n' "$SECRET" "$ORG" > "$KEY_FILE" )
  echo "    clave «Defensa» creada; el secreto (se muestra UNA vez) está en $KEY_FILE"
else
  echo "    la clave «Defensa» ya existe (su secreto está en $KEY_FILE desde la primera pasada)"
fi

# --- 6. Relleno para la paginación ---------------------------------------------
if [ "$EXTRA_TICKETS" -gt 0 ]; then
  log "Tickets de relleno: $EXTRA_TICKETS"
  prios=(LOW MEDIUM HIGH)
  for i in $(seq 1 "$EXTRA_TICKETS"); do
    must "201" "ticket de relleno $i" -- POST /tickets "$MARC" \
      "$(jq -nc --arg o "$ORG" --arg i "$i" --arg p "${prios[$((i % 3))]}" \
        '{organizationId: $o, title: ("Equipo de préstamo número " + $i + " no arranca"), description: ("Ticket de relleno " + $i + " para enseñar la paginación, los filtros y la búsqueda."), priority: $p}')"
  done
fi

log "Listo"
case "$API" in
  https://*) echo "    Entra en https://localhost:5173 con las cuentas de $SEED_FILE" ;;
  *) echo "    Entra en http://localhost:5173 con las cuentas de $SEED_FILE" ;;
esac
