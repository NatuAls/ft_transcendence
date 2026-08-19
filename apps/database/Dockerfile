FROM postgres:15-alpine

# Los scripts de esta ruta se ejecutan una sola vez al crear el volumen de datos.
COPY conf/init.sql /docker-entrypoint-initdb.d/init.sql
