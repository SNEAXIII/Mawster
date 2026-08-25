"""Hoist indented `import ...` / `from ... import ...` to the top of their module.

Local imports buried inside functions or methods are found with the AST rather
than by matching a text prefix, so nested indentation and parenthesised
multi-line imports are handled. Imports living in an `if TYPE_CHECKING:` block
are left alone: that is the whole point of such a block.

    python3 api.py            # dry run, writes nothing
    python3 api.py --apply    # rewrite the files
"""

import argparse
import ast
import textwrap
from pathlib import Path

TARGET_DIRS = ("src", "tests")
SKIP_PARTS = ("__pycache__", ".venv", "venv", "node_modules")

AnyImport = ast.Import | ast.ImportFrom
ImportKey = tuple[str, int, str | None, tuple[tuple[str, str | None], ...]]


def import_key(node: AnyImport) -> ImportKey:
    """Identity of an import, so the same one is not hoisted twice."""
    level = getattr(node, "level", 0)
    module = getattr(node, "module", None)
    return (type(node).__name__, level, module, tuple((a.name, a.asname) for a in node.names))


def type_checking_lines(tree: ast.Module) -> set[int]:
    """Line numbers sitting inside an `if TYPE_CHECKING:` body."""
    lines: set[int] = set()
    for node in ast.walk(tree):
        if not isinstance(node, ast.If):
            continue
        test = node.test
        name = test.id if isinstance(test, ast.Name) else getattr(test, "attr", None)
        if name != "TYPE_CHECKING":
            continue
        for statement in node.body:
            lines.update(range(statement.lineno, statement.end_lineno + 1))
    return lines


def iter_blocks(node: ast.AST):
    """Every statement list in the tree, so we know what is alone in its block."""
    for child in ast.walk(node):
        for field in ("body", "orelse", "finalbody"):
            block = getattr(child, field, None)
            if isinstance(block, list) and block and isinstance(block[0], ast.stmt):
                yield block


def module_anchor(tree: ast.Module, lines: list[str]) -> int:
    """Line count to keep untouched: shebang, comments, docstring, `__future__`.

    Comments are absent from the AST, so the header is measured on the raw
    lines first and the AST only ever pushes the anchor further down.
    """
    anchor = 0
    while anchor < len(lines) and (
        not lines[anchor].strip() or lines[anchor].lstrip().startswith("#")
    ):
        anchor += 1
    body = list(tree.body)
    if (
        body
        and isinstance(body[0], ast.Expr)
        and isinstance(body[0].value, ast.Constant)
        and isinstance(body[0].value.value, str)
    ):
        anchor = max(anchor, body[0].end_lineno)
        body = body[1:]
    for node in body:
        if isinstance(node, ast.ImportFrom) and node.module == "__future__":
            anchor = max(anchor, node.end_lineno)
        else:
            break
    return anchor


def collect(tree: ast.Module):
    """Imports to hoist, and the ones deliberately left in place."""
    skipped_lines = type_checking_lines(tree)
    top_level = {import_key(n) for n in tree.body if isinstance(n, ast.Import | ast.ImportFrom)}
    hoistable: list[AnyImport] = []
    left: list[tuple[AnyImport, str]] = []
    for block in iter_blocks(tree):
        for node in block:
            if not isinstance(node, ast.Import | ast.ImportFrom) or node.col_offset == 0:
                continue
            if node.lineno in skipped_lines:
                left.append((node, "TYPE_CHECKING"))
            elif len(block) == 1:
                left.append((node, "seul dans son bloc"))
            else:
                hoistable.append(node)
    hoistable.sort(key=lambda node: node.lineno)
    return hoistable, left, top_level


def rewrite(source: str, hoistable: list[AnyImport], top_level: set[ImportKey]) -> str:
    """Move each import block up to the anchor, keeping their relative order."""
    lines = source.splitlines(keepends=True)
    anchor = module_anchor(ast.parse(source), lines)
    seen = set(top_level)
    moved: list[str] = []
    for node in hoistable:
        block = "".join(lines[node.lineno - 1 : node.end_lineno])
        key = import_key(node)
        if key not in seen:
            seen.add(key)
            moved.append(textwrap.dedent(block))
    for node in reversed(hoistable):
        del lines[node.lineno - 1 : node.end_lineno]
    lines[anchor:anchor] = moved
    return "".join(lines)


def process(path: Path, root: Path, apply: bool):
    source = path.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return None
    hoistable, left, top_level = collect(tree)
    if not hoistable:
        return None
    updated = rewrite(source, hoistable, top_level)
    try:
        ast.parse(updated)
    except SyntaxError:
        return {"path": path.relative_to(root), "broken": True, "moved": [], "left": left}
    if apply:
        path.write_text(updated, encoding="utf-8")
    moved = [(n.lineno, ast.get_source_segment(source, n).splitlines()[0]) for n in hoistable]
    return {"path": path.relative_to(root), "broken": False, "moved": moved, "left": left}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", nargs="?", default="api", type=Path)
    parser.add_argument("--apply", action="store_true", help="rewrite files instead of listing")
    parser.add_argument(
        "--dirs",
        default=",".join(TARGET_DIRS),
        help="comma-separated subtrees to walk; keep it to where ruff enables PLC0415",
    )
    args = parser.parse_args()

    results = []
    for target in args.dirs.split(","):
        for path in sorted((args.root / target).rglob("*.py")):
            if any(part in SKIP_PARTS for part in path.parts):
                continue
            result = process(path, args.root, args.apply)
            if result:
                results.append(result)

    total = 0
    for result in results:
        print(result["path"])
        if result["broken"]:
            print("  !! resultat invalide, fichier laisse tel quel")
            continue
        for lineno, text in result["moved"]:
            print(f"  L{lineno:<5} {text.strip()}")
            total += 1
        for node, reason in result["left"]:
            print(f"  L{node.lineno:<5} (garde: {reason})")

    files = sum(1 for r in results if not r["broken"])
    action = "remontes" if args.apply else "remontables"
    print(f"\n{files} fichiers, {total} imports {action}")
    if not args.apply:
        print("--apply pour appliquer")


if __name__ == "__main__":
    main()
