#!/bin/bash

# Creamos la carpeta si no existe
mkdir -p config/nginx/certs

# Solo generamos el certificado si no existe previamente
if [ ! -f config/nginx/certs/transcendence.crt ]; then
    printf "Generating self-signed SSL certificates...\n"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -subj "/C=ES/ST=Catalonia/L=Barcelona/O=42Barcelona/CN=localhost" \
        -keyout config/nginx/certs/transcendence.key \
        -out config/nginx/certs/transcendence.crt > /dev/null 2>&1
    printf "Certificates generated in config/nginx/certs/!\n"
else
    printf "The SSL certificates are already in place. Skipping a step...\n"
fi