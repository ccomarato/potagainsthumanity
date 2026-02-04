#!/bin/sh
set -e

# Default to server:8081 for Docker Desktop
export UPSTREAM_HOST=${UPSTREAM_HOST:-server:8081}

# Replace only $UPSTREAM_HOST in nginx.conf
sed "s|\$UPSTREAM_HOST|${UPSTREAM_HOST}|g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start nginx
exec nginx -g "daemon off;"