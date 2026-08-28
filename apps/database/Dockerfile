FROM postgres:15-alpine

# La imagen contiene los scripts para que la inicializacion no dependa de un
# bind mount sobre el sistema de archivos compartido, que puede producir
# errores "Stale file handle" antes de que PostgreSQL llegue a arrancar.
COPY conf/01-extensions.sql /docker-entrypoint-initdb.d/01-extensions.sql
