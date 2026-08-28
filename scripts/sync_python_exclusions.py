#!/usr/bin/env python3
"""Sync coverage exclusions between api/pyproject.toml and sonar-project.properties."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXCLUSIONS = [
    "*/__init__.py",
    "tests/*",
    "migrations/*",
    "scripts/*",
    "src/fixtures/*",
    "src/utils/logging_config.py",
    "src/controllers/dev_controller.py",
]

# Sonar-only: coverage.py never sees these.
SONAR_EXTRA = ["front/**", "static-assets/**", ".claude/**", "api/main.py"]


def sonar_pattern(p: str) -> str:
    p = p.replace("*/", "**/", 1) if p.startswith("*/") else p
    p = f"{p[:-2]}/**" if p.endswith("/*") else p
    return f"api/{p}"


def replace_line(path: Path, prefix: str, new_line: str) -> None:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    for i, line in enumerate(lines):
        if line.startswith(prefix):
            lines[i] = new_line
            # NOSONAR: S2083 is false, it is hardcoded content
            path.write_text("".join(lines), encoding="utf-8")
            return
    msg = f"No {prefix!r} found in {path.name}"
    raise SystemExit(msg)


replace_line(
    ROOT / "api" / "pyproject.toml",
    "omit",
    "omit = [" + ", ".join(f'"{p}"' for p in EXCLUSIONS) + "]\n",
)
replace_line(
    ROOT / "sonar-project.properties",
    "sonar.coverage.exclusions",
    "sonar.coverage.exclusions="
    + ",".join(SONAR_EXTRA + [sonar_pattern(p) for p in EXCLUSIONS])
    + "\n",
)
print("Synced.")
