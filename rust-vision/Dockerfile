FROM rust:1.99.1-slim-trixie AS base-rust
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
RUN cargo install --locked cargo-chef --version 0.1.78
WORKDIR /app

FROM base-rust AS prepare-deps
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo chef prepare

FROM base-rust AS gallery
COPY --from=prepare-deps /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --bin build_gallery
COPY Cargo.toml Cargo.lock ./
COPY src src
COPY --from=portraits . portraits
COPY --from=api-fixtures champions.json .
RUN cargo build --release --locked --bin build_gallery
RUN ./target/release/build_gallery --portraits portraits --champions champions.json --output gallery.bin

FROM base-rust AS ground-truth
COPY --from=prepare-deps /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --bin mcoc-vision
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN --mount=type=bind,source=artifacts-vision/data/real,target=/app/artifacts-vision/data/real \n    ./target/release/mcoc-vision

FROM base-rust AS worker-build
COPY --from=prepare-deps /app/recipe.json recipe.json
RUN cargo chef cook --release --locked --features worker --bin worker
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo build --release --locked --features worker --bin worker
RUN mkdir /runtime && ldd target/release/worker | awk '/=> \//{print $3}' | xargs -I{} cp --parents -L {} /runtime
RUN cp --parents -L /lib64/ld-linux-x86-64.so.2 /runtime

FROM scratch AS worker
WORKDIR /app
COPY --from=worker-build /runtime /
COPY artifacts-vision/artifacts/yolo/best.onnx artifacts-vision/artifacts/ocr/digits.onnx ./
COPY --from=gallery /app/gallery.bin .
COPY --from=worker-build /app/target/release/worker .
ENV DETECTOR_MODEL=best.onnx DIGITS_MODEL=digits.onnx GALLERY_FILE=gallery.bin
ENTRYPOINT ["/app/worker"]
