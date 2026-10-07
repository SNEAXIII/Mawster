FROM rust:1.99.0-alpine3.24 AS base-rust
RUN cargo install --locked cargo-chef 
WORKDIR /app

FROM base-rust AS prepare-deps
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM base-rust AS builded-deps
COPY --from=prepare-deps /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY Cargo.toml Cargo.lock ./
COPY src src

FROM builded-deps AS assets
COPY static static
RUN cargo run --release --bin build_assets

FROM builded-deps AS server
RUN cargo build --release --bin mawster-static-files

FROM scratch AS runtime
WORKDIR /app
COPY --from=server /app/target/release/mawster-static-files /mawster-static-files
COPY --from=assets /app/build /app/static
ENV BIND_URL=0.0.0.0:80
EXPOSE 80
ENTRYPOINT ["/mawster-static-files"]