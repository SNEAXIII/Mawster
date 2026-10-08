FROM rust:1.99.0-alpine3.24 AS base-rust
RUN cargo install --locked cargo-chef --version 0.1.78
WORKDIR /app

FROM base-rust AS prepare-deps
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo chef prepare

FROM base-rust AS assets
COPY --from=prepare-deps /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --bin build_assets --features=assets
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo build --release --locked --bin build_assets --features=assets
COPY static static
RUN ./target/release/build_assets

FROM base-rust AS server
COPY --from=prepare-deps /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --bin mawster-static-files --features=server
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo build --release --locked --bin mawster-static-files --features=server

FROM scratch AS runtime
WORKDIR /app
COPY --from=assets /app/build /app/static
COPY --from=server /app/target/release/mawster-static-files /mawster-static-files
USER 65534:65534
EXPOSE 8005
ENTRYPOINT ["/mawster-static-files"]