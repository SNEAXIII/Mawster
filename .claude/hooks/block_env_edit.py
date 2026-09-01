#!/usr/bin/env python3
"""Refuse an Edit/Write targeting a `.env` file.

Wired as a PreToolUse hook in `.claude/settings.json`. A hook receives the tool
call as JSON on **stdin** — there is no environment variable carrying the file
path — and blocks the call by exiting with code **2** (1 is a non-blocking
error, which is why the previous inline version never stopped anything).
"""

import json
import re
import sys

ENV_FILE = re.compile(r"(^|[\\/])[^\\/]*\.env(\.[\w-]+)?$", re.IGNORECASE)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0  # malformed payload: never block on our own failure

    path = payload.get("tool_input", {}).get("file_path", "")
    if path and ENV_FILE.search(path):
        print(f"BLOCKED: {path} is a .env file — edit it yourself", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
