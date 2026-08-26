FROM python:3.12-alpine

LABEL maintainer="SNEAXIII <misterbalise2@gmail.com>"

WORKDIR /app

COPY pyproject.toml uv.lock ./
# `--only-binary :all:` refuses sdists, so no package gets to run a setup.py at build
# time; `uv==` pins what an unpinned `pip install uv` would otherwise resolve fresh on
# every rebuild. `--no-build` is uv's equivalent of the pip flag.
RUN pip install --only-binary :all: uv==0.10.6 && \
    uv sync --only-group migrate --no-install-project --frozen --no-build

COPY --chown=root:root --chmod=555 migrations ./migrations
COPY --chown=root:root --chmod=555 alembic.ini migrate.sh ./

RUN sed -i 's/\r$//' migrate.sh

CMD ["sh", "migrate.sh"]
