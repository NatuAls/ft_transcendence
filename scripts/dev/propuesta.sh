#!/usr/bin/env bash
# =============================================================================
#  Propuestas del frontend: CI y vista previa en local
#
#  Cada propuesta vive en su rama (proposal/*) y trae una página /demo.html
#  que enseña lo que cambia. Este script prepara un árbol de trabajo por
#  propuesta, le pasa el CI local y levanta la aplicación para verla.
#
#      scripts/dev/propuesta.sh <propuesta> <orden>
#      make propuesta P=estilos-base A=demo
#
#  Propuestas: estilos-base · transversal-core · pantalla-referencia
#
#  Órdenes:
#      ci     CI local sobre esa rama (por defecto: quality + unit, que son
#             los jobs que tocan el frontend; JOBS="..." para elegir otros,
#             JOBS="all" para los seis).
#      demo   Vite en un contenedor y abre la página de la propuesta. No
#             necesita backend ni tener Node instalado.
#      app    Pila de desarrollo completa (Postgres, Redis, Mailpit, API y
#             web) desde esa rama: la aplicación de verdad, con su API.
#      down   Para lo que esté levantado de esa propuesta.
#      info   Qué cambia la rama y qué mirar.
#
#  Los árboles se crean en ~/helpdesk-propuestas/<repo>/<propuesta>
#  (PROPUESTAS_DIR para cambiarlo). Se dejan ahí entre ejecuciones: el
#  `npm ci` de la primera vez no se repite.
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# Un directorio por repositorio: el del equipo y el privado de DevOps tienen
# las mismas ramas, y un árbol de trabajo sólo puede pertenecer a uno.
PROPUESTAS_DIR="${PROPUESTAS_DIR:-$HOME/helpdesk-propuestas/$(basename "$ROOT")}"
WEB_PORT="${WEB_PORT:-5173}"

PROPOSAL="${1:-}"
ACTION="${2:-info}"

log()  { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m[aviso] %s\033[0m\n' "$*"; }
fail() { printf '\033[0;31m%s\033[0m\n' "$*" >&2; exit 1; }

case "$PROPOSAL" in
  estilos-base|transversal-core|pantalla-referencia) ;;
  *)
    cat >&2 <<MSG
Uso: $0 <propuesta> <orden>

  Propuestas: estilos-base | transversal-core | pantalla-referencia
  Órdenes:    ci | demo | app | down | info
MSG
    exit 2 ;;
esac

BRANCH="proposal/$PROPOSAL"
WORKTREE="$PROPUESTAS_DIR/$PROPOSAL"
PROJECT="helpdesk-$PROPOSAL"

describe() {
  case "$PROPOSAL" in
    estilos-base)
      cat <<'MSG'
  Propuesta 1 · base de estilos (Tailwind v4 con nuestros tokens)
    Documento .......... PROPUESTA-ESTILOS.md (fuera del repo)
    Qué cambia ......... tokens en packages/ui/src/theme.css, el plugin en
                         vite.config.ts y NotFoundPage migrada a utilidades.
    Qué mirar en demo .. la paleta, la escala de espaciado y de texto, los
                         componentes de packages/ui conviviendo con ellas y
                         el botón "Ver la pantalla migrada".
    En la aplicación ... http://localhost:PORT/#not-found
MSG
      ;;
    transversal-core)
      cat <<'MSG'
  Propuesta 2 · piezas transversales (core/)
    Documento .......... PROPUESTA-TRANSVERSAL.md (fuera del repo)
    Qué cambia ......... apps/web/src/core (api, realtime, i18n, async,
                         feedback) y 4 componentes nuevos en packages/ui.
    Qué mirar en demo .. los cuatro escenarios de carga, los avisos que
                         traducen un error de la API y uno de red, los
                         errores por campo, los componentes nuevos y el
                         selector de idioma (en/es/ca).
    En la aplicación ... las piezas aún no están enchufadas a ninguna
                         pantalla (eso es el trabajo de los bloques): la
                         demo es la forma de verlas.
MSG
      ;;
    pantalla-referencia)
      cat <<'MSG'
  Propuesta 3 · pantalla terminada de punta a punta
    Documento .......... PROPUESTA-PANTALLA-REFERENCIA.md (fuera del repo)
    Qué cambia ......... api/http.ts + api/organizations.ts, la pantalla de
                         organizaciones conectada, y vitest en apps/web.
    Qué mirar en demo .. el selector de escenario: con datos, vacía, error
                         500 con reintento, carga lenta; y crear una
                         organización repitiendo el nombre para ver el 409.
    En la aplicación ... `app`, registrarse y entrar en
                         http://localhost:PORT/#organizations (API real).
MSG
      ;;
  esac
}

ensure_worktree() {
  if [ -d "$WORKTREE" ]; then
    git -C "$WORKTREE" rev-parse --git-dir > /dev/null 2>&1 \
      || fail "$WORKTREE existe pero no es un árbol de trabajo de git."
    # Los dos repositorios (el del equipo y el privado de DevOps) tienen las
    # mismas ramas: sin esta comprobación se trabajaría sobre el árbol del otro
    # sin enterarse.
    local suyo mio
    suyo="$(git -C "$WORKTREE" rev-parse --path-format=absolute --git-common-dir 2> /dev/null)"
    mio="$(git -C "$ROOT" rev-parse --path-format=absolute --git-common-dir 2> /dev/null)"
    [ "$suyo" = "$mio" ] || fail \
      "$WORKTREE pertenece a otro repositorio ($suyo). Usa PROPUESTAS_DIR=<otra ruta> o bórralo."
    return
  fi

  local ref="$BRANCH"
  if ! git -C "$ROOT" rev-parse --verify --quiet "$ref" > /dev/null; then
    # Si la rama no está en local pero sí publicada, se usa la del remoto.
    if git -C "$ROOT" rev-parse --verify --quiet "origin/$BRANCH" > /dev/null; then
      ref="origin/$BRANCH"
    else
      fail "No existe la rama $BRANCH (ni origin/$BRANCH) en $ROOT."
    fi
  fi
  log "Creando el árbol de trabajo de $PROPOSAL en $WORKTREE"
  mkdir -p "$PROPUESTAS_DIR"
  git -C "$ROOT" worktree add "$WORKTREE" "$ref"
}

# Imagen con Node de .nvmrc y el npm de devEngines; la construye el CI local.
ci_image() {
  local node_version npm_version
  node_version="$(tr -d '[:space:]' < "$WORKTREE/.nvmrc")"
  npm_version="$(grep -A3 '"packageManager"' "$WORKTREE/package.json" | grep -m1 '"version"' | cut -d'"' -f4)"
  echo "helpdesk-ci:node${node_version}-npm${npm_version:-11.17.0}"
}

case "$ACTION" in
  info)
    describe | sed "s/PORT/$WEB_PORT/g"
    echo
    echo "  Rama ............... $BRANCH ($(git -C "$ROOT" log -1 --format=%h "$BRANCH"))"
    echo "  Árbol de trabajo ... $WORKTREE$([ -d "$WORKTREE" ] || echo '  (aún sin crear)')"
    echo
    echo "  scripts/dev/propuesta.sh $PROPOSAL ci    · scripts/dev/propuesta.sh $PROPOSAL demo"
    ;;

  ci)
    ensure_worktree
    jobs="${JOBS:-quality unit}"
    [ "$jobs" = all ] && jobs=""
    log "CI local sobre $BRANCH${jobs:+ (jobs: $jobs)}"
    # El lanzador del CI vive en la rama de DevOps; se invoca por ruta
    # absoluta y trabaja sobre el árbol donde estemos.
    ( cd "$WORKTREE" && bash "$ROOT/scripts/ci/run-local.sh" $jobs )
    ;;

  demo)
    ensure_worktree
    image="$(ci_image)"
    docker image inspect "$image" > /dev/null 2>&1 || {
      log "Construyendo la imagen de Node (primera vez)"
      ( cd "$WORKTREE" && bash "$ROOT/scripts/ci/run-local.sh" compose > /dev/null )
    }
    # Las tres demos usan el puerto 5173: si hay otra levantada, se para sola.
    # En una presentación no hay que acordarse de nada: basta con lanzar la
    # siguiente y recargar la pestaña del navegador.
    for other in $(docker ps --format '{{.Names}}' \
      | grep -E '^helpdesk-(estilos-base|transversal-core|pantalla-referencia)-web$' || true); do
      [ "$other" = "$PROJECT-web" ] && continue
      log "Parando la demo anterior ($other)"
      docker rm -f "$other" > /dev/null
    done
    if docker ps --format '{{.Names}}' | grep -qx dev_web; then
      fail "La pila completa (make propuesta A=app) está ocupando el 5173. Párala con: scripts/dev/propuesta.sh <propuesta> down"
    fi

    log "Vite para $PROPOSAL (sin backend)"
    describe | sed "s/PORT/$WEB_PORT/g"
    cat <<MSG

  Demo ........ http://localhost:$WEB_PORT/demo.html
  Aplicación .. http://localhost:$WEB_PORT/          (con datos de ejemplo)

  Ctrl-C para parar.
MSG
    mkdir -p "$HOME/.cache/helpdesk-ci"
    # -it sólo si hay terminal: así también se puede lanzar desde un script.
    tty_args=()
    [ -t 0 ] && tty_args=(-it)
    docker run --rm "${tty_args[@]}" \
      --name "$PROJECT-web" \
      --user "$(id -u):$(id -g)" \
      -v "$WORKTREE:/work" -w /work \
      -v "$HOME/.cache/helpdesk-ci:/home/ci" \
      -e HOME=/home/ci \
      -p "$WEB_PORT:5173" \
      "$image" bash -euo pipefail -c '
        [ -d node_modules/.package-lock.json ] || npm ci
        npm run dev --workspace=apps/web -- --host 0.0.0.0 --port 5173 --strictPort
      '
    ;;

  app)
    ensure_worktree
    log "Pila de desarrollo completa desde $BRANCH"
    warn "compose.dev.yml usa nombres de contenedor fijos (dev_api, dev_web…): sólo una propuesta a la vez."
    # --renew-anon-volumes: node_modules del contenedor web vive en un volumen
    # anónimo; sin esto, al cambiar de rama se reutilizaría el de la anterior y
    # faltarían las dependencias nuevas (tailwind, i18next, vitest…).
    ( cd "$WORKTREE" \
      && bash scripts/gen-secrets.sh \
      && docker compose -p "$PROJECT" -f compose.dev.yml up --build --renew-anon-volumes --detach )
    describe | sed "s/PORT/$WEB_PORT/g"
    cat <<MSG

  Aplicación .. http://localhost:$WEB_PORT/
  Demo ........ http://localhost:$WEB_PORT/demo.html
  API ......... http://localhost:5000/api/health
  Correos ..... http://localhost:8025   (Mailpit: verificación, contraseñas)

  Registro: la aplicación crea la cuenta contra la API real; el correo de
  verificación aparece en Mailpit.

  Parar: scripts/dev/propuesta.sh $PROPOSAL down
MSG
    ;;

  down)
    if [ -d "$WORKTREE" ]; then
      ( cd "$WORKTREE" && docker compose -p "$PROJECT" -f compose.dev.yml down 2> /dev/null ) || true
    fi
    docker rm -f "$PROJECT-web" > /dev/null 2>&1 || true
    echo "Parado lo de $PROPOSAL."
    ;;

  *)
    fail "Orden desconocida: $ACTION (ci | demo | app | down | info)"
    ;;
esac
