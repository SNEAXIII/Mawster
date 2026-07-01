#!/usr/bin/env python3
"""Audit SQLModel models and Pydantic DTOs for consistency issues.

Upgrades the original `backups/listing.py` name-counter into a signature-aware
analyzer. It parses (never imports) every model and DTO with the `ast` module,
then reports three families of findings:

1. Mixin candidates  - identical field signatures repeated across many models.
2. Field drift       - one field name carrying divergent types/constraints.
3. Model->DTO drift  - a DTO field sharing a model field's name but losing
                       (or changing) the constraints the model enforces.

Output is a Markdown report on stdout. Nothing is modified: the human reads the
report and decides which refactors are worth doing. Run from the repo root:

    python .claude/skills/model-dto-audit/scripts/analyze_models.py
    python .claude/skills/model-dto-audit/scripts/analyze_models.py --min-repeat 4
"""

from __future__ import annotations

import argparse
import ast
from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path

# Field() kwargs that change validation/DB behaviour. Cosmetic kwargs
# (examples, description, title, alias) are ignored so they never create noise.
STRUCTURAL_KWARGS = (
    "primary_key",
    "foreign_key",
    "unique",
    "index",
    "nullable",
    "max_length",
    "min_length",
    "ge",
    "le",
    "gt",
    "lt",
    "pattern",
    "default",
    "default_factory",
    "max_digits",
    "decimal_places",
)

# Field names whose naming is accepted technical debt - reported but never
# proposed for rename. Keep in sync with the loginlog-naming-debt memory.
NAMING_DEBT = {"date_connexion", "id_user"}


@dataclass
class FieldInfo:
    name: str
    annotation: str
    kwargs: dict[str, str] = field(default_factory=dict)
    owner: str = ""  # ClassName
    location: str = ""  # path:lineno
    is_table: bool = False  # True for SQLModel table models

    def signature(self) -> tuple:
        """Structural identity used for mixin / drift comparison."""
        return (self.annotation,) + tuple(
            (k, self.kwargs.get(k)) for k in STRUCTURAL_KWARGS if k in self.kwargs
        )

    def constraint_repr(self) -> str:
        parts = [f"{k}={self.kwargs[k]}" for k in STRUCTURAL_KWARGS if k in self.kwargs]
        return ", ".join(parts) if parts else "(no constraints)"


def _field_kwargs(call: ast.Call) -> dict[str, str]:
    out: dict[str, str] = {}
    for kw in call.keywords:
        if kw.arg is None:
            continue
        try:
            out[kw.arg] = ast.unparse(kw.value)
        except Exception:
            out[kw.arg] = "<unparseable>"
    return out


def _is_field_call(value: ast.expr) -> ast.Call | None:
    """Return the Field(...) call node if this assignment uses Field()."""
    if isinstance(value, ast.Call):
        fn = value.func
        if isinstance(fn, ast.Name) and fn.id == "Field":
            return value
        if isinstance(fn, ast.Attribute) and fn.attr == "Field":
            return value
    return None


def _class_is_table(node: ast.ClassDef) -> bool:
    for kw in node.keywords:
        if kw.arg == "table" and isinstance(kw.value, ast.Constant) and kw.value.value:
            return True
    return False


def parse_file(path: Path, repo_root: Path) -> list[FieldInfo]:
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"))
    except (SyntaxError, UnicodeDecodeError):
        return []
    rel = path.relative_to(repo_root)
    fields: list[FieldInfo] = []
    for node in tree.body:
        if not isinstance(node, ast.ClassDef):
            continue
        is_table = _class_is_table(node)
        for stmt in node.body:
            # Annotated assignment: `name: Type` or `name: Type = Field(...)`.
            if not isinstance(stmt, ast.AnnAssign) or not isinstance(
                stmt.target, ast.Name
            ):
                continue
            name = stmt.target.id
            try:
                annotation = ast.unparse(stmt.annotation)
            except Exception:
                annotation = "<?>"
            # Skip ORM relationships - they are not columns/fields.
            if "Relationship" in (ast.unparse(stmt.value) if stmt.value else ""):
                continue
            kwargs: dict[str, str] = {}
            if stmt.value is not None:
                call = _is_field_call(stmt.value)
                if call is not None:
                    kwargs = _field_kwargs(call)
            fields.append(
                FieldInfo(
                    name=name,
                    annotation=annotation,
                    kwargs=kwargs,
                    owner=node.name,
                    location=f"{rel}:{stmt.lineno}",
                    is_table=is_table,
                )
            )
    return fields


def collect(repo_root: Path) -> tuple[list[FieldInfo], list[FieldInfo]]:
    models_dir = repo_root / "api/src/models"
    dto_dir = repo_root / "api/src/dto"
    model_fields: list[FieldInfo] = []
    dto_fields: list[FieldInfo] = []
    for p in sorted(models_dir.rglob("*.py")):
        if p.name == "__init__.py":
            continue
        model_fields.extend(f for f in parse_file(p, repo_root) if f.is_table)
    for p in sorted(dto_dir.rglob("*.py")):
        if p.name == "__init__.py":
            continue
        dto_fields.extend(parse_file(p, repo_root))
    return model_fields, dto_fields


def report_mixin_candidates(
    model_fields: list[FieldInfo], min_repeat: int
) -> list[str]:
    by_sig: dict[tuple, list[FieldInfo]] = defaultdict(list)
    for f in model_fields:
        by_sig[(f.name, f.signature())].append(f)
    lines = ["## 1. Mixin candidates (identical field repeated across models)\n"]
    found = False
    # Sort by how widely repeated, most repeated first.
    for (name, _sig), group in sorted(by_sig.items(), key=lambda kv: -len(kv[1])):
        owners = sorted({f.owner for f in group})
        if len(owners) < min_repeat:
            continue
        found = True
        sample = group[0]
        lines.append(
            f"- **`{name}`** ({sample.annotation}) — {len(owners)} models: "
            f"{', '.join(owners)}"
        )
        lines.append(f"  - signature: `{sample.constraint_repr()}`")
    if not found:
        lines.append(f"_None repeated in >= {min_repeat} models._")
    return lines


def report_field_drift(model_fields: list[FieldInfo]) -> list[str]:
    """Duplicated field already gone inconsistent: same name in >=2 models with
    divergent type/constraints. These are the bugs DRY is meant to prevent -
    a single mixin would make the divergence impossible."""
    by_name: dict[str, list[FieldInfo]] = defaultdict(list)
    for f in model_fields:
        by_name[f.name].append(f)
    lines = [
        "\n## 2. Already-drifted duplicates (same field, divergent across models)\n"
    ]
    found = False
    for name in sorted(by_name):
        if name in NAMING_DEBT:
            continue
        group = by_name[name]
        owners = {f.owner for f in group}
        variants = {(f.annotation, f.constraint_repr()) for f in group}
        # Need real duplication (>=2 models) AND a genuine divergence.
        if len(owners) < 2 or len(variants) <= 1:
            continue
        found = True
        lines.append(
            f"- **`{name}`** defined {len(owners)} times with "
            f"{len(variants)} different signatures:"
        )
        seen: set[tuple] = set()
        for f in group:
            key = (f.annotation, f.constraint_repr())
            if key in seen:
                continue
            seen.add(key)
            lines.append(
                f"  - {f.owner}: `{f.annotation}` "
                f"({f.constraint_repr()}) — {f.location}"
            )
    if not found:
        lines.append("_No drifted duplicates - repeated fields are consistent._")
    return lines


# Class-name fragments that mark a DTO as carrying *input* (request) data, where
# a model column has a corresponding *input* (request) DTO field.
INPUT_DTO_MARKERS = ("request", "create", "update", "body", "payload")


def _is_input_dto(owner: str) -> bool:
    low = owner.lower()
    # "Response"/"...Result" are outputs even when the domain noun contains
    # "request" (e.g. UpgradeRequestResponse). Suffix wins over substring.
    if low.endswith("response") or low.endswith("result"):
        return False
    return any(m in low for m in INPUT_DTO_MARKERS)


def report_model_dto_drift(
    model_fields: list[FieldInfo], dto_fields: list[FieldInfo]
) -> list[str]:
    # A field name only has a single canonical model definition when every model
    # that declares it agrees. Names that disagree across models (section 2) have
    # no canonical source, so comparing a DTO to an arbitrary one is meaningless.
    sigs_by_name: dict[str, set] = defaultdict(set)
    canonical: dict[str, FieldInfo] = {}
    for f in model_fields:
        sigs_by_name[f.name].add(f.signature())
        canonical.setdefault(f.name, f)
    ambiguous = {n for n, s in sigs_by_name.items() if len(s) > 1}

    guard_keys = ("max_length", "min_length", "ge", "le", "gt", "lt", "pattern")
    # Only input DTOs (Request/Create/Update) are reported: a request that drops
    # a column's guard is a real validation gap. Response DTOs legitimately omit
    # guards (serialization, not validation), so they are out of scope here.
    findings: list[str] = []
    for d in dto_fields:
        if d.name in ambiguous or not _is_input_dto(d.owner):
            continue
        m = canonical.get(d.name)
        if m is None:
            continue
        type_changed = m.annotation != d.annotation
        lost = [k for k in guard_keys if k in m.kwargs and k not in d.kwargs]
        if not type_changed and not lost:
            continue
        findings.append(f"- **`{d.name}`** in DTO `{d.owner}` ({d.location})")
        if type_changed:
            findings.append(f"  - type: model `{m.annotation}` vs DTO `{d.annotation}`")
        if lost:
            findings.append(
                f"  - drops model guard(s): {', '.join(lost)} "
                f"(model: {m.constraint_repr()})"
            )

    lines = [
        "\n## 3. Input-DTO validation gaps (Request/Create/Update drops a model guard)\n"
    ]
    lines += findings or ["_None — input DTOs match their model columns._"]
    return lines


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo-root", default=".", help="Repo root (default: cwd)")
    ap.add_argument(
        "--min-repeat",
        type=int,
        default=3,
        help="Min models sharing a field to flag a mixin candidate (default: 3)",
    )
    args = ap.parse_args()
    repo_root = Path(args.repo_root).resolve()

    model_fields, dto_fields = collect(repo_root)
    out: list[str] = [
        "# Model / DTO consistency audit\n",
        f"_Models scanned: {len({f.owner for f in model_fields})} | "
        f"model fields: {len(model_fields)} | DTO fields: {len(dto_fields)}_\n",
    ]
    out += report_mixin_candidates(model_fields, args.min_repeat)
    out += report_field_drift(model_fields)
    out += report_model_dto_drift(model_fields, dto_fields)
    print("\n".join(out))


if __name__ == "__main__":
    main()
