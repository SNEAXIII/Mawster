# Model-free: exercises the vision.jobs/vision.results wiring in E2E without
# the real worker's ~3.5 GB of torch/paddle models. Never run alongside the
# real vision-worker — both consume the same queue (see compose-dev.yaml,
# this service only starts under `--profile e2e`).
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Dependencies first, code later: only aio-pika + aioboto3, no torch/paddle.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --no-dev

FROM python:3.12-slim AS runtime

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
COPY main.py ./

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1

CMD ["python", "main.py"]
