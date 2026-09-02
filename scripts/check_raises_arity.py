#!/usr/bin/env python3
"""Fail when a `pytest.raises` block can throw from more than one place.

Ruff's PT012 already rejects a block holding several statements. It does not look
inside the statement, so this stays invisible to it:

    with pytest.raises(HTTPException):
        await _init(session, storage, [_declaration(size=TOO_BIG)])

`_declaration()` runs inside the block. If it ever raised an HTTPException of its
own the test would pass green without `_init` being called at all — the assertion
would prove nothing. Bind the setup above the block instead:

    declaration = _declaration(size=TOO_BIG)

    with pytest.raises(HTTPException):
        await _init(session, storage, [declaration])

The rule: at most one counted call anywhere inside the block, and it is the one
under test. UUID generators are allowlisted (see ALLOWED_CALLS).

Usage: check_raises_arity.py [path ...]   (default: api/tests)
"""

import ast
import sys
from pathlib import Path

# scripts/ -> repo root -> api/tests
DEFAULT_TARGET = Path(__file__).resolve().parents[1] / "api" / "tests"

# Calls that do not count towards the budget. A UUID generator draws a random value and
# has no failure mode a test could ever be asserting on, so hoisting it above the block
# buys nothing — unlike a fixture builder or a DTO constructor, which can raise the very
# exception the block is checking for. Keep this list short: every entry is a hole.
ALLOWED_CALLS = frozenset({"uuid.uuid1", "uuid.uuid4", "uuid1", "uuid4"})


def _is_raises_block(node: ast.With | ast.AsyncWith) -> bool:
    """True when the `with` opens a `pytest.raises(...)` (or bare `raises(...)`)."""
    for item in node.items:
        call = item.context_expr
        if isinstance(call, ast.Call):
            func = call.func
            if isinstance(func, ast.Attribute) and func.attr == "raises":
                return True
            if isinstance(func, ast.Name) and func.id == "raises":
                return True
    return False


def _calls_in_body(node: ast.With | ast.AsyncWith) -> list[ast.Call]:
    """Every call in the block body that counts. The context expression is not part of
    the body, so a `match=re.escape(...)` on the `raises` line never counts either."""
    return [
        n
        for stmt in node.body
        for n in ast.walk(stmt)
        if isinstance(n, ast.Call) and ast.unparse(n.func) not in ALLOWED_CALLS
    ]


def check_file(path: Path) -> list[str]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except SyntaxError as exc:
        return [f"{path}:{exc.lineno}: could not parse ({exc.msg})"]

    problems = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.With | ast.AsyncWith) or not _is_raises_block(node):
            continue
        calls = _calls_in_body(node)
        if len(calls) > 1:
            extra = ", ".join(sorted({ast.unparse(c.func) for c in calls[1:]}))
            problems.append(
                f"{path}:{node.lineno}: {len(calls)} calls inside `pytest.raises` "
                f"(hoist the setup above the block: {extra})"
            )
    return problems


def iter_python_files(targets: list[Path]):
    for target in targets:
        if target.is_dir():
            yield from sorted(target.rglob("*.py"))
        elif target.suffix == ".py":
            yield target


def main(argv: list[str]) -> int:
    targets = [Path(a) for a in argv[1:]] or [DEFAULT_TARGET]
    problems = [p for f in iter_python_files(targets) for p in check_file(f)]
    for problem in problems:
        print(problem)
    if problems:
        print(f"\n{len(problems)} block(s) with more than one call that can throw.")
        print("Bind the setup to a variable above the `with`, so only the call under")
        print("test can raise. See the docstring at the top of this script.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
