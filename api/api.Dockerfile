FROM python:3.12-alpine AS builder

WORKDIR /app

# `--only-binary :all:` refuses sdists, so no package gets to run a setup.py at build
# time; `uv==` pins what an unpinned `pip install uv` would otherwise resolve fresh on
# every rebuild. Same reasoning for uv's own `--no-build` below.
RUN pip install --only-binary :all: uv==0.10.6

COPY pyproject.toml uv.lock ./
RUN uv sync --no-dev --frozen --no-build --no-install-project

COPY src ./src
# No `--no-build` here on purpose: every third-party dependency is already installed by
# the sync above, so the only thing left to build is mawster-api itself — our own source,
# which has no wheel and is not the supply-chain risk the flag guards against.
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
