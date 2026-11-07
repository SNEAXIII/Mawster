# Models and screenshots live in a private submodule

Mawster is public, and a push stays in its history. The players' screenshots and their ground
truth (`data/real`), the trained weights and the code that trains them must not be published.
They live in the private repo `artifacts-vision`, checked out at `rust-vision/artifacts-vision`.

The runtime loads its models from `artifacts-vision/artifacts/` and scores against
`artifacts-vision/data/real` (`config.rs`, `REAL_DIR`). Training writes to
`artifacts-vision/out/runs/`; a model does nothing until its `.onnx` replaces the one in
`artifacts/`, and only after `cargo detect` passes every verified cell at 100% with it.
The gallery is derived from public portraits: it is built (`cargo gallery`, or by the image),
never tracked.

## Consequences

The public repo holds only the gitlink. Nothing under `artifacts-vision/` is ever added to it,
and `.dockerignore`, whose patterns are anchored at the context root, spells every private path
out in full.

CI checks out that one submodule with `BOT_TOKEN`, not `submodules: true`, which would also pull
the private notes. The image embeds the models, so its Docker Hub repo is private, and a fork
cannot build it: images are built on `release` and `staging` only.

The ground-truth check runs by hand. The Dockerfile's `ground-truth` stage is not wired into CI.
