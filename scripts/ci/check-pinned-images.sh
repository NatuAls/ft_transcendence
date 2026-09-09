#!/usr/bin/env bash
# =============================================================================
#  Prohíbe imágenes sin fijar (`:latest` o sin etiqueta) en los ficheros
#  Compose. Tarea DevOps 2: "Fijar versiones de las imágenes externas por
#  versión o digest. En especial, sustituir axllent/mailpit:latest".
#
#  Se ignoran las imágenes propias construidas por el pipeline
#  (ghcr.io/…/helpdesk-*), que van etiquetadas con el SHA del commit y usan
#  ${GITHUB_SHA:-latest} sólo como valor por defecto local.
#
#  Uso:  scripts/ci/check-pinned-images.sh compose.dev.yml compose.prod.yml
# =============================================================================
set -euo pipefail

status=0

for file in "$@"; do
  [ -f "$file" ] || { echo "::error::no existe $file"; status=1; continue; }

  while IFS= read -r line; do
    image=$(echo "$line" | sed -E 's/^[[:space:]]*image:[[:space:]]*//; s/^["'"'"']//; s/["'"'"']$//')

    # Imágenes propias: se etiquetan con ${GITHUB_SHA} en el despliegue.
    case "$image" in
      *helpdesk-api-*|*helpdesk-web-*) continue ;;
    esac

    if echo "$image" | grep -qE ':latest$'; then
      echo "::error file=$file::imagen sin fijar (:latest): $image"
      status=1
    elif ! echo "$image" | grep -qE '(:[^/]+$|@sha256:)'; then
      echo "::error file=$file::imagen sin etiqueta de versión: $image"
      status=1
    fi
  done < <(grep -E '^[[:space:]]*image:' "$file" || true)
done

if [ "$status" -eq 0 ]; then
  echo "Todas las imágenes externas están fijadas por versión o digest."
fi

exit "$status"
