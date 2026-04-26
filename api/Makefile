MESSAGE ?=

.PHONY: help install install-dev run-dev run-testing create-mig migrate fixtures load-champions reset-db init-db cancel-last test test-cov scrape-champions check fix format

help:
	@echo "run-dev      --> run the server in dev mode with auto reload"
	@echo "create-mig   --> create fresh new migration, add a message with MESSAGE=\"your message\""
	@echo "migrate      --> execute pending migrations"
	@echo "fixtures     --> load all fixtures for dev purposes"
	@echo "load-champions --> load champions from scripts/champions.json"
	@echo "load-masteries --> load masteries from scripts/masteries.json"
	@echo "init-db      --> load one user and basic bdd"
	@echo "cancel-last  --> cancel last executed migration"
	@echo "test         --> run tests (xdist enabled by default, set XDIST=0 to disable)"
	@echo "test-cov     --> run test coverage (single-threaded)"
	@echo "install      --> install prod dependencies only"
	@echo "install-dev  --> install all dependencies (prod + dev + migrate groups)"
	@echo "reset-db     --> reset the database"
	@echo "repopulate-db --> reset the database and load champions + fixtures"
	@echo "scrape-champions --> scrape MCOC wiki and download champion images"

install:
	uv sync --no-dev

install-dev:
	uv sync --all-groups

run-dev:
	uv run fastapi dev --reload

run-testing:
	uv run app_testing.py

create-mig:
	@test -n "$(MESSAGE)" || (echo "ERROR: MESSAGE is required: make create-mig MESSAGE=\"your_migration_name\"" && exit 1)
	uv run alembic revision --autogenerate -m "$(MESSAGE)"

migrate:
	uv run alembic upgrade head

fixtures:
	uv run python -m src.fixtures.sample_data

load-champions:
	uv run python -m src.fixtures.load_champions

load-masteries:
	uv run python -m src.fixtures.load_masteries

reset-db:
	uv run python -m src.fixtures.reset_db

init-db:
	uv run python -m src.fixtures.first_init_prod

cancel-last:
	uv run alembic downgrade -1

test:
	uv run pytest tests -v --tb=short -n 6

test-cov:
	uv run pytest tests --cov --cov-report term-missing -v

scrape-champions:
	cd ../static-assets && uv run python scrape_champions.py

repopulate-db:
	make reset-db
	make load-champions
	make load-masteries
	make fixtures

check:
	uvx ruff check

fix:
	uvx ruff check --fix

format:
	uvx ruff format