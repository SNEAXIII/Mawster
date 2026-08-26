"""Path handling shared by the fixture loader CLIs.

The loaders accept `--json path/to/file.json` as a dev convenience. That
argument reaches `open()` directly, so it is validated here rather than in each
script: a relative `../` chain, a symlink or an absolute path would otherwise
let a faulty invocation read any file the seeder process can reach.
"""

import sys
from pathlib import Path

# The api project directory (src/fixtures/paths.py -> api/). Fixtures ship
# inside the repo, so nothing a loader reads has any business living outside it.
ALLOWED_ROOT = Path(__file__).resolve().parents[2]


def json_path_from_argv(default: Path) -> Path:
    """Return the `--json` argument when given, else `default`.

    The path is resolved (symlinks included) and must land inside
    `ALLOWED_ROOT` and be a regular file. Anything else exits non-zero rather
    than reaching the filesystem read.
    """
    asked_for_json = len(sys.argv) > 2 and sys.argv[1] == "--json"
    candidate = Path(sys.argv[2]) if asked_for_json else default

    resolved = candidate.resolve()

    if not resolved.is_relative_to(ALLOWED_ROOT):
        msg = f"❌ Refusing to read {resolved}: outside {ALLOWED_ROOT}"
        raise SystemExit(msg)
    if not resolved.is_file():
        msg = f"❌ No such fixture file: {resolved}"
        raise SystemExit(msg)

    return resolved
