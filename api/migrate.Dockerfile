FROM python:3.14-alpine

LABEL maintainer="SNEAXIII <misterbalise2@gmail.com>"

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN pip install --only-binary :all: uv==0.10.6 && \
    uv sync --only-group migrate --no-install-project --frozen --no-build

COPY --chown=root:root --chmod=555 migrations ./migrations
COPY --chown=root:root --chmod=555 alembic.ini migrate.sh ./

RUN sed -i 's/\r$//' migrate.sh

CMD ["sh", "migrate.sh"]
