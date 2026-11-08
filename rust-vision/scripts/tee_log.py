"""Copy stdin to the terminal and to a file: `make` on Windows runs cmd, which has no `tee`.

some_command 2>&1 | uv run python scripts/tee_log.py out/worker.log
"""

import sys
from pathlib import Path


def main(path: Path) -> None:
    sys.stdin.reconfigure(encoding="utf-8", errors="replace")
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as log:
        for line in sys.stdin:
            for stream in (sys.stdout, log):
                stream.write(line)
                stream.flush()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
