# Protocolo de defensa — ft_transcendence · HelpDesk Lite

> Guía de la evaluación del 16/10/2026, punto por punto y en el **mismo orden que la
> hoja de evaluación** (`tmp/Eval/ft_transcendence.md`). Para cada punto dice qué
> se pide, quién lo presenta, qué hay que **enseñar**, con qué **comando o pantalla**
> se demuestra y cómo se **argumenta**.
>
> Fuentes: la hoja de evaluación, el enunciado (`tmp/ft_transcendence_enunciado.md`),
> el inventario de puntos (`tmp/INFORME-HelpDeskLite_mix-rev5.md`), el `README.md` de
> `develop` (ya con la versión de Aren, #95) y el código de `backend` en `13a5bf1`:
> `develop` (`1bbd481`) más la PR #97, pendiente de aprobación.
>
> **Dónde vive (16/10):** esta carpeta (`tmp/Eval/`: la guía, la hoja, el estado y los
> dos scripts) está en el repositorio desde la rama `backend` y llega a `develop` con
> la PR #101 (R5). El enunciado y el informe rev5 siguen sólo en la rama `docs` del
> repositorio personal de Felipe.
>
> **Revisión del 15/10 por la tarde** (sustituye a la de la mañana). Qué cambia:
>
> - **Resuelto en código, pendiente de aprobar y fusionar:** HTTPS en local (B10), la
>   condición de carrera de los cambios simultáneos (9.3), los 401 de la consola al
>   recargar y el cierre de sesión por una renovación perdida (4.3), todo en la
>   **PR #97**; y `apps/api/.env_api` (B11), en las **PR #98** (a `develop`) y **#99**
>   (a `main`).
> - **El README cambió** (#95): ahora reclama **14 módulos y 23 puntos** (nuevo:
>   *Advanced search*, menor → **M14**); ya tiene el login de Aren (`arhea`, B2) y el
>   *Product Owner*, pero *Project Manager* y *Tech Lead* siguen con el marcador
>   `login` (B1).
> - **Ya en `main` y desplegado** (*Deploy Production* en verde, 15/10 16:42): la
>   regla del 404 para tickets, comentarios y adjuntos (#93), la sesión que sobrevive
>   a una caída de la API y a dos pestañas, y la licencia.
> - **Nuevo bloqueante B12:** lo que todavía habla con la API por HTTP en local.
>
> **Comprobado el 15/10 por la tarde**, por HTTPS contra la pila local con los
> cambios de #97: las dos siembras (`seed-local.mjs` por el proxy de Vite y
> `seed-defensa.sh`), todas las demostraciones con `curl` de 2.6, 5.6, M5 y M8, la
> regla del 404 (mismo cuerpo para lo ajeno y lo inventado), la de la carrera (9.3:
> un 200 y siete 409, una sola transición en el historial) y que un clon nuevo en la
> misma máquina sale con certificado de confianza sin importar nada más. **135**
> pruebas unitarias de la API, **229** de la web (42 ficheros) y **130** de
> integración, en verde en el CI local y en GitHub.
>
> Comprobado por la mañana (sigue valiendo): clon limpio, `gen-secrets.sh`,
> migraciones, administrador de arranque, todas las consultas del anexo A, `backup.sh`,
> `restore.sh --drill` sobre una copia concreta y la inspección de una copia antigua;
> cada nombre, puerto, ruta, código de error, texto de log, workflow, *job*, campo del
> `MANIFEST` y métrica que cita la guía.
>
> Lo que **no** se ha podido probar desde aquí: el servidor de Oracle, Cloudflare y
> los workflows que tocan el servidor (lanzar el ensayo de restauración lo bloquea el
> clasificador del asistente: lo lanza el equipo, 7.4). Esos pasos están escritos a
> partir de los scripts y workflows del repositorio y van marcados con ☁ o 🐙.

**Leyenda:** 🖥 terminal local · ☁ servidor de Oracle (SSH) · 🌐 navegador ·
🐙 GitHub · ⚠️ riesgo · ✅ comprobado

---

## Índice

0. [Antes de la defensa (hoy)](#0-antes-de-la-defensa-hoy)
1. [Arranque desde cero en local](#1-arranque-desde-cero-en-local)
2. [Chuleta de accesos: logs, base de datos, servidor](#2-chuleta-de-accesos)
3. [Preliminares](#3-preliminares)
4. [Requisitos generales](#4-requisitos-generales)
5. [Requisitos técnicos](#5-requisitos-técnicos)
6. [Módulos (23 puntos reclamados)](#6-módulos)
7. [Copias de seguridad y restauración, a fondo](#7-copias-de-seguridad-y-restauración)
8. [Calidad del código, decisiones técnicas, trabajo en equipo](#8-calidad-del-código)
9. [Funcionalidad, estabilidad y multiusuario](#9-funcionalidad)
10. [Verificación final y bonus](#10-verificación-final-y-bonus)
11. [CI en local y pruebas sueltas](#11-ci-en-local-y-pruebas-sueltas)
12. [Plan B: si algo falla durante la defensa](#12-plan-b)
- [Anexo A — Consultas SQL](#anexo-a--consultas-sql)
- [Anexo B — Preguntas difíciles](#anexo-b--preguntas-difíciles)
- [Anexo C — Rutas de la aplicación](#anexo-c--rutas-de-la-aplicación)
- [Anexo D — Cloudflare, paso a paso](#anexo-d--cloudflare-paso-a-paso)

---

## 0. Antes de la defensa (hoy)

### 0.1 Bloqueantes: sin esto se puede caer la evaluación

Estado al 15/10 por la tarde: ✅ resuelto · ⏳ hecho, falta aprobar/fusionar · ❌ pendiente.

| # | Estado | Qué | Por qué | Cómo se comprueba |
|---|---|---|---|---|
| B1 | ⏳ PR del README (16/10) | **Roles PO, PM, Tech Lead y Developers en el README.** *16/10, decidido por el equipo (fichero de Nahuel y captura del grupo): PM = elerazo-; Tech Lead = fcela-ga, nalesso e israetor. Falta que Elizabeth cuente, en su fila y en su sección, lo que hizo como PM, y que lo sepa explicar.* Tras #95, «Required project roles» tiene *Product Owner* = arhea y *Developers* = los cinco, pero *Project Manager / Scrum Master* y *Technical Lead / Architect* siguen con el marcador `login`. La tabla de responsabilidades aún dice de israetor sólo «Reviews · infrastructure» | El enunciado (II.1.1) y la hoja (*README Verification* y *Individual Contributions*) piden expresamente **PO, PM, Tech Lead, Developers**. Es el primer punto que se mira | `grep -n "\| login \|" README.md` no debe devolver nada |
| B2 | ✅ #95 | Primera línea del README con los cinco logins (ya incluye `arhea`) | Formato obligatorio | `head -2 README.md` |
| B3 | ❌ | **«How AI was used»**: faltan elerazo- e israetor (arhea y nalesso ya están; la de fcela-ga, puesta al día el 16/10). Cada declaración la escribe su autor | Requisito de *Resources* | `grep -n "_to be written" README.md` no debe devolver nada |
| B4 | ❌ | *16/10: la de Nahuel, escrita por él e integrada; el borrador de Israel, completado con el historial (el tema, el i18n, el cambio de contraseña); falta que Elizabeth e Israel confirmen el suyo y añadan sus retos.* **«Individual Contributions»** sigue con los borradores de Nahuel, Elizabeth e Israel («*Draft from the history; … to confirm*») y la nota «Each person writes their own…» (ver 3.2) | La hoja pide «Individual contributions of each member» y lo contrasta con lo que dice cada uno y con Git | `grep -nE "Draft from the history\|Each person writes their own" README.md` vacío |
| B5 | ⏳ PR del README (16/10), con el texto de 0.4 | **«Instructions» falla si se sigue al pie de la letra**: dice `cp .env.example .env` (deja el `.env` sin administrador) y `npm run dev:api` / `npm run dev:web` en `http://localhost:5173`, que chocan con los contenedores y, con #97, ya ni siquiera es la dirección | Quien evalúa sigue el README desde un clon vacío | Sección 1; texto nuevo, ya con HTTPS, en 0.4 |
| B6 | ⏳ a medias | **Todo en `main`, desplegado y en el repositorio de la intra.** `main` = `cb3bba5` (#94) está desplegado (*Deploy Production* en verde, 15/10 16:42). Falta: aprobar y fusionar #97 y #98, la PR `develop` → `main` con la aprobación de **otra** persona sobre el último commit, el despliegue, y subir esa versión a vogsphere | Sólo se evalúa lo que hay en el repositorio entregado, y producción es donde se enseña el HTTPS público | 🖥 `git log -1 origin/main` = commit desplegado (`/api/version` con token o la etiqueta de la imagen, 2.6) |
| B7 | ❌ equipo | **Ensayo de restauración en verde hoy, en prod y en staging.** Último verde: 12/10 (el programado). Hay que lanzarlo a mano; al asistente se lo bloquea el clasificador | Es la mitad del módulo «Health check… backups and disaster recovery» | 🐙 Actions → *Ensayo de restauración* → *Run workflow*, primero `prod` y al acabar `staging` (7.4) |
| B8 | ❌ equipo | **Exportadores de Prometheus levantados** (rev5: «siguen borrados») | Sin ellos Grafana enseña paneles vacíos | ☁ `bash scripts/ops/check-server.sh` (2.5) y *Status → Targets* todo `UP` |
| B9 | ❌ equipo | **Cloudflare en SSL/TLS «Full (strict)»** y no «Flexible» (paso a paso en el Anexo D.3) | Con *Flexible*, el tramo Cloudflare → Oracle va en HTTP y «¿todo es HTTPS?» tiene mala respuesta | ☁ `sudo python3 scripts/ops/npm-tls.py --dry-run` y luego sin `--dry-run` (certificado en el origen); después, panel de Cloudflare → SSL/TLS → *Overview* → *Full (strict)*; si la web da **526**, volver a *Full* y revisar NPM (5.7) |
| B10 | ✅ `develop` (#97; la importación automática, #101) | **HTTPS en el entorno local:** hecho, probado y fusionado en `develop` (falta llevarlo a `main`, B6). Con él, `make` sirve **https://localhost:5173** con un certificado firmado por una autoridad local. **Importar esa autoridad una vez en el navegador del portátil de la defensa** (1.9) | El enunciado (III.3): «*Any connection to the backend, from a browser, from a script, from an external API, etc., must use HTTPS*»; la hoja mira la barra de direcciones justo después del despliegue local | 1.9 y 5.7: candado en Chrome y `openssl s_client` |
| B11 | ✅ #98 y #99 | **`apps/api/.env_api` fuera del repositorio** (cinco claves con valores de marcador, sin uso), y `.env_*` en el `.gitignore`: fusionado en `develop` (#98) y en `main` (#99) | La hoja: «*Any credentials … found in the repository (outside of .env) will result in immediate project failure*» | `git ls-files \| grep -iE '(^\|/)\.env'` sólo devuelve los dos `.example` |
| B12 | ❌ decidir hoy | **Lo que aún habla con la API por HTTP en local.** Con #97 el navegador va por HTTPS, pero `dev_api` sigue publicando el 5000 (`'5000:5000'`, en todas las interfaces), y `make seed-dev`, `make reset-dev` y los ejemplos antiguos lo usaban por `http://127.0.0.1:5000` | El mismo III.3 dice «*from a script*». Un `curl http://localhost:5000/…` o un script que lo use delante de quien evalúa contradice el punto, aunque el navegador vaya por HTTPS | Opción **a** (ya aplicada en esta guía, ✅ probada): delante de quien evalúa, todo por `https://localhost:5173` —siembras incluidas— o desde dentro de los contenedores, que el enunciado permite sin cifrar. Opción **b**, en código: dejar de publicar el 5000 (o sólo en `127.0.0.1`) y que `seed-dev`/`reset-dev` usen HTTPS. Es una PR pequeña, pero cambia el flujo de todo el equipo la víspera (5.7) |

**Lo que falta de la tabla de roles (B1).** Con #95 el README ya tiene *Product
Owner* = arhea y *Developers* = los cinco; quedan dos marcadores `login`. La elección
es del equipo, pero cada persona tiene que poder justificar la suya. Definiciones del
enunciado:

- **PO**: visión del producto, backlog, prioridades, valida lo terminado, habla con evaluadores y compañeros.
- **PM / Scrum Master**: reuniones y planificación, seguimiento de avances y plazos, comunicación, riesgos y bloqueos.
- **Tech Lead / Architect**: arquitectura, decisiones de stack, calidad y buenas prácticas, revisión del código crítico.
- **Developers**: todos.

Propuesta coherente con el historial:

```markdown
| Subject role | Assigned member(s) |
|---|---|
| Product Owner | arhea |
| Project Manager / Scrum Master | israetor |
| Technical Lead / Architect | fcela-ga |
| Developers | fcela-ga, nalesso, arhea, elerazo-, israetor |
```

Y en la tabla de responsabilidades, la fila de israetor con lo que de verdad hizo
(3.2: cambio de contraseña, motor de tema, i18n de acceso, cuenta y errores, pruebas
de los formularios de acceso, revisión y fusión de la mayoría de PR), no sólo
«Reviews · infrastructure».

> ✅ **Decidido por el equipo el 16/10:** PM = elerazo-; Tech Lead = fcela-ga,
> nalesso e israetor (lo que hay ahora en el README). La propuesta de arriba queda
> superada.
>
> ⚠️ El historial apoya que israetor sea quien revisaba y fusionaba (PM) y que
> fcela-ga sea el Tech Lead. Lo que no apoya es inventar un rol que nadie ejerció:
> la hoja pide a cada persona explicar el suyo.

### 0.2 Muy recomendables

| # | Estado | Qué | Por qué |
|---|---|---|---|
| R1 | ⏳ PR del README (16/10): 135 / 232 / 130 | Actualizar las cifras del README («Continuous Integration and Delivery», tabla de *jobs*): dice 123 pruebas unitarias de API, 51 de web y 100 de integración; hoy son **135 / 227 / 125** en `develop` y **135 / 229 / 130** con #97 | La hoja final pregunta «Is the README complete and **accurate**?». Que no se contradiga con lo que se ejecuta delante |
| R2 | ❌ | Borrar el comentario HTML de las líneas 4–5 del README («Required project roles and personal declarations marked with placeholders…») cuando estén B1, B3 y B4 | Se ve en la vista *raw* y en el editor |
| R3 | — | *(Subido a bloqueante: B11)* | — |
| R4 | ⏳ PR del README (16/10) | Añadir `doc/` y `rclone/` al `.gitignore` | `make seed-dev` escribe contraseñas en `doc/seed.txt` y **`doc/` NO está ignorado** en el repositorio (en el clon de Felipe sí, pero por `.git/info/exclude`, que no se comparte). Un `git add .` las subiría. Mientras tanto: sembrar con `--salida ../seed.txt` (fuera del repo) |
| R5 | ✅ cambiado el 16/10 | **`tmp/Eval/` sí se entrega** (decisión de Felipe, 16/10): la guía, la hoja, el estado y los dos scripts entran por `backend` y llegan a `develop` con #101; con la PR `develop` → `main`, también al clon de la defensa, y `seed-defensa.sh` y `obs-local.sh` se lanzan desde ahí (1.5, M11). **El resto de `tmp/` no:** el enunciado y el informe rev5 siguen sólo en la rama `docs` del repositorio personal, y esa rama no se fusiona entera nunca | El repositorio del equipo es público: lo que entra lo puede leer cualquiera, también quien evalúa. Revisado antes de subirlo: ni secretos ni la IP del servidor (sólo marcadores); `deployer`, las rutas de `/opt/helpdesk` y los correos del `.mailmap` (3.5) ya estaban en los workflows, el README y el historial. El informe rev5 se queda fuera porque es material interno («el ensayo de restauración automático no ha estado verde ni una vez») |
| R6 | ❌ opcional | Un `.mailmap` para que `git shortlog` no reparta a cada persona en 2–3 identidades (3.5) | Que la hoja de «Git History» se lea de un vistazo |
| R7 | ❌ | Abrir sesión **antes** de la defensa, en perfiles de navegador separados, con las cuentas demo de producción | En producción las rutas de credenciales están limitadas a **5 por minuto y por IP** en nginx y a 10 en la API. Cinco personas entrando desde la misma red del campus agotan la ventana enseguida |
| R8 | ⏳ PR del README (16/10): las 9 anotaciones `runbook` que faltaban y la frase corregida (no eran enlaces, sino los primeros comandos); en el servidor se ven al recargar Prometheus | Corregir en el README la frase de las alertas («*every one of them carrying a link to its runbook entry*», «Observability and Alerting») o completar las anotaciones: **14 de las 23** reglas llevan `runbook`; no lo llevan `LatenciaAlta`, `DiscoCritico`, `MemoriaAlta`, `PostgresConexionesAlLimite`, `RedisSinMemoria`, `BackupAntiguo`, `BackupSospechosamentePequeno`, `EnsayoDeRestauracionFallido` y `CertificadoCaducaYa` | M11 se enseña abriendo ese fichero, y la hoja pregunta si el README es «*accurate*» |
| R9 | ⏳ | #97, #98 y #99 ya están fusionadas. Queda **#101** (dos errores de consola, la importación de la autoridad y, desde el 16/10, esta carpeta `tmp/Eval/`): que **otra** persona la apruebe esta noche, con «Create a merge commit», y la PR `develop` → `main` | Sin eso, los errores de consola siguen en staging y producción |
| R10 | ❌ | **Filtros con varios valores en Swagger.** El documento OpenAPI declara `status` y `priority` de `GET /tickets` y `GET /public/tickets` con `explode: true` (valores repetidos: `status=OPEN&status=CLOSED`), y la API sólo acepta comas (`status=OPEN,CLOSED`): repetidos contesta `400 VALIDATION_FAILED` (✅ comprobado en las dos rutas). Arreglo de una línea por parámetro: `explode: false` en `apps/api/src/modules/openapi/paths/tickets.ts` (líneas 45 y 54) y `paths/public-api.ts` (105 y 114) | Swagger es lo que se enseña en M5 y M14: elegir dos estados en *Try it out* da un 400 delante de quien evalúa. Mientras no se arregle, un solo valor por filtro en Swagger |
| R11 | ⏳ PR del README (16/10): columna «Why we chose it» | **Una justificación por módulo en el README.** El enunciado (cap. VI, *Modules*) pide «*Justification for each module choice*», y la tabla de «Modules» sólo dice cómo se hizo cada uno; el porqué sólo está para el de libre elección. Propuesta, una frase por fila (abajo) | La hoja verifica el README contra el enunciado; con la columna basta |

Propuesta para R11 (una columna *Why* en la tabla de «Modules», en el orden del README):

```markdown
| Custom-made design system | Five people building screens in parallel needed one visual language; semantic tokens make the dark theme a redefinition, not a rewrite |
| Public API | Organizations feed tickets from their own tools (monitoring, web forms) without sharing anyone's credentials |
| CI/CD (Module of Choice) | See «Why this is claimed as a Module of Choice» |
| Monitoring with Prometheus and Grafana | Two environments on one free server: without metrics and alerts, an outage or a full disk would be found by the users |
| Health checks, status page, backups and recovery | A help desk keeps the history of every incident; losing it, or not knowing it is down, is the worst failure it can have |
| GDPR | It stores personal data of other organizations' staff; access and erasure are legal duties in the EU, not extras |
| Standard user management | Profiles, avatars, presence and sessions tell people who is answering their ticket |
| Advanced permissions | Members, agents and administrators at two levels must see and do different things; one policy table decides it |
| Organization system | Several organizations share one installation without seeing each other's tickets |
| Framework front and back | Typed contracts end to end with React and Express, mature ecosystems the team already knew |
| ORM | Versioned migrations applied on every deploy and typed queries instead of hand-written SQL |
| Real-time features | Agents and requesters see a ticket change while they look at it, without reloading |
| User interaction | Agents and users talk about an incident outside the ticket; friendships and profiles give context about who is who |
| Advanced search | Agents work through hundreds of tickets: finding the right one by text, state and priority is the core of the job |
```

### 0.3 Ensayo general de esta noche (≈ 1 h 30)

No es recorrer la guía entera: son estos pasos, en este orden, en **el portátil de la
defensa** y con #97 y #98 ya fusionadas en `develop` (si no lo están, desde la rama
`backend`).

1. 🖥 Clon limpio en carpeta vacía y `make`, cronometrado (sección 1). Tiene que acabar
   con `Web: https://localhost:5173`.
2. 🌐 **Importar la autoridad local en el navegador**, una vez (1.9), y comprobar el
   candado en https://localhost:5173. En otro clon de la misma máquina ya no hará
   falta (la autoridad es por máquina).
3. 🖥 Siembra base por HTTPS y datos de la defensa (1.5); recorrido por las pantallas
   con las cinco cuentas.
4. 🌐 Consola de Chrome limpia en local **y en producción** (4.3): recargar, navegar,
   entrar y salir. Los únicos rojos aceptables son los de las pruebas con datos
   inválidos, y se hacen después.
5. 🐙 Ensayo de restauración en prod y después en staging; leer el log (7.4, B7).
6. ☁ `check-server.sh`, túnel SSH, Grafana con datos, Prometheus *Targets* todo `UP`
   (B8). Cloudflare en *Full (strict)* (B9).
7. 🌐 Recorrer los **14** módulos con su dueño (sección 6). Cada persona presenta el
   suyo y sabe contar el de otro.
8. 🖥 Las dos demostraciones nuevas: la carrera (9.3: un 200 y siete 409) y la regla
   del 404 (M8: el mismo cuerpo para un ticket ajeno que para uno inventado).
9. 🖥 `make ci JOBS="quality unit security"` en el portátil de la defensa (11.1): el
   job `security` es el mismo que bloqueó la PR #88 en GitHub (gitleaks).

### 0.4 Texto propuesto para «Instructions» del README (B5)

```markdown
### Run it locally (development)

    git clone <repo-url> helpdesk && cd helpdesk
    make              # = make up-dev: writes .env with random secrets (scripts/gen-secrets.sh),
                      #   creates the local HTTPS certificate (scripts/dev/local-cert.sh),
                      #   then builds and starts db, redis, mailpit, api and web
    make seed-dev     # optional: demo organizations, people, categories and tickets
                      #   (needs Node >= 20.11 on the host; credentials go to doc/seed.txt)

- Application: https://localhost:5173 · API reference: https://localhost:5173/api/v1/docs ·
  captured e-mail (Mailpit): http://localhost:8025
- HTTPS: the certificate is signed by a local certificate authority that `make` creates
  once per machine in `~/.local/share/helpdesk-lite/local-ca`. Import its `ca.crt` in the
  browser once (`make cert` prints how; with `certutil` installed it is automatic).
  `make cert` shows the current certificate and asks before replacing it.
- `make` prints the primary administrator: sign in with `<BOOTSTRAP_ADMIN_USERNAME>@helpdesk.invalid`
  and the password it shows (both are also in `.env`).
- Do not copy `.env.example` by hand: if `.env` exists, `gen-secrets.sh` leaves it untouched.
  To regenerate it: `bash scripts/gen-secrets.sh --force` (keeps a backup).
- Start again from an empty database: `make reset-dev`. Stop: `make down-dev`.
- Hot reload already works inside the containers (the source tree is mounted into
  `api` and `web`): there is no need to run `npm run dev:*` on the host, and doing it
  while the containers are up fails with the port in use.
```

### 0.5 Reparto de la defensa

| Bloque | Presenta | Apoya |
|---|---|---|
| Arranque desde cero, `.env`, secretos | fcela-ga | nalesso (Docker) |
| Concepto, stack, organización del equipo | dos personas distintas (p. ej. israetor y arhea) | — |
| Tickets (crear, lista, filtros, búsqueda, detalle, notas internas) | nalesso | fcela-ga (API) |
| Design system, Tailwind, responsive; producto (PO) | arhea | — |
| Búsqueda avanzada (M14) | arhea (filtros y su experiencia) | nalesso (integración y búsqueda global), fcela-ga (API) |
| Chat | elerazo- | fcela-ga (capa de sockets) |
| Preferencias: idioma y tema, cambio de contraseña, validación de formularios de acceso | israetor | — |
| Usuarios, roles, organizaciones, RGPD, API pública | fcela-ga | arhea (pantallas) |
| CI/CD, monitorización, copias y restauración, HTTPS local | fcela-ga | nalesso (CI/CD, copias) |

> Todos tienen que poder contar el proyecto entero en dos minutos y explicar al
> menos una pieza que no es suya (hoja: *Teamwork Evidence* → «Team members can
> explain each other's work»).

---

## 1. Arranque desde cero en local

Es lo que pide *Deployment* («a single command») y lo que la hoja recomienda
hacer desde un `git clone` en carpeta vacía.

### 1.1 Requisitos del portátil

| Herramienta | Para qué | Comprobar |
|---|---|---|
| Docker ≥ 27 con Compose v2 | Toda la pila | `docker version && docker compose version` |
| GNU Make, git | Los atajos y el clon | `make -v && git --version` |
| openssl y python3 | `scripts/gen-secrets.sh` los exige; openssl también hace el certificado local (1.9) | `openssl version && python3 -V` |
| `certutil` (opcional, paquete `libnss3-tools`) | Importa sola la autoridad local en Chrome y Firefox; sin él, se importa a mano una vez (1.9) | `command -v certutil` |
| Chrome estable | La hoja lo pide (*Browser Compatibility*) | `google-chrome --version` |
| curl y jq | Esperar a la API, el script de datos extra y las pruebas a mano | `curl -V && jq --version` |
| Node ≥ 20.11 en el host | **Sólo** para `make seed-dev` (ver 1.5 si no hay Node) | `node -v` |

En los puestos de 42 (Docker sin root, `sgoinfre` en exFAT): el `make ci` lo
detecta y trabaja sobre un espejo; para la pila de desarrollo basta con que Docker
funcione.

### 1.2 Clon limpio y comprobaciones previas que pide la hoja

```bash
mkdir -p ~/defensa && cd ~/defensa && ls -A            # carpeta vacía (la hoja lo pide)
git clone <URL_DEL_REPO> helpdesk && cd helpdesk
git log --oneline -1                                   # el commit que se evalúa
alias; type make docker git                             # sin alias raros (lo pide la hoja)
```

### 1.3 Los secretos: `make secrets`

```bash
make secrets          # = bash scripts/gen-secrets.sh  (entorno dev por defecto)
```

Qué hace (`scripts/gen-secrets.sh`, ✅ probado en un clon limpio):

- Copia `.env.example` a `.env` **con permisos 600** y rellena con valores aleatorios
  (`openssl rand -hex`) todos los secretos: contraseña de PostgreSQL y `DATABASE_URL`,
  `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (distintos), `PASSWORD_PEPPER`,
  `METRICS_TOKEN`, `BACKUP_ENCRYPTION_KEY`, `DOCS_GATEWAY_TOKEN` y el hash de la
  documentación, y el **administrador principal** (`BOOTSTRAP_ADMIN_USERNAME`
  = `op-xxxxxxxx`, contraseña con la política de la aplicación).
- Imprime al final las dos credenciales que se teclean: **el administrador**
  (`op-xxxxxxxx@helpdesk.invalid` y su contraseña) y la de la documentación (sólo
  sirve en staging/producción).
- **Nunca** sobrescribe un `.env` existente: dice «.env ya existe: no se toca». Para
  regenerarlo: `bash scripts/gen-secrets.sh --force` (guarda `.env.bak.<fecha>`).
- `RCLONE_REMOTE` queda vacío a propósito: sólo existe en el servidor.
- En desarrollo deja `APP_PUBLIC_ORIGIN` vacío y `CORS_ORIGINS` con los orígenes
  `https://` y `http://` de localhost: la API escribe los enlaces de los correos con
  el esquema y el host que le pasa Vite (`X-Forwarded-Proto/Host`), así que salen por
  `https://localhost:5173` (✅ comprobado con el correo de recuperar la contraseña).

Enseñar a quien evalúa, en ese momento:

```bash
ls -l .env                      # -rw------- : sólo su dueño lo lee
git check-ignore -v .env        # .gitignore:2:.env   .env   → ignorado
git status --short              # vacío: el .env no aparece
grep -c '=' .env.example        # la plantilla versionada, sin valores reales
```

> ⚠️ **No** hacer `cp .env.example .env` antes (lo que dice hoy el README): con un
> `.env` ya presente, `gen-secrets.sh` no lo toca y la API arranca **sin
> administrador**, con lo que `make seed-dev` falla con «Faltan
> BOOTSTRAP_ADMIN_USERNAME y BOOTSTRAP_ADMIN_PASSWORD en el .env».

### 1.4 Un solo comando: `make`

```bash
make            # regla por defecto = make up-dev
```

`up-dev` ejecuta, en este orden, `gen-secrets.sh` (que no hace nada si el `.env` ya
existe), `scripts/dev/local-cert.sh --ensure` (crea el certificado HTTPS local si
falta, sin preguntar nada; 1.9) y `docker compose -p helpdesk-dev -f compose.dev.yml
up --build --detach`, y termina con `Web: https://localhost:5173`. Levanta cinco
contenedores:

| Contenedor | Qué es | Puerto en el host |
|---|---|---|
| `dev_database` | PostgreSQL 15 | 5432 |
| `dev_redis` | Redis 7 | 6380 |
| `dev_mailpit` | Buzón que captura los correos | 8025 (web), 1025 (SMTP) |
| `dev_api` | API Express; al arrancar: `prisma generate` + `prisma migrate deploy` + `npm run dev` | 5000 |
| `dev_web` | Vite (React), **por HTTPS** con el certificado local; reenvía `/api` y `/socket.io` a la API por la red de Docker | 5173 |

Esperar a que la API conteste y enseñar que todo está en pie:

```bash
# Una vez por terminal: que curl confíe en la autoridad local además de en las públicas
# (así el mismo curl sirve para https://localhost:5173 y para https://helpdesklite.me)
cat /etc/ssl/certs/ca-certificates.crt ~/.local/share/helpdesk-lite/local-ca/ca.crt > ~/defensa/ca-bundle.pem
export CURL_CA_BUNDLE=~/defensa/ca-bundle.pem

until curl -sf https://localhost:5173/api/health > /dev/null; do sleep 2; done; echo "API lista"
docker compose -p helpdesk-dev -f compose.dev.yml ps          # 5 servicios, db y redis "healthy"
curl -s https://localhost:5173/api/health/ready | jq           # dependencias: database, redis, smtp, storage
docker logs dev_api 2>&1 | grep -iE "migrat|bootstrap-admin|listening"
```

En el log tienen que verse las 4 migraciones aplicadas, «administrador principal
creado» y «API listening on 0.0.0.0:5000» (el 5000 es el puerto **dentro** del
contenedor; el navegador entra por el 5173, B12).

> El primer `make` construye las imágenes (`npm install` dentro): varios minutos.
> Hacerlo antes de la defensa en el portátil que se vaya a usar y, delante de
> quien evalúa, repetirlo desde el clon limpio (las capas ya están en caché).

**No** lanzar después `npm run dev:api` / `npm run dev:web`: los contenedores ya
lo hacen y el segundo proceso falla con el puerto ocupado.

> La hoja pide revisar **juntos** los scripts que facilitan la corrección. `make`
> llama a dos: `scripts/gen-secrets.sh` y `scripts/dev/local-cert.sh`. Los dos
> empiezan con una cabecera que explica qué hacen, qué no tocan nunca (un `.env`
> existente, la autoridad local) y cómo se repiten; enseñarla si la piden.

### 1.5 Usuarios base y datos de prueba

**Lo que crea el arranque** (sin hacer nada): sólo el administrador de plataforma
del `.env` (`modules/admin/bootstrap-admin.ts`), ya verificado, con el correo
`<BOOTSTRAP_ADMIN_USERNAME>@helpdesk.invalid`. Ver sus credenciales:

```bash
grep '^BOOTSTRAP_ADMIN_' .env
```

**Siembra base — `scripts/dev/seed-local.mjs`** (lo que lanza `make seed-dev`):

```bash
# Por HTTPS, por el mismo proxy que el navegador (✅ probado el 15/10: 2 min, con una
# espera del limitador de credenciales). Recomendado delante de quien evalúa (B12):
API_BASE_URL=https://localhost:5173 NODE_EXTRA_CA_CERTS="$HOME/.local/share/helpdesk-lite/local-ca/ca.crt" \
  node scripts/dev/seed-local.mjs --salida ../seed.txt   # fuera del repo (R4)
# Lo mismo con el atajo, que va por http://127.0.0.1:5000 (B12) y escribe doc/seed.txt:
#   make seed-dev
cat ../seed.txt
```

Todo por la API real (registro, confirmación del correo leyendo Mailpit, mismas
validaciones y permisos). Deja:

| Cuenta | Papel |
|---|---|
| `op-xxxxxxxx@helpdesk.invalid` | GLOBAL_ADMIN principal (del `.env`, protegido) |
| `demo-sistemas@helpdesklite.me` | Segundo GLOBAL_ADMIN (promocionado por la API) |
| `demo-admin@helpdesklite.me` | ORG_ADMIN de las tres organizaciones (las creó) |
| `demo-agent@helpdesklite.me` | AGENT de Vilanova |
| `demo-laura@helpdesklite.me`, `demo-marc@helpdesklite.me` | MEMBER de Vilanova |

- 3 organizaciones: «Ayuntamiento de Vilanova — Soporte TI», «Consell Comarcal
  Informàtica», «Hospital Sant Camil TIC», con sus categorías (cada organización
  nace con 4 por defecto: General, Hardware, Network, Software).
- 8 tickets en Vilanova (referencias `AYUNTA-0001…0008`) en los cuatro estados,
  movidos con la máquina de estados real (su historial queda en `ticket_history`).
- Tarda unos segundos; si salta el limitador (10 credenciales/min/IP) espera solo.
- Se puede repetir: reconcilia roles, no duplica, y **regenera las contraseñas de
  las cuentas demo** (el fichero nuevo es el que vale).

Sin Node en el host, la misma siembra **dentro del contenedor de la API** (Node 24;
el repo está montado en `/app`). Ahí habla con la API sin cifrar, pero es una conexión
interna del backend, la que el enunciado permite expresamente («*software inside your
container(s)*»):

```bash
docker exec -e MAILPIT_URL=http://mailpit:8025 dev_api \
  node /app/scripts/dev/seed-local.mjs --salida /tmp/seed.txt
docker exec dev_api cat /tmp/seed.txt > ../seed.txt && chmod 600 ../seed.txt
```

Se puede repetir, y además **recoloca lo que se haya movido a mano**: el 15/10,
después de un día de pruebas, demo-laura había quedado sólo como ORG_ADMIN de Consell
Comarcal; la siembra la devolvió a Vilanova («pertenencias: 6 (1 creadas o
corregidas)»). Cambia las contraseñas de las cuentas demo: vale el fichero nuevo.

**Datos extra para la defensa — `seed-defensa.sh`** (✅ probado el 15/10 por la
tarde, **por HTTPS**: `https://localhost:5173/api/v1` con la autoridad local; sin
ella cae a `http://127.0.0.1:5000` y avisa de que así no se lanza delante de quien
evalúa; necesita curl y jq). Vive en `tmp/Eval/` del repositorio (desde el 16/10,
R5) y se lanza desde la raíz del clon (las rutas que usa son relativas a donde se
lanza: la clave de la API queda en `../defensa-api-key.txt`, fuera del clon):

```bash
# En la defensa, desde la raíz del clon limpio y después de la siembra base:
bash tmp/Eval/seed-defensa.sh ../seed.txt                      # el fichero de la siembra base
EXTRA_TICKETS=30 bash tmp/Eval/seed-defensa.sh ../seed.txt     # + 30 tickets para paginar

# Si el clon es de `main` y #101 aún no ha llegado a `main`, la carpeta no está:
# sacar los dos scripts de `develop` a una carpeta fuera del clon (en el clon de
# Felipe, el remoto del equipo es `equipo`: `equipo/develop`).
mkdir -p ~/defensa-scripts && for f in seed-defensa.sh obs-local.sh; do
  git show "origin/develop:tmp/Eval/${f}" > ~/defensa-scripts/"${f}"; done
bash ~/defensa-scripts/seed-defensa.sh ../seed.txt
```

> La hoja pide revisar **juntos** cualquier script que facilite la corrección
> («*review together any scripts used to facilitate the grading*»). Antes de
> lanzarlo, enseñarlo en pantalla a quien evalúa: sólo llama a la API pública de la
> propia aplicación con las cuentas de la siembra (nada por SQL), y se lee en un
> minuto.

Añade, siempre por la API: comentarios públicos y **notas internas** en cada ticket
(la persona MEMBER ve 2, el agente ve 3), un ticket abierto asignado y otro sin
asignar para asignarlo en directo, la amistad laura ↔ marc aceptada y una solicitud
**pendiente** agent → laura para aceptarla en directo, una conversación de chat
laura ↔ marc con 3 mensajes y una **clave de la API pública** «Defensa» con todos
los *scopes*, cuyo secreto queda en `../defensa-api-key.txt` (permisos 600, fuera
del repo). Repetirlo no duplica nada salvo los tickets de relleno.

**Datos en vivo (mejor aún delante de quien evalúa):** crear un ticket, comentarlo,
cambiar su estado, crear una organización, dar un rol a un correo, mandar un
mensaje. Cada acción se comprueba después en la base de datos (anexo A).

### 1.6 Volver a empezar, parar, limpiar

| Comando | Qué hace |
|---|---|
| `make reset-dev` | Pide escribir `borrar`; `down --volumes`, `up-dev`, espera a la API y `seed-dev`. Base vacía y sembrada |
| `make down-dev` | Para la pila (los datos se quedan en los volúmenes) |
| `make down-dev-all` | Para también contenedores `dev_*` de otro clon (si `down-dev` «no hace nada») |
| `make fclean` | Borra contenedores **y volúmenes** (pide confirmación) |
| `make re` | `fclean` + `up-dev` |
| `make logs ID=api` | Sigue los logs de un servicio |
| `make it ID=dev_api` | Shell dentro de un contenedor |

### 1.7 Dónde está cada cosa en local

| Qué | URL |
|---|---|
| Aplicación | https://localhost:5173 |
| Documentación de la API (Swagger) | https://localhost:5173/api/v1/docs |
| Documento OpenAPI | https://localhost:5173/api/v1/openapi.json |
| Correos (verificación, recuperación, invitaciones, RGPD) | http://localhost:8025 (Mailpit hace de buzón de correo; no es el backend, 5.7) |
| Página de estado | https://localhost:5173/status.html (en producción `/status`) |
| Sondas | https://localhost:5173/api/health · `/api/health/ready` · `/api/health/status` |

### 1.8 Problemas típicos al arrancar

| Síntoma | Causa y arreglo |
|---|---|
| `port is already allocated` (5432, 5000, 5173…) | Otro servicio o un clon anterior. `make down-dev-all`; `docker ps` para ver quién lo ocupa |
| `make seed-dev`: «Faltan BOOTSTRAP_ADMIN_…» | `.env` copiado a mano. `bash scripts/gen-secrets.sh --force` y `make reset-dev` |
| `make seed-dev`: «La API no responde» | Todavía migrando. `docker logs -f dev_api` y esperar a «API listening» |
| La web carga pero no entra nadie | `docker logs dev_api` (¿variables?), `curl -s localhost:5000/api/health/ready \| jq` |
| No llega el correo de verificación | Está en Mailpit: http://localhost:8025 |
| `dev_api` se reinicia en bucle con `P1000: Authentication failed` o «*database … does not exist*» | En la terminal hay variables `POSTGRES_*`, `DATABASE_URL`, `JWT_*`… exportadas (de otro clon, de un `set -a; . .env` anterior…) y Compose las **prefiere** al `.env`. Comprobar sólo los nombres, sin enseñar valores: `env \| cut -d= -f1 \| grep -E '^(POSTGRES\|DATABASE_URL\|DB_)'`; abrir una terminal limpia (o `unset` de esas variables) y `make up-dev`, que recrea la base y la API con el `.env` del clon. Pasó al preparar esta guía (15/10): los datos no se tocan, sólo la conexión |
| `http://localhost:5173` no contesta (respuesta vacía) | Con el certificado local la web va **sólo** por HTTPS: https://localhost:5173 |
| Chrome avisa «La conexión no es privada» (`NET::ERR_CERT_AUTHORITY_INVALID`) | La autoridad local no está en ese navegador. `make cert` la importa y dice si ya está (1.9); después, cerrar Chrome del todo y volver a abrirlo. Rehacer el certificado no sirve: el problema es la confianza en la autoridad |
| `curl: (60) SSL certificate problem` en local | Falta `export CURL_CA_BUNDLE=~/defensa/ca-bundle.pem` en esa terminal (1.4) |
| `seed-defensa.sh` acaba en «HTTP 404 TICKET_NOT_FOUND» | Una cuenta demo ya no es miembro de esa organización (pruebas a mano). La siembra base la recoloca (1.5) y se vuelve a lanzar |


### 1.9 HTTPS en local: la autoridad local y `make cert`

Lo hace `scripts/dev/local-cert.sh` (PR #97). Son dos piezas, y la diferencia es lo
que importa al sobrescribir:

| Pieza | Dónde | Cuántas | Si se rehace |
|---|---|---|---|
| **Autoridad local** (`ca.crt` + `ca.key`) | `~/.local/share/helpdesk-lite/local-ca/`, **fuera** del repositorio; la clave con permisos 600 | Una por persona y máquina, para todos sus clones | El script **no la rehace nunca**: obligaría a importar la nueva en cada navegador y a borrar la vieja. Si se borra a mano, el siguiente `make` crea otra y hay que importarla otra vez |
| **Certificado de localhost** (`localhost.crt` + `localhost.key`) | `config/local-tls/` del clon, ignorado por git | Uno por clon | Nada que hacer en el navegador: lo firma la misma autoridad. Sólo se reinicia la web para que lo use |

- La autoridad sólo puede firmar para `localhost`, `127.0.0.1` y `::1` (*name
  constraints*, críticas): aunque su clave se escapase, no serviría para suplantar
  ningún otro sitio.
- El certificado de localhost: EC P-256, 825 días, `subjectAltName` con `localhost`,
  `127.0.0.1` y `::1`, uso `serverAuth`.

```bash
make                 # lo crea si falta, lo rehace si caduca en menos de 30 días o es de otra autoridad; nunca pregunta
make cert            # enseña el actual (caducidad, huella, autoridad) y PREGUNTA antes de rehacerlo [s/N]
make cert FORCE=1    # lo rehace sin preguntar, con la misma autoridad
```

Sin terminal (`make cert < /dev/null`) nunca rehace nada. ✅ Los tres caminos, probados
el 15/10.

**Importar la autoridad en el navegador** (PR #101): lo hace el propio script, en
Chrome/Chromium (`~/.pki/nssdb`) y en los perfiles de Firefox, con el `certutil` del
sistema o, si no está —los puestos de 42, sin sudo—, con el de un contenedor Alpine
que construye la primera vez. Lo reintenta en cada `make` hasta que entra y anota la
huella de la autoridad importada (`~/.local/share/helpdesk-lite/local-ca/trusted.sha256`).
`make cert` dice si ya está. **Chrome la toma al volver a abrirlo**: cerrarlo del
todo (o `chrome://restart`). Para quitarla: `certutil -d sql:$HOME/.pki/nssdb -D -n
"HelpDesk Lite local CA"`.

> El 15/10 por la noche, en este puesto sin `certutil`, la versión anterior no la
> importó nunca: sólo lo intentaba al crear la autoridad, explicaba los pasos a mano
> una vez y no volvía a probar. Rehacer el certificado no servía de nada, porque el
> problema no era el certificado sino la confianza en quien lo firma.
> ✅ Comprobado con la nueva: la autoridad entra una vez en `~/.pki/nssdb`, con
> confianza `C,,` y del propio usuario, y un Chrome nuevo abre https://localhost:5173
> como **seguro** sin ignorar ningún error de certificado.

A mano, sólo si lo anterior no pudiera (sin `certutil` ni Docker):

- En Chrome: `chrome://certificate-manager` → certificados importados de Linux
  → *Autoridades* → *Importar* → `~/.local/share/helpdesk-lite/local-ca/ca.crt` →
  marcar «Confiar en este certificado para identificar sitios web». Reiniciar Chrome
  si no lo toma.
- En Firefox: `about:preferences#privacy` → *Ver certificados* → *Autoridades* →
  *Importar* → el mismo fichero → «Confiar en esta CA para identificar sitios web».

**Enseñarlo** (5.7): candado → «La conexión es segura» → certificado emitido por
«HelpDesk Lite local CA (…)». Y por terminal:

```bash
echo | openssl s_client -connect localhost:5173 -servername localhost \
  -CAfile ~/.local/share/helpdesk-lite/local-ca/ca.crt 2>/dev/null | grep -E "^subject=|^issuer=|Verify return code"
#   subject=O=HelpDesk Lite (development), CN=localhost
#   issuer=O=HelpDesk Lite (development), CN=HelpDesk Lite local CA (<usuario>@<máquina>)
#   Verify return code: 0 (ok)
openssl x509 -in ~/.local/share/helpdesk-lite/local-ca/ca.crt -noout -text | grep -A4 "Name Constraints"
```

✅ Comprobado el 15/10: la cadena verifica para `localhost` y `127.0.0.1`, y falla sin
la autoridad (lo que ve un navegador que todavía no confía en ella); el correo de
recuperar la contraseña enlaza a `https://localhost:5173`; entrar, renovar la sesión y
el socket (`wss://localhost:5173/socket.io`) funcionan en Chrome; y un clon nuevo en la
misma máquina sale con un certificado que verifica contra la autoridad que ya estaba.

> ⚠️ En el portátil de la defensa, importar la autoridad **esta noche** (0.3, paso 2).
> Si la defensa acaba en otro portátil, su primer `make` crea allí otra autoridad, y
> hay que importarla (un minuto; plan B en 12).

---

## 2. Chuleta de accesos

### 2.1 Logs

🖥 Local:

```bash
docker logs -f --tail 100 dev_api                 # JSON por línea: ts, level, scope, msg, requestId
docker logs --since 10m dev_api 2>&1 | grep -i error
docker logs --tail 50 dev_web
make logs ID=api                                   # vía compose
```

☁ Servidor (contenedores `helpdesk-<servicio>-<entorno>`: `api`, `web`, `db`, `redis`,
`mailpit`, `backup`; entornos `prod` y `staging`):

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
docker logs --since 15m helpdesk-api-prod
docker logs --since 15m helpdesk-api-prod 2>&1 | grep '"level":"error"'
docker compose -p prod -f /opt/helpdesk/prod/compose.prod.yml logs --tail 100 api web
cat /opt/helpdesk/prod/backups/cron.log | tail -20       # copias nocturnas
```

Y sin SSH a los contenedores, en Grafana → *Explore* → Loki:

```logql
{container="helpdesk-api-prod"} |= "error"
{env="prod", service="api"} | json | level="warn"
```

> Cada respuesta de error de la API lleva un `requestId` (en el cuerpo y en la
> cabecera `X-Request-Id`; se ve en DevTools → *Network* → la petición).
> `docker logs dev_api 2>&1 | grep <requestId>` (o `helpdesk-api-prod` en el
> servidor) la encuentra en el log (✅ comprobado): buen argumento de «error handling».

### 2.2 Base de datos

🖥 Local (usa las variables del propio contenedor; no hay que teclear contraseñas):

```bash
docker exec -it dev_database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
# una consulta suelta:
docker exec dev_database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM tickets"'
```

El puerto 5432 está publicado: también vale un cliente gráfico (DBeaver,
pgAdmin) con usuario, base y contraseña de `grep '^POSTGRES_' .env`.

☁ Servidor (la base **no** publica puertos; se entra por el contenedor):

```bash
docker exec -it helpdesk-db-prod sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker exec -it helpdesk-db-staging sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Dentro de `psql`: `\dt` (22 tablas + `_prisma_migrations`), `\d tickets` (columnas,
índices, claves foráneas con `ON DELETE CASCADE / SET NULL`), `\x` para ver filas
en vertical, `\q` para salir. **Las columnas van en camelCase y entre comillas
dobles** (`"createdAt"`, `"passwordHash"`). Consultas preparadas: anexo A.

> Para enseñar «lo que veo en la web está en la base»: crear algo en la interfaz
> (un ticket) y lanzar la consulta A.4 justo después; la referencia (`AYUNTA-0009`
> en Vilanova: las seis primeras letras del identificador de la organización y un
> contador propio) coincide con la de la pantalla.

### 2.3 Redis

```bash
docker exec dev_redis redis-cli dbsize
docker exec dev_redis redis-cli --scan --count 100 | head -20   # ventanas de rate limit, presencia, revocaciones
docker exec helpdesk-redis-prod redis-cli info memory | grep used_memory_human   # ☁
```

### 2.4 Correo (Mailpit)

- 🖥 Local: http://localhost:8025.
- ☁ Servidor: escucha sólo en `127.0.0.1` del host; **8025 = prod, 8026 = staging**.
  Se abre con el túnel de 2.5 y http://localhost:8025.
- ⚠️ En producción los correos **tampoco** salen a buzones reales (`SMTP_HOST=mailpit`,
  el valor de `compose.prod.yml` y de `gen-secrets.sh`; comprobarlo hoy en
  `/opt/helpdesk/prod/.env`): si quien evalúa
  se registra en https://helpdesklite.me, su correo de verificación (o el de
  recuperación, o el código del RGPD) está en el Mailpit de producción. Tener el
  túnel abierto antes de empezar y saber explicarlo (8.2, «Compromisos»).

### 2.5 Servidor de Oracle: SSH, túnel y revisión completa

```bash
ssh <USUARIO_SSH>@<IP_SERVIDOR>          # deployer está en el grupo docker; el origen sólo acepta lo que dejan la VCN y fail2ban

# Túnel con todo lo que escucha en 127.0.0.1 del servidor:
ssh -N -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 -L 9093:127.0.0.1:9093 \
       -L 8025:127.0.0.1:8025 -L 8026:127.0.0.1:8026 <USUARIO_SSH>@<IP_SERVIDOR>
# Grafana http://localhost:3000 · Prometheus http://localhost:9090 · Alertmanager http://localhost:9093
# (si esos puertos ya están ocupados en el portátil —otro programa, o el plan B local de M11—,
#  se cambia el de la izquierda: -L 3005:127.0.0.1:3000 → Grafana en http://localhost:3005)
# Mailpit prod http://localhost:8025 · Mailpit staging http://localhost:8026
```

| Ruta en el servidor | Qué hay |
|---|---|
| `/opt/helpdesk/prod`, `/opt/helpdesk/staging` | `compose.prod.yml`, `.env` (600), `scripts/`, `backups/`, `drills/`, `nginx/` |
| `/opt/helpdesk/observability` | `compose.observability.yml`, `config/`, `.env` |
| `/opt/helpdesk/<env>/backups/<fecha>[_<etiqueta>]` | Copias: `MANIFEST`, `database.dump.enc`, `uploads.tar.gz.enc`, `toc.txt` |
| `/opt/helpdesk/<env>/drills/RESTORE-DRILL-*.txt` | Informe de cada ensayo |

Revisión de una vez (sólo lectura: contenedores, errores, objetivos de Prometheus,
alertas activas, edad de copias y ensayos), desde el clon del repo en el servidor:

```bash
cd <CHECKOUT_SERVIDOR> && git pull
bash scripts/ops/check-server.sh            # sale con 1 si hay algún FALLO
sudo bash scripts/ops/check-server.sh       # además lee lo que es de root
```

### 2.6 Comprobaciones por `curl`

```bash
curl -s https://helpdesklite.me/api/health | jq                  # vivo
curl -s https://helpdesklite.me/api/health/status | jq           # semáforo público por áreas
curl -sI https://helpdesklite.me/status | head -1                # la página de estado
curl -s https://helpdesklite.me/api/version | jq                 # público: sólo nombre y versión

# Vista de operador (☁ en el servidor; el token no sale de allí):
export METRICS_TOKEN="$(grep -m1 '^METRICS_TOKEN=' /opt/helpdesk/prod/.env | cut -d= -f2-)"
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://helpdesklite.me/api/health/status | jq
curl -s -H "Authorization: Bearer $METRICS_TOKEN" https://helpdesklite.me/api/version | jq   # commit desplegado
docker inspect helpdesk-api-prod --format '{{.Config.Image}}'    # ghcr.io/.../helpdesk-api-prod:<SHA>
unset METRICS_TOKEN
```

El SHA de la imagen y el `commit` de `/api/version` tienen que ser el último commit
de `main` (`git log -1 origin/main`): es la prueba de que producción corre lo que
pasó el CI.

🖥 Lo mismo en local, **por HTTPS** (con `CURL_CA_BUNDLE` de 1.4; ✅ probado):

```bash
curl -s https://localhost:5173/api/health | jq                       # {"status":"ok", ...}
curl -s https://localhost:5173/api/health/status | jq '{overall, areas}'
curl -s https://localhost:5173/api/health/ready | jq
```

Nunca `http://localhost:5000` delante de quien evalúa (B12).

---

## 3. Preliminares

### 3.1 Team Presence — «Are all team members present?»

Los **cinco**: fcela-ga, nalesso, arhea, elerazo-, israetor. Si falta uno, la
evaluación se detiene ahí. Confirmar asistencia esta noche.

### 3.2 Individual Contributions — cada persona, por separado

La hoja pide a **cada uno**: su rol (PO, PM, Tech Lead, Developer), qué hizo, y al
menos una funcionalidad o módulo que implementó personalmente. Lo que sigue sale del
historial (`git log --no-merges --author=…`); cada persona lo ajusta, se lo aprende
y **lo enseña funcionando**.

| Persona | Qué contar (evidencia en Git) | Lo que demuestra en directo |
|---|---|---|
| **fcela-ga** | Back end entero: modelo Prisma y migraciones, estructura de módulos de la API, autenticación y sesiones, RBAC (`apps/api/src/rbac/policies.ts`), bus de eventos transaccional, capa de Socket.IO, búsqueda, API pública, RGPD, sondas. DevOps: CI/CD, despliegues con puerta, Oracle + Cloudflare, copias y ensayos, Prometheus/Grafana/Loki y alertas. Roles por correo y pantallas de roles, organizaciones, amigos, perfil, sesiones | API pública con `curl`, CI/CD en Actions, Grafana, ensayo de restauración |
| **nalesso** (NatuAls / Nahuel) | Creó el repositorio y la base del monorepo (05–08/08: workspaces, `apps/web` con Vite y React, `apps/api` con Express); el Docker inicial del proyecto (02–05/09: composes, rotación de logs, copias); la infraestructura compartida del front (#53: cliente HTTP con renovación de sesión, estado asíncrono, toasts, i18n, proveedor de tiempo real); **todas las pantallas de tickets contra la API**: alta con validación (07/10), lista paginada en servidor con eventos en tiempo real (09/10), detalle y conversación del ticket (13/10), notas internas y edición de comentarios, búsqueda global conectada a la API (14/10) | Crear un ticket, filtrar y buscar, nota interna que el MEMBER no ve, la lista que se actualiza sola en otra ventana |
| **arhea** (Aren; en Git, `arielrhea`) | *Product Owner* en el README (#95): concepto del producto, prototipos y flujos en Penpot. Configuró el monorepo (10–13/08: ESLint, Prettier, paquetes `contracts` y `ui`, plantilla de PR, versiones de Node y npm); la base de la interfaz (04/09); el **design system con Tailwind v4** y la migración de todas las vistas (27/09); el comportamiento responsive (28/09–01/10); la experiencia de búsqueda y filtros (M14) | `packages/ui` y sus componentes, `@theme` con los tokens, la app en móvil, los filtros de tickets |
| **elerazo-** (Elizabeth) | La primera pantalla de login y su conexión con la API (21/08), el Makefile, el **módulo de chat en tiempo real** y su integración con WebSocket (16/09) y la interfaz del chat integrada con el tiempo real (14/10) | Chat entre dos navegadores |
| **israetor** (Israel) | Esquema Prisma inicial y arranque con migraciones (19–26/08), Node fijado a 24.19.0 en las imágenes, flujo login/registro y proxy de Vite; **cambio de contraseña** (09/10), **motor de tema claro/oscuro/sistema** y preferencias con autoguardado (13/10), **i18n** de acceso, cuenta y errores de la API en/es/ca, autocompletado seguro y «ver contraseña», pruebas de seguridad, accesibilidad y rate limit de los formularios de acceso (14/10). Revisó y fusionó la mayoría de PR | Cambiar idioma y tema, cambiar la contraseña, validación de los formularios de acceso |

Comandos para enseñarlo:

```bash
git log --no-merges --author="NatuAls\|Nahuel" --format='%h %ad %s' --date=short | head -25
git log --no-merges --author="Israel\|EsteNoEsIsra" --format='%h %ad %s' --date=short | head -25
git log --no-merges --author="Elizabeth" --format='%h %ad %s' --date=short
git log --no-merges --author="arielrhea" --format='%h %ad %s' --date=short
git log --no-merges --author="felipecela\|Felipe" --format='%h %ad %s' --date=short | head -25
```

> ⚠️ Que lo que cada uno dice coincida con el README (B4) y con Git. Si el README
> dice que israetor sólo «fijó la versión de Node y revisó PR», y luego Israel enseña
> el i18n y el tema oscuro, la incoherencia juega en contra aunque el trabajo exista.

### 3.3 README Verification — las ocho secciones

| Lo que pide la hoja | Dónde está en el README | Estado |
|---|---|---|
| Project name and description | `# HelpDesk Lite` + «Description» (línea 12) con *key features* | ✅ |
| Team members with assigned roles (PO, PM, Tech Lead, Developers) | «Team Information» (163), «Required project roles» (168) | ✅ B1 (PR del 16/10): PO arhea; PM elerazo-; Tech Lead fcela-ga, nalesso e israetor; Developers, los cinco |
| Project management approach | «Project Management» (185): ramas y PR revisadas, Trello, Notion, WhatsApp/Discord/Slack, reuniones con actas, auditorías | ✅ |
| Technologies used with justifications | «Technical Stack» (207): tabla capa · elección · porqué | ✅ |
| Database schema | «Database Schema» (500): diagrama Mermaid, campos clave, cascadas | ✅ |
| List of features and who implemented them | «Features List» (790) | ⚠️ B4: revisar autores |
| Chosen modules with justifications and point calculation | «Modules» (819): **14 filas, total 23** (nuevo: *Advanced search*, M14); justificación del módulo de libre elección en «Why this is claimed as a Module of Choice (Major)» (328) | ✅ |
| Individual contributions of each member | «Individual Contributions» (846) | ⚠️ B4: quedan dos borradores (Elizabeth e Israel) |

Además, del enunciado (cap. VI): primera línea en cursiva con los logins (B2 ✅),
«Instructions» con requisitos y pasos (B5 ✅ en la PR del 16/10), «Resources» con
referencias y uso de IA (B3 ❌: faltan Elizabeth e Israel), y README en inglés ✅.

### 3.4 Project Coherence — dos personas distintas

Guion común (que lo sepan contar al menos israetor y arhea, no sólo fcela-ga):

1. **Qué es.** Un *help desk* multiorganización: una organización da de alta a su
   gente, las personas MEMBER abren tickets, los AGENT los clasifican, asignan,
   comentan (también con notas internas) y resuelven; todo queda en un historial
   que no se puede reescribir. Además chat 1 a 1, amistades con presencia en vivo,
   API pública para integraciones y derechos RGPD.
2. **Con qué y por qué.** React 19 + Vite + Tailwind 4 en el front; Express 5 en el
   back; los dos en TypeScript y **validados con los mismos esquemas Zod**
   (`packages/contracts`), así que front y back no pueden discrepar sobre qué es un
   dato válido. PostgreSQL porque el dominio es relacional (organización →
   miembros → tickets → comentarios) y se apoya en restricciones y cascadas; Prisma
   para consultas tipadas y migraciones versionadas; Redis para sesiones, rate limit
   y Socket.IO; Docker Compose; Oracle Cloud ARM gratuito detrás de Cloudflare.
3. **Cómo se coordinó.** Trabajo por áreas (infraestructura y API por un lado,
   interfaz por otro), ramas `backend`/`frontend`/`dev-ops` → PR revisadas →
   `develop` (staging) → `main` (producción, con aprobación de otra persona),
   Trello y Notion, reuniones con actas y auditorías periódicas del estado.

### 3.5 Git History

```bash
git shortlog -sn --no-merges --all              # commits por persona
git log --oneline --graph --decorate -30        # ramas y fusiones
git log --merges --format='%h %ad %an %s' --date=short | head -20   # PR fusionadas, quién fusiona
```

Qué señalar:

- Commits de **las cinco** personas, con mensajes convencionales (`feat(tickets): …`,
  `fix(api): …`, `test(web): …`).
- Las fusiones de PR las hacen personas distintas (Felipe, Elizabeth, Nahuel, Israel):
  🐙 pestaña *Pull requests* → *Closed* del repositorio del equipo, con revisiones.
- Cada persona aparece con 2–3 identidades (nombre de GitHub, nombre real, correo de
  la 42). Explicarlo, o unificarlo con un `.mailmap` en la raíz (R6):

```text
Felipe Cela Garcés <118649951+felipecela@users.noreply.github.com>
Nahuel Alesso <nahuelalesso19@gmail.com> NatuAls <nahuelalesso19@gmail.com>
Nahuel Alesso <nahuelalesso19@gmail.com> <105528674+NatuAls@users.noreply.github.com>
Nahuel Alesso <nahuelalesso19@gmail.com> <nalesso@car8s3.42barcelona.com>
Israel Torrico Castro <israeltf1219@gmail.com> Israel <israeltf1219@gmail.com>
Israel Torrico Castro <israeltf1219@gmail.com> <39791748+EsteNoEsIsra@users.noreply.github.com>
Israel Torrico Castro <israeltf1219@gmail.com> <israetor@car7s2.42barcelona.com>
Elizabeth Erazo <elizabethnayeli818@gmail.com> <elerazo-@car8s1.42barcelona.com>
Elizabeth Erazo <elizabethnayeli818@gmail.com> <elerazo-@car7s3.42barcelona.com>
arielrhea <arielrhea@hotmail.com> <135766576+arielrhea@users.noreply.github.com>
```

> ⚠️ El volumen de commits de fcela-ga es mayor. El argumento honesto: el reparto fue
> por áreas, y DevOps + API son muchos ficheros pequeños; el front se concentra en
> menos commits más grandes (la migración a Tailwind de Aren son pocos commits que
> tocan todas las vistas). La hoja pide «not just one person committing everyone's
> work», y cada persona tiene commits propios en su área.

---

## 4. Requisitos generales

### 4.1 Architecture Components — frontend, backend, base de datos

Cada componente lo explica una persona distinta:

| Componente | Dónde | Quién | Qué enseñar |
|---|---|---|---|
| Frontend | `apps/web` (React 19, Vite, router propio en `app/routes.ts`, `features/*`), `packages/ui` | arhea o nalesso | La app en https://localhost:5173 y el árbol de `apps/web/src` |
| Backend | `apps/api` (Express 5): `src/modules/*` (auth, tickets, organizations, chat, realtime, public-api, gdpr, health…), `src/rbac`, `src/common/middleware` | fcela-ga | `curl -s https://localhost:5173/api/health/ready \| jq` y la estructura de un módulo (router → servicio → Prisma) |
| Base de datos | PostgreSQL 15, `apps/api/prisma/schema.prisma`, `prisma/migrations` (4) | israetor (hizo el primer esquema) o fcela-ga | `\dt` en psql (2.2) |
| Compartido | `packages/contracts` (esquemas Zod que validan el front y la API) | nalesso | `packages/contracts/src/tickets.ts` usado en `CreateTicketPage.tsx` y en el router de tickets |

```bash
docker compose -p helpdesk-dev -f compose.dev.yml ps
ls apps/api/src/modules apps/web/src/features packages/ui/src packages/contracts/src
```

### 4.2 Deployment — «a single command»

- **Demostración:** sección 1 entera desde el clon vacío: `make` y la aplicación
  accesible en **https://localhost:5173**, con candado (1.9), y los cinco servicios
  en pie.
- **Argumento:** un comando, sin intervención manual: los secretos se generan, el
  certificado HTTPS local se emite, las imágenes se construyen, las migraciones se
  aplican en el arranque de la API y el primer administrador se crea solo. Lo único
  manual es confiar en la autoridad local la primera vez en esa máquina, que es una
  decisión del navegador, no del despliegue.
- **Y en servidor:** producción tampoco se arranca a mano: un *merge* a `main` la
  despliega (🐙 Actions → *Deploy Production*), y `make deploy-prod` hace lo mismo
  sin Actions. Enseñar el último despliegue en verde y sus pasos (copia previa,
  smoke test).

### 4.3 Browser Compatibility — consola de Chrome sin errores ni avisos

**Dónde:** en local (https://localhost:5173) y en producción (https://helpdesklite.me).
En local, Vite y React en modo desarrollo escriben mensajes propios (`[vite]
connected`, la sugerencia de instalar React DevTools): son `debug`/`info`, no avisos, y
con *Default levels* no se ven.

1. Chrome estable, ventana de incógnito (sin extensiones), F12 → *Console* → niveles
   *Default levels* + marcar *Preserve log*.
2. Recargar la página de acceso. Entrar con una cuenta. Navegar: Tickets → un ticket
   → People → un perfil → Messages → Account → Organization → los pies Privacy y Terms.
   Recargar un par de veces por el camino.
3. La consola tiene que seguir vacía. Mirar también la pestaña *Issues*.

Argumentos:

- Commit `9892fb5` («a quiet console on load: zod's eval probe, unnamed fields,
  i18next»): se quitaron los avisos de Zod, los campos de formulario sin `name`/`id` y
  el aviso de i18next. `apps/web/test/console-warnings.test.ts` impide que vuelvan.
- **Los dos `POST /auth/refresh 401` al recargar** (aparecieron el 15/10; arreglados en
  la PR #97). No eran «no hay sesión», y había tres causas encadenadas:
  1. La web renovaba la sesión **en cada cambio de pantalla** (el efecto que la
     restaura dependía de la ruta): una rotación de la cookie por navegación.
  2. Una renovación cortada a medias (una recarga justo entonces) dejaba al navegador
     con un token que la API ya había sustituido; al volver, la API lo tomaba por un
     robo, revocaba toda la familia de sesiones y echaba a la persona.
  3. La renovación rechazada no borraba la cookie indicativa `hd_session`, así que
     cada recarga volvía a preguntar, y pintaba otro 401 (dos, por la redirección al
     inicio de sesión).

  Ahora la sesión se restaura al abrir la aplicación y no en cada pantalla; una
  respuesta perdida tiene **30 s** de margen, y sólo si el sustituto no se ha usado
  nunca; y un 401/403 de `/auth/refresh` borra las dos cookies. Comprobado en Chrome
  sin interfaz, antes → después: cuatro navegaciones, cuatro renovaciones → ninguna;
  una recarga con sesión, dos → una; una sesión cerrada desde otro sitio, dos 401 y
  otro más en cada recarga → **uno**, la primera vez; una respuesta perdida, sesión
  cerrada → sesión intacta. Pruebas: `apps/web/test/session-restore.test.tsx` y
  `apps/api/test/integration/auth.test.ts`.
- **Dos errores más, vistos en staging y producción el 15/10 por la noche** (PR
  #101; hasta que se fusione y se despliegue, siguen saliendo allí):
  - `GET /admin/audit-logs 401`: el *access token* dura 15 minutos y el cliente lo
    mandaba hasta que la API lo rechazaba; luego renovaba y repetía. La pantalla
    se recuperaba sola, pero Chrome ya había anotado el 401. Ahora renueva
    **antes** de mandar un token que caduca en menos de 30 s (la misma regla que ya
    seguía el socket).
  - Un cambio de rol no llegaba a la pantalla: la aplicación releía la sesión al
    entrar o salir de una organización, pero no con `member.updated`, y seguía con
    el rol anterior (botones que la API rechaza y, en la organización, las
    estadísticas pedidas cada minuto con nuestro `403 RBAC_FORBIDDEN`). Ahora
    relee la sesión cuando el cambio es suyo.
- **Los 403 de staging no son de la aplicación** (comprobado el 16/10). Staging
  está detrás de un **desafío de Cloudflare**: cuando caduca la autorización del
  navegador (el *Challenge Passage* de Cloudflare), cada llamada a la API y el
  WebSocket reciben el `403` de Cloudflare (`cf-mitigated: challenge`, su página
  «Just a moment…») hasta que se recarga la página. Es el `GET …/stats 403` con
  «Unexpected error» y la ristra de «WebSocket connection … failed: … 403» del
  15/10 por la noche, con el administrador de plataforma, al que la API nunca le
  niega las estadísticas (comprobado: `200`; un MEMBER recibe nuestro `403
  RBAC_FORBIDDEN`, con su sobre, y la pantalla lo traduce como falta de permiso).
  En el registro de Cloudflare salen como «Mitigated by Cloudflare». Producción no
  tiene desafío: su API contesta nuestro JSON y su socket sube con `101`.
  Arreglo, en el panel de Cloudflare: alargar el *Challenge Passage* (Security →
  Settings) para que un desafío resuelto dure toda la jornada, o añadir las IP del
  equipo como excepción en la regla de staging; paso a paso, y las demás opciones,
  en el **Anexo D.1**. Y la demostración, en producción o en local, no en staging.

> ⚠️ **Cloudflare** puede añadir, en una muestra de las respuestas, una CSP
> *report-only* para su inventario de scripts (lo explica la cabecera de
> `console-warnings.test.ts`). Si en producción aparece un aviso «[Report Only]…», es
> de Cloudflare, no del código, y no bloquea nada. **Salió el 15/10 en staging**:
> «*Loading the script … violates … script-src 'unsafe-inline' 'unsafe-eval'*» y una
> línea «*Connecting to … violates … connect-src 'none'*» por cada petición, todas
> *report-only*. Es el monitor de scripts y de conexiones de Cloudflare
> (*Page Shield / Client-side security*), que añade su propia CSP de sólo informe a
> una muestra de las respuestas; nuestra CSP (`script-src 'self'`…) va aparte.
> Desactivarlo en el panel de Cloudflare antes de la defensa (una sola zona,
> `helpdesklite.me`, para producción y staging; paso a paso en el **Anexo D.2**), o
> explicarlo así.

> ⚠️ **Los 4xx que provoque la prueba de validación aparecen en rojo en la consola**
> («POST …/auth/login 401»). Chrome registra así cualquier respuesta HTTP de error: no
> son errores de JavaScript (el enunciado dice «No warnings or errors about the
> **Javascript code**»), y el 401 es la respuesta correcta: la **misma** para un correo
> inexistente que para una contraseña mala (`AUTH_INVALID_CREDENTIALS`, con el mismo
> tiempo de cálculo del hash gracias a `fakeVerifyPassword`), que es lo que impide
> averiguar qué correos están registrados. No se puede quitar sin mentir en el código
> de estado. La traza que acompaña (`auth.ts:207`, `SignInPage.tsx:57`) sólo existe en
> desarrollo: producción no publica *source maps*. Por eso: primero la consola limpia
> con un recorrido correcto; después, en otro momento, las pruebas con datos inválidos.
>
> Lo mismo con una sesión cerrada desde otro sitio («cerrar todas las sesiones», un
> cambio de contraseña): la siguiente carga del otro navegador deja **un** 401, porque
> la API tiene que decir que no una vez. Si se enseña M7 («cerrar la sesión del otro
> dispositivo»), hacerlo después del recorrido de la consola.

### 4.4 Privacy Policy y Terms of Service

| Qué | Dónde |
|---|---|
| Enlaces en el **pie de todas las pantallas** con sesión | `apps/web/src/layout/AppFooter.tsx`, usado en `AppShell.tsx` |
| También en acceso, registro, pantallas de cuenta suspendida / sin organización y en la página de estado | `SessionStatePage.tsx` (`LegalLinks`), `public/status.html` |
| Las páginas | `#privacy-policy` y `#terms` (`features/legal/LegalPage.tsx`) |
| Prueba | `apps/web/test/legal-footer.test.tsx` (pie en todas las pantallas, vuelta a la pantalla de origen, enlaces en `/status`) |

Demostración: desde cualquier pantalla, clic en *Privacy* en el pie → leer en voz
alta dos apartados → «Back» devuelve a la pantalla de origen. Lo mismo con *Terms*.
Después, sin sesión, los mismos enlaces en la pantalla de acceso.

Argumento de contenido: está escrito sobre lo que la aplicación **de verdad**
guarda y hace: qué datos se tratan, una sola cookie estrictamente necesaria
(`hd_refresh`, HttpOnly, Secure, SameSite) más una cookie indicativa sin token, sin
analítica ni publicidad; quién aloja (Oracle, Cloudflare); plazos de conservación
concretos (sesiones 7 días, logs 30 días, copias cifradas 14 días, borrado a los 30
días de un cierre administrativo); los derechos y **cómo ejercerlos** (Account →
Privacy & data, doble confirmación del borrado); sesiones revocables, que es lo que
prometen los Términos y enseña `#account/sessions`. No son plantillas. Y están en
los tres idiomas de la aplicación (en/es/ca): cambiar el idioma en *Preferences* y
volver a abrirlas.

---

## 5. Requisitos técnicos

### 5.1 Frontend Responsiveness — dos tamaños como mínimo

1. 🌐 DevTools → *Toggle device toolbar* (Ctrl+Shift+M) → *iPhone 12 Pro* (390 px) y
   *iPad Air* (820 px); y escritorio a pantalla completa.
2. En móvil (por debajo de 1100 px): barra de navegación fija abajo, menús, lista de tickets en tarjetas, filtros
   en hoja (`TicketFilterSheet.tsx`), detalle de ticket, chat (lista ↔ conversación),
   formularios.
3. Girar a horizontal. Sin scroll horizontal en ninguna pantalla.

Argumento (arhea): diseño *mobile-first* con los *breakpoints* de Tailwind
(`sm:`, `md:`, `lg:`); commits «correct ticket layouts on small screens», «close
messages breakpoint gap» (28/09–01/10). Accesibilidad básica: foco visible,
`aria-*`, `prefers-reduced-motion`, diálogos con trampa de foco.

### 5.2 Styling Solution — Tailwind CSS 4

```bash
find apps/web/src -name '*.css'                         # un único fichero: styles/global.css
sed -n 1,40p apps/web/src/styles/global.css             # @import "tailwindcss" y @theme con los tokens
grep -n "tailwindcss" apps/web/vite.config.ts           # plugin @tailwindcss/vite
sed -n 1,40p packages/ui/src/Button.tsx                 # variantes con clases de utilidad y tokens
```

Argumento: Tailwind v4 con **tokens semánticos** en `@theme` (canvas, surface,
border, ink, muted, primary y los cuatro colores de estado), una escala tipográfica
y radios comunes; los componentes de `packages/ui` sólo usan esos tokens, así que el
tema oscuro de Israel es redefinir tokens, no reescribir pantallas.

### 5.3 Environment Variables — credenciales

```bash
git check-ignore -v .env .env-observabilidad        # ignorados por .gitignore
git ls-files | grep -iE '(^|/)\.env'                # sólo .env.example y .env-observabilidad.example (con #98 fusionada; B11)
cat .env.example | head -40                         # nombres y valores de ejemplo, ningún secreto real
git ls-files | grep -iE '\.(key|pem|crt)$|htpasswd|rclone\.conf|metrics_token$'   # vacío
git check-ignore -v config/local-tls/localhost.key   # el certificado local, ignorado (su autoridad ni siquiera está en el repo)
make ci JOBS=security                               # gitleaks sobre los commits, npm audit, Trivy
```

Argumentos:
- Los secretos **no existen** en el repositorio: en local los genera
  `gen-secrets.sh`; en el servidor los escribe el despliegue desde los *secrets* de
  GitHub Actions en un `.env` 600 y se montan en sólo lectura.
- El CI pasa **gitleaks** en cada PR (`security`). Si alguien sube un secreto, el CI
  se pone en rojo.
- **Si preguntan por el historial** (sale en `.gitleaksignore`): hubo dos incidentes
  y están documentados en ese fichero. (1) Unos secretos JWT **de desarrollo**
  acabaron en una transcripción de sesión commiteada en agosto/septiembre; se
  **rotaron** (`scripts/ci/rotate-secrets.sh`), `mod/` y `fix/` se ignoraron y las
  huellas se reconocen en `.gitleaksignore` sólo para esos commits. (2) Un
  certificado autofirmado `CN=localhost` de la arquitectura antigua, sin valor fuera
  de esa máquina. Ninguno abre nada que exista hoy. Contarlo con naturalidad: es un
  ejemplo de detección y respuesta, no algo que esconder.
- **`apps/api/.env_api`** (B11, PR #98 a `develop`): fichero del 19/08 con cinco
  claves de marcador (`change_me`/`mi_usuario`), sin uso (`git grep env_api` no
  encuentra ninguna referencia). Borrado, y `.env_*` añadido al `.gitignore` para que
  no vuelva. Si se pregunta por el historial: sigue ahí, pero son marcadores; no hay
  nada que rotar.
- **El HTTPS local no añade secretos al repositorio:** la clave de la autoridad local
  vive en `~/.local/share/helpdesk-lite/local-ca` (600) y el certificado de localhost
  en `config/local-tls/`, ignorado.

### 5.4 Database Design — esquema y relaciones

1. README → «Database Schema»: el diagrama Mermaid (GitHub lo pinta).
2. `apps/api/prisma/schema.prisma`: 22 modelos con `@relation`, `onDelete: Cascade`
   o `SetNull`, índices y únicos compuestos (`@@unique([organizationId, reference])`,
   `@@unique([organizationId, userId])`).
3. En la base real: `\dt`, `\d tickets` y `\d organization_members` (anexo A.1–A.2).

Puntos a explicar: UUID v7 (ordenables en el tiempo), `citext` en correo y usuario
(únicos sin distinguir mayúsculas), roles como `enum`, `ticket_history` sólo de
escritura, borrado de una organización en cascada (miembros, categorías, tickets,
comentarios, adjuntos) y referencias a asignado o categoría a `NULL`.
Numeración de tickets por organización con un contador que se incrementa de forma
atómica dentro de la transacción (`tickets.service.ts`: `ticketSeq: { increment: 1 }`):
dos altas simultáneas no pueden obtener la misma referencia.

### 5.5 Authentication Security — hash y sal

Código: `apps/api/src/modules/auth/password.ts`.

- **Argon2id** (parámetros de OWASP: 19 MiB, t=2, p=1). La **sal es aleatoria por
  contraseña** y la genera argon2; va dentro del propio hash.
- Además un **pepper**: HMAC-SHA256 con `PASSWORD_PEPPER` (del `.env`) antes de
  hashear. Robar la base sin el `.env` no basta para un ataque fuera de línea.
- `fakeVerifyPassword()`: si el correo no existe se gasta el mismo tiempo, para no
  revelar qué cuentas existen.
- Bloqueo progresivo tras 5 fallos (1, 2, 5, 15 min) y límites de peticiones.
- Sesión: *access token* JWT de 15 min + *refresh* opaco en cookie **HttpOnly**,
  `SameSite=Strict`, que rota en cada uso; si se reutiliza uno viejo se revoca toda
  la familia (`user_sessions.familyId`, `replacedById`). Con una excepción (PR #97):
  una respuesta que nunca llegó al navegador. En los 30 s siguientes a una rotación, y
  sólo si el sustituto no se ha usado nunca, el token anterior recibe un par nuevo y
  el sustituto perdido se anula; si ese sustituto aparece después, alguien lo tenía, y
  cae la familia entera. Una renovación rechazada (401/403) borra también las cookies.
  Pruebas en `test/integration/auth.test.ts` (el robo, la respuesta perdida, pasado
  el margen y las cookies).
- Lo que no se puede leer no existe: a quien pregunta por un ticket, comentario o
  adjunto que no puede ver, la API le contesta exactamente lo mismo que por un
  identificador inventado (404 con el mismo `code`, `messageKey` y `message`), igual
  que con las organizaciones (M8).

Demostración en la base (anexo A.3):

```sql
SELECT username, left("passwordHash", 45) AS hash FROM users ORDER BY "createdAt";
--  $argon2id$v=19$m=19456,p=1,t=2$<SAL distinta en cada fila>$<hash>
```

Para que se vea la sal: registrar en la web dos cuentas con **la misma contraseña** y
repetir la consulta: los dos hashes son distintos.

### 5.6 Form Validation — front **y** back

Argumento central: el front y la API validan con **los mismos objetos Zod**
(`packages/contracts`). En el front, `RegisterPage.tsx` y `CreateTicketPage.tsx`
hacen `registerSchema.safeParse(...)` / `createTicketSchema.safeParse(...)`; en la
API, `validate(schema)` (`apps/api/src/common/middleware/validate.ts`) aplica el
mismo esquema y responde `400 VALIDATION_FAILED` con `details` por campo.

**Pruebas en el navegador (front):**

| Formulario | Entrada | Resultado esperado |
|---|---|---|
| Registro | campos vacíos | el navegador y el formulario marcan los campos obligatorios |
| Registro | correo `hola@` | lo para el navegador (`type="email"`) o el esquema compartido, sin llamar a la API |
| Registro | contraseña `abc` / `abcdefghij` | reglas: 10+, mayúscula, minúscula, dígito, símbolo (en vivo) |
| Registro | contraseñas distintas | «no coinciden» |
| Registro | usuario `a b!` | caracteres no válidos (sólo `a-z 0-9 _ -`, 3–32) |
| Nuevo ticket | título de 2 letras | mínimo 5 caracteres |
| Ticket | resolver sin texto de resolución | exige ≥ 20 caracteres |

**Pruebas saltándose el front (back)**, con `curl` o desde Swagger
(*Try it out*). Siempre **por HTTPS**: contra producción, o contra el local por el
proxy de Vite (con `CURL_CA_BUNDLE` de 1.4). Nunca `http://localhost:5000` (B12). ✅
Todo el bloque, probado en local el 15/10 por la tarde:

```bash
A=https://helpdesklite.me/api/v1          # producción
# A=https://localhost:5173/api/v1         # local, por HTTPS
# Correo y contraseña inválidos → 400 con details por campo
curl -s -X POST $A/auth/register -H 'content-type: application/json' \
  -d '{"email":"hola@","username":"a b","password":"abc","confirmPassword":"x","firstName":"","lastName":"","acceptTerms":false}' | jq
# Inyección SQL en el login → 400 (no es un correo); nunca llega a la base
curl -s -X POST $A/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"' OR 1=1 --\",\"password\":\"x\"}" | jq '{statusCode, code, details}'
# Identificador que no es UUID → 400 INVALID_IDENTIFIER
curl -s "$A/tickets/1%20OR%201=1" -H "authorization: Bearer $TOKEN" | jq '{statusCode, code}'
# Cuerpo de más de 1 MB → 413 PAYLOAD_TOO_LARGE
head -c 1200000 /dev/zero | tr '\0' a | jq -Rs '{title:"x", description: .}' \
  | curl -s -X POST $A/tickets -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d @- | jq '{statusCode, code}'
```

`$TOKEN` se saca así, sin que la contraseña aparezca en pantalla ni en el historial:

```bash
# En producción: la cuenta demo de producción; la contraseña se teclea a ciegas
read -rsp 'Contraseña de demo-laura: ' P; echo
TOKEN=$(jq -nc --arg e demo-laura@helpdesklite.me --arg p "$P" '{email:$e,password:$p}' \
  | curl -s -X POST $A/auth/login -H 'content-type: application/json' -d @- | jq -r .accessToken); unset P
# En local, la del fichero de la siembra:
# P="$(awk '/demo-laura@/{print $NF; exit}' ../seed.txt)"
```

**SQL injection:** todas las consultas pasan por Prisma (parametrizadas); las dos
consultas a mano usan `Prisma.sql` con parámetros (`search.service.ts`) o `$1`
(`organizations.service.ts`). En la búsqueda de tickets, `q='; DROP TABLE tickets; --`
devuelve 0 resultados y la tabla sigue ahí (✅ probado).

**XSS:** crear un ticket con título `<img src=x onerror=alert(1)>` y descripción
`<script>alert('xss')</script>`. Se guarda tal cual (✅ comprobado en la base) y la
interfaz lo **pinta como texto**: React escapa todo lo que interpola y no hay
ningún `dangerouslySetInnerHTML` en el proyecto (`grep -rn dangerouslySetInnerHTML
apps/web/src packages/ui` vacío). En producción, además, la CSP de nginx
(`security-headers.inc`) prohíbe scripts en línea (`script-src 'self'`).

**Ficheros:** el tipo se decide por los *magic bytes*, no por la extensión: un
script renombrado a `.pdf` → `415 FILE_TYPE_NOT_ALLOWED`; los avatares se recodifican
a WebP sin EXIF.

### 5.7 Secure Connections — HTTPS

La hoja: «*Verify the connection is secure (check browser address bar). All
communication between frontend and backend must be encrypted using HTTPS.*» El
enunciado (III.3) va más lejos: «*Any connection to the backend, from a browser, from a
script, from an external API, etc., must use HTTPS. Connections inside the backend
itself (e.g., web server and database, software inside your container(s)) can be
without encryption.*»

**Demostración en local** (B10, PR #97), justo después del despliegue de 4.2:

1. 🌐 https://localhost:5173 → candado → «La conexión es segura» → el certificado:
   `CN=localhost`, emitido por «HelpDesk Lite local CA (…)».
2. DevTools → *Network*: las llamadas van a `https://localhost:5173/api/v1/…`; con el
   filtro *WS*, el socket va por `wss://localhost:5173/socket.io/…`.
3. 🖥 El `openssl s_client` de 1.9 (`Verify return code: 0 (ok)`) y las *name
   constraints* de la autoridad.
4. 🖥 Las pruebas con `curl` de 5.6 y M5, por `https://localhost:5173`.

**Argumento del local:** el navegador, y cualquier script de la demostración, sólo habla
con Vite, por HTTPS, con un certificado de una autoridad local en la que confía; Vite
reenvía `/api` y `/socket.io` a la API por la red interna de Docker, que es el
«*inside the backend*» que el enunciado permite sin cifrar. No es un certificado
autofirmado que se acepta a ciegas: la autoridad es una por máquina, vive fuera del
repositorio y sólo puede firmar para localhost, así que su clave no serviría para
suplantar ningún otro sitio.

**Demostración en producción:**

1. 🌐 https://helpdesklite.me → candado → «La conexión es segura» → certificado válido.
2. `curl -sI http://helpdesklite.me | head -3` → redirección a `https://`.
3. DevTools → *Network* → filtro *WS*: el socket va por `wss://helpdesklite.me/socket.io/…`.
4. `curl -sI https://helpdesklite.me | grep -iE 'strict-transport|content-security|x-frame'`:
   cabeceras de seguridad (CSP con `upgrade-insecure-requests`).

**Argumento de producción:** navegador → Cloudflare con TLS; Cloudflare → origen con
TLS (certificado Let's Encrypt en Nginx Proxy Manager, `scripts/ops/npm-tls.py`),
**si Cloudflare está en Full (strict)** (B9). El origen sólo acepta conexiones de los
rangos de Cloudflare (VCN + `DOCKER-USER`). Dentro del servidor (nginx → API → base de
datos, Redis) va sin cifrar, que el enunciado permite expresamente.

> ⚠️ **Lo que todavía habla por HTTP en local (B12).** `dev_api` publica el 5000
> (`'5000:5000'` en `compose.dev.yml`, en todas las interfaces) y allí la API contesta
> por HTTP; `make seed-dev` y `make reset-dev` lo usan. Delante de quien evalúa:
>
> - nunca `curl http://localhost:5000/…`, ni Swagger en el 5000: todo por
>   `https://localhost:5173`, como ya hace esta guía;
> - la siembra, por HTTPS o desde dentro del contenedor (1.5);
> - si preguntan por el 5000 (`docker compose ps` lo enseña): es el puerto de la API
>   en la red de Docker, publicado para las herramientas de desarrollo; nada de la
>   aplicación lo usa, y el navegador y los scripts de la demostración entran por el
>   5173 por HTTPS. Es el punto débil del argumento: la opción **b** de B12 lo cierra en
>   código (dejar de publicarlo, o sólo en `127.0.0.1`, y llevar `seed-dev` y
>   `reset-dev` a HTTPS).
> - **Mailpit** (http://localhost:8025, y por túnel en el servidor) hace de buzón de
>   correo de las personas: no es el backend de la aplicación, y la aplicación no
>   habla con él desde el navegador. En un despliegue real sería el proveedor de
>   correo de cada cual.

---

## 6. Módulos

### 6.0 Cuenta de puntos (lo que se lee en el README)

| # | Módulo | Tipo | Pts | Dueño en el README | Presenta |
|---|---|---|---|---|---|
| M1 | Framework en front y back (React + Express) | Mayor | 2 | arhea (front) · fcela-ga (back) | arhea + fcela-ga |
| M2 | ORM (Prisma) | Menor | 1 | fcela-ga | fcela-ga (o israetor) |
| M3 | Tiempo real con WebSockets | Mayor | 2 | fcela-ga · elerazo- · nalesso | nalesso + elerazo- |
| M4 | Interacción entre usuarios (chat, perfil, amigos) | Mayor | 2 | elerazo- · fcela-ga | elerazo- |
| M5 | API pública con clave, rate limit y documentación | Mayor | 2 | fcela-ga | fcela-ga |
| M6 | Design system propio (≥ 10 componentes) | Menor | 1 | arhea | arhea |
| M7 | Gestión estándar de usuarios y autenticación | Mayor | 2 | fcela-ga · arhea | israetor o arhea + fcela-ga |
| M8 | Sistema de permisos avanzado | Mayor | 2 | fcela-ga · arhea | fcela-ga |
| M9 | Sistema de organizaciones | Mayor | 2 | fcela-ga · arhea | fcela-ga + arhea |
| M10 | RGPD | Menor | 1 | fcela-ga | fcela-ga |
| M11 | Monitorización con Prometheus y Grafana | Mayor | 2 | fcela-ga | fcela-ga |
| M12 | Health check, página de estado, copias y recuperación | Menor | 1 | fcela-ga · nalesso | fcela-ga + nalesso |
| M13 | **Libre elección (Mayor):** CI/CD con pruebas y despliegue automáticos | Mayor | 2 | fcela-ga | fcela-ga + nalesso |
| M14 | **Búsqueda avanzada** con filtros, ordenación y paginación (nuevo en el README, #95) | Menor | 1 | arhea · nalesso · fcela-ga | arhea + nalesso |
| | **Total** | 9 mayores + 5 menores | **23** | | |

**9 mayores (18) + 5 menores (5) = 23.** Mayores: M1, M3, M4, M5, M7, M8, M9, M11,
M13. Menores: M2, M6, M10, M12, M14. El README los lista en otro orden (empieza por el
design system); los números de esta guía son sólo para ella.

- Mínimo para aprobar: **14**. Bonus: lo que pasa de 14, **máximo 5** → techo útil 19.
- Margen: se pueden perder hasta **4 puntos** (dos mayores, o un mayor y dos menores…)
  sin bajar del máximo. Por eso el orden de la demostración importa: primero los más
  sólidos.
- El bonus **sólo cuenta si toda la parte obligatoria está perfecta** (secciones 3–5 y
  la gestión de errores). Un fallo en *Privacy Policy* o en *Environment Variables*
  no sólo cuesta el punto: anula el bonus.
- Dependencias del enunciado: ninguno de los 14 depende de un juego; el chat avanzado
  no se reclama; «Advanced permissions», «Organization system» y «Advanced search» no
  tienen dependencias. ✅

Orden recomendado de demostración (de más a menos sólido): M5 API pública → M13 CI/CD
→ M11 Prometheus/Grafana → M8 permisos → M9 organizaciones → M14 búsqueda → M7
usuarios → M4 interacción → M3 tiempo real → M10 RGPD → M12 health/copias → M1 → M2 →
M6.

> No reclamar en la defensa nada que no esté en la tabla del README. Lo que hay de
> más (idiomas en/es/ca, tema oscuro, notificaciones, adjuntos) suma en «Overall
> Quality», no como módulo. Los idiomas podrían optar al módulo menor de «*multiple
> languages*» (tres idiomas, selector en *Preferences*, páginas legales ya
> traducidas), pero el enunciado pide además traducciones **completas** y que **todo**
> el texto sea traducible, y eso no se ha revisado pantalla por pantalla. No está en
> el README y con 23 reclamados no hace falta.

---

### M1 — Framework en front y back (Mayor, 2)

**Pide el enunciado:** framework de front (React, Vue…) y de back (Express, NestJS…).

**Demostrar:**
```bash
grep -E '"(react|react-dom|vite)"' apps/web/package.json
grep -E '"express"' apps/api/package.json
sed -n 1,60p apps/api/src/app.ts          # helmet, cors, cookie-parser, rate limit, routers, error handler
sed -n 1,60p apps/web/src/app/routes.ts   # rutas de la SPA
```
**Argumento:** React 19 + Vite 8 (el enunciado considera React un framework);
Express 5 con *middlewares* propios (autenticación, `orgScope`, política RBAC,
validación, métricas, errores). Lo que los une: los contratos Zod compartidos y los
tipos de punta a punta.

**Si preguntan** «¿por qué no Next.js/NestJS?»: SPA servida como estáticos (nginx,
CSP estricta, sin servidor de render que proteger) y una API pequeña y explícita
donde cada *middleware* se ve; NestJS añadía decoradores e inyección de
dependencias que no hacían falta para 111 rutas.

### M2 — ORM (Menor, 1)

**Demostrar:**
```bash
sed -n 120,180p apps/api/prisma/schema.prisma     # modelo User con relaciones
ls apps/api/prisma/migrations                     # 4 migraciones versionadas
docker logs dev_api 2>&1 | grep -i "migration"    # aplicadas en el arranque
grep -n "prisma\.\(ticket\|organization\)\." apps/api/src/modules/tickets/tickets.service.ts | head
```
Y en psql: `SELECT migration_name, finished_at FROM _prisma_migrations;` (A.12).

**Argumento:** Prisma 7 con `@prisma/adapter-pg`; 22 tablas; migraciones versionadas
que se aplican solas en cada arranque y en cada despliegue (con copia previa: la
última foto del esquema anterior); consultas tipadas; dos consultas a mano, y las dos
parametrizadas. En producción la aplicación entra con un rol de **mínimo privilegio**
(`helpdesk_app`, sólo DML) y las migraciones con el propietario (`compose.prod.yml`:
`DATABASE_URL` vs `MIGRATE_DATABASE_URL`).

### M3 — Tiempo real con WebSockets (Mayor, 2)

**Pide:** actualizaciones en tiempo real entre clientes; conexión/desconexión bien
gestionadas; difusión eficiente.

**Demostrar** (dos navegadores: Chrome normal y una ventana de incógnito, o Chrome y
Firefox):

1. A = demo-agent en *Tickets*; B = demo-laura crea un ticket → aparece en la lista de
   A **sin recargar** (evento `ticket.created` a la sala de la organización).
2. A cambia el estado o asigna el ticket → B, con el ticket abierto, lo ve cambiar
   (`ticket.updated` a la sala `ticket:<id>`).
3. *People*: A ve a B «en línea». B cierra su pestaña → a los **60 s** A lo ve «fuera
   de línea» (periodo de gracia: recargar la página no hace parpadear la presencia).
4. Desconexión: en B, DevTools → *Network* → *Offline*; mientras, A crea algo; B vuelve
   a *Online* → el socket reconecta y pide `sync` con lo que cambió mientras estaba
   fuera.
5. Chat (M4) en las dos ventanas.
6. DevTools → *Network* → *WS* → el *frame* de cada evento.

**Evidencia:**
```bash
grep -rn "io\.emit(" apps/api/src            # sólo sale el comentario de socket-server.ts que explica que no hay ninguno
grep -n "io.to(" apps/api/src/modules/realtime/*.ts | head
grep -n "60_000\|'sync'" apps/api/src/modules/realtime/socket-server.ts
```
**Argumento:** Socket.IO con el *handshake* autenticado por el *access token*; salas
por usuario, organización, ticket y conversación, así que cada evento llega sólo a
quien puede verlo (**cero `io.emit()` global**). Los eventos salen de un bus de
dominio **transaccional**: se publican después del *commit*, así que un *rollback*
nunca anuncia un cambio que no ocurrió. Presencia con contador de sockets por
persona (varias pestañas) y gracia de 60 s; `sync` al reconectar. Métrica
`helpdesk_realtime_connections` en Grafana.

### M4 — Interacción entre usuarios (Mayor, 2)

**Pide:** chat básico (enviar y recibir), perfiles (ver información), amigos
(añadir, quitar, ver la lista).

**Demostrar** (con los datos de `seed-defensa.sh`):

1. **Chat** (elerazo-): laura en *Messages* → conversación con marc (ya tiene 3
   mensajes) → escribir; en la ventana de marc llega al instante, con contador de no
   leídos. Iniciar otra conversación nueva desde un perfil (botón de mensaje).
2. **Perfil**: *People* → clic en una persona → `#people-profile?person=demo-marc`:
   presencia o última conexión, biografía, miembro desde, organizaciones y rol en
   cada una, tickets abiertos y atendidos.
3. **Amigos**: laura ve a marc en su lista con «friends since» y presencia; laura
   tiene una **solicitud pendiente** de demo-agent → aceptarla en directo; buscar a
   una persona y enviarle solicitud; **quitar** un amigo (botón «Remove friend» en el
   perfil o en la lista).

**Evidencia en la base:** A.7 (amistades) y A.8 (mensajes).

**Argumento:** chat 1 a 1 persistido (`conversations`, `conversation_members` con
`lastReadAt`, `messages`), en tiempo real por la sala de la conversación; amistades
con solicitudes en los dos sentidos, aceptar, rechazar, retirar y quitar; perfiles
públicos sin exponer el correo de terceros.

### M5 — API pública (Mayor, 2)

**Pide:** API para interactuar con la base, clave segura, rate limiting,
documentación y al menos 5 endpoints con GET, POST, PUT y DELETE.

**Demostrar con `curl`** (✅ todo probado en local por HTTPS el 15/10 por la tarde; la clave la crea
`seed-defensa.sh` o se crea en la interfaz: *Organization → API keys*, el secreto
se enseña **una sola vez**):

```bash
B=https://helpdesklite.me/api/v1/public         # producción
read -rsp 'Clave de la API: ' K; echo           # la creada hoy en producción: Organization → API keys
# En local, por HTTPS (CURL_CA_BUNDLE de 1.4):
# B=https://localhost:5173/api/v1/public; K=$(awk '/^X-API-Key:/{print $2}' ../defensa-api-key.txt)

curl -s $B/me -H "X-API-Key: $K" | jq                                       # organización y scopes de la clave
curl -s "$B/tickets?take=3&status=OPEN" -H "X-API-Key: $K" | jq '.meta, [.data[].reference]'
ID=$(curl -s -X POST $B/tickets -H "X-API-Key: $K" -H 'content-type: application/json' \
  -d '{"title":"Creado desde la API pública","description":"Alta desde una integración externa.","priority":"MEDIUM"}' | jq -r .id)
curl -s -X PUT $B/tickets/$ID -H "X-API-Key: $K" -H 'content-type: application/json' \
  -d '{"title":"Actualizado con PUT","description":"Descripción sustituida entera.","priority":"HIGH"}' | jq '{reference,title,priority}'
curl -s -X POST $B/tickets/$ID/comments -H "X-API-Key: $K" -H 'content-type: application/json' \
  -d '{"body":"Comentario desde la API pública"}' | jq '{id, body}'
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $B/tickets/$ID -H "X-API-Key: $K"   # 204

# Seguridad (FALSA: con la forma de una clave, pero inventada; en una variable,
# como $K, para que el escáner de secretos del CI no la tome por una de verdad)
FALSA=hdl_live_falsa.falsa
curl -s $B/me -H "X-API-Key: $FALSA" | jq '{statusCode, code}'                    # 401 API_KEY_INVALID
curl -s -X POST $B/tickets -H "X-API-Key: $K" -H 'content-type: application/json' \
  -d '{"title":"ab","description":"x"}' | jq '{statusCode, code, details}'            # 400 VALIDATION_FAILED

# Rate limit: 60/min por clave (y 1000/h)
curl -s -D - -o /dev/null $B/me -H "X-API-Key: $K" | grep -i ratelimit
for i in $(seq 1 65); do curl -s -o /dev/null -w '%{http_code}\n' $B/me -H "X-API-Key: $K"; done | sort | uniq -c
#   60 200 · 5 429 si la clave no se ha usado en el último minuto (el 429 lleva Retry-After).
#   Si se acaba de usar, menos 200: el 15/10, tras 8 llamadas en ese minuto, 52 y 13.
#   Las cabeceras RateLimit-* son las de la ventana de una hora (1000).
```

Antes del bucle, recordar que agota la clave durante un minuto. Después, en la web,
el ticket creado por la API aparece en la lista (no es una puerta paralela: llama a
los mismos servicios, con el mismo RBAC y la misma máquina de estados).

**Documentación:** https://localhost:5173/api/v1/docs (local, abierta) — en
producción https://helpdesklite.me/api/v1/docs pide la credencial de equipo
(`docs` + la contraseña que imprimió `gen-secrets.sh --env prod`). Guion de 10 pasos
en `apps/api/ENDPOINTS.md` («Guion de demostración»): *Authorize* → `apiKeyAuth` →
pegar el secreto → *Try it out* en `GET /public/me`, `POST /public/tickets`…

**Evidencia en la base:** A.9: la clave se guarda como `prefix` + **hash Argon2id**
(`keyHash`), nunca el secreto; `lastUsedAt` se actualiza; el alta queda en
`audit_logs` (`apiKey.created`).

**Argumento:** 14 endpoints, *scopes* por clave (`tickets:read/write`,
`comments:read/write`, `categories:read/write`, `stats:read`), la clave está atada a
**una** organización y no puede ver otra, 60/min y 1000/h por clave además del límite
por IP, OpenAPI 3.0.3 de 110 operaciones generado de los contratos Zod (no escrito a
mano) y una prueba (`test/unit/openapi.test.ts`) que falla si una ruta queda sin
documentar; otra (`test/integration/openapi-contract.test.ts`) valida las respuestas
reales contra el documento.

### M6 — Design system (Menor, 1)

**Pide:** sistema de diseño propio con componentes reutilizables, paleta de color,
tipografía e iconos; mínimo 10 componentes.

**Demostrar:**
```bash
ls packages/ui/src                     # Alert, Avatar, Button, Checkbox, Dialog, DropdownMenu, EmptyState,
                                       # ErrorState, Icon, IconButton, LoadingState, Pagination, SelectField,
                                       # Skeleton, StatusBadge, Tabs, TextField, Toast (+ BrandMark, no cuenta)
cat packages/ui/src/index.ts           # lo que se exporta
sed -n 1,80p packages/ui/README.md     # catálogo: API, variantes, uso, teclado y accesibilidad
sed -n 1,60p apps/web/src/styles/global.css    # @theme: paleta semántica, tipografía, radios
grep -rn "from 'ui'" apps/web/src | wc -l      # cuántas pantallas lo usan
```
En la app: botones en sus variantes, `StatusBadge` en la lista de tickets, `Dialog`
con trampa de foco (Esc cierra, Tab no se escapa), `Toast`, `Pagination`, `Icon`.

**Argumento:** el README cuenta 15 genéricos (hay 18 ficheros de componente; se dejó
fuera `BrandMark` por ser marca). Tokens semánticos en vez de colores sueltos: el
tema oscuro sólo redefine tokens. Cada componente documenta su comportamiento con
teclado y lectores de pantalla.

### M7 — Gestión estándar de usuarios y autenticación (Mayor, 2)

**Pide:** actualizar el perfil; subir avatar (con uno por defecto); añadir amigos y
ver si están en línea; página de perfil.

**Demostrar:**

1. *Account → Profile settings*: cambiar nombre, cargo, biografía, zona horaria →
   guardar → recargar: persiste (A.3 o `SELECT * FROM user_profiles`).
2. **Avatar**: sin foto se ven **las iniciales**; subir una imagen → se recodifica a
   WebP 512×512 sin EXIF; «Remove photo» → vuelven las iniciales y el fichero se
   borra del servidor.
3. **Amigos y presencia**: M4 punto 3 y M3 punto 3.
4. **Perfil**: `#people-profile?person=demo-laura`.
5. Extra que prometen los Términos: *Account → Sessions & devices*
   (`#account/sessions`): cada dispositivo, «This device», última actividad, cerrar
   uno o todos. Con dos navegadores: cerrar la sesión del otro y ver que el otro
   queda fuera.
6. Extra de Israel: cambio de contraseña (`#account/password`), que cierra las demás
   sesiones; idioma y tema en *Preferences*, que además siguen al instante en las
   otras pestañas abiertas.
7. La sesión aguanta: recargar dos veces seguidas, abrir dos pestañas, o `docker
   restart dev_api` con la aplicación abierta: la pantalla espera y vuelve, sin echar
   a nadie (#93 y #97). Hacerlo **después** del recorrido de la consola (4.3): mientras
   la API arranca, Chrome anota los 502 del proxy.

**Argumento:** registro con verificación de correo, recuperación de contraseña que
responde igual exista o no la cuenta (no revela quién está registrado), bloqueo
progresivo, *refresh* rotatorio con detección de reutilización (y 30 s de margen
para una respuesta que no llegó, 5.5). Los ficheros se validan por contenido (*magic
bytes*) y se recodifican con sharp.

### M8 — Sistema de permisos avanzado (Mayor, 2)

**Pide:** ver, editar y borrar usuarios (CRUD); gestión de roles; vistas y acciones
distintas según el rol.

**Demostrar** (README, «How to demonstrate it»):

1. Como GLOBAL_ADMIN (`op-…@helpdesk.invalid` o demo-sistemas): **Users** (`#admin`):
   listar, buscar, filtrar por rol y estado; **editar** nombre; **cambiar rol** de
   plataforma; **suspender** (la cuenta no puede entrar) y reactivar; **borrar**.
   Intentar degradar o suspender la propia cuenta o la del administrador principal →
   bloqueado en el formulario **y** rechazado por la API.
2. **Crear** = invitar: *Platform roles* (`#platform-roles`) → dar administración de
   plataforma a un correo que no existe → «Waiting for the account». En una ventana
   privada, registrarse con ese correo → «Confirm your e-mail to continue» → abrir el
   correo en Mailpit → `#verify-email` → «Your access now: …». El rol llega **al
   verificar**, no al registrarse.
3. **Vistas según el rol** en *Roles & access* (`#organization-roles`), entrando con
   tres cuentas:
   - demo-admin (ORG_ADMIN): asignar por correo, cambiar roles en línea, expulsar,
     cancelar reservas.
   - demo-agent (AGENT): directorio de sólo lectura de quién hace qué.
   - demo-laura (MEMBER): su rol, la matriz de capacidades y a quién pedir el cambio
     (sólo nombres, sin correos).
   - Y en tickets: el MEMBER sólo ve los suyos y no ve notas internas; el AGENT ve
     todos y puede cambiar estado y asignarse.
4. Saltarse la interfaz: con el token de laura, `PATCH /users/<id>/role` →
   `403 RBAC_FORBIDDEN` (puede ver a marc, pero no tocar su rol: aquí el 403 es lo
   correcto). Pedir una organización ajena, o un ticket que no puede leer → **404**
   con el **mismo cuerpo** que para un identificador inventado: la respuesta no
   confirma que exista (#93). ✅ Probado tal cual, en zsh, el 15/10 por la tarde:

```bash
# $A y el token de laura en $TOKEN como en 5.6; el de marc igual, en $MARC
q() { docker exec dev_database sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\""; }
MARC_ID=$(q "SELECT id FROM users WHERE username = 'demo-marc'")
OTRA=$(q "SELECT id FROM organizations WHERE name LIKE 'Hospital%' LIMIT 1")
INVENTADO=01a10000-0000-7000-8000-000000000000

curl -s -X PATCH "$A/users/$MARC_ID/role" -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"globalRole":"GLOBAL_ADMIN"}' | jq -c '{statusCode, code}'
#   {"statusCode":403,"code":"RBAC_FORBIDDEN"}
for id in "$OTRA" "$INVENTADO"; do
  curl -s "$A/organizations/$id" -H "authorization: Bearer $TOKEN" | jq -c '{statusCode, code, messageKey, message}'
done                                           # dos líneas idénticas: 404 ORG_NOT_A_MEMBER
DE_LAURA=$(curl -s "$A/tickets?createdById=me&take=1" -H "authorization: Bearer $TOKEN" | jq -r '.data[0].id')
for id in "$DE_LAURA" "$INVENTADO"; do         # marc es MEMBER: sólo ve los suyos
  curl -s "$A/tickets/$id" -H "authorization: Bearer $MARC" | jq -c '{statusCode, code, messageKey, message}'
done                                           # dos líneas idénticas: 404 TICKET_NOT_FOUND
```

   Lo mismo para todo lo que cuelga de un ticket: historial, comentarios, adjuntos (y
   el adjunto de una nota interna para quien no puede ver notas internas).
   `test/integration/tenancy.test.ts` compara las respuestas campo a campo.

**Evidencia:** `apps/api/src/rbac/policies.ts` (una función pura decide toda
autorización; la interfaz sólo oculta lo que la API rechazaría),
`test/unit/policies.test.ts`, `test/integration/rbac.test.ts`, `role-grants.test.ts`,
`admin-users.test.ts`; en la web, `permissions.test.ts` cruza los permisos de la
interfaz con la tabla de políticas del servidor. Auditoría: A.10 y la pantalla
`#admin/audit` con el antes y el después de cada cambio.

**Si preguntan** «¿dónde está el *Create* del CRUD?»: el administrador no crea
cuentas con contraseña; da un rol a una **dirección** y la persona crea su cuenta.
Es deliberado: nadie conoce la contraseña de otra persona, y el rol no se puede
robar registrando antes una dirección ajena (se reclama al verificarla).

### M9 — Sistema de organizaciones (Mayor, 2)

**Pide:** crear, editar y borrar organizaciones; añadir y quitar usuarios; ver
organizaciones y hacer acciones dentro (mínimo crear, leer, actualizar).

**Demostrar:**

1. *Organizations → New organization*: crear una dando su administración a un correo
   (queda reservada hasta que se verifique).
2. *Organization settings*: editar nombre y descripción; categorías (crear, editar);
   estadísticas.
3. Miembros: añadir por usuario o correo, cambiar rol, **quitar**. Intentar quitar al
   último ORG_ADMIN → `409 ORG_LAST_ADMIN`.
4. Cambiar de organización activa con el selector (demo-admin está en tres): los
   tickets cambian.
5. Dentro de la organización: crear, leer, actualizar tickets (y borrar como
   ORG_ADMIN).
6. **Borrar** la organización de prueba (sólo su creador o plataforma) → desaparece
   en cascada (A.2: `ON DELETE CASCADE`).
7. Aislamiento: una persona de otra organización pide `GET /organizations/<id>` → 404,
   el mismo que para un identificador inventado; y lo mismo con sus tickets,
   comentarios y adjuntos (M8, punto 4).

**Evidencia:** A.2 (pertenencias), `test/integration/tenancy.test.ts`,
`org-scope.ts` (el *middleware* que encierra cada petición en su organización).

### M10 — RGPD (Menor, 1)

**Pide:** pedir los datos; borrado con confirmación; exportación legible; correos de
confirmación.

**Demostrar** (con una cuenta creada en la defensa, para poder borrarla):

1. *Account → Privacy & data* → «Export your personal data» → **Request export** → llega un correo (Mailpit) con un
   código y un enlace `#account/export-requested?token=…` → confirmar.
2. Se construye en segundo plano → segundo correo «ready» → descargar el **ZIP**:
   `data.json` con perfil, tickets, comentarios, mensajes, notificaciones,
   adjuntos, pertenencias, amistades y sesiones, un `README.txt` que explica el
   contenido y los mismos datos en CSV (`csv/tickets.csv`, `comments`, `messages`,
   `sessions`): legible por una persona y por una máquina.
   ```bash
   unzip -l ~/Downloads/helpdesk-lite-export-*.zip            # README.txt, data.json y csv/ (tickets, comentarios, mensajes, sesiones)
   unzip -p ~/Downloads/helpdesk-lite-export-*.zip data.json | jq 'keys'
   ```
3. «Delete your account» → **Delete account** → correo con código → hay que escribir **el código y el propio
   nombre de usuario**: con el nombre equivocado → `GDPR_USERNAME_MISMATCH`; con el
   código equivocado → `GDPR_TOKEN_INVALID`; con los dos bien → la cuenta desaparece
   y no puede entrar.
4. En la base: `SELECT type, status, "requestedAt", "completedAt" FROM gdpr_requests ORDER BY "requestedAt" DESC LIMIT 5;`
   y que la cuenta ya no está (A.3); sus comentarios en tickets ajenos quedan
   **anonimizados**.

**Argumento:** borrado real (no una marca), con anonimización de lo que otras
personas necesitan (un comentario en un ticket ajeno); doble factor en lo
irreversible; enlace de descarga autenticado y de corta duración; todo auditado.
Prueba: `test/integration/account-erasure.test.ts`.

### M11 — Monitorización con Prometheus y Grafana (Mayor, 2)

**Pide:** Prometheus recogiendo métricas; exportadores e integraciones; paneles
propios en Grafana; reglas de alerta; acceso seguro a Grafana.

**Demostrar** (☁ con el túnel de 2.5):

1. **Prometheus** http://localhost:9090 → *Status → Targets*: todo `UP` — node,
   cAdvisor, postgres ×2, redis ×2, las dos API (`helpdesk-api-prod/staging`), blackbox
   HTTP y TLS. Una consulta propia:
   ```promql
   sum by (status) (rate(helpdesk_http_requests_total{job="helpdesk-api-prod"}[5m]))
   histogram_quantile(0.95, sum by (le) (rate(helpdesk_http_request_duration_seconds_bucket[5m])))
   ```
2. *Alerts*: las **23 reglas** (`config/prometheus/rules/alerts.yml`) en 5 grupos
   (`disponibilidad`, `errores`, `recursos`, `copias_de_seguridad`, `certificados`;
   el README las presenta en 6 áreas porque separa copias y ensayos). Cada una lleva
   su `summary`, y 14 llevan además el paso a seguir en la anotación `runbook` (R8:
   el README dice que todas).
3. **Grafana** http://localhost:3000 (usuario `admin` y la contraseña de
   `/opt/helpdesk/observability/.env`) → panel «HelpDesk Lite — Visión general»:
   disponibilidad externa, días hasta caducar el certificado, antigüedad de la última
   copia, último ensayo (RTO), peticiones por código, 5xx, latencia p50/p95/p99,
   dependencias, disco, CPU/memoria por contenedor, PostgreSQL, y errores recientes de
   la API desde Loki (ya enmascarados).
4. **Alerta de verdad** sin romper nada: lanzar una alerta de prueba a Alertmanager y
   ver llegar el correo (y Telegram si es crítica):
   ```bash
   docker exec helpdesk-alertmanager amtool --alertmanager.url=http://127.0.0.1:9093 \
     alert add PruebaDefensa severity=critical env=prod \
     --annotation=summary="Alerta de prueba lanzada durante la defensa"
   docker exec helpdesk-alertmanager amtool --alertmanager.url=http://127.0.0.1:9093 alert query
   ```
   Llega en ~10 s (las críticas tienen `group_wait: 10s`) y se resuelve sola a los
   5 min.
5. Las reglas se prueban sin desplegar: 🖥 `make test-alerts-pull` (una vez) y
   `make test-alerts` (promtool con la misma versión que el servidor).

**Seguridad de Grafana:** escucha sólo en `127.0.0.1` del servidor (no se publica a
internet) y se llega por túnel SSH; `GF_USERS_ALLOW_SIGN_UP=false`,
`GF_AUTH_ANONYMOUS_ENABLED=false`, contraseña de administrador obligatoria
(`compose.observability.yml`). `/api/metrics` exige `METRICS_TOKEN` (401 sin él; desde
fuera, nginx responde 404).

**Argumento:** 9 métricas propias de la aplicación (peticiones, duración, en vuelo,
rechazos por rate limit, fallos de autenticación, dependencias arriba/abajo y su
latencia, conexiones de tiempo real, eventos de dominio): las alertas de latencia,
5xx y rate limit no serían posibles sólo con exportadores. Tres alertas saltan por
**ausencia** de métrica (un backup que no corre no da fallos).

**Por qué `make` no levanta Prometheus ni Grafana:** `make` (= `make up-dev`) sólo
arranca la pila de desarrollo (`compose.dev.yml`: base de datos, Redis, Mailpit, API y
web). La monitorización es otro compose, `compose.observability.yml`, hecho para el
servidor: se cuelga de las redes de prod y staging (`external: true`), monta rutas de
`/opt/helpdesk` y vigila los contenedores de esos entornos. En un portátil no tiene nada
que vigilar, y no arranca. Se enseña la del servidor, por el túnel (2.5).

**Plan B en local** (si el servidor no responde): `obs-local.sh` (en `tmp/Eval/`; si
el clon no tiene esa carpeta, se saca de `develop` como `seed-defensa.sh`, 1.5) levanta
Prometheus y Grafana, con las mismas versiones que el servidor, contra la pila de
desarrollo. Nada de lo que genera toca el repositorio: va a `~/.cache/helpdesk-obs-local`.

```bash
bash tmp/Eval/obs-local.sh up       # desde la raíz del clon, con `make` ya hecho
bash tmp/Eval/obs-local.sh status   # objetivos y reglas
bash tmp/Eval/obs-local.sh down     # parar y borrar (los datos son efímeros)
```

- Prometheus en http://localhost:9090: *Status → Targets* con `helpdesk-api-dev` (el
  `/api/metrics` de `dev_api`, con su `METRICS_TOKEN`), `postgres`, `redis` y
  `prometheus` en `UP`; *Alerts*, las 23 reglas del repositorio, las mismas del
  servidor.
- Grafana en http://localhost:3000: si el puerto está ocupado, el script usa el
  siguiente libre y lo dice. Usuario `admin`, contraseña en
  `~/.cache/helpdesk-obs-local/grafana-admin-password`. Panel «HelpDesk Lite — Visión
  general (local)», entorno `dev`: peticiones por código, 5xx, latencias p50/p95/p99,
  dependencias y PostgreSQL, con los datos de la API local.
- En local sale vacío lo que sólo existe en el servidor: la sonda HTTPS y el
  certificado, las copias y los ensayos, el disco y los contenedores, y Loki. Con el
  tiempo, varias alertas de ausencia pueden saltar por lo mismo; se explica así.
- ✅ Probado el 15/10 por la noche: los cuatro objetivos en `UP`, 23 reglas en 5
  grupos, y las consultas del panel devuelven datos a través de Grafana (325
  peticiones, dependencias arriba, 2 conexiones de PostgreSQL, p95 de 22 ms).
- **Argumento:** la monitorización de verdad está en el servidor; esto enseña la misma
  configuración (las reglas y el panel del repositorio) leyendo las métricas de la API
  local con su token, que es lo que haría Prometheus en cualquier entorno.
- Si después se abre el túnel al servidor (2.5), parar antes el local (`down`) o
  llevar el túnel a otros puertos locales (`-L 9091:127.0.0.1:9090 -L
  3005:127.0.0.1:3000`).

### M12 — Health check, página de estado, copias y recuperación (Menor, 1)

**Pide:** health checks, página de estado, copias automáticas y procedimientos de
recuperación ante desastres.

**Demostrar:**

1. Sondas: `curl` de 2.6: `/api/health` (vivo, sin límite), `/api/health/ready`
   (dependencias), `/api/health/status` (semáforo **por áreas funcionales**, sin
   nombres de componentes, versiones ni latencias para el público; detalle completo
   sólo con el token de operación).
2. Página de estado: https://helpdesklite.me/status (fichero estático, no la SPA:
   sigue en pie aunque se rompa el bundle o caiga la API; refresco cada 60 s; el
   estado no se transmite sólo con color).
3. Copias: cron diario a las 00:00 UTC y una copia **antes de cada despliegue**;
   cifradas AES-256, con huellas SHA-256, verificadas al hacerlas y enviadas fuera del
   host (Oracle Object Storage); 14 días de retención.
4. Recuperación: ensayo de restauración en vivo desde GitHub Actions y restauración
   de una copia concreta (sección 7).
5. Métricas y alertas de copias y ensayos en Grafana (paneles «Antigüedad de la
   última copia correcta» y «Último ensayo de restauración»).

**Argumento:** el RTO se **mide** en cada ensayo (segundos; objetivo 1 h) y el RPO
acordado es 24 h (más la copia previa a cada despliegue). Límite honesto (README,
«Known limitations»): un único servidor; si cae la máquina entera, la monitorización
cae con ella. Lo cubren las copias fuera del host y el runbook.

### M13 — Módulo de libre elección: CI/CD (Mayor, 2)

**Pide el enunciado para un módulo de libre elección** (IV.10): justificación en el
README de por qué se eligió, qué retos técnicos resuelve, qué valor aporta y por qué
merece ser mayor; que no sea un atajo y demuestre complejidad. Está en el README,
«Why this is claimed as a Module of Choice (Major)», con las cuatro respuestas.

**Demostrar:**

1. 🐙 Una PR cerrada: el *check* `ci-success` y los 7 *jobs*: `quality` (prettier,
   eslint, tsc, build), `unit-tests`, `integration-tests` (Postgres y Redis reales),
   `compose-validation`, `docker-build`, `security` (gitleaks, npm audit, Trivy, SBOM),
   `ci-success`.
2. 🐙 *Actions → Deploy Production*, último run en verde: *gate* (la puerta en código:
   PR fusionada, aprobada por **otra** persona, aprobación sobre el **último**
   commit, sin cambios pedidos) → build ARM64 nativo → push a GHCR con el SHA →
   *Deploy to Oracle Cloud*: buscar en el log «Copia de seguridad previa», el smoke
   test y «sirviendo …».
3. El SHA desplegado = el de `main` = el de la imagen (2.6).
4. El rollback: en `scripts/deploy/remote-deploy.sh`, la función `rollback()`; y en el
   historial de Actions, el despliegue que se revirtió solo (si lo hay, enseñarlo).
5. Lo mismo sin Actions, en local: `make ci JOBS="quality unit"` (11.1).

```bash
sed -n 1,60p scripts/ci/prod-gate.mjs
grep -n "rollback\|smoke\|predeploy" scripts/deploy/remote-deploy.sh | head
cat .github/CODEOWNERS | head
```

**Argumento (las cuatro preguntas):**
- *Por qué:* dos entornos en un servidor pequeño y cinco personas fusionando en la
  misma rama; el riesgo real era un despliegue roto sin vuelta atrás, un secreto
  subido por error o un cambio en producción que nadie había leído.
- *Retos:* despliegue con copia previa, smoke test y rollback automático; revisiones
  que de verdad bloquean (los *environment reviewers* no frenan nada en un repo
  privado sin Enterprise, así que la regla vive en `prod-gate.mjs` contra la API de
  GitHub); imágenes construidas una vez por commit en ARM64 nativo y promovidas por
  SHA; el pipeline entero reproducible sin Actions.
- *Valor:* es lo que hace demostrables los demás módulos; cazó defectos reales (un
  despliegue que fallaba en silencio por una «I» escrita como «l» en el login de un
  aprobador; dos entornos cuyos contenedores se robaban los nombres).
- *Por qué mayor:* 5 workflows, 7 jobs, una puerta escrita contra la API, un script de
  despliegue con copia, cerrojo, healthchecks, smoke test y rollback, dos auditorías
  programadas, un ejecutor local y el ciclo de vida de los secretos.

**Si preguntan** «¿no es esto DevOps estándar?»: ningún módulo de la lista cubre la
entrega continua; lo que lo hace mayor no es tener un YAML sino lo que hay en código
(puerta, rollback, promoción por SHA, ejecución local) y que se ha usado en cada
despliegue del proyecto.

### M14 — Búsqueda avanzada (Menor, 1)

**Pide el enunciado:** «*Implement advanced search functionality with filters,
sorting, and pagination*». Es el módulo que añadió Aren en #95: el README lo
atribuye a arhea (la experiencia de búsqueda y filtros), nalesso (la integración con
la API y la búsqueda global) y fcela-ga (la API de búsqueda).

**Demostrar** (mejor con relleno: `EXTRA_TICKETS=30 bash tmp/Eval/seed-defensa.sh
../seed.txt`, 1.5):

1. *Tickets* como demo-agent: escribir una palabra del título o de la descripción en el
   buscador. Búsqueda de **texto completo** e **insensible a los acentos**: `padro`
   encuentra «padró» y `telefon`, «telèfon» (los tickets de la siembra están en
   catalán).
2. Filtros de estado, prioridad y categoría, combinables; el total cambia.
3. Ordenación: *Newest* / *Oldest* (fecha de creación).
4. Paginación **en el servidor**: 30 por página, con el `Pagination` del design system.
5. El estado vive en la URL: copiar la dirección con filtros y abrirla en otra pestaña
   → mismos filtros y misma página. Se puede compartir un enlace a una búsqueda.
6. Búsqueda global (barra superior): tickets y personas, por la API.
7. En móvil, los filtros en una hoja (`TicketFilterSheet.tsx`).

**Lo mismo por la API** (✅ probado el 15/10 por la tarde, por HTTPS):

```bash
curl -s "$A/tickets?q=padro&take=5" -H "authorization: Bearer $TOKEN" \
  | jq -c '{total: .meta.total, refs: [.data[].reference]}'                    # padró, sin acento
curl -s "$A/tickets?status=OPEN,IN_PROGRESS&priority=HIGH,MEDIUM&sort=createdAt&order=asc&take=2&page=2" \
  -H "authorization: Bearer $TOKEN" | jq -c '.meta | {page, pages, total, tookMs}'
curl -s "$A/tickets?take=1" -H "authorization: Bearer $TOKEN" | jq '.meta.facets'   # recuentos por estado y prioridad
```

> ⚠️ Varios valores de un filtro van **separados por comas** (`status=OPEN,IN_PROGRESS`).
> Repetido (`status=OPEN&status=IN_PROGRESS`) la API contesta `400
> VALIDATION_FAILED`, y es justo lo que manda Swagger, porque el documento OpenAPI
> declara esos parámetros con `explode: true`. En la defensa: en Swagger, un solo
> valor por filtro. Arreglo de una línea en R10.

**Evidencia:**

- `apps/api/src/modules/search/search.service.ts`: `to_tsvector` con la configuración
  `helpdesk_es` (sin acentos) y un **índice GIN**
  (`prisma/migrations/20260819104700_constraints_and_search_index`), no `LIKE '%…%'`;
  diecisiete filtros, facetas, ordenación y dos paginaciones (por página y por cursor).
  `meta.tookMs` dice cuánto tardó cada búsqueda.
- Web: `TicketListPage.tsx` (buscador, filtros, orden, paginación, estado en la URL),
  `GlobalSearchDialog.tsx`; pruebas `apps/web/test/ticket-list-page.test.tsx` (9) y
  `global-search-dialog.test.tsx` (4).
- API: la forma de la respuesta de búsqueda contrastada con el documento OpenAPI
  (`test/integration/openapi-contract.test.ts`); búsqueda, orden y paginación de
  usuarios en `admin-users.test.ts`.

**Argumento:** búsqueda de texto completo de verdad (índice GIN, configuración en
español sin acentos), filtros combinables, ordenación y paginación en el servidor
(nada se filtra en el navegador), estado compartible en la URL, y la misma búsqueda
disponible para integraciones en la API pública (`GET /public/tickets`).

---

## 7. Copias de seguridad y restauración

Esta sección resuelve la duda de **cómo restaurar una copia concreta** y no sólo la
última. Todo sale de `scripts/backup.sh`, `scripts/restore.sh`,
`scripts/deploy/remote-deploy.sh` y `.github/workflows/backup-drill.yml`. Los pasos
7.5 y 7.8 están **probados en local** (✅); los del servidor (☁) y Actions (🐙)
reproducen lo que hacen esos ficheros.

### 7.1 Qué copias hay y cómo se llaman

Cada copia es un directorio en `/opt/helpdesk/<entorno>/backups/` con este nombre:

```
AAAA-MM-DD_HH-MM-SS[_<etiqueta>]          ← hora UTC (el contenedor de backup no fija zona)
```

| Etiqueta | Quién la hace | Qué contiene |
|---|---|---|
| *(ninguna)*, p. ej. `2026-10-14_00-00-00` | El cron del contenedor `helpdesk-backup-<env>`, cada día a las **00:00 UTC** (02:00 en Madrid en verano) | El estado de esa noche |
| `predeploy-<sha7>`, p. ej. `2026-10-14_09-41-07_predeploy-5671bd8` | `remote-deploy.sh`, **antes** de desplegar el commit `<sha7>` | El estado **justo antes** de que entrase `<sha7>`, es decir, los datos con la versión **anterior** ya aplicada y sin las migraciones de `<sha7>` |
| `pre-restore` | `restore.sh --production`, antes de restaurar | Copia de emergencia del estado que se va a sobrescribir |
| la que se ponga (`defensa`…) | A mano (7.3) | Lo que haya en ese momento |

Dentro de cada una:

| Fichero | Qué es |
|---|---|
| `MANIFEST` | `fecha`, `base_de_datos`, `etiqueta`, tamaños, **huellas SHA-256** de los dos `.enc`, `rpo_horas=24`, `rto_objetivo_minutos=60` |
| `database.dump.enc` | `pg_dump -F c`, cifrado al vuelo con AES-256-CBC + PBKDF2 (250 000 iteraciones). El volcado en claro nunca toca el disco |
| `uploads.tar.gz.enc` | Los adjuntos y avatares, cifrados igual |
| `toc.txt` | El índice que `pg_restore --list` sacó al verificar la copia nada más hacerla |

Retención: **14 días**, en local y en el bucket de Oracle Object Storage (mismo nombre
de directorio bajo `RCLONE_REMOTE`). Una copia de hace tres semanas ya no existe.

### 7.2 Encontrar la copia de un momento concreto

**Por fecha** (☁):

```bash
ls -1 /opt/helpdesk/prod/backups | grep '^20'
grep -H -E '^(fecha|etiqueta|dump_bytes)=' /opt/helpdesk/prod/backups/*/MANIFEST
```

**Por commit** (lo que preguntabas): la etiqueta `predeploy-<sha7>` es el enlace con
Git.

```bash
# 🖥 En el repositorio: los despliegues de producción son los commits de main
git fetch origin main
git log origin/main --first-parent --format='%h  %ad  %s' --date=format:'%d/%m %H:%M' | head -15
# ☁ La copia que se hizo justo antes de desplegar ese commit
ls -d /opt/helpdesk/prod/backups/*_predeploy-5671bd8
```

Regla para no equivocarse: **para volver al estado en que corría la versión X, se
usa la copia `predeploy-` del commit que se desplegó DESPUÉS de X** (esa copia se
hizo con X todavía en marcha). Ejemplo: `main` tiene … → `aaa1111` → `bbb2222`. La
copia `*_predeploy-bbb2222` contiene los datos tal y como estaban con `aaa1111`
corriendo, un instante antes de que llegase `bbb2222`.

**Por GitHub, sin SSH** (🐙): *Actions* → *Deploy Production* → el run de ese commit →
job «Construir y desplegar (requiere aprobación)» → paso «Deploy to Oracle Cloud» →
buscar `copia completada en`. La línea es
`[backup] copia completada en /backups/2026-10-14_09-41-07_predeploy-5671bd8 (3s)`;
dentro del contenedor la carpeta es `/backups/…`, en el servidor
`/opt/helpdesk/prod/backups/…`. Staging igual, con *Deploy Staging*.

**Fuera del host** (☁):

```bash
docker exec helpdesk-backup-prod sh -c 'rclone --config /rclone/rclone.conf lsd "$RCLONE_REMOTE"'
```

(`rclone` se instala dentro del contenedor en la primera copia con destino externo;
si dice que no existe, está en el host con `/opt/helpdesk/prod/rclone/rclone.conf`.)

### 7.3 Hacer una copia ahora (para la demostración)

```bash
# ☁ Usa las variables del propio contenedor: base, usuario, clave de cifrado, destino externo
docker exec -e BACKUP_LABEL=defensa helpdesk-backup-prod sh /backup.sh
#   …
#   [backup] verificación correcta (N objetos en el índice)
#   [backup] copia externa completada.
#   [backup] copia completada en /backups/2026-10-16_10-12-33_defensa (2s)
cat /opt/helpdesk/prod/backups/*_defensa/MANIFEST
```

Es la misma orden que lanza el cron y el despliegue. Deja también la métrica que lee
Prometheus (el panel «Antigüedad de la última copia correcta» vuelve a cero).

### 7.4 Ensayo de restauración desde GitHub Actions (*Run workflow*)

> B7: el último verde es del **12/10** (el programado de los lunes). Lanzarlo hoy a
> mano, `prod` primero y `staging` cuando acabe (de uno en uno: cada ensayo levanta un
> PostgreSQL con 2 GB en memoria en la misma máquina). El `restore.sh` que se ejecuta
> es el del commit de `main`, que desde el 15/10 16:42 es `cb3bba5`.

El ensayo (`restore.sh --drill`) levanta un PostgreSQL **efímero** en una red
interna sin salida, restaura ahí la copia, cuenta filas, comprueba que todas las
migraciones de Prisma están aplicadas y que cada adjunto de la base está en el
archivo, **mide el RTO** y lo borra todo. **No toca producción.**

Pasos:

1. 🐙 Repositorio del equipo (el que tiene los *secrets* del servidor) → pestaña
   **Actions**.
2. Columna izquierda → **Ensayo de restauración**.
3. Botón **Run workflow** (arriba a la derecha de la lista de runs):
   - *Use workflow from*: **Branch: main** (el `restore.sh` que se ejecuta es el de ese
     commit: lo descarga de la API de GitHub con el SHA del run).
   - *Entorno cuya copia se ensaya*: `prod` o `staging`.
   - *Ruta de la copia (vacío = la última)*: **aquí se elige la copia concreta**, con
     la ruta relativa a `/opt/helpdesk/<entorno>`, por ejemplo
     `backups/2026-10-14_09-41-07_predeploy-5671bd8` o `backups/2026-10-16_10-12-33_defensa`.
4. **Run workflow** → abrir el run → job «Restaurar la última copia en un entorno
   aislado (prod)».
5. En el paso «Ejecutar el ensayo en el servidor» se lee, en este orden:
   - `Copia seleccionada: backups/… · modo: --drill` y el `MANIFEST`.
   - `✔ huella de database.dump.enc correcta`, `✔ huella de uploads.tar.gz.enc correcta`.
   - `✔ pg_restore terminó sin errores`.
   - Filas por tabla: `users`, `organizations`, `tickets`, `ticket_comments`, `attachments`.
   - `✔ migraciones de Prisma: 4 aplicadas, 0 a medias`.
   - `✔ los N adjuntos vivos están presentes en el archivo`.
   - `RTO medido en este ensayo: Ns (objetivo: 3600s)` y el informe final con
     `resultado=CORRECTO`.
6. Paso «Recoger el informe del ensayo» y la pestaña *Summary* del run.

Lo mismo por SSH, con salida en directo (☁):

```bash
cd /opt/helpdesk/prod
bash scripts/restore.sh --drill                                              # la última
bash scripts/restore.sh --drill backups/2026-10-14_09-41-07_predeploy-5671bd8   # una concreta
ls -1t drills/ | head -3 && cat "drills/$(ls -1t drills | grep RESTORE | head -1)"
```

(`scripts/restore.sh` está ahí porque el workflow lo descarga en cada ensayo; si no
estuviese: `cp <CHECKOUT_SERVIDOR>/scripts/restore.sh /opt/helpdesk/prod/scripts/`.)

**Demostración de «restaurar a un punto concreto»** (la más convincente, 5 minutos):

1. 🌐 En producción, crear un ticket «Prueba defensa 16/10».
2. ☁ `docker exec helpdesk-db-prod sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT count(*) FROM tickets"'` → N.
3. 🐙 Ensayo con la copia de **anoche** → el log dice `tickets: N-1 filas` (o las que
   hubiese anoche): la copia es un estado anterior y restaurable.
4. ☁ Copia ahora (7.3) y 🐙 ensayo con esa copia → `tickets: N filas`.
5. Si quieren ver **el contenido** (que el ticket nuevo no está en la copia de
   anoche), 7.5.

### 7.5 Ver el contenido de una copia concreta sin tocar producción ✅

Restaura una copia en un PostgreSQL de usar y tirar (sin red, en memoria) y permite
consultarla. Probado en local con una copia `_predeploy-…` real: el ticket creado
después de la copia no aparece en ella.

```bash
# ☁ En el servidor, como deployer
cd /opt/helpdesk/prod
COPIA=backups/2026-10-14_00-00-00                  # la copia elegida (7.2)
export BACKUP_ENCRYPTION_KEY="$(grep -m1 '^BACKUP_ENCRYPTION_KEY=' .env | cut -d= -f2-)"

docker run -d --name defensa-restore --network none \
  -e POSTGRES_USER=defensa -e POSTGRES_PASSWORD=defensa -e POSTGRES_DB=defensa \
  --tmpfs /var/lib/postgresql/data:rw,size=1g postgres:15-alpine
# PostgreSQL arranca dos veces la primera vez (inicialización): se espera a la segunda
until docker exec defensa-restore psql -U defensa -d defensa -tAc 'SELECT 1' >/dev/null 2>&1; do sleep 1; done
sleep 3
until docker exec defensa-restore psql -U defensa -d defensa -tAc 'SELECT 1' >/dev/null 2>&1; do sleep 1; done

openssl enc -d -aes-256-cbc -md sha512 -pbkdf2 -iter 250000 \
  -pass env:BACKUP_ENCRYPTION_KEY -in "$COPIA/database.dump.enc" \
| docker exec -i defensa-restore pg_restore -U defensa -d defensa --no-owner --no-privileges

docker exec -it defensa-restore psql -U defensa -d defensa \
  -c 'SELECT reference, title, status, "createdAt" FROM tickets ORDER BY "createdAt" DESC LIMIT 5;'
docker exec -it defensa-restore psql -U defensa -d defensa      # consultas libres (anexo A)

docker rm -f defensa-restore; unset BACKUP_ENCRYPTION_KEY       # al terminar
```

- La clave se lee del `.env` del entorno y no se imprime.
- `--network none` + `tmpfs`: no puede hablar con nada y no deja datos en disco.
- `--no-owner --no-privileges`: el volcado trae permisos para el rol `helpdesk_app`,
  que no existe en esta base de usar y tirar.

### 7.6 Restauración real (recuperación ante desastre) — en **staging**

`restore.sh --production` **sustituye** la base en uso por la copia. En la defensa,
si se quiere enseñar una recuperación de verdad, **sólo en staging**. Ensayarlo esta
noche.

```bash
# ☁
cd /opt/helpdesk/staging
ls -1 backups | grep '^20' | tail -5                       # elegir la copia
sudo touch .maintenance                                     # que el temporizador de autorrecuperación no levante nada a medias
bash scripts/restore.sh --production backups/2026-10-15_00-00-00
#   ⚠ RESTAURACIÓN SOBRE helpdesk_staging … Escribe RESTAURAR para continuar: RESTAURAR
sudo rm .maintenance
curl -s https://staging.helpdesklite.me/api/health/ready | jq '.status'   # (pasa el reto de Cloudflare desde el navegador)
```

Lo que hace, en orden (`scripts/restore.sh`, modo producción):

1. Verifica las huellas del `MANIFEST`; **si no cuadran, aborta** sin tocar nada.
2. Descifra el volcado a un temporal y comprueba el de adjuntos **antes** de parar
   nada (una clave equivocada no deja el servicio caído).
3. **Copia de emergencia** del estado actual (`*_pre-restore`).
4. Para `api` y `web` (la base sigue en pie).
5. `pg_restore --clean --if-exists --no-owner` sobre la base del entorno. Si hay
   errores, **no** levanta la pila y explica cómo seguir.
6. Restaura los adjuntos en el volumen `uploads_<entorno>`.
7. `docker compose up -d` y el tiempo total.

**Deshacerlo:** la misma orden con la copia `*_pre-restore` que acaba de crear.

**Rollback ≠ restauración:** si un despliegue falla, `remote-deploy.sh` vuelve
**solo** a la imagen anterior (la aplicación), pero no deshace migraciones ya
aplicadas. Si una migración destructiva rompiera datos, se restaura la copia
`predeploy-<sha7>` de ese despliegue con 7.6.

### 7.7 Métricas y alertas de las copias

```promql
time() - helpdesk_backup_last_success_timestamp_seconds        # segundos desde la última copia buena, por env
helpdesk_backup_database_bytes                                 # tamaño del volcado cifrado
helpdesk_restore_drill_duration_seconds                        # RTO del último ensayo
helpdesk_restore_drill_failures                                # 0 = el último ensayo salió bien
```

Reglas (`config/prometheus/rules/alerts.yml`): `BackupFallido`, `BackupAntiguo`,
`SinMetricaDeBackup`, `BackupSospechosamentePequeno`, `EnsayoDeRestauracionAntiguo`,
`SinMetricaDeEnsayo`, `EnsayoDeRestauracionFallido`. Argumento: tres de ellas saltan
por la **ausencia** de la métrica, porque un backup que no corre no produce fallos.
Pruebas de esas reglas sin servidor: `make test-alerts` (`config/prometheus/rules/tests/backups.yml`).

### 7.8 Ensayo completo en local (plan B si el servidor no responde) ✅

Con la pila de desarrollo en marcha (`make`), una copia con el **mismo** `backup.sh`
y un ensayo con el **mismo** `restore.sh`, sin servidor:

```bash
# 🖥 Desde la raíz del repo
E=../ensayo-backup && mkdir -p $E/backups $E/scripts
cp scripts/backup.sh scripts/restore.sh $E/scripts/
envget(){ grep -m1 "^$1=" .env | cut -d= -f2-; }
# restore.sh corre con `set -euo pipefail` y lee también GHCR_OWNER y GITHUB_SHA:
# si faltan en este .env, termina en silencio sin hacer nada.
printf 'DB_USER=%s\nDB_PASSWORD=%s\nDB_NAME=%s\nBACKUP_ENCRYPTION_KEY=%s\nENV_NAME=local\nGHCR_OWNER=local\nGITHUB_SHA=local\n' \
  "$(envget POSTGRES_USER)" "$(envget POSTGRES_PASSWORD)" "$(envget POSTGRES_DB)" \
  "$(envget BACKUP_ENCRYPTION_KEY)" > $E/.env && chmod 600 $E/.env

# Copia (el contenedor instala openssl la primera vez: necesita internet)
docker run --rm --network helpdesk-dev_dev_network \
  -e POSTGRES_USER="$(envget POSTGRES_USER)" -e POSTGRES_PASSWORD="$(envget POSTGRES_PASSWORD)" \
  -e POSTGRES_DB="$(envget POSTGRES_DB)" -e BACKUP_ENCRYPTION_KEY="$(envget BACKUP_ENCRYPTION_KEY)" \
  -e BACKUP_ENV=local -e BACKUP_LABEL=ensayo \
  -v "$(cd $E && pwd)/backups:/backups" -v helpdesk-dev_uploads_dev:/uploads:ro \
  -v "$(cd $E && pwd)/scripts/backup.sh:/backup.sh:ro" \
  postgres:15-alpine sh /backup.sh

# Ensayo sobre esa copia (o sobre la última, sin argumento)
(cd $E && bash scripts/restore.sh --drill "backups/$(ls backups | grep _ensayo | tail -1)")
```

Resultado en local el 15/10: huellas correctas, `pg_restore` sin errores, filas por
tabla, 4 migraciones aplicadas, adjuntos presentes, `RTO medido: 4s`,
`resultado=CORRECTO`.

- El volumen montado en `/uploads` tiene que ser **el de la API**
  (`helpdesk-dev_uploads_dev`). Con otro, el ensayo sale `FALLIDO` con «N de N
  adjuntos vivos NO están en el archivo»: es la comprobación de coherencia base ↔
  adjuntos haciendo su trabajo (pasó al prepararlo, y es buen ejemplo si preguntan
  qué detecta el ensayo).
- Los ficheros de `$E/backups` quedan de root, porque los crea el contenedor:
  `sudo rm -rf ../ensayo-backup` para limpiar.

---

## 8. Calidad del código

### 8.1 Code Structure

```
apps/
  api/                 Express 5 · TypeScript
    prisma/            schema.prisma + migrations/
    src/
      app.ts           cadena de middlewares (helmet, cors, cookies, métricas, rate limit, rutas, errores)
      common/          errores (ApiError), jwt, logger, middleware/ (auth, org-scope, policy, validate, rate-limit…)
      rbac/            policies.ts: la única tabla de autorización
      modules/<área>/  <área>.router.ts → <área>.service.ts → Prisma  (auth, tickets, organizations, chat,
                       realtime, public-api, gdpr, health, observability, openapi, search, files…)
    test/unit · test/integration
  web/                 React 19 · Vite · Tailwind 4
    src/app            rutas, sesión, organización activa, límites de error
    src/core           cliente HTTP, estado asíncrono, i18n, tiempo real, tema
    src/features/<área> pantallas por funcionalidad (tickets, people, messages, account, admin, organization…)
    src/layout         armazón, pie, menús
    test/              Vitest + jsdom
packages/
  contracts/           esquemas Zod compartidos (lo que valida el front y la API)
  ui/                  design system
scripts/               gen-secrets, backup/restore, ci/, deploy/, ops/, dev/
config/                prometheus, alertmanager, grafana, loki, promtail, blackbox
```

Estilo uniforme: Prettier y ESLint en todo el monorepo (`npm run format:check`,
`npm run lint`), TypeScript estricto (`npm run typecheck`), commits convencionales,
plantilla de PR. Los cuatro comprobados en verde el 15/10.

Ficheros para enseñar (cortos y representativos): `apps/api/src/rbac/policies.ts`,
`apps/api/src/common/middleware/validate.ts`, `apps/api/src/modules/auth/password.ts`,
`apps/web/src/core/api/client.ts`, `packages/ui/src/Button.tsx`,
`packages/contracts/src/tickets.ts`.

### 8.2 Technical Decisions — respuestas preparadas

| Pregunta | Respuesta |
|---|---|
| ¿Por qué este stack? | TypeScript en las dos mitades con **un solo** juego de contratos Zod: el front no puede aceptar lo que la API rechaza. React por ecosistema y experiencia del equipo; Express por ser pequeño y explícito; PostgreSQL por ser relacional con restricciones fuertes; Prisma por migraciones versionadas y consultas tipadas |
| ¿Cómo se estructuró? | Monorepo con *workspaces*; API por módulos de dominio (router → servicio → datos); una tabla de políticas pura para toda decisión de permisos; bus de eventos transaccional para desacoplar tiempo real y notificaciones del resto |
| Retos | Roles reservados a un correo que se **reclaman al verificar**, no al registrarse (si no, quien registrase antes `jefe@empresa.com` heredaría su rol); el ensayo de restauración fallaba por permisos (la copia es de root y el ensayo entra como deployer); dos entornos en una máquina que se robaban nombres de contenedor y el alias `api` en una red compartida; Cloudflare bloqueado en España durante el fútbol (plan de contingencia documentado). Y de la víspera (15/10): una sesión que se cerraba sola porque una recarga cortaba la renovación del token (la API la tomaba por un robo), dos cambios de estado simultáneos que pasaban los dos la máquina de estados, y HTTPS en local con una autoridad propia restringida a localhost |
| Compromisos | Un solo servidor (gratis, ARM): sin alta disponibilidad, la monitorización cae con la máquina. Loki en vez de ELK (no se reclama el módulo de ELK). Router propio en vez de React Router (control total, menos dependencias). Mailpit en los entornos de demostración en vez de correo real |
| ¿Cómo sabéis que funciona? | 135 pruebas unitarias de la API, 229 de la web, 130 de integración contra PostgreSQL y Redis reales, contrato OpenAPI validado contra respuestas reales, y el CI en cada PR. Y cada arreglo de la última semana llegó con la prueba que falla si se deshace (por ejemplo, la de la carrera: sin el arreglo, ocho cambios de estado a la vez dan ocho 200) |

### 8.3 Teamwork Evidence

- Git: 3.5. PR: 🐙 *Pull requests → Closed*, con revisiones y fusiones de personas
  distintas; `CODEOWNERS` para las rutas de infraestructura.
- Herramientas: Trello (tablero), Notion (endpoints, guías de integración, actas),
  WhatsApp/Discord/Slack.
- Cada persona explica **la pieza de otra**: p. ej. Elizabeth cuenta la puerta de
  producción; Israel, las notas internas de tickets; Nahuel, el design system.

---

## 9. Funcionalidad

### 9.1 Guion multiusuario (10 minutos)

Tres navegadores o perfiles: **A** = demo-admin, **B** = demo-agent, **C** = demo-laura
(entrar antes, ver R7).

1. C crea un ticket con categoría y prioridad → aparece en la lista de B **sin
   recargar**.
2. B lo abre, se lo asigna, escribe un comentario público y una **nota interna** → C ve
   el comentario en vivo y **no** ve la nota.
3. B lo pasa a *Resolved* (texto de resolución ≥ 20 caracteres) → C lo cierra (*Closed*:
   el autor sólo puede confirmar el cierre).
4. A, en *Roles & access*, cambia el rol de C a AGENT → C recarga y su vista cambia.
5. C y B chatean; B ve a C en línea en *People*.
6. A borra una categoría que usa un ticket → el ticket queda sin categoría
   (`SET NULL`), no se rompe.
7. Base de datos: el ticket, su historial y los comentarios (A.4–A.6).

### 9.2 Gestión de errores

| Caso | Qué pasa |
|---|---|
| Ruta inexistente `#no-existe` | Página 404 propia (`NotFoundPage.tsx`) |
| Error de render | `AppErrorBoundary.tsx`: pantalla de error, no página en blanco |
| Error de la API | Toast o mensaje por campo, traducido; la respuesta lleva un `requestId` (DevTools → *Network*) que se encuentra en el log (2.1) |
| API caída | La sesión distingue «no hay sesión» de «el servidor no contesta» (`SessionUnreachable`); `/status` sigue cargando y lo dice en rojo |
| Sesión caducada | El cliente HTTP renueva la sesión **una vez** ante un 401 y reintenta (`core/api/client.ts`) |
| Fallos de validación | Mensaje por campo, en el idioma de la persona |
| Dos cambios a la vez sobre un ticket | El segundo recibe `409 TICKET_CHANGED` («Alguien ha cambiado este ticket mientras tanto. Recárgalo y vuelve a intentarlo», traducido) en vez de pisar al primero (9.3) |
| Algo que no se puede leer | `404` con el mismo cuerpo que un identificador inventado (M8) |
| Una renovación de sesión cortada a medias | 30 s de margen: la sesión sigue (4.3, 5.5) |

### 9.3 Concurrencia: lo que está garantizado

- **Garantizado:** la referencia de ticket por organización (contador atómico en la
  transacción), unicidad de correo, usuario y pertenencias (restricciones de la
  base), rotación del *refresh* con detección de reutilización, eventos publicados
  sólo tras el *commit*, y, con la PR #97, **los cambios de estado y las
  asignaciones**: cada escritura sólo se aplica si el ticket sigue en el estado contra
  el que se comprobó (`updateMany` condicionado al estado, o al responsable, que se
  leyó); la petición que pierde la carrera recibe `409 TICKET_CHANGED`. Igual el
  cierre automático de los tickets resueltos hace una semana (ya no pisa una
  reapertura) y el sello de la primera respuesta.
- **Lo que había** (encontrado al preparar esta guía, 15/10): `changeStatus()` leía el
  estado y luego actualizaba con `where: { id }` sin condición. Ocho agentes moviendo
  a la vez el mismo ticket OPEN → IN_PROGRESS recibían **ocho 200**, y el historial
  registraba la transición ocho veces. El enunciado lo pide dentro del soporte
  multiusuario **obligatorio** (II.2): «*No data corruption or race conditions occur
  with simultaneous user actions*».

**Demostrarlo** (✅ probado el 15/10 por la tarde, por HTTPS, en bash y en zsh):

```bash
# $A y el token de laura en $TOKEN como en 5.6; el de demo-agent, igual, en $AGENT
ORG=$(curl -s $A/organizations -H "authorization: Bearer $AGENT" | jq -r '[.[] | select(.name|startswith("Ayuntamiento"))][0].id')
T=$(curl -s -X POST $A/tickets -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"organizationId\":\"$ORG\",\"title\":\"Prueba de carrera en la defensa\",\"description\":\"Ocho cambios de estado lanzados a la vez.\"}" | jq -r .id)
for i in $(seq 8); do
  curl -s -o /dev/null -w '%{http_code}\n' -X PATCH "$A/tickets/$T/status" -H "authorization: Bearer $AGENT" \
    -H 'content-type: application/json' -d '{"status":"IN_PROGRESS"}' &
done | sort | uniq -c; wait
#       1 200
#       7 409
curl -s "$A/tickets/$T/history" -H "authorization: Bearer $AGENT" \
  | jq -c '[.[] | select(.field == "status") | "\(.oldValue) -> \(.newValue)"]'
#   ["OPEN -> IN_PROGRESS","null -> OPEN"]     ← una sola transición (la otra es el alta)
```

Y en la base, A.6 con la referencia del ticket nuevo. La prueba automática es
`apps/api/test/integration/concurrency.test.ts`: ocho peticiones a la vez para el
estado y ocho para la asignación; sin el arreglo fallan las dos (ocho 200). En local:
`make ci JOBS=integration` (11.1), o el fichero suelto dentro del contenedor (11.3).

### 9.4 Overall Quality — «¿esfuerzo y aprendizaje?»

La hoja lo puntúa aparte (*Functionality → Overall Quality*): comprensión de la web,
ir más allá del mínimo, tecnologías nuevas aprendidas, creatividad, concepto bien
ejecutado. Lo que lo demuestra sin reclamarlo como módulo:

- **Más allá del mínimo:** la aplicación en tres idiomas (en/es/ca) con cambio en
  vivo, tema claro/oscuro/sistema, búsqueda global, notas internas, adjuntos con
  comprobación por contenido, registro de auditoría con el antes y el después,
  página de estado independiente de la aplicación, sesiones revocables por
  dispositivo.
- **Aprendido en el camino** (que cada persona cuente lo suyo): Tailwind v4 y un
  design system propio (Aren), Socket.IO y el tiempo real (Elizabeth, Nahuel),
  i18next y un motor de temas (Israel), Prisma, RBAC, CI/CD, observabilidad y copias
  cifradas (Felipe).
- **Concepto bien ejecutado:** un *help desk* multiorganización que se usa de punta a
  punta (alta de la organización, invitación por correo, ticket, conversación,
  resolución, cierre) con 494 pruebas automáticas detrás (135 + 229 + 130).
- **Decisiones con criterio** (8.2): los contratos Zod compartidos, la tabla de
  políticas única, roles que se reclaman al verificar el correo.

---

## 10. Verificación final y bonus

- **Final Module Count:** se cuentan sólo los módulos que funcionan delante de quien
  evalúa. Con 23 reclamados y techo de 19, hay 4 de margen (6.0).
- **Project Success:** parte obligatoria completa (3–5, con B10, B11 y la carrera de
  9.3 fusionados, y B12 decidido), todos han contribuido (3.2), se explican decisiones
  (8.2), cumple el enunciado, README completo y exacto (B1, B3–B5, R1, R2, R8).
- **Bonus:** sólo si la parte obligatoria está **entera y perfecta** y la gestión de
  errores responde bien a usos inesperados (9.2). Cada módulo validado por encima de
  14 suma (mayor 2, menor 1) hasta 5. Por eso los puntos de riesgo de la parte
  obligatoria (HTTPS en local y lo que aún va por HTTP, B10 y B12; el fichero
  `.env_api`, B11; la carrera, 9.3; el README, B1–B5) valen más que cualquier módulo:
  un «No» en cualquiera de ellos anula todo el bonus.

---

## 11. CI en local y pruebas sueltas

### 11.1 El CI completo o por *jobs*, sin GitHub Actions

```bash
make ci                                  # los 6 jobs locales: quality unit integration compose images security
make ci JOBS="quality unit"              # sólo algunos (nombres exactos de scripts/ci/run-local.sh)
make ci JOBS=integration                 # PostgreSQL y Redis efímeros, migraciones, API compilada, 130 pruebas (125 en develop)
make ci JOBS=security                    # gitleaks, npm audit (críticas), Trivy
SKIP_TRIVY=1 make ci JOBS=security       # sin descargar Trivy (~150 MB)
```

Node y npm salen de un contenedor con las versiones de `.nvmrc` y `devEngines`
(24.19.0 / 11.17.0): no hace falta instalarlos. Los informes TAP quedan en
`test-results/`. En `sgoinfre` (exFAT) trabaja sobre un espejo automáticamente.

### 11.2 Con Node 24.19.0 y npm 11.17.0 en el host

```bash
npm ci
(cd apps/api && npx prisma generate)
npm run format:check && npm run lint && npm run typecheck && npm run build
npm test --workspace=apps/api          # 135 pruebas unitarias (node:test)
npm test --workspace=apps/web          # 229 pruebas en 42 ficheros (Vitest + jsdom; 227 en develop)
```

(`devEngines` hace que `npm` se niegue a correr con otra versión: usar `make ci` si
no se tienen esas versiones.)

### 11.3 Una prueba concreta ✅

```bash
# API, un fichero
cd apps/api && node --test test/unit/policies.test.ts
# API, sólo las pruebas cuyo nombre contiene un texto
node --test --test-name-pattern="RESOLVED" test/unit/state-machine.test.ts
# Web, un fichero
cd apps/web && npx vitest run test/legal-footer.test.tsx
# Web, por nombre
npx vitest run -t "public status page"
```

**Sin Node en el host** (lo normal en los puestos de 42: el disco de `sgoinfre` es
exFAT y no admite el `node_modules` de los *workspaces*), lo mismo dentro de los
contenedores de la pila de desarrollo, que tienen Node 24, sus dependencias y el repo
montado en `/app`. ✅ Probado el 15/10 con la pila en marcha:

```bash
# API: un fichero, por nombre, y la prueba de «ninguna ruta sin documentar»
docker exec -w /app/apps/api dev_api node --test test/unit/policies.test.ts                     # 52 pruebas
docker exec -w /app/apps/api dev_api node --test --test-name-pattern="RESOLVED" test/unit/state-machine.test.ts   # 7
docker exec -w /app/apps/api dev_api node --test test/unit/openapi.test.ts                      # 11
# Web: un fichero y por nombre
docker exec -w /app/apps/web dev_web npx vitest run test/legal-footer.test.tsx                  # 3
docker exec -w /app/apps/web dev_web npx vitest run -t "public status page"                     # 1 de 229
docker exec -w /app/apps/web dev_web npx vitest run test/session-restore.test.tsx               # 2: la sesión al abrir la app (4.3)
```

`node --test` termina con el resumen `ℹ tests 52 · ℹ pass 52 · ℹ fail 0`; Vitest,
con `Test Files … passed` y `Tests … passed`.

**Un fichero de integración** contra la pila de desarrollo. La suite hace más altas
y logins de lo que permite el límite de credenciales, así que la API se relanza con
el límite relajado y las pruebas tienen que ver el mismo valor; dentro del
contenedor comparten además `DATABASE_URL` y `UPLOAD_DIR` con la API (fuera, una
diferencia de `UPLOAD_DIR` hace fallar la prueba del borrado de cuentas). ✅ Probado
el 15/10 dentro del contenedor: 7 de 7.

```bash
# 0) Terminal limpia: sin POSTGRES_*, DATABASE_URL ni JWT_* exportadas (ver 1.8)
env | cut -d= -f1 | grep -E '^(POSTGRES|DATABASE_URL|DB_|JWT_)' || echo "terminal limpia"   # sólo los nombres
# 1) La API con los límites relajados (exportados: así Compose los ve seguro)
export RATE_LIMIT_AUTH_PER_MIN=100000 RATE_LIMIT_GLOBAL_PER_MIN=200000 \
       API_KEY_RATE_PER_MIN=100000 API_KEY_RATE_PER_HOUR=1000000
docker compose -p helpdesk-dev -f compose.dev.yml up -d api
until curl -sf https://localhost:5173/api/health > /dev/null; do sleep 2; done   # CURL_CA_BUNDLE de 1.4
docker exec dev_api printenv RATE_LIMIT_AUTH_PER_MIN            # 100000
# 2) La prueba, con los mismos valores
docker exec -w /app/apps/api -e API_BASE_URL=http://127.0.0.1:5000 \
  -e RATE_LIMIT_AUTH_PER_MIN -e RATE_LIMIT_GLOBAL_PER_MIN -e API_KEY_RATE_PER_MIN -e API_KEY_RATE_PER_HOUR \
  dev_api node --test test/integration/public-api.test.ts       # 7 pruebas
# 3) Volver a los límites normales
unset RATE_LIMIT_AUTH_PER_MIN RATE_LIMIT_GLOBAL_PER_MIN API_KEY_RATE_PER_MIN API_KEY_RATE_PER_HOUR
docker compose -p helpdesk-dev -f compose.dev.yml up -d api
docker exec dev_api printenv RATE_LIMIT_AUTH_PER_MIN            # 10
```

Deja cuentas de prueba en la base de desarrollo; para una base limpia, `make ci
JOBS=integration` (efímera) o `make reset-dev` después. Es una demostración para
el ensayo: delante de quien evalúa, mejor `make ci JOBS=integration`, que no toca la
pila de desarrollo.

Ficheros de integración (14): `auth`, `rbac`, `tenancy`, `role-grants`, `self-role`,
`admin-users`, `social`, `avatar`, `public-api`, `account-erasure`, `errors`,
`routes`, `openapi-contract` y `concurrency` (la carrera de 9.3). Cualquiera de ellos se
lanza igual que `public-api` en la receta de arriba, cambiando el nombre del fichero.
`concurrency` sólo registra cuatro cuentas y cabe con los límites normales (✅ 2 de 2
dentro del contenedor el 15/10 por la tarde):

```bash
docker exec -w /app/apps/api -e API_BASE_URL=http://127.0.0.1:5000 dev_api \
  node --test test/integration/concurrency.test.ts                # ℹ tests 2 · ℹ pass 2
```

### 11.4 Las alarmas y el despliegue, en local

```bash
make test-alerts-pull && make test-alerts    # promtool: sintaxis y comportamiento de las 23 reglas
make deploy-staging                          # construir y desplegar staging desde este host (sin Actions)
```

---

## 12. Plan B

| Si… | Entonces |
|---|---|
| El portátil no construye las imágenes (red del campus) | Llevar las imágenes ya construidas (`make` hecho antes); o usar otro portátil del equipo ya preparado |
| Producción no carga (Cloudflare bloqueado) | Plan de contingencia del runbook (DNS sin proxy); mientras, todo lo demostrable en local; HTTPS por capturas del certificado hechas hoy |
| El servidor no responde por SSH | Copia y ensayo en local (7.8); Actions sigue mostrando ensayos y despliegues anteriores. Para M11, Prometheus y Grafana en local con `obs-local.sh` (M11, plan B) |
| `429` al entrar en producción | Esperar 60 s; usar las sesiones ya abiertas (R7) |
| Un módulo falla en directo | No insistir: pasar al siguiente, volver al final. Hay 3 puntos de margen |
| Alguien no recuerda un detalle | La persona dueña lo explica; nunca contradecirse entre miembros |
| El navegador no confía en la autoridad local (la defensa acaba en otro portátil) | Importarla (1.9, un minuto). Mientras, `openssl s_client` y `curl` con `--cacert` demuestran que la cadena es válida, y el HTTPS público se enseña en producción (5.7) |
| Preguntan por el puerto 5000 o por Mailpit en HTTP | 5.7 (B12): qué es, por qué no lo usa nada de la demostración, y el arreglo en código si se decide |
| Swagger da 400 al elegir dos estados | R10: un valor por filtro en Swagger, o los mismos filtros por `curl` con comas (M14) |

---

## Anexo A — Consultas SQL

Todas ✅ probadas el 15/10 contra la base sembrada. Entrar con 2.2; las columnas van
entre comillas dobles.

```sql
-- A.1 Tablas (22, sin contar _prisma_migrations) y la estructura de una
SELECT count(*) AS tablas FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name <> '_prisma_migrations';
\dt
\d tickets

-- A.2 Pertenencias: quién es qué en cada organización
SELECT o.name AS organizacion, u.username, m.role
  FROM organization_members m
  JOIN organizations o ON o.id = m."organizationId"
  JOIN users u ON u.id = m."userId"
 ORDER BY o.name, m.role, u.username;
\d organization_members

-- A.3 Usuarios, rol de plataforma y hash Argon2id (la sal es distinta en cada fila)
SELECT username, email, "globalRole", "isActive",
       "emailVerifiedAt" IS NOT NULL AS verificado,
       left("passwordHash", 45) AS hash
  FROM users ORDER BY "createdAt";

-- A.4 Últimos tickets, con autor, asignado y categoría (lo que se ve en la lista)
SELECT t.reference, left(t.title, 40) AS titulo, t.status, t.priority,
       a.username AS autor, g.username AS asignado, c.name AS categoria
  FROM tickets t
  JOIN users a ON a.id = t."createdById"
  LEFT JOIN users g ON g.id = t."assignedToId"
  LEFT JOIN categories c ON c.id = t."categoryId"
 ORDER BY t."createdAt" DESC LIMIT 10;

-- A.5 Comentarios de un ticket: públicos y notas internas
SELECT t.reference, u.username, tc."isInternal" AS interna, left(tc.body, 50) AS texto, tc."createdAt"
  FROM ticket_comments tc
  JOIN tickets t ON t.id = tc."ticketId"
  JOIN users u ON u.id = tc."authorId"
 WHERE t.reference = 'AYUNTA-0003'            -- cambiar por la referencia que se vea en pantalla
 ORDER BY tc."createdAt";

-- A.6 Historial (sólo se añade, nunca se reescribe)
SELECT t.reference, h.field, h."oldValue", h."newValue", u.username AS quien, h."createdAt"
  FROM ticket_history h
  JOIN tickets t ON t.id = h."ticketId"
  JOIN users u ON u.id = h."changedById"
 WHERE t.reference = 'AYUNTA-0008'
 ORDER BY h."createdAt";

-- A.7 Amistades
SELECT r.username AS solicita, a.username AS recibe, f.status, f."updatedAt"
  FROM friendships f
  JOIN users r ON r.id = f."requesterId"
  JOIN users a ON a.id = f."addresseeId";

-- A.8 Mensajes del chat
SELECT u.username, left(m.body, 50) AS mensaje, m."createdAt"
  FROM messages m JOIN users u ON u.id = m."senderId"
 ORDER BY m."createdAt" DESC LIMIT 10;

-- A.9 Claves de la API pública: prefijo y hash, nunca el secreto
SELECT name, prefix, left("keyHash", 30) AS hash, scopes, "rateLimitPerMinute", "lastUsedAt", "revokedAt"
  FROM api_keys;

-- A.10 Auditoría: quién hizo qué
SELECT a."createdAt", u.username AS actor, a.action, a.entity, a."entityId"
  FROM audit_logs a LEFT JOIN users u ON u.id = a."actorId"
 ORDER BY a."createdAt" DESC LIMIT 15;

-- A.11 Sesiones: sólo el hash del refresh, familia de rotación, revocadas
SELECT u.username, left(s."refreshTokenHash", 16) AS refresh_hash, s."familyId",
       s."userAgent", s.ip, s."revokedAt" IS NOT NULL AS revocada
  FROM user_sessions s JOIN users u ON u.id = s."userId"
 ORDER BY s."createdAt" DESC LIMIT 10;

-- A.12 Migraciones aplicadas
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at;

-- A.13 RGPD
SELECT u.username, g.type, g.status, g."requestedAt", g."completedAt"
  FROM gdpr_requests g JOIN users u ON u.id = g."userId"
 ORDER BY g."requestedAt" DESC;

-- A.14 Recuento general
SELECT (SELECT count(*) FROM users) AS usuarios, (SELECT count(*) FROM organizations) AS organizaciones,
       (SELECT count(*) FROM tickets) AS tickets, (SELECT count(*) FROM ticket_comments) AS comentarios,
       (SELECT count(*) FROM messages) AS mensajes;
```

Para lanzar una de fuera de `psql` (por ejemplo la A.14):

```bash
docker exec dev_database sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT count(*) FROM tickets"'
```

---

## Anexo B — Preguntas difíciles

| Pregunta | Respuesta |
|---|---|
| «Esto lo ha hecho una sola persona» | Reparto por áreas, cada uno con commits propios en la suya (3.2); el front de tickets (Nahuel), el design system (Aren), el chat (Elizabeth), el i18n y el tema (Israel) son demostrables por su dueño |
| «¿Usasteis IA?» | Sí, y está declarado en el README por persona (B3): para qué y qué se revisó a mano. Cada uno explica su código sin ayuda |
| «El local va por HTTP» | Ya no: https://localhost:5173 con un certificado de una autoridad local, una por máquina, fuera del repositorio y restringida a localhost (1.9, 5.7). Lo que queda en HTTP en local —el 5000 para herramientas, Mailpit— y por qué no es la aplicación: B12 |
| «¿Esto no es una credencial?» (`apps/api/.env_api`, valores por defecto de `compose.dev.yml` como `mi_password`) | `.env_api` se borró (B11, #98) y `.env_*` está ignorado; eran marcadores sin uso. Los valores por defecto de `compose.dev.yml` (`${POSTGRES_PASSWORD:-mi_password}`) son el respaldo para que Compose no falle sin `.env`; nunca se usan, porque `gen-secrets.sh` escribe el `.env` antes de arrancar (5.3) |
| «¿Qué pasa si se cae el servidor?» | Un solo servidor (limitación declarada); copias cifradas fuera del host, ensayos semanales con RTO medido en segundos, runbook; la alerta de sitio caído salta en ~2 min salvo que caiga la máquina entera |
| «¿Por qué 404 y no 403 a quien no es miembro?» | Un 403 confirma que existe; un 404 con **el mismo cuerpo** que para un identificador inventado no da información. Vale para organizaciones y, desde #93, para tickets, comentarios y adjuntos (M8, punto 4). El 403 se queda para quien sí ve el recurso pero no puede hacer esa acción (el autor que quiere editar un ticket que ya no está abierto) |
| «¿Dónde se valida X?» | En los dos lados con el mismo esquema de `packages/contracts` (5.6) |
| «¿Cómo se crea el primer administrador?» | En el arranque, desde `BOOTSTRAP_ADMIN_*` (secretos), ya verificado, con correo `@helpdesk.invalid` (dominio reservado, RFC 2606); protegido frente a otros administradores |
| «¿Y si alguien registra el correo de su jefe para quedarse su rol?» | Los roles reservados se reclaman al **verificar** el correo, no al registrarse |
| «¿Por qué no ELK?» | En una instancia gratuita con dos entornos, Loki indexa etiquetas y reutiliza el Grafana que ya existe; por eso **no** se reclama el módulo de ELK |
| «Restaurad la copia de ayer» | 7.2 → 7.4 (ensayo) o 7.6 (real, en staging) |
| «¿Hay condiciones de carrera?» | 9.3: lo que está garantizado, cómo se encontró la del cambio de estado, cómo se arregló (escritura condicionada al estado leído, `409 TICKET_CHANGED`) y la demostración con ocho peticiones a la vez |
| «¿Por qué hay un 401 en rojo en la consola?» | 4.3: al entrar con datos malos es la respuesta correcta (la misma para un correo inexistente que para una contraseña mala), y Chrome anota toda respuesta HTTP de error; no es un error de JavaScript. Los 401 de `/auth/refresh` al recargar sí eran un fallo, y se arreglaron (#97) |
| «¿Por qué 30 s de margen al reutilizar un refresh?» | Una respuesta que nunca llegó (una recarga o una pestaña cerrada con la petición en vuelo) no es un robo, y sin el margen la sesión se cerraba sola. El coste: un token robado y reutilizado en esos 30 s, antes de que se use el sustituto, recibe un par; la siguiente renovación del navegador legítimo revoca entonces la familia entera |
| «¿Y si se rehace el certificado, o la autoridad?» | 1.9: el certificado se rehace sin consecuencias (lo firma la misma autoridad); la autoridad no la rehace el script nunca, y rehacerla a mano obliga a importarla de nuevo en cada navegador |
| «¿Qué aporta la búsqueda para ser un módulo?» | M14: texto completo con índice GIN y sin acentos, filtros combinables, orden y paginación en el servidor, estado en la URL, y la misma búsqueda en la API pública |

---

## Anexo C — Rutas de la aplicación

| Ruta | Pantalla |
|---|---|
| `#login`, `#register`, `#forgot-password`, `#reset-password`, `#verify-email` | Acceso |
| `#tickets`, `#new-ticket`, `#ticket-detail?…`, `#related-tickets` | Tickets. La lista guarda su estado en la URL: `#tickets?q=padro&status=OPEN&priority=HIGH&category=<id>&sort=oldest&page=2` |
| `#people`, `#people-profile?person=<usuario>` | Personas y perfiles |
| `#messages` | Chat |
| `#organization`, `#organization-roles`, `#organizations` | Organización activa, roles, lista de organizaciones |
| `#admin`, `#admin/audit`, `#platform-roles` | Plataforma (GLOBAL_ADMIN) |
| `#account`, `#account/profile`, `#account/preferences`, `#account/password`, `#account/sessions`, `#account/privacy`, `#account/delete` | Cuenta |
| `#privacy-policy`, `#terms` | Legales |
| `/status` (local: `/status.html`) | Página de estado (estática) |
| `/api/v1/docs`, `/api/v1/openapi.json` | Documentación de la API |

---

## Anexo D — Cloudflare, paso a paso

Comprobado el 16/10. Los menús son los del panel nuevo de Cloudflare; entre
paréntesis, los del antiguo. Todo se hace en https://dash.cloudflare.com → la
cuenta → el dominio `helpdesklite.me`, que es una sola zona para producción y
staging.

### D.1 Los 403 de staging (el desafío)

**Qué pasa.** La regla personalizada del WAF «Proteger entorno Staging» (desde
el 08/09) tiene la expresión `(http.host eq "staging.helpdesklite.me")`, más una
excepción para la IP del servidor, y la acción *Managed Challenge*. Al resolver el
desafío, el navegador recibe la cookie `cf_clearance`, que dura lo que diga
*Challenge Passage* (30 min; Cloudflare da una hora más a las peticiones XHR). La
aplicación no recarga la página, así que pasada esa hora y media las llamadas a la
API y la reconexión del WebSocket reciben el `403` de Cloudflare
(`cf-mitigated: challenge`). Un desafío no se puede resolver desde un `fetch` ni
desde un WebSocket: sólo recargando la página. Producción no tiene desafío.

**Antes de tocar nada.** *Security → Security rules* (*Security → WAF → Custom
rules*) → «Proteger entorno Staging» → *Edit* → *Edit expression*. Copiar la
expresión entera a un fichero: es lo que se restaura si algo sale mal. La parte
con `ip.src` es la excepción del servidor y **no se puede perder**: es la que deja
a Prometheus comprobar `https://staging.helpdesklite.me/api/health` (comprobado:
desde el servidor da `200`, desde fuera `403`). Sin ella salta `SitioCaido` para
staging.

**Opción A — alargar el *Challenge Passage* (la recomendada hoy).**

1. *Security → Settings* (*Security → Settings*), categoría *DDoS attacks*, o
   buscar «Challenge passage».
2. El lápiz de *Challenge passage* → **1 day** (u 8 horas) → *Save*.
3. Cada persona recarga staging una vez: el cambio vale para los desafíos que se
   resuelven a partir de ahora.
4. Comprobar: Chrome → DevTools → *Application* → *Cookies* →
   `https://staging.helpdesklite.me` → `cf_clearance` caduca dentro de un día.

Es un ajuste de toda la zona, pero sólo staging tiene desafío. Cloudflare
recomienda entre 15 y 45 minutos: con un día, una cookie robada vale un día, que
para un staging con datos de prueba es aceptable. Después de la defensa se puede
volver a 30 minutos. Por API: `PATCH /zones/<ZONE_ID>/settings/challenge_ttl` con
`{"value": 86400}` y un token con *Zone Settings: Edit*.

**Opción B — sin desafío desde las IP del equipo.**

1. La IP pública de cada sitio: `curl -s https://www.cloudflare.com/cdn-cgi/trace | grep '^ip='`.
2. *Security → Security rules* → *Create rule* → *Custom rules*. Nombre:
   «Staging: equipo sin desafío».
3. *Edit expression*:
   `(http.host eq "staging.helpdesklite.me" and ip.src in {<IP_CAMPUS> <IP_CASA>})`
4. *Choose action*: **Skip** → marcar **All remaining custom rules**.
5. Orden: **First**. Tiene que quedar **encima** de «Proteger entorno Staging» (si
   no, no hace nada); si sale debajo, arrastrarla arriba en la lista.
6. *Deploy*. Comprobar desde esa red:
   `curl -s -o /dev/null -w '%{http_code}\n' https://staging.helpdesklite.me/api/health`
   → `200` (antes, `403`).

Variante sin regla nueva: añadir a la expresión de la regla existente, dentro del
paréntesis exterior, `and not ip.src in {<IP_CAMPUS> <IP_CASA>}`. Coste: la IP del
campus la comparten todos los estudiantes y las de casa cambian. La aplicación
sigue pidiendo sesión. El plan gratuito admite 5 reglas personalizadas.

**Opción C — no desafiar la API ni el WebSocket.** Añadir a la expresión de la
regla, dentro del paréntesis exterior:
`and not starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/socket.io/")`.
La página se sigue desafiando al abrirla y las llamadas de la aplicación nunca:
arregla el síntoma de raíz. Coste: la API de staging queda sin desafío para
cualquiera (sigue pidiendo sesión, con *rate limit* en nginx y en la API, y
`/api/v1/docs` con su contraseña).

**Opción D — apagar el desafío durante la defensa.** *Security → Security
rules* → el interruptor de «Proteger entorno Staging» en *Off*; encenderlo después.
Staging queda público, con su inicio de sesión.

**Opción E — Cloudflare Access en vez del desafío (no hoy).** *Zero Trust →
Access → Applications → Add an application → Self-hosted* para
`staging.helpdesklite.me`: una política *Allow* con los correos del equipo
(*One-time PIN*), sesión de 24 h, y una política *Bypass* para la IP del servidor
(si no, la sonda de Prometheus se queda fuera); después, apagar la regla del
desafío. Gratis hasta 50 usuarios, pero es más trabajo y más que probar.

**En el código, no en Cloudflare:** el cliente HTTP y el socket podrían detectar
`cf-mitigated: challenge` y recargar la página para que el navegador resuelva el
desafío. Es poco código, pero el día de la defensa, no.

**Recomendación:** A (un día) y, si se trabaja desde el campus, B con su IP. Si no
se quiere tocar nada más, D durante la defensa. La demostración, en producción o en
local, no en staging (4.3).

### D.2 Las líneas «[Report Only]» de la consola (monitor de scripts)

Es *Client-side security* (antes *Page Shield*): añade a una muestra de las
respuestas su propia cabecera `Content-Security-Policy-Report-Only`
(`script-src 'none'; connect-src 'none'`, con informe a Cloudflare). No bloquea
nada, pero Chrome lo escribe en la consola.

1. *Security → Settings*, categoría *Client-side abuse* (*Security → Client-side
   security*, antes *Page Shield*) → **Continuous script monitoring** → *Off*. Una vez por zona: vale para
   producción y staging.
2. Si en *Security rules* hay reglas de tipo *Content security* con acción *Log*,
   añaden otra cabecera *report-only*: desactivarlas también.
3. Comprobar: recargar varias veces con DevTools abierto (es una muestra, no todas
   las respuestas) y, desde una terminal,
   `for i in $(seq 30); do curl -s -o /dev/null -D - https://helpdesklite.me/ | grep -ci '^content-security-policy-report-only'; done | sort | uniq -c`
   → todo `0` (el 16/10 por la mañana producción ya daba 30 de 30 sin ella).

### D.3 SSL/TLS «Full (strict)» (B9), sólo si da tiempo

1. Mirar primero: *SSL/TLS → Overview*, el modo actual; y *Rules → Configuration
   Rules*, donde puede haber ya una regla con *SSL: Strict* para algún host (el
   informe del 26/09 la cita: no tocarla).
2. Si el modo general no es *Full (strict)*: en el servidor,
   `sudo python3 scripts/ops/npm-tls.py --dry-run` y después sin `--dry-run`
   (certificado válido en el origen).
3. *SSL/TLS → Overview → Configure → Custom SSL/TLS* → **Full (strict)** → *Save*.
4. Comprobar que https://helpdesklite.me y staging cargan. Si dan **526**
   (certificado del origen no válido), volver a *Full* y revisar Nginx Proxy
   Manager (5.7).
