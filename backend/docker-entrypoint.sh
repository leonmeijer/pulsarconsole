#!/bin/bash
# =============================================================================
# Pulsar Console API - Docker Entrypoint
# =============================================================================
# This script runs database migrations before starting the application.

set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec "$@"

