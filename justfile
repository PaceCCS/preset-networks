default:
  @just --list

dev:
  cd {{justfile_directory()}}/local && docker compose --profile dev up --build

prod:
  cd {{justfile_directory()}}/local && docker compose --profile prod up --build -d

down:
  cd {{justfile_directory()}}/local && docker compose --profile dev down && docker compose --profile prod down