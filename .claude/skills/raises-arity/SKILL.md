---
name: raises-arity
description: Vérifie qu'un bloc `pytest.raises` ne contient qu'un seul appel susceptible de lever, et remonte les appels de setup au-dessus du bloc. Use when a test asserts an exception and the `with pytest.raises(...)` block also builds its own fixture inline, when ruff's PT012 passes but the block still calls a helper (`_declaration(...)`, `_champion_ref()`, `_defender_target(...)`) inside the asserted statement, when the user asks to "refactor this exception test to have only one invocation possibly throwing", or before adding a new `pytest.raises` test in `api/tests/`.
---

# Raises Arity

## Le problème

Ruff couvre la moitié du sujet et pas l'autre.

`PT012` (activé via le ruleset `PT`) rejette un bloc `pytest.raises` contenant **plusieurs instructions**. Il ne regarde pas *à l'intérieur* de l'instruction. Ceci passe donc son contrôle :

```python
with pytest.raises(HTTPException) as exc:
    await _init(session, storage, [_declaration(size=MAX_SCREEN_BYTES + 1)])
```

Une seule instruction, mais **deux choses qui peuvent lever**. Si `_declaration()` levait un jour une `HTTPException` — validation ajoutée dans le helper, signature changée — le test passerait au vert **sans jamais appeler `_init`**. L'assertion ne prouverait plus rien, et rien ne le signalerait.

## La règle

**Au plus un appel *comptabilisé* dans tout le corps du bloc**, et c'est celui sous test.

```python
declaration = _declaration(size=MAX_SCREEN_BYTES + 1)   # arrange, hors du bloc

with pytest.raises(HTTPException) as exc:
    await _init(session, storage, [declaration])        # un seul appel
```

Une seule exception, l'allowlist `ALLOWED_CALLS` en tête du script : les générateurs d'UUID (`uuid.uuid4`, `uuid.uuid1`, et leurs formes importées directement). Ils tirent une valeur au hasard et n'ont aucun mode d'échec sur lequel un test pourrait porter — les hisser au-dessus du bloc ne prouve rien de plus. Un builder de fixture ou un constructeur de DTO, si.

**Garder cette liste courte : chaque entrée est un trou.** Un helper « trivial » de plus, puis un autre, et la règle ne dit plus rien.

Cas qui passent, pour référence :

| Forme | Verdict |
| --- | --- |
| `raise ValueError(msg)` | ok — un appel |
| `d["missing"]` | ok — zéro appel |
| `pytest.raises(ValueError, match=re.escape(MSG))` | ok — `re.escape` est sur la ligne du `with`, pas dans le corps |
| `session.get(Model, obj_id)` | ok — un appel |
| `svc.get_by_id(session, uuid.uuid4())` | ok — l'UUID est en allowlist |
| `publish(job_id=uuid.uuid4(), import_id=uuid.uuid4())` | ok — deux UUID, zéro comptabilisé |
| `MatchupTargetInput(**_defender_target(x))` | **signalé** — deux appels |
| `Req(champion_id=uuid.uuid4(), targets=_targets())` | **signalé** — `_targets`, pas l'UUID |

## Workflow

1. **Constater**
   ```bash
   uv run --no-project python .claude/skills/raises-arity/scripts/check_raises_arity.py
   ```
   Sans argument il balaie `api/tests`. Accepte aussi des chemins précis (fichiers ou dossiers).

2. **Corriger** — pour chaque bloc signalé, lier l'expression de setup à une variable **au-dessus** du `with`, séparée par une ligne vide (bloc arrange). Nommer la variable d'après ce qu'elle est dans l'appel, pas d'après le helper : `declaration`, `champion`, `payload`, `missing_champion_id` — pas `result` ni `data`.

3. **Ne pas réordonner** le reste du test, ne pas fusionner des tests, ne pas toucher aux assertions qui suivent le bloc.

4. **Vérifier**
   ```bash
   uv run --no-project python .claude/skills/raises-arity/scripts/check_raises_arity.py   # 0 restant
   cd api && uvx ruff check && uv run pytest tests/unit -q
   ```
   Le script vert ne suffit pas : il ne fait qu'analyser l'AST. Seuls les tests prouvent que le hoist n'a rien cassé.

## Où c'est branché

Le hook pre-commit `raises-arity` (`.pre-commit-config.yaml`, repo `local`) lance ce script sur les fichiers `api/tests/**.py` mis en staging. Le skill sert à corriger un lot existant ou à trancher un cas ; le hook empêche la régression.

## Limites

- Analyse purement syntaxique : un appel derrière un alias (`f = _declaration; f(...)`) reste vu comme un appel, mais un appel masqué dans une compréhension imbriquée est compté comme les autres — pas de faux négatif connu, quelques faux positifs possibles sur du code très indirect.
- Pas d'échappatoire type `# noqa`. Si un bloc justifie vraiment deux appels, en discuter avec le user plutôt que d'élargir `ALLOWED_CALLS` au cas par cas.
