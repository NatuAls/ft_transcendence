#!/usr/bin/env bash
# =============================================================================
#  Guardián del informe de pruebas (formato TAP de `node --test`).
#
#  Existe por un motivo muy concreto: las suites de test/integration se saltan
#  solas cuando la API no responde (apiIsUp() -> t.skip). En local eso es
#  cómodo; en CI sería un verde falso, porque `node --test` termina con código 0
#  tanto si ejecuta 200 pruebas como si las salta todas o no encuentra ninguna.
#
#  Este script convierte en fallo de CI:
#    · un informe vacío o ilegible,
#    · 0 pruebas ejecutadas,
#    · cualquier prueba fallida,
#    · cualquier prueba SALTADA o marcada como TODO.
#
#  Uso:  scripts/ci/check-test-report.sh <fichero.tap> "<etiqueta>"
# =============================================================================
set -euo pipefail

LOG="${1:?uso: check-test-report.sh <fichero.tap> [etiqueta]}"
LABEL="${2:-suite}"

if [ ! -s "$LOG" ]; then
  echo "::error::[$LABEL] no se generó ningún informe TAP en $LOG"
  exit 1
fi

# El resumen de node --test en TAP son líneas del tipo:  "# pass 42"
# Se toma la ÚLTIMA aparición de cada clave (el resumen final del proceso).
summary_value() {
  awk -v key="$1" '$1 == "#" && $2 == key { value = $3 } END { print value }' "$LOG"
}

tests=$(summary_value tests)
passed=$(summary_value pass)
failed=$(summary_value fail)
skipped=$(summary_value skipped)
todo=$(summary_value todo)

if [ -z "$tests" ]; then
  echo "::error::[$LABEL] $LOG no contiene un resumen TAP; ¿se ejecutó node --test con --test-reporter=tap?"
  echo "----- últimas líneas del informe -----"
  tail -n 30 "$LOG"
  exit 1
fi

echo "[$LABEL] ejecutadas=$tests  ok=$passed  fallidas=${failed:-0}  saltadas=${skipped:-0}  todo=${todo:-0}"

status=0

if [ "$tests" -eq 0 ]; then
  echo "::error::[$LABEL] no se ejecutó ninguna prueba. Revisa el patrón de ficheros."
  status=1
fi

if [ "${failed:-0}" -ne 0 ]; then
  echo "::error::[$LABEL] ${failed} prueba(s) han fallado."
  echo "----- pruebas fallidas -----"
  grep -E '^not ok ' "$LOG" || true
  status=1
fi

# El punto clave del ejercicio: una prueba saltada NO es una prueba pasada.
if [ "${skipped:-0}" -ne 0 ]; then
  echo "::error::[$LABEL] ${skipped} prueba(s) se han SALTADO. En CI se exige la suite completa."
  echo "----- pruebas saltadas -----"
  grep -E '# SKIP' "$LOG" || true
  status=1
fi

if [ "${todo:-0}" -ne 0 ]; then
  echo "::error::[$LABEL] ${todo} prueba(s) marcadas como TODO."
  grep -E '# TODO' "$LOG" || true
  status=1
fi

if [ "$status" -eq 0 ]; then
  echo "[$LABEL] informe correcto: $tests pruebas, todas ejecutadas y en verde."
fi

exit "$status"
