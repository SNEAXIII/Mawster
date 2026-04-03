# Plan : Bans de champions à la création d'une guerre

## Contexte

Lors de la création d'une guerre, les officers/owner peuvent bannir jusqu'à 5 champions. Ces bans sont globaux (tous BGs), définitifs, et rendent les champions concernés indisponibles comme attaquants et comme synergies.

---

## Modèle de données

### Nouveau modèle `WarBan`

```python
# api/src/models/WarBan.py
class WarBan(SQLModel, table=True):
    __tablename__ = "war_ban"
    __table_args__ = (UniqueConstraint("war_id", "champion_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    war_id: uuid.UUID = Field(foreign_key="war.id", index=True)
    champion_id: uuid.UUID = Field(foreign_key="champion.id")
```

### Relation sur `War`

Ajouter dans `War` :
```python
bans: List["WarBan"] = Relationship(back_populates="war")
```

---

## Migration Alembic

- `make reset-db` avant de créer la migration
- `make create-mig` : nouvelle table `war_ban`
- `make migrate`

---

## Backend

### DTO — `dto_war.py`

**`WarCreateRequest`** — ajouter :
```python
banned_champion_ids: list[uuid.UUID] = Field(default=[], max_items=5)
```

**`WarResponse`** — ajouter :
```python
banned_champions: list[ChampionResponse] = []
```
Et dans `flatten_relations` : charger les champions depuis les `WarBan`.

### `WarService.create_war`

1. Valider `len(banned_champion_ids) <= 5` (409 sinon)
2. Valider pas de doublons dans la liste (409 sinon)
3. Valider que chaque `champion_id` existe en DB (404 sinon)
4. Créer la `War`
5. Créer un `WarBan` par ID dans la même transaction
6. `await session.commit()`

### `WarService._load_war`

Ajouter `selectinload(War.bans).selectinload(WarBan.champion)` pour charger les bans avec leurs champions.

### `WarService.get_available_attackers`

Ajouter un filtre : exclure les `ChampionUser` dont le `champion_id` est dans les bans de la guerre.

```python
banned_ids = {b.champion_id for b in war.bans}
# Filtrer les résultats : cu.champion_id not in banned_ids
```

### `WarService.add_synergy_attacker`

Avant d'insérer : vérifier que `champion_user.champion_id` n'est pas dans les bans de la guerre. 409 si banni.

---

## Frontend

### Formulaire de création de guerre

Fichier : `front/app/game/war/_components/` (composant existant de création)

- Charger tous les champions une fois via `GET /champions` (ou l'endpoint existant du roster selector)
- Ajouter un sélecteur de bans : jusqu'à 5 slots, interface identique au sélecteur de champion du roster
  - Search par nom
  - Portrait par champion
  - Champion déjà sélectionné → grisé (non re-sélectionnable)
  - Slot vide = icône "+" cliquable
  - Clic sur un slot rempli → retire le ban
- `banned_champion_ids: uuid[]` inclus dans le body du `POST /alliances/{id}/wars`

### Affichage des bans sur la page de guerre

- `WarResponse.banned_champions` → afficher les portraits en lecture seule
- Indicateur visuel clair (ex: icône ban rouge, grayscale)
- Section dédiée visible par tous les membres

### Sélecteurs d'attaquants / synergies

Aucune modification frontend nécessaire — le filtrage est fait côté backend.

---

## Tests

### Backend — unit/integration

- `create_war` avec 5 bans valides → OK
- `create_war` avec 6 bans → 409
- `create_war` avec doublon dans la liste → 409
- `create_war` avec `champion_id` inexistant → 404
- `get_available_attackers` : champion banni absent de la liste
- `add_synergy_attacker` : champion banni → 409

### E2E — `front/cypress/e2e/war/bans.cy.ts`

- Créer une guerre avec 3 bans → bans visibles sur la page
- Champion banni absent du sélecteur d'attaquant
- Champion banni absent du sélecteur de synergie
- Helper setup : utiliser `setupWarOwner` + `cy.apiLoadChampion`

---

## i18n

Ajouter dans `en.ts` et `fr.ts` :
- Clés pour "Banned champions", "Ban a champion", "This champion is banned", slot labels, erreurs

---

## Ordre d'implémentation

1. Modèle `WarBan` + migration
2. `WarService.create_war` + validation
3. `WarService._load_war` + `WarResponse` avec bans
4. Filtrage dans `get_available_attackers` et `add_synergy_attacker`
5. Tests backend
6. Frontend : sélecteur de bans dans le formulaire
7. Frontend : affichage des bans sur la page de guerre
8. i18n
9. Tests E2E
