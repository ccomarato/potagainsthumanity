#!/bin/sh
set -e

# Default to server:8081 for Docker Desktop
export UPSTREAM_HOST=${UPSTREAM_HOST:-server:8081}

# Substitute environment variables in nginx.conf
envsubst < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start nginx
exec nginx -g "daemon off;"
