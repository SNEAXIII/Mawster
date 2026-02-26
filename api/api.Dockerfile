FROM python:3.12-alpine

LABEL maintainer="SNEAXIII <misterbalise2@gmail.com>"

# Required to run wait for it
RUN apk add --no-cache bash

WORKDIR /app

RUN addgroup --system --gid 1001 python&&\
    adduser --system --uid 1001 fastapi

COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --no-dev --frozen --no-install-project

COPY --chown=root:root --chmod=555 migrations ./migrations
COPY --chown=root:root --chmod=555 alembic.ini main.py run.sh wait-for-it.sh Makefile ./
COPY --chown=root:root --chmod=555 src ./src
COPY --chown=root:root --chmod=555 scripts ./scripts
COPY --chown=root:root --chmod=555 static ./static

RUN uv sync --no-dev --frozen
RUN find . -type f -name "*.sh" -exec dos2unix {} \;

USER fastapi