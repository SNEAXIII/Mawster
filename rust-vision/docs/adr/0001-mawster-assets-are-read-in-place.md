# Mawster's assets are read in place, never mirrored

The crate lives inside Mawster, at `rust-vision/`, so the champion list and the portraits are
always one directory up: `config.rs` reads `../api/src/fixtures/champions.json` and
`../static-assets/static/champions` directly. The Docker build receives the same two
directories as named build contexts, `api-fixtures` and `portraits` (`compose-dev.yaml`,
`_images.yaml`), and builds the gallery from them.

This replaces the mirror of the standalone `mcoc-vision` repo. Its CI cloned it alone, so it
kept a copy of `champions.json` and a pre-commit hook to refresh it; the hand-kept copy before
that hook had drifted to 52 of 330 champions. Inside Mawster there is nothing to mirror.

## Consequences

No copy, no hook, no drift. A new champion reaches the worker with the next image build, and
every release rebuilds every image.

Every path is relative to the working directory: the binaries and the Makefile run from
`rust-vision/`. The training code of the private submodule reads the same two sources through
`config.MAWSTER`.
