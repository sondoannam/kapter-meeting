@echo off
setlocal
set SCRIPT_DIR=%~dp0
if not exist "%SCRIPT_DIR%..\infra\.env" (
  echo .env file not found, copying .env.example to .env
  copy /Y "%SCRIPT_DIR%..\infra\.env.example" "%SCRIPT_DIR%..\infra\.env"
)
docker compose -f "%SCRIPT_DIR%..\infra\postgres.docker-compose.yml" --env-file "%SCRIPT_DIR%..\infra\.env" up -d