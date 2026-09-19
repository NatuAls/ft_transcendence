# `metrics_token_<entorno>` — los ficheros que lee Prometheus

`config/prometheus/prometheus.yml` declara dos jobs, uno por entorno, cada uno
con su credencial:

```yaml
  - job_name: helpdesk-api-prod
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/metrics_token_prod
  - job_name: helpdesk-api-staging
    authorization:
      type: Bearer
      credentials_file: /etc/prometheus/metrics_token_staging
```

Los ficheros **no se versionan** (`.gitignore`): contienen el token de
operación. Se crean en el servidor junto a `prometheus.yml`, con el **mismo
valor** que los secretos `PROD_METRICS_TOKEN` y `STAGING_METRICS_TOKEN` de
GitHub Actions (que son los que el despliegue escribe en el `.env` de cada
entorno). **Nunca escribas el valor en este README ni en ningún `.md`.**

```bash
cd /opt/helpdesk/observability/config/prometheus
# el valor sale del .env del entorno, no de un portapapeles
sudo sh -c 'printf "%s" "$(grep -m1 ^METRICS_TOKEN= /opt/helpdesk/prod/.env    | cut -d= -f2-)" > metrics_token_prod'
sudo sh -c 'printf "%s" "$(grep -m1 ^METRICS_TOKEN= /opt/helpdesk/staging/.env | cut -d= -f2-)" > metrics_token_staging'
sudo chmod 644 metrics_token_prod metrics_token_staging   # Prometheus corre como nobody (65534)
```

Sin salto de línea final (`printf` en vez de `echo`): Prometheus manda el
contenido literal como cabecera `Authorization`, y un `\n` de más produce un
401 que cuesta media hora encontrar.

`compose.observability.yml` los monta en sólo lectura. Si un fichero no existe
al hacer `up`, Docker crea un **directorio** con ese nombre y Prometheus no
puede leerlo («unable to read authorization credentials file»): créalos antes.

Comprobación: en Prometheus → Status → Targets, `helpdesk-api-prod` y
`helpdesk-api-staging` deben estar `UP`.
