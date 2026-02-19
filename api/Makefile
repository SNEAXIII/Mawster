ifeq ($(OS), Windows_NT)
    VENV_PYTHON_FOLDER := venv_win
    VENV_PYTHON_EXECUTABLE := $(VENV_PYTHON_FOLDER)/Scripts/python.exe
    PYTHON_EXECUTABLE := python
else
    VENV_PYTHON_FOLDER := venv_linux
    VENV_PYTHON_EXECUTABLE := $(VENV_PYTHON_FOLDER)/bin/python
    PYTHON_EXECUTABLE := python3
endif
RUN_MODULE := $(VENV_PYTHON_EXECUTABLE) -m
help:
	@echo "run-dev	-->	run the server in dev mode with auto reload"
	@echo "create-mig	-->	create fresh new migration"
	@echo "migrate	-->	execute pending migrations"
	@echo "fixtures	-->	load all fixtures for dev purposes"
	@echo "init-db	-->	load one user and basic bdd"
	@echo "cancel-last	-->	cancel last executed migration"
	@echo "test-cov	-->	run the test coverage"
	@echo "create-venv	-->	create the python virtual env"
	@echo "dl-prod-reqs	-->	install prod requirements"
	@echo "dl-dev-reqs	-->	install prod and dev requirements"
	@echo "reset-db	-->	reset the database"

create-venv:
	$(PYTHON_EXECUTABLE) -m venv $(VENV_PYTHON_FOLDER)

dl-prod-reqs:
	$(RUN_MODULE) pip install -r requirements.txt

dl-dev-reqs:
	$(RUN_MODULE) pip install -r requirements_dev.txt

run-dev:
	$(RUN_MODULE) fastapi dev --reload

create-mig:
	$(RUN_MODULE) alembic revision --autogenerate -m "init"

migrate:
	$(RUN_MODULE) alembic upgrade head

fixtures:
	$(RUN_MODULE) src.fixtures.sample_data

reset-db:
	$(RUN_MODULE) src.fixtures.reset_db

init-db:
	$(RUN_MODULE) src.fixtures.first_init_prod

cancel-last:
	$(RUN_MODULE) alembic downgrade -1

test-cov:
	$(RUN_MODULE) pytest tests --cov --cov-report term-missing -v
