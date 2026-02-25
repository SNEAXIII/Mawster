MIGRATION_MESSAGE := "init"

help:
	@echo "run-dev      --> run the server in dev mode with auto reload"
	@echo "create-mig   --> create fresh new migration"
	@echo "migrate      --> execute pending migrations"
	@echo "fixtures     --> load all fixtures for dev purposes"
	@echo "init-db      --> load one user and basic bdd"
	@echo "cancel-last  --> cancel last executed migration"
	@echo "test         --> run tests (xdist enabled by default, set XDIST=0 to disable)"
	@echo "test-cov     --> run test coverage (single-threaded)"
	@echo "install      --> install prod dependencies (uv sync)"
	@echo "install-dev  --> install prod + dev dependencies"
	@echo "reset-db     --> reset the database"

install:
	uv sync --no-dev

install-dev:
	uv sync --extra dev

run-dev:
	uv run fastapi dev --reload

create-mig:
	uv run alembic revision --autogenerate -m "$(MIGRATION_MESSAGE)"

migrate:
	uv run alembic upgrade head

fixtures:
	uv run python -m src.fixtures.sample_data

reset-db:
	uv run python -m src.fixtures.reset_db

init-db:
	uv run python -m src.fixtures.first_init_prod

cancel-last:
	uv run alembic downgrade -1

test:
	uv run pytest tests -v --tb=short -n auto

test-cov:
	uv run pytest tests --cov --cov-report term-missing -v
