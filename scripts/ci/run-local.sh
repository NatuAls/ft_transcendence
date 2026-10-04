#!/usr/bin/env bash
# =============================================================================
#  CI en local — HelpDesk Lite
#
#  Ejecuta la misma batería que .github/workflows/ci.yml sin gastar minutos de
#  GitHub Actions. Los pasos de Node corren DENTRO de un contenedor construido
#  con la versión exacta de .nvmrc y el npm de devEngines, así que el resultado
#  no depende de lo que haya instalado en la máquina (en el servidor de Oracle
#  hay Node 22 del sistema, que no vale para este proyecto).
#
#      scripts/ci/run-local.sh                  # todos los jobs
#      scripts/ci/run-local.sh quality unit     # sólo esos
#      make ci            /  make ci JOBS="quality unit"
#
#  Jobs (mismos nombres que en ci.yml):
#      quality      formato · lint · tipos · build de los 4 workspaces
#      unit         tests unitarios + guardián del informe TAP
#      integration  Postgres y Redis reales, API compilada, tests + guardián
#      compose      validación de los tres ficheros compose + imágenes fijadas
#      images       build de las imágenes de producción + comprobaciones + Trivy
#      security     gitleaks · npm audit (críticas) · Trivy del árbol
#
#  Variables opcionales:
#      CI_CACHE_DIR    caché de npm entre ejecuciones (def. ~/.cache/helpdesk-ci)
#      CI_WORKDIR      copia de trabajo cuando el repositorio vive en un sistema
#                      de ficheros sin enlaces simbólicos (exfat, ntfs, algunos
#                      montajes de red): npm los necesita para los workspaces.
#                      Se detecta solo; por defecto <CI_CACHE_DIR>/src.
#      SKIP_TRIVY=1    omite los dos escaneos de Trivy (descarga ~150 MB)
#      SKIP_GITLEAKS=1 omite el escaneo de secretos
#      REBUILD_CI_IMAGE=1  reconstruye la imagen de Node del CI
#
#  Diferencias conocidas con GitHub Actions, todas documentadas en
#  la guía DevOps del equipo, apartado «CI y despliegues en local»: aquí `npm ci` se hace UNA vez para todos los jobs (en
#  Actions cada job parte de cero), no se suben artefactos (los informes TAP
#  quedan en test-results/) y no se genera el SBOM.
# =============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

NODE_VERSION="$(tr -d '[:space:]' < .nvmrc)"
NPM_VERSION="$(node -e 'process.stdout.write(require("./package.json").devEngines.packageManager.version)' 2>/dev/null || echo 11.17.0)"
CI_IMAGE="helpdesk-ci:node${NODE_VERSION}-npm${NPM_VERSION}"
CI_CACHE_DIR="${CI_CACHE_DIR:-$HOME/.cache/helpdesk-ci}"
CI_NET="helpdesk-ci-net"
DB_CONTAINER="helpdesk-ci-db"
REDIS_CONTAINER="helpdesk-ci-redis"
TRIVY_IMAGE="aquasec/trivy:0.74.0"
GITLEAKS_IMAGE="zricethezav/gitleaks:v8.30.1"

# Credenciales efímeras: sólo viven dentro de los contenedores de prueba de
# esta ejecución, igual que en el workflow.
CI_DB_USER=helpdesk_ci
CI_DB_PASSWORD=helpdesk_ci_password
CI_DB_NAME=helpdesk_ci
CI_JWT_ACCESS_SECRET=ci_access_secret_not_a_real_secret_0123456789
CI_JWT_REFRESH_SECRET=ci_refresh_secret_not_a_real_secret_0123456789
CI_PASSWORD_PEPPER=ci_pepper_not_a_real_secret_0123456789

ALL_JOBS=(quality unit integration compose images security)
JOBS=("$@")
[ ${#JOBS[@]} -gt 0 ] || JOBS=("${ALL_JOBS[@]}")

log()  { printf '\n\033[0;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[0;33m[aviso] %s\033[0m\n' "$*"; }
fail() { printf '\033[0;31m%s\033[0m\n' "$*" >&2; }

for job in "${JOBS[@]}"; do
  case " ${ALL_JOBS[*]} " in
    *" $job "*) ;;
    *) fail "Job desconocido: $job. Válidos: ${ALL_JOBS[*]}"; exit 2 ;;
  esac
done

command -v docker > /dev/null || { fail "Hace falta Docker."; exit 1; }
docker info > /dev/null 2>&1 || { fail "El demonio de Docker no responde (¿estás en el grupo docker?)."; exit 1; }

# -----------------------------------------------------------------------------
# Directorio de trabajo de los pasos de Node.
#
# `npm ci` enlaza los workspaces (node_modules/web -> ../apps/web). En exfat,
# ntfs o algunos montajes de red no se pueden crear enlaces simbólicos y la
# instalación muere con EPERM. Cuando ocurre, se trabaja sobre un espejo del
# repositorio en un sistema de ficheros que sí los admite (la caché, en el
# home) y los informes se copian de vuelta al final.
# -----------------------------------------------------------------------------
WORK="$ROOT"
MIRRORED=0

symlinks_supported() { # symlinks_supported <dir>
  local probe="$1/.ci-symlink-probe"
  rm -f "$probe" 2> /dev/null || true
  if ln -s . "$probe" 2> /dev/null; then rm -f "$probe"; return 0; fi
  return 1
}

sync_mirror() {
  WORK="${CI_WORKDIR:-$CI_CACHE_DIR/src}"
  warn "$ROOT no admite enlaces simbólicos ($(df -T "$ROOT" 2> /dev/null | awk 'NR==2{print $2}')): npm ci no puede instalar los workspaces ahí."
  log "Espejando el repositorio en $WORK"
  mkdir -p "$WORK"
  symlinks_supported "$WORK" || { fail "$WORK tampoco admite enlaces simbólicos. Elige otra ruta con CI_WORKDIR."; exit 1; }
  if command -v rsync > /dev/null; then
    rsync -a --delete \
      --exclude '.git/' --exclude 'node_modules/' --exclude 'dist/' \
      --exclude '.ci-symlink-probe' \
      "$ROOT/" "$WORK/"
  else
    # tar preserva permisos y no necesita rsync instalado.
    ( cd "$ROOT" && tar --exclude=./.git --exclude='*/node_modules' --exclude=./node_modules \
        --exclude='*/dist' -cf - . ) | tar -C "$WORK" -xf -
  fi
  MIRRORED=1
  echo "Espejo listo. Los pasos de Node corren ahí; Docker, gitleaks y los informes siguen apuntando al repositorio real."
}

collect_reports() {
  [ "$MIRRORED" -eq 1 ] || return 0
  if [ -d "$WORK/test-results" ]; then
    mkdir -p "$ROOT/test-results"
    cp -f "$WORK"/test-results/*.tap "$ROOT/test-results/" 2> /dev/null || true
  fi
}

needs_node=0
for job in "${JOBS[@]}"; do
  case "$job" in quality|unit|integration|security) needs_node=1 ;; esac
done
if [ "$needs_node" -eq 1 ] && ! symlinks_supported "$ROOT"; then
  sync_mirror
fi

# -----------------------------------------------------------------------------
# Imagen de Node del CI: Node de .nvmrc + npm de devEngines, ya instalados.
# Se construye una vez y se reutiliza; así ningún job depende de la red para
# hacer `npm install -g npm@...` como sí hace el runner de GitHub.
# -----------------------------------------------------------------------------
build_ci_image() {
  if [ "${REBUILD_CI_IMAGE:-0}" != "1" ] && docker image inspect "$CI_IMAGE" > /dev/null 2>&1; then
    return
  fi
  log "Construyendo la imagen del CI ($CI_IMAGE)"
  docker build -t "$CI_IMAGE" - <<DOCKERFILE
FROM node:${NODE_VERSION}-bookworm-slim
# openssl: los motores de Prisma lo necesitan. curl: el guardián de arranque.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN npm install -g npm@${NPM_VERSION}
# El contenedor corre con el UID de quien lanza el script para que node_modules
# y los informes queden con su dueño, no con root.
RUN mkdir -p /home/ci && chmod 0777 /home/ci
ENV HOME=/home/ci NPM_CONFIG_UPDATE_NOTIFIER=false CI=true
WORKDIR /work
DOCKERFILE
}

# node_run <nombre> [--net] <<'SCRIPT' ... SCRIPT
node_run() {
  local name="$1"; shift
  printf '\033[0;90m   · paso %s (en %s)\033[0m\n' "$name" "$CI_IMAGE"
  local net_args=()
  if [ "${1:-}" = "--net" ]; then net_args=(--network "$CI_NET"); shift; fi
  mkdir -p "$CI_CACHE_DIR"
  docker run --rm -i \
    --user "$(id -u):$(id -g)" \
    -v "$WORK:/work" -w /work \
    -v "$CI_CACHE_DIR:/home/ci" \
    -e HOME=/home/ci \
    "${net_args[@]}" \
    ${NODE_ENV_ARGS[@]+"${NODE_ENV_ARGS[@]}"} \
    "$CI_IMAGE" bash -euo pipefail -s
}

# -----------------------------------------------------------------------------
# Dependencias: una sola vez por ejecución (en Actions es una por job).
# -----------------------------------------------------------------------------
PREPARED=0
prepare_deps() {
  [ "$PREPARED" -eq 0 ] || return 0
  log "Instalando dependencias (npm ci) y generando el cliente de Prisma"
  NODE_ENV_ARGS=(-e DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=public")
  local rc=0
  node_run deps <<'SCRIPT' || rc=$?
npm ci
cd apps/api && npx prisma generate
SCRIPT
  unset NODE_ENV_ARGS
  [ "$rc" -eq 0 ] || return "$rc"
  PREPARED=1
}

# -----------------------------------------------------------------------------
# Servicios efímeros para el job de integración. Sin puertos publicados: viven
# en su propia red, así que no pueden chocar con la pila de staging/producción
# que corre en el mismo servidor.
# -----------------------------------------------------------------------------
services_down() {
  docker rm -f "$DB_CONTAINER" "$REDIS_CONTAINER" > /dev/null 2>&1 || true
  docker network rm "$CI_NET" > /dev/null 2>&1 || true
}

services_up() {
  services_down
  log "Levantando Postgres y Redis efímeros"
  docker network create "$CI_NET" > /dev/null || return 1
  docker run -d --name "$DB_CONTAINER" --network "$CI_NET" \
    -e POSTGRES_USER="$CI_DB_USER" -e POSTGRES_PASSWORD="$CI_DB_PASSWORD" -e POSTGRES_DB="$CI_DB_NAME" \
    --health-cmd "pg_isready -U $CI_DB_USER -d $CI_DB_NAME" --health-interval 5s --health-retries 20 \
    postgres:15-alpine > /dev/null || return 1
  docker run -d --name "$REDIS_CONTAINER" --network "$CI_NET" \
    --health-cmd "redis-cli ping" --health-interval 5s --health-retries 20 \
    redis:7-alpine > /dev/null || return 1

  local waited=0
  while [ "$waited" -lt 90 ]; do
    if [ "$(docker inspect -f '{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null)" = healthy ] &&
       [ "$(docker inspect -f '{{.State.Health.Status}}' "$REDIS_CONTAINER" 2>/dev/null)" = healthy ]; then
      echo "Servicios listos (${waited}s)."
      return 0
    fi
    sleep 3; waited=$((waited + 3))
  done
  fail "Postgres/Redis no llegaron a estar sanos en 90s"
  return 1
}

# -----------------------------------------------------------------------------
# Jobs
# -----------------------------------------------------------------------------
job_quality() {
  prepare_deps || return 1
  node_run quality <<'SCRIPT'
npm run format:check
npm run lint
npm run typecheck
npm run build
SCRIPT
}

job_unit() {
  prepare_deps || return 1
  node_run unit <<'SCRIPT' || return 1
mkdir -p test-results
npm run test:ci --workspace=apps/api | tee test-results/unit.tap
SCRIPT
  bash "$WORK/scripts/ci/check-test-report.sh" "$WORK/test-results/unit.tap" "tests unitarios" || return 1

  # Tests de la web: sólo en las ramas que los tienen (apps/web declara el
  # script `test`). Con `test:ci` se hace lo mismo que el job de CI: informe
  # TAP y el mismo guardián que el de la API.
  if grep -q '"test:ci":' "$WORK/apps/web/package.json" 2> /dev/null; then
    log "Tests de la web (vitest)"
    node_run unit-web <<'SCRIPT' || return 1
mkdir -p test-results
npm run test:ci --workspace=apps/web | tee test-results/web.tap
SCRIPT
    bash "$WORK/scripts/ci/check-test-report.sh" "$WORK/test-results/web.tap" "tests de la web" || return 1
  elif grep -q '"test":' "$WORK/apps/web/package.json" 2> /dev/null; then
    log "Tests de componentes del frontend (vitest)"
    node_run unit-web <<'SCRIPT' || return 1
npm run test --workspace=apps/web
SCRIPT
  else
    echo "Esta rama no tiene tests de frontend (apps/web sin script \`test\`): se omiten."
  fi
}

job_integration() {
  prepare_deps || return 1
  services_up || return 1
  NODE_ENV_ARGS=(
    -e NODE_ENV=test
    -e PORT=5000
    -e DATABASE_URL="postgresql://${CI_DB_USER}:${CI_DB_PASSWORD}@${DB_CONTAINER}:5432/${CI_DB_NAME}?schema=public"
    -e REDIS_URL="redis://${REDIS_CONTAINER}:6379"
    -e JWT_ACCESS_SECRET="$CI_JWT_ACCESS_SECRET"
    -e JWT_REFRESH_SECRET="$CI_JWT_REFRESH_SECRET"
    -e PASSWORD_PEPPER="$CI_PASSWORD_PEPPER"
    -e UPLOAD_DIR=/tmp/helpdesk-uploads
    -e SEED_ON_BOOT=false
    -e LOG_LEVEL=warn
    -e CORS_ORIGINS=http://localhost:5173
    -e API_BASE_URL=http://localhost:5000
    # La suite hace muchas más peticiones que el límite por defecto; API y
    # pruebas tienen que ver EL MISMO valor (igual que en ci.yml).
    -e RATE_LIMIT_AUTH_PER_MIN=100000
    -e RATE_LIMIT_GLOBAL_PER_MIN=200000
    -e API_KEY_RATE_PER_MIN=100000
    -e API_KEY_RATE_PER_HOUR=1000000
  )
  local status=0
  node_run integration --net <<'SCRIPT' || status=$?
mkdir -p /tmp/helpdesk-uploads test-results

# Exactamente el mismo comando que ejecuta el contenedor de producción.
( cd apps/api && npx prisma migrate deploy )
npm run build --workspace=apps/api

# Se arranca dist/index.js (lo que se publica en la imagen), no src con --watch.
( cd apps/api && node dist/index.js > /tmp/api.log 2>&1 & echo $! > /tmp/api.pid )
trap 'kill "$(cat /tmp/api.pid)" 2>/dev/null || true' EXIT

bash scripts/ci/wait-for-http.sh http://localhost:5000/api/health 90 || { tail -n 120 /tmp/api.log; exit 1; }

# /api/health/ready responde 200 aunque una dependencia esté caída: el estado
# real va en el cuerpo, y eso es lo que se comprueba.
body=$(curl -fsS http://localhost:5000/api/health/ready)
echo "$body"
node -e '
  const r = JSON.parse(process.argv[1]);
  const db = (r.services ?? []).find((s) => s.name === "database");
  if (r.status !== "ok" || !db || db.status !== "up") {
    console.error("La API no está lista: " + JSON.stringify(r));
    process.exit(1);
  }
' "$body"

set -o pipefail
npm run test:integration:ci --workspace=apps/api | tee test-results/integration.tap || {
  echo "----- últimas líneas del log de la API -----"; tail -n 120 /tmp/api.log; exit 1;
}
SCRIPT
  unset NODE_ENV_ARGS
  services_down
  [ "$status" -eq 0 ] || return "$status"
  bash "$WORK/scripts/ci/check-test-report.sh" "$WORK/test-results/integration.tap" "tests de integración"
}

job_compose() {
  # Se valida en un directorio temporal con un .env de mentira: el .env real
  # del desarrollador no se toca ni se lee.
  local tmp; tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" RETURN
  cp compose.dev.yml compose.prod.yml compose.observability.yml "$tmp/"
  cat > "$tmp/.env" <<'EOF'
ENV_NAME=ci
GITHUB_ACTOR=ci
GITHUB_SHA=0000000000000000000000000000000000000000
GHCR_OWNER=ci
DB_USER=ci
DB_PASSWORD=ci
DB_NAME=ci
JWT_ACCESS_SECRET=ci_access_secret_not_a_real_secret_0123456789
JWT_REFRESH_SECRET=ci_refresh_secret_not_a_real_secret_0123456789
PASSWORD_PEPPER=ci_pepper_not_a_real_secret_0123456789
CORS_ORIGINS=https://example.invalid
APP_VERSION=0.0.0-ci
SMTP_HOST=smtp.example.invalid
SMTP_PORT=25
MAIL_FROM=HelpDesk Lite <no-reply@example.invalid>
BACKUP_ENCRYPTION_KEY=ci_backup_key_0123456789
METRICS_TOKEN=ci_metrics_token_0123456789
RCLONE_REMOTE=objectstorage:helpdesk-backups/ci
EOF
  cat > "$tmp/.env.observability-ci" <<'EOF'
GRAFANA_ADMIN_PASSWORD=ci_not_a_real_password
ALERT_EMAIL_TO=ci@example.invalid
ALERT_SMTP_HOST=smtp.example.invalid:587
ALERT_SMTP_USER=ci
ALERT_SMTP_PASS=ci
PROD_DB_USER=ci
PROD_DB_PASSWORD=ci
PROD_DB_NAME=ci
STAGING_DB_USER=ci
STAGING_DB_PASSWORD=ci
STAGING_DB_NAME=ci
EOF
  docker compose -f "$tmp/compose.dev.yml" config --quiet
  docker compose -f "$tmp/compose.prod.yml" config --quiet
  docker compose --env-file "$tmp/.env.observability-ci" -f "$tmp/compose.observability.yml" config --quiet
  test -f config/alertmanager/alertmanager.yml.tmpl
  grep -q '^route:' config/alertmanager/alertmanager.yml.tmpl
  bash scripts/ci/check-pinned-images.sh compose.dev.yml compose.prod.yml compose.observability.yml
  echo "Los tres ficheros compose son válidos y no usan :latest."
}

job_images() {
  local sha; sha="$(git rev-parse HEAD)"
  log "Imagen de la API (arquitectura nativa: $(uname -m))"
  docker build -f apps/api/Dockerfile.prod --build-arg GIT_COMMIT="$sha" -t helpdesk-api:ci . || return 1
  log "Imagen de la web"
  docker build -f apps/web/Dockerfile.prod -t helpdesk-web:ci . || return 1

  log "Comprobaciones sobre las imágenes construidas"
  local user; user="$(docker run --rm --entrypoint sh helpdesk-api:ci -c 'id -un')"
  echo "usuario del contenedor: $user"
  [ "$user" = node ] || { fail "La imagen de la API corre como $user"; return 1; }

  docker run --rm --entrypoint sh helpdesk-api:ci -c 'test -x /app/node_modules/.bin/prisma' \
    || { fail "falta /app/node_modules/.bin/prisma; el CMD de producción no podría migrar"; return 1; }

  if docker run --rm --entrypoint sh helpdesk-api:ci -c 'command -v npm'; then
    fail "npm sigue en la imagen final; volvería la CVE de su copia de tar"; return 1
  fi
  echo "npm no está en la imagen final."

  docker run --rm --entrypoint sh helpdesk-api:ci -c '/app/node_modules/.bin/prisma --help > /dev/null' \
    || { fail "la CLI de Prisma no arranca en la imagen"; return 1; }
  echo "prisma se ejecuta correctamente sin npm."

  docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}' helpdesk-api:ci || true
  docker images --format '{{.Repository}}:{{.Tag}}  {{.Size}}' helpdesk-web:ci || true

  if [ "${SKIP_TRIVY:-0}" = "1" ]; then
    warn "Trivy omitido (SKIP_TRIVY=1)"
    return 0
  fi
  log "Trivy sobre la imagen de la API (CRÍTICAS bloquean)"
  local tmp; tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" RETURN
  # Se exporta la imagen a un fichero en vez de dar a Trivy el socket de
  # Docker: el escáner no necesita hablar con el demonio.
  docker save helpdesk-api:ci -o "$tmp/api.tar" || return 1
  docker run --rm -v "$tmp:/scan" -v "$CI_CACHE_DIR/trivy:/root/.cache" "$TRIVY_IMAGE" \
    image --input /scan/api.tar --severity CRITICAL --ignore-unfixed --exit-code 1 --format table
}

job_security() {
  if [ "${SKIP_GITLEAKS:-0}" = "1" ]; then
    warn "gitleaks omitido (SKIP_GITLEAKS=1)"
  else
    # Mismo ALCANCE que en GitHub: sobre una pull request, gitleaks-action
    # escanea los commits DE LA PR, no todo el historial. Aquí se hacen las dos
    # mitades equivalentes: los ficheros tal como están ahora, y los commits
    # que esta rama añade sobre su base. Escanear el historial entero marcaría
    # fugas antiguas ya asumidas (ver .gitleaksignore) y el CI local nunca
    # estaría verde.
    # Los ficheros TAL COMO ESTÁN COMMITEADOS en HEAD (git archive), no el
    # directorio de trabajo: ahí hay .env, doc/ y demás ficheros ignorados que
    # contienen secretos a propósito y que nunca llegan al repositorio.
    log "Escaneo de secretos: árbol commiteado en HEAD"
    local snapshot; snapshot="$(mktemp -d)"
    # shellcheck disable=SC2064
    trap "rm -rf '$snapshot'" RETURN
    git archive HEAD | tar -C "$snapshot" -x
    docker run --rm -v "$snapshot:/repo" "$GITLEAKS_IMAGE" \
      dir /repo --redact --no-banner --exit-code 1 || return 1

    local base="${GITLEAKS_BASE:-}"
    if [ -z "$base" ]; then
      for candidate in origin/develop origin/main develop main; do
        if git rev-parse --verify --quiet "$candidate" > /dev/null; then base="$candidate"; break; fi
      done
    fi
    if [ -n "$base" ] && [ -n "$(git rev-list "$base..HEAD" 2> /dev/null)" ]; then
      log "Escaneo de secretos: commits de esta rama sobre $base"
      docker run --rm -v "$ROOT:/repo" "$GITLEAKS_IMAGE" \
        detect --source=/repo --redact --no-banner --exit-code 1 \
        --log-opts="$base..HEAD" || return 1
    else
      echo "Sin commits propios sobre ${base:-la base}: nada que escanear en el historial."
    fi
  fi

  prepare_deps || return 1
  log "Dependencias vulnerables"
  node_run audit <<'SCRIPT' || return 1
npm audit --audit-level=critical
npm audit --audit-level=low || echo "(informativo: hay avisos por debajo de críticas)"
SCRIPT

  if [ "${SKIP_TRIVY:-0}" = "1" ]; then
    warn "Trivy omitido (SKIP_TRIVY=1)"
    return 0
  fi
  log "Trivy sobre el árbol de ficheros (CRÍTICAS bloquean)"
  docker run --rm -v "$ROOT:/scan" -v "$CI_CACHE_DIR/trivy:/root/.cache" "$TRIVY_IMAGE" \
    fs /scan --severity CRITICAL --ignore-unfixed --exit-code 1 --format table \
    --skip-dirs /scan/node_modules/.cache
}

# -----------------------------------------------------------------------------
# Ejecución
# -----------------------------------------------------------------------------
cleanup() { services_down; collect_reports; }
trap cleanup EXIT
build_ci_image

declare -A RESULT
started="$(date +%s)"
overall=0

for job in "${JOBS[@]}"; do
  log "JOB: $job"
  job_started="$(date +%s)"
  if "job_$job"; then
    RESULT[$job]="OK ($(( $(date +%s) - job_started ))s)"
  else
    RESULT[$job]="FALLO ($(( $(date +%s) - job_started ))s)"
    overall=1
  fi
done

# Resumen equivalente al job `ci-success` del workflow.
printf '\n\033[0;36m==> Resumen del CI local (%ss)\033[0m\n' "$(( $(date +%s) - started ))"
for job in "${JOBS[@]}"; do
  printf '  %-12s %s\n' "$job" "${RESULT[$job]}"
done

if [ "$overall" -ne 0 ]; then
  fail $'\nCI local EN ROJO.'
  exit 1
fi
printf '\n\033[0;32mCI local en verde.\033[0m\n'
