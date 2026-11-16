FROM rust:1.99.1-slim-trixie@sha256:f6c4a35d21dbb3c89d7a8d056c193e94fc09037f2b58dd858b09c39a47dd02d7 AS base-rust
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ pkg-config libssl-dev xz-utils && rm -rf /var/lib/apt/lists/*
ADD --checksum=sha256:aca691abfbfbbe00d482e0ed2249eec3091b65e96a0ce92947fb5b254d48b16d \
    https://github.com/LukeMathWalker/cargo-chef/releases/download/v0.1.78/cargo-chef-x86_64-unknown-linux-musl.tar.xz /tmp/chef.tar.xz
RUN tar -xJf /tmp/chef.tar.xz -C /usr/local/cargo/bin --strip-components=1 \
      cargo-chef-x86_64-unknown-linux-musl/cargo-chef && rm /tmp/chef.tar.xz
WORKDIR /app

FROM base-rust AS prepare-deps
COPY Cargo.toml Cargo.lock ./
COPY src src
RUN cargo chef prepare

FROM base-rust AS deps
COPY --from=prepare-deps /app/recipe.json recipe.json
RUN cargo chef cook --release --locked
RUN cargo chef cook --release --locked --features worker
COPY Cargo.toml Cargo.lock ./
COPY src src

FROM deps AS gallery
COPY --from=portraits . portraits
COPY --from=api-fixtures champions.json .
RUN cargo build --release --locked --bin build_gallery
RUN ./target/release/build_gallery --portraits portraits --champions champions.json --output gallery.bin

FROM deps AS ground-truth
RUN cargo build --release --locked --bin mcoc-vision
ENV DETECTOR_MODEL=best.onnx DIGITS_MODEL=digits.onnx
COPY artifacts-vision/artifacts/yolo/best.onnx ./
COPY artifacts-vision/artifacts/ocr/digits_yolo26n_224_e140_fp16.onnx ./digits.onnx
COPY --from=gallery /app/gallery.bin artifacts/gallery/mosaic.bin
RUN --mount=type=bind,source=artifacts-vision/data/real,target=/app/artifacts-vision/data/real \
    ./target/release/mcoc-vision --no-save && touch /gt-passed

FROM deps AS worker-build

RUN cargo build --release --locked --features worker --bin worker
RUN mkdir /runtime && ldd target/release/worker | awk '/=> \//{print $3}' | xargs -I{} cp --parents -L {} /runtime
RUN cp --parents -L /lib64/ld-linux-x86-64.so.2 /runtime

FROM scratch AS worker
WORKDIR /app
COPY --from=worker-build /runtime /
COPY --from=ground-truth /app/best.onnx /app/digits.onnx ./
COPY --from=gallery /app/gallery.bin .
COPY --from=worker-build /app/target/release/worker .
# BuildKit only builds what the target needs: this makes the ground-truth gate one of them.
COPY --from=ground-truth /gt-passed /
ENV DETECTOR_MODEL=best.onnx DIGITS_MODEL=digits.onnx GALLERY_FILE=gallery.bin
ENTRYPOINT ["/app/worker"]
