#!/usr/bin/env bash
# Use this script to start a local development database and create the configured test database.
# Re-running it is safe: existing containers and databases are reused.
#
# TO RUN ON WINDOWS:
# 1. Install WSL (Windows Subsystem for Linux):
#    https://learn.microsoft.com/en-us/windows/wsl/install
# 2. Install Docker Desktop or Podman Desktop:
#    https://docs.docker.com/desktop/setup/install/windows-install/
#    https://podman-desktop.io/docs/installation/windows-install
# 3. Open WSL and run `./start-database.sh` from the project directory.
#
# On Linux and macOS, run `./start-database.sh` directly from the project directory.

set -euo pipefail

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example to .env and configure it first."
  exit 1
fi

# Import database configuration from .env.
set -a
source .env
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set in .env."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to read the database URLs."
  exit 1
fi

# Parse URL components with Node so encoded usernames and passwords work correctly.
url_part() {
  node -e '
    const url = new URL(process.argv[1]);
    const part = process.argv[2];
    const values = {
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: decodeURIComponent(url.pathname.slice(1)),
    };
    process.stdout.write(values[part] ?? "");
  ' "$1" "$2"
}

DB_HOST=$(url_part "$DATABASE_URL" host)
DB_PORT=$(url_part "$DATABASE_URL" port)
DB_USER=$(url_part "$DATABASE_URL" user)
DB_PASSWORD=$(url_part "$DATABASE_URL" password)
DB_NAME=$(url_part "$DATABASE_URL" database)
DB_CONTAINER_NAME="$DB_NAME-postgres"

if [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
  echo "DATABASE_URL must include a username, password, and database name."
  exit 1
fi

# Prefer Docker when both supported container engines are installed.
if command -v docker >/dev/null 2>&1; then
  DB_CONTAINER_CMD="docker"
elif command -v podman >/dev/null 2>&1; then
  DB_CONTAINER_CMD="podman"
else
  echo "Docker or Podman is not installed."
  exit 1
fi

if ! "$DB_CONTAINER_CMD" info >/dev/null 2>&1; then
  echo "$DB_CONTAINER_CMD is not running."
  exit 1
fi

# Replace the template password in both database URLs before creating the container.
if [ "$DB_PASSWORD" = "password" ]; then
  echo "You are using the default database password."
  read -r -p "Generate a random password? [y/N]: " DB_PASSWORD_REPLY
  if ! [[ $DB_PASSWORD_REPLY =~ ^[Yy]$ ]]; then
    echo "Change the default password in .env and try again."
    exit 1
  fi

  DB_PASSWORD=$(openssl rand -base64 12 | tr '+/' '-_')
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "s#:password@#:$DB_PASSWORD@#g" .env
  else
    sed -i "s#:password@#:$DB_PASSWORD@#g" .env
  fi

  DATABASE_URL=${DATABASE_URL/:password@/:$DB_PASSWORD@}
  if [ -n "${DATABASE_TEST_URL:-}" ]; then
    DATABASE_TEST_URL=${DATABASE_TEST_URL/:password@/:$DB_PASSWORD@}
  fi
fi

# Inspect the expected container before checking its port. A running project
# container owns that port and should be reused rather than treated as a conflict.
container_exists=false
if "$DB_CONTAINER_CMD" inspect "$DB_CONTAINER_NAME" >/dev/null 2>&1; then
  container_exists=true
fi

if [ "$container_exists" = false ]; then
  if command -v nc >/dev/null 2>&1 && nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "Port $DB_PORT is already in use and container '$DB_CONTAINER_NAME' does not exist."
    exit 1
  fi

  "$DB_CONTAINER_CMD" run -d \
    --name "$DB_CONTAINER_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    -e POSTGRES_DB="$DB_NAME" \
    -p "$DB_PORT:5432" \
    -v "$DB_CONTAINER_NAME-data:/var/lib/postgresql" \
    docker.io/postgres
  echo "Created database container '$DB_CONTAINER_NAME'."
elif [ "$("$DB_CONTAINER_CMD" inspect --format '{{.State.Running}}' "$DB_CONTAINER_NAME")" != "true" ]; then
  "$DB_CONTAINER_CMD" start "$DB_CONTAINER_NAME" >/dev/null
  echo "Started existing database container '$DB_CONTAINER_NAME'."
else
  echo "Database container '$DB_CONTAINER_NAME' is already running."
fi

# PostgreSQL image initialization variables only apply when its data directory is
# first created. Refuse a mismatched username instead of recreating stored data.
CONTAINER_DB_USER=$(
  "$DB_CONTAINER_CMD" inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$DB_CONTAINER_NAME" |
    awk -F= '$1 == "POSTGRES_USER" { print substr($0, index($0, "=") + 1) }'
)

if [ "$CONTAINER_DB_USER" != "$DB_USER" ]; then
  echo "Container '$DB_CONTAINER_NAME' was initialized with PostgreSQL user '$CONTAINER_DB_USER',"
  echo "but DATABASE_URL uses '$DB_USER'. Existing container credentials cannot be changed through .env."
  exit 1
fi

# Database creation commands must wait until PostgreSQL accepts connections.
for DB_READY_ATTEMPT in {1..30}; do
  if "$DB_CONTAINER_CMD" exec "$DB_CONTAINER_NAME" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
    break
  fi
  if [ "$DB_READY_ATTEMPT" -eq 30 ]; then
    echo "PostgreSQL did not become ready within 30 seconds."
    exit 1
  fi
  sleep 1
done

# A separate test database is optional for compatibility, but tests fall back to
# DATABASE_URL and truncate its application tables when this value is absent.
if [ -z "${DATABASE_TEST_URL:-}" ]; then
  echo "DATABASE_TEST_URL is not set; no separate test database was created."
  exit 0
fi

TEST_DB_HOST=$(url_part "$DATABASE_TEST_URL" host)
TEST_DB_PORT=$(url_part "$DATABASE_TEST_URL" port)
TEST_DB_USER=$(url_part "$DATABASE_TEST_URL" user)
TEST_DB_PASSWORD=$(url_part "$DATABASE_TEST_URL" password)
TEST_DB_NAME=$(url_part "$DATABASE_TEST_URL" database)

# This script manages only databases inside its own local container.
if [ "$TEST_DB_HOST" != "$DB_HOST" ] || [ "$TEST_DB_PORT" != "$DB_PORT" ]; then
  echo "DATABASE_TEST_URL points to a different PostgreSQL server; leaving it unchanged."
  exit 0
fi

if [ "$TEST_DB_USER" != "$DB_USER" ] || [ "$TEST_DB_PASSWORD" != "$DB_PASSWORD" ]; then
  echo "DATABASE_TEST_URL must use the same username and password as DATABASE_URL for this container."
  exit 1
fi

if [ "$TEST_DB_NAME" = "$DB_NAME" ]; then
  echo "Warning: DATABASE_TEST_URL uses the development database. Tests will delete its application data."
  exit 0
fi

# Check first so rerunning the script does not try to create the database twice.
TEST_DB_EXISTS=$(
  "$DB_CONTAINER_CMD" exec "$DB_CONTAINER_NAME" \
    psql -U "$DB_USER" -d "$DB_NAME" -tAc \
    "SELECT 1 FROM pg_database WHERE datname = '$(printf '%s' "$TEST_DB_NAME" | sed "s/'/''/g")';"
)

if [ "$TEST_DB_EXISTS" = "1" ]; then
  echo "Test database '$TEST_DB_NAME' already exists."
else
  "$DB_CONTAINER_CMD" exec "$DB_CONTAINER_NAME" \
    createdb -U "$DB_USER" --owner "$DB_USER" "$TEST_DB_NAME"
  echo "Created test database '$TEST_DB_NAME'."
fi
