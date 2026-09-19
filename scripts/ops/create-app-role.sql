-- =============================================================================
--  Rol de aplicación SIN privilegios — HelpDesk Lite   (auditoría B4 / N27)
--
--  Hoy la API se conecta como `helpdesk_admin`, que es SUPERUSUARIO de la
--  instancia de PostgreSQL: una inyección o un fallo de deserialización
--  tendría DROP DATABASE. Este script crea `helpdesk_app` con lo mínimo:
--  conectar, usar el esquema, DML sobre las tablas y usar las secuencias.
--  Las migraciones (DDL) las sigue haciendo el propietario, en un paso aparte
--  del arranque (ver apps/api/Dockerfile.prod: MIGRATE_DATABASE_URL).
--
--  Ejecutar con el envoltorio, que genera las contraseñas y hace el quoting:
--
--      sudo bash scripts/ops/create-app-role.sh prod      # o staging
--
--  Imprime UNA vez las dos contraseñas nuevas para pegarlas en el secreto
--  PROD_DB_APP_PASSWORD (GitHub Actions) y en PROD_DB_PASSWORD del .env de la
--  pila de observabilidad (postgres-exporter, con el usuario helpdesk_monitor).
--  No las escribe en ningún fichero.
--
--  Idempotente: se puede volver a ejecutar (cambia la contraseña y reafirma
--  los GRANT).
-- =============================================================================
\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'helpdesk_app') THEN
    CREATE ROLE helpdesk_app LOGIN;
  END IF;
END
$$;

ALTER ROLE helpdesk_app WITH LOGIN PASSWORD :app_password
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;

-- Conectar y usar el esquema (sin CREATE: no puede añadir tablas).
GRANT CONNECT ON DATABASE :"DBNAME" TO helpdesk_app;
GRANT USAGE ON SCHEMA public TO helpdesk_app;
REVOKE CREATE ON SCHEMA public FROM helpdesk_app;

-- DML sobre lo que ya existe.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO helpdesk_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO helpdesk_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO helpdesk_app;

-- Y sobre lo que creen las FUTURAS migraciones del propietario (current_user).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO helpdesk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO helpdesk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO helpdesk_app;

-- La tabla de migraciones de Prisma la lee la API al arrancar (prisma migrate
-- status no; pero el cliente puede consultarla): lectura basta.
-- (Ya cubierta por el GRANT sobre ALL TABLES.)

-- Rol de sólo lectura para los exportadores de Prometheus (postgres-exporter):
-- pg_monitor da acceso a pg_stat_* sin ver datos de las tablas.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'helpdesk_monitor') THEN
    CREATE ROLE helpdesk_monitor LOGIN;
  END IF;
END
$$;
ALTER ROLE helpdesk_monitor WITH LOGIN PASSWORD :monitor_password
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;
GRANT pg_monitor TO helpdesk_monitor;
GRANT CONNECT ON DATABASE :"DBNAME" TO helpdesk_monitor;

\echo 'helpdesk_app y helpdesk_monitor listos. Comprobación:'
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
  FROM pg_roles WHERE rolname IN ('helpdesk_admin','helpdesk_app','helpdesk_monitor') ORDER BY 1;
