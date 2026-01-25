default:
  @just --list

dev:
  cd {{invocation_directory()}}/local && docker compose --profile dev up --build

prod:
  cd {{invocation_directory()}}/local && docker compose --profile prod up --build -d

down:
  cd {{invocation_directory()}}/local && docker compose --profile dev down && docker compose --profile prod down