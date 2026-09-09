#!/usr/bin/env bash
# =============================================================================
#  Espera a que una URL devuelva 2xx. Si se agota el plazo, FALLA (exit 1).
#
#  Es deliberadamente estricto: en CI, "la API no llegó a arrancar" tiene que
#  romper el pipeline, no dejar que las pruebas se salten en silencio.
#
#  Uso:  scripts/ci/wait-for-http.sh <url> [segundos]
# =============================================================================
set -euo pipefail

URL="${1:?uso: wait-for-http.sh <url> [segundos]}"
TIMEOUT="${2:-90}"
INTERVAL=2
elapsed=0

echo "Esperando a $URL (máximo ${TIMEOUT}s)…"

while [ "$elapsed" -lt "$TIMEOUT" ]; do
  if curl -fsS --max-time 5 "$URL" > /dev/null 2>&1; then
    echo "$URL responde tras ${elapsed}s."
    exit 0
  fi
  sleep "$INTERVAL"
  elapsed=$((elapsed + INTERVAL))
done

echo "::error::$URL no respondió en ${TIMEOUT}s."
exit 1
