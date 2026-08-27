FROM python:3.12-alpine AS builder

WORKDIR /app

RUN pip install --only-binary :all: uv==0.10.6

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen --no-build --no-install-project

COPY src ./src
# No --no-build: this sync installs mawster-api itself, which has no wheel.
RUN uv sync --no-dev --frozen

# ---

FROM python:3.12-alpine

LABEL maintainer="SNEAXIII <misterbalise2@gmail.com>"

ENV PYTHONUNBUFFERED=1

RUN apk add --no-cache bash && pip install --only-binary :all: uv==0.10.6

WORKDIR /app

RUN addgroup --system --gid 1001 python && \
    adduser --system --uid 1001 fastapi

COPY --from=builder /app/.venv ./.venv
COPY --from=builder /app/src ./src

COPY --chown=root:root --chmod=555 main.py run.sh seed.sh wait-for-it.sh ./
RUN find . -type f -name "*.sh" -exec sed -i 's/\r$//' {} \;

USER fastapi
