FROM python:3.12-alpine

LABEL maintainer="SNEAXIII <misterbalise2@gmail.com>"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN pip install uv && uv sync --only-group migrate --no-install-project --frozen

COPY --chown=root:root --chmod=555 migrations ./migrations
COPY --chown=root:root --chmod=555 alembic.ini migrate.sh ./

RUN sed -i 's/\r$//' migrate.sh

CMD ["sh", "migrate.sh"]
