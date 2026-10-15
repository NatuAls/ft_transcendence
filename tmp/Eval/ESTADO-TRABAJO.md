# Estado del trabajo — defensa del 16/10 (16/10, de madrugada)

## Dónde estamos

| Bloque | Estado |
|---|---|
| Guía | `PROTOCOLO-DEFENSA.md`, revisada entera el 15/10 por la tarde contra la hoja de evaluación, el enunciado, el README de `develop` (con #95) y el código de la PR #97. 14 módulos, 23 puntos. Desde el 16/10, en el repositorio: `tmp/Eval/`, por `backend` y #101 (R5) |
| Producción | `main` = `cb3bba5`, desplegado el 15/10 a las 16:42 (*Deploy Production* en verde). Incluye #93: la regla del 404, la sesión que sobrevive a una caída de la API y a dos pestañas, la licencia |
| Fusionadas el 15/10 por la noche | **#97** (sesión y consola, carreras, HTTPS en local), **#98** y **#99** (`apps/api/.env_api` fuera, en `develop` y en `main`), **#100** (arreglos de interfaz de Israel y Nahuel) |
| Pendiente de aprobar | **#101**: los dos errores de consola de staging y producción (el 401 de un token a punto de caducar y el 403 de las estadísticas tras un cambio de rol) y la importación automática de la autoridad local sin `certutil`; y, desde el 16/10, esta carpeta (`tmp/Eval/`) |
| README | B2 resuelto (#95). Pendientes: B1, B3, B4, B5, R1, R2, R8 y R11 |
| Servidor | B7 (ensayo de restauración: último verde el 12/10), B8 (exportadores), B9 (Cloudflare en *Full (strict)*). Los hace el equipo |
| Por decidir | B12 (el puerto 5000 y las siembras por HTTP en local) y R10 (los filtros con varios valores en Swagger) |

## Pendiente, en orden (esta noche)

1. **Aprobar y fusionar #101**, por **otra** persona, con «Create a merge commit», y
   llevar `develop` a `main` con su PR y su despliegue (B6): el 401 de producción
   sigue hasta entonces. En Cloudflare: desactivar el monitor de scripts y
   conexiones, y alargar el *Challenge Passage* de staging (o una excepción para
   las IP del equipo): los 403 de staging son de su desafío, no de la aplicación
   (4.3).
2. **README**, en una sola PR: *Project Manager* y *Tech Lead* (B1, propuesta en 0.1),
   la fila de israetor, «How AI was used» de nalesso, elerazo- e israetor (B3), las
   contribuciones de verdad (B4), «Instructions» (B5, texto en 0.4), las cifras
   135 / 229 / 130 (R1), el comentario HTML (R2), la frase de los runbooks (R8) y una
   justificación por módulo (R11, texto en 0.2).
3. **Decidir B12** (opción a ya aplicada en la guía; la b es código) y, si da tiempo,
   **R10** (una línea por parámetro en el documento OpenAPI).
4. **Servidor:** ensayo de restauración en prod y después en staging (B7, 7.4);
   `check-server.sh` y *Targets* todo en `UP` (B8); Cloudflare en *Full (strict)*
   (B9).
5. **Desplegar** `main` con todo (B6) y subir esa versión al repositorio de la intra.
6. **Ensayo general** (0.3) en el portátil de la defensa: clon limpio y `make`,
   **importar la autoridad local** en el navegador, siembras, consola limpia, los 14
   módulos, las demostraciones de la carrera (9.3) y del 404 (M8), `make ci`.
7. **Antes de entrar:** si el clon de la defensa no tiene `tmp/Eval/` (#101 aún no en
   `main`), los dos scripts sacados de `develop` (1.5), sesiones
   abiertas en producción en perfiles separados (R7), túnel SSH abierto (2.4, 2.5),
   `CURL_CA_BUNDLE` exportado en la terminal de la demostración (1.4).

## Hecho el 15/10

- **#93**, fusionada y desplegada: lo que no se puede leer no existe (el mismo 404 que
  un identificador inventado, para tickets, comentarios y adjuntos); la sesión
  sobrevive a una caída de la API y a dos pestañas; idioma y tema entre pestañas;
  `LICENSE`.
- **#97** (abierta): los dos 401 de la consola al recargar y el cierre de sesión por
  una renovación cortada a medias; los cambios simultáneos sobre un ticket (sólo uno se
  aplica, `409 TICKET_CHANGED`); HTTPS en local con una autoridad local por máquina
  (`make cert`). CI local y de GitHub en verde: 135 unitarias, 229 de la web y 130 de
  integración.
- **#98 y #99** (abiertas): `apps/api/.env_api` fuera, y `.env_*` en el `.gitignore`.
- **La guía**, revisada contra todo lo anterior:
  - estado de B1–B12 y R1–R11 al día, con B12 (lo que aún va por HTTP), R9 (las
    aprobaciones), R10 (los filtros en Swagger) y R11 (justificar los módulos) nuevos;
  - módulo nuevo **M14** (búsqueda avanzada) y cuenta de 23 puntos, margen de 4;
  - HTTPS local de punta a punta: 1.4, 1.9 (la autoridad, `make cert` y qué pasa al
    sobrescribir), 5.7 y el plan B;
  - la consola (4.3), la sesión (5.5, M7), la regla del 404 (M8, M9) y la carrera
    (9.3), con demostraciones que se pueden copiar y pegar;
  - todos los `curl` locales por `https://localhost:5173`, y un mismo `curl` que vale
    para el local y para producción (`CURL_CA_BUNDLE`).
- **Probado por HTTPS contra la pila local**, tal como queda escrito: la siembra base
  por el proxy de Vite, `seed-defensa.sh`, las pruebas de validación (5.6), la API
  pública (M5), los permisos y el 404 (M8, en bash y en zsh), la búsqueda (M14), la
  carrera (9.3, en bash y en zsh), el fichero `concurrency` dentro del contenedor, y que
  un clon nuevo en la misma máquina sale con certificado de confianza.
- **`obs-local.sh`** (nuevo): Prometheus y Grafana en local contra la pila de
  desarrollo, como plan B de M11 (`make` no los levanta: están hechos para el
  servidor). Probado: cuatro objetivos en `UP`, 23 reglas y el panel con datos.
- **`seed-defensa.sh`** va ahora por HTTPS (`https://localhost:5173/api/v1` con la
  autoridad local), y avisa si tiene que caer a HTTP.

## Encontrado al revisar (y dónde está en la guía)

- El README reclama ahora 14 módulos y 23 puntos (6.0, M14).
- *Project Manager* y *Tech Lead* siguen con el marcador `login` (B1).
- `make seed-dev`, `make reset-dev` y el puerto 5000 publicado siguen hablando HTTP
  con la API (B12, 5.7).
- Los filtros con varios valores repetidos dan 400 (R10, M14).
- Falta la justificación por módulo que pide el enunciado (R11).
- #99 contradice el «`main` only receives `develop`» del README (B11).
- `doc/` sólo está ignorado en el clon de Felipe (`.git/info/exclude`), no en el
  `.gitignore` (R4).
- Las páginas legales ya están traducidas (4.4, 6.0).
- `make` (y `make all`) no levanta Prometheus ni Grafana, y `make dev-up` no existe
  (es `make up-dev`): la monitorización es del servidor. Plan B local en M11.
- En la base de desarrollo, demo-laura había dejado de ser miembro de Vilanova por las
  pruebas del día, y `seed-defensa.sh` fallaba con un 404: la siembra base la recoloca
  (1.5, 1.8).

## Fuera del alcance de esta guía

- Publicarla como página compartible no se ha hecho. Desde el 16/10 está en el
  repositorio del equipo, que es público (R5): revisada antes de subirla, no lleva
  secretos ni la IP del servidor (sólo marcadores), y lo demás que nombra (`deployer`,
  las rutas de `/opt/helpdesk`, los correos del `.mailmap`) ya estaba publicado en los
  workflows, el README y el historial.

## Historia

- 15/10 por la mañana: primera versión completa de la guía, en el orden de la hoja;
  revisión de nombres, puertos, rutas, códigos, logs, workflows y métricas contra
  `develop` `86f4246`; añadidos B10, B11, R8 y 9.4; `seed-defensa.sh`.
- 15/10 por la tarde: revisión entera contra el README nuevo (#95), #93 ya en
  producción y la PR #97.
- 15/10 por la noche: los errores de consola y la autoridad local (#101), el plan B
  local de M11 (`obs-local.sh`) y los 403 de staging, que son del desafío de Cloudflare.
- 16/10 de madrugada: la carpeta `tmp/Eval/` entra en `backend` y va en #101 (R5); los
  scripts se lanzan desde ella. Esta versión.
