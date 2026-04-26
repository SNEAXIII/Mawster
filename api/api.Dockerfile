FROM python:3.12-alpine AS builder

WORKDIR /app

RUN pip install uv

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen --no-install-project

COPY src ./src
RUN uv sync --no-dev --frozen

# ---

FROM python:3.12-alpine

LABEL maintainer="SNEAXIII <misterbalise2@gmail.com>"

RUN apk add --no-cache bash && pip install uv

WORKDIR /app

RUN addgroup --system --gid 1001 python && \
    adduser --system --uid 1001 fastapi

COPY --from=builder /app/.venv ./.venv

COPY --chown=root:root --chmod=555 main.py run.sh wait-for-it.sh ./
RUN find . -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;

USER fastapi
