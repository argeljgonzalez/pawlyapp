#!/bin/bash
set -euo pipefail
# Clave de autenticación interna persistente; nunca se guarda en Git.
if [ ! -s /data/keyfile/replica.key ]; then
  umask 077
  openssl rand -base64 756 > /data/keyfile/replica.key
fi
chown mongodb:mongodb /data/keyfile/replica.key
chmod 400 /data/keyfile/replica.key
exec /usr/local/bin/docker-entrypoint.sh mongod --replSet rs0 --keyFile /data/keyfile/replica.key --bind_ip_all
