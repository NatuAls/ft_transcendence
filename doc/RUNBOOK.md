# Runbook de operaciones — HelpDesk Lite

Qué hacer cuando algo pasa en producción o en staging, en orden y sin
adivinar. Todo lo de aquí se ejecuta como `ubuntu` con `sudo` en la VM de
Oracle, desde un checkout del repositorio en `~/repo`. Nunca se escriben
secretos en este fichero ni en el chat: los valores viven en GitHub
(Secrets) y en los `.env` del servidor.

| Entorno | URL | Directorio | Despliegue |
|---|---|---|---|
| Producción | https://helpdesklite.me | `/opt/helpdesk/prod` | `Deploy Production` al fusionar en `main` (PR aprobada + puerta `gate`) |
| Staging | https://staging.helpdesklite.me | `/opt/helpdesk/staging` | `Deploy Staging` al fusionar en `develop` |
| Observabilidad | túnel SSH (ver §6) | `/opt/helpdesk/observability` | a mano: `scripts/ops/sync-observability.sh` |
| Proxy (NPM) | :80/:443 (sólo Cloudflare) · :81 admin (sólo local) | `/opt/helpdesk/proxy` | a mano |

## 1 · ¿Está caído? Diagnóstico en 2 minutos

```bash
curl -s https://helpdesklite.me/api/health/status | jq .overall     # "operational"
sudo docker ps --format '{{.Names}}\t{{.Status}}' | grep -E 'prod|staging|proxy'
sudo docker logs --tail 50 helpdesk-api-prod
curl -s 127.0.0.1:9090/api/v1/alerts | jq '.data.alerts[] | {a:.labels.alertname, e:.labels.env, s:.state}'
```

- **No hay contenedores `helpdesk-*-prod`** → alguien hizo `compose down`.
  El temporizador `helpdesk-ensure@prod.timer` los levanta solo en ≤ 10 min
  (§4). Si no puedes esperar: `cd /opt/helpdesk/prod && sudo docker compose -f compose.prod.yml up -d --pull never`.
- **`api` reiniciándose** → `sudo docker logs helpdesk-api-prod`: casi siempre
  una variable de entorno inválida (Zod la nombra) o la base sin migrar.
- **Todo `Up (healthy)` pero la web da 5xx** → el proxy: `sudo docker logs proxy-app-1 --tail 50`;
  comprobar que los contenedores están en la red `proxy-tier`.
- **`SitioCaido` sólo en staging con todo sano** → Cloudflare está desafiando
  la sonda (regla WAF de staging). La excepción es una regla *Skip* para la
  IP del servidor (ver `Audit/audit3.md` §14.4-B, en el repo privado).

## 2 · Desplegar, redesplegar y volver atrás

- **Normal**: PR → `develop` (staging) → PR `develop → main` (producción).
  La puerta `gate` exige aprobación de otra persona sobre el último commit.
- **Redesplegar el mismo commit** (p. ej. tras cambiar un secreto):
  Actions → *Deploy Production* → *Run workflow*. Sólo lo puede lanzar quien
  esté en la variable `PROD_APPROVERS`.
- **Volver a la versión anterior**: `remote-deploy.sh` ya lo hace solo si la
  API no llega a estar sana. Para forzarlo a mano: *Run workflow* del commit
  anterior (`main` sigue igual; el SHA a desplegar es el del run). Ojo: el
  rollback revierte la imagen, **no** las migraciones ya aplicadas.
- **Qué hace el despliegue**: copia de seguridad `predeploy-<sha>` → `pull`
  → `up -d` → espera `healthy` → si falla, log de la API + rollback.

## 3 · Copias de seguridad y restauración

- Cron **diario a las 00:00 UTC** dentro de `helpdesk-backup-<env>`
  (`scripts/backup.sh`): dump cifrado (AES-256) + adjuntos → local
  (`/opt/helpdesk/<env>/backups`, 14 días) y Oracle Object Storage
  (`helpdesk-backups/<env>`). Métricas en `backups/metrics/backup.prom`.
- **Copia manual ahora**: `sudo docker exec -e BACKUP_LABEL=manual helpdesk-backup-prod sh /backup.sh`
- **Ensayo de restauración** (semanal por `backup-drill.yml`, o a mano):
  `sudo bash scripts/restore.sh --drill` — Postgres efímero, mide el RTO, no
  toca nada. Informe en `backups/<copia>/RESTORE-DRILL-*.txt`.
- **Restauración REAL**: `sudo bash scripts/restore.sh --production backups/<copia>`.
  Pide escribir `RESTAURAR`; hace antes una copia `pre-restore`; si el
  MANIFEST no cuadra **aborta**; si `pg_restore` devuelve errores **no
  levanta la pila** y lo dice (`RESTORE_IGNORE_ERRORS=1` para seguir a sabiendas).
- La clave de cifrado es `<ENV>_BACKUP_KEY` (GitHub). Sin ella las copias no
  se abren: si se rota, guardar la anterior.

## 4 · Parar un entorno a propósito (mantenimiento, pruebas)

El 17/09 producción estuvo 14 h 49 min parada tras un `compose down`
deliberado que nadie volvió a levantar. Desde entonces:

```bash
sudo touch /opt/helpdesk/prod/.maintenance     # ANTES: el temporizador no toca nada
# ... parar, probar, lo que sea ...
sudo rm /opt/helpdesk/prod/.maintenance        # DESPUÉS
```

Sin el marcador, `helpdesk-ensure@prod.timer` (cada 5 min,
`scripts/ops/ensure-stack.sh`) levanta la pila si `api`, `web` o `db` llevan
dos comprobaciones sin correr. Avisar en el chat del equipo antes de parar.

## 5 · Alertas: qué significa cada una y qué hacer

Definidas en `config/prometheus/rules/alerts.yml`; cada alerta lleva un
`runbook:` con el primer comando. Llegan a Telegram (críticas) y correo.

| Alerta | Significa | Primer paso |
|---|---|---|
| `SitioCaido` / `ApiNoLista` | la sonda externa no ve `/api/health` / la API no está *ready* | §1 |
| `SondaTargetCaido` | Prometheus no puede leer un exportador | `docker ps`; `sync-observability.sh` |
| `Tasa5xxSostenida` / `LatenciaAlta` | la API responde mal o lenta | `docker logs helpdesk-api-<env>`; Grafana → panel API |
| `RateLimitDisparado` | muchos bloqueos por límite de peticiones | ¿ataque o cliente roto? Cloudflare → Security → Events |
| `ContenedorReiniciandose` | > 2 reinicios en 15 min | logs del contenedor; healthcheck |
| `DiscoBajo` / `DiscoCritico`, `MemoriaAlta`, `PostgresConexionesAlLimite`, `RedisSinMemoria` | recursos | `df -h`, `docker system df`, `docker stats` |
| `BackupFallido` / `BackupAntiguo` / `BackupSospechosamentePequeno` | copia fallida / > 36 h sin copia / la mitad de lo habitual | `cat /opt/helpdesk/<env>/backups/cron.log`; copia manual (§3) |
| `SinMetricaDeBackup` / `SinMetricaDeEnsayo` | la métrica ni existe (host nuevo, cron roto) | `ls backups/metrics`; ejecutar copia/ensayo |
| `EnsayoDeRestauracionFallido` / `…Antiguo` | el ensayo falló / > 10 días | `scripts/restore.sh --drill` y leer el informe |
| `CertificadoCaducaPronto` / `CertificadoCaducaYa` | el certificado del sitio caduca / ha caducado | Cloudflare lo renueva solo; en modo DNS only, NPM (§7) |

Prueba de la cadena de avisos (llega a Telegram y correo, y luego se resuelve):

```bash
curl -XPOST 127.0.0.1:9093/api/v2/alerts -H 'Content-Type: application/json' \
  -d '[{"labels":{"alertname":"PruebaDeAlertas","severity":"critical","env":"prod"},"annotations":{"summary":"prueba"}}]'
```

## 6 · Ver Grafana / Prometheus (túnel)

Usuario `monitor` (sólo túnel, sin shell). Clave y contraseña de Grafana:
pedirlas a Felipe por canal seguro. Con la clave:

```bash
ssh -N -i <clave-monitor> -L 3000:127.0.0.1:3000 -L 9090:127.0.0.1:9090 monitor@<IP>
# Grafana http://localhost:3000 · Prometheus http://localhost:9090
```

## 7 · TLS entre Cloudflare y el origen (N23)

Estado de partida: Cloudflare en modo *Flexible* (HTTPS sólo hasta
Cloudflare; Cloudflare → Oracle en HTTP). Para cerrar ese tramo:

1. En el servidor: `sudo python3 scripts/ops/npm-tls.py` — pide un
   certificado Let's Encrypt para `helpdesklite.me` y `staging.` por la API
   de NPM y lo asigna a los dos proxy hosts (sin forzar HTTPS aún).
   Credenciales en `/root/.npm-admin` (600). Con `CF_DNS_API_TOKEN` usa
   DNS-01 (recomendado; no depende del WAF).
2. Cloudflare → SSL/TLS → Overview → **Full (strict)**. Comprobar
   `curl -sI https://helpdesklite.me/ | head -1` → 200.
3. Opcional: `sudo python3 scripts/ops/npm-tls.py --force-ssl`
   (redirección 80 → 443 en NPM). **Nunca antes del paso 2**: con Flexible
   provoca un bucle de redirecciones.
4. Renovación: NPM la hace sola (certbot). `CertificadoCaduca` avisa si no.

## 8 · Plan B: Cloudflare bloqueado por la orden judicial (N42)

Desde redes españolas, en horario de partidos, LaLiga hace bloquear rangos
de IP de Cloudflare: el sitio no carga aunque el servidor esté perfecto (se
ve un certificado `CN=core1.netops.test` o un timeout). Si pasa el día de
la defensa, se sirve **sin Cloudflare** durante unas horas:

Requisito previo: el paso §7-1 hecho (certificado Let's Encrypt en NPM).
Sin él, en modo *DNS only* el navegador vería un certificado inválido.

1. **Abrir el origen** (hoy sólo acepta 80/443 desde Cloudflare):
   - Oracle → Networking → VCN → Security List → añadir *Ingress* `0.0.0.0/0`
     TCP 80 y 443 (dejar las de Cloudflare; se quitan después).
   - En el servidor: `sudo bash scripts/ops/origin-cloudflare-only.sh --remove`.
2. **Forzar HTTPS en NPM** si no estaba: `sudo python3 scripts/ops/npm-tls.py --force-ssl`.
3. **Cloudflare → DNS**: en los registros `helpdesklite.me` y `staging`,
   *Proxy status* → **DNS only** (nube gris). Propaga en 1-5 min (TTL auto).
4. Comprobar desde una red española y desde el móvil (datos):
   `curl -sI https://helpdesklite.me/ | head -1`; el certificado ahora es el
   de Let's Encrypt.
5. **Volver** (mismo día, en orden inverso): Proxy → *Proxied* (nube
   naranja) → esperar 5 min → `origin-cloudflare-only.sh --apply` → quitar
   las reglas `0.0.0.0/0` de la VCN. Con el origen abierto se pierden el WAF,
   el caché y el ocultamiento de la IP: no dejarlo así más de lo necesario.

Alternativa más simple si sólo falla la red del campus: enseñar la demo por
datos móviles de otro operador, o por una VPN fuera de España.

## 9 · Rotar un secreto

1. Generar el valor nuevo (`openssl rand -hex 32` o `scripts/ci/rotate-secrets.sh <env>`).
2. Si es de la base de datos: primero `ALTER USER … PASSWORD` en Postgres.
3. Cambiarlo en GitHub → Secrets → *Actions*.
4. Redesplegar (*Run workflow*) para que `remote-deploy.sh` reescriba el `.env`.
5. `METRICS_TOKEN`: además `sudo bash scripts/ops/sync-observability.sh`
   (regenera `config/prometheus/metrics_token_<env>`).
6. La clave de backup: guardar la anterior (las copias viejas siguen cifradas con ella).

## 10 · Endurecimiento del host (referencia)

`scripts/ops/harden-host.sh` (fail2ban, `PermitRootLogin no`, `deployer` sin
túnel/PTY, rpcbind fuera), `scripts/ops/origin-cloudflare-only.sh` (DOCKER-USER),
`scripts/ops/create-app-role.sh` (rol `helpdesk_app` sólo DML y
`helpdesk_monitor`), `scripts/ops/cleanup-host-personal-data.sh`. Todos
idempotentes; la cabecera de cada uno explica qué toca.
