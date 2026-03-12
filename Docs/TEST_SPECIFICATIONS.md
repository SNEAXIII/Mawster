# Spécifications de tests — Mawster API

**Date** : Juillet 2025  
**Source** : Analyse des controllers, DTOs, services et règles métier  
**Couverture** : Tests unitaires (services) + Tests d'intégration (endpoints)

---

## Table des matières

1. [Auth](#1-auth)
2. [User](#2-user)
3. [Game Account](#3-game-account)
4. [Alliance](#4-alliance)
5. [Champion (Admin)](#5-champion-admin)
6. [Champion User / Roster](#6-champion-user--roster)
7. [Defense](#7-defense)
8. [Admin](#8-admin)
9. [Upgrade Requests](#9-upgrade-requests)

---

## 1. Auth

**Controller** : `auth_controller.py`  
**Service** : `AuthService.py`, `JWTService.py`, `DiscordAuthService.py`  
**DTOs** : `dto_token.py`, `dto_utilisateurs.py`

### 1.1 — `POST /auth/discord` (Login Discord)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| AUTH-01 | Login Discord réussi | access_token Discord valide | `LoginResponse` avec access_token + refresh_token | 200 |
| AUTH-02 | Token Discord invalide | access_token vide ou invalide | Erreur token Discord | 401 |
| AUTH-03 | Nouvel utilisateur créé | Premier login avec Discord ID inconnu | Utilisateur créé en base, login généré (alnum 4-15 chars) | 200 |
| AUTH-04 | Utilisateur existant retrouvé | Login avec Discord ID déjà connu | Même utilisateur retourné, `last_login_date` mis à jour | 200 |
| AUTH-05 | Utilisateur désactivé | Login avec un compte `disabled_at != null` | Erreur utilisateur désactivé | 401 |
| AUTH-06 | Utilisateur supprimé | Login avec un compte `deleted_at != null` | Erreur utilisateur supprimé | 401 |

### 1.2 — `GET /auth/session` (Session courante)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| AUTH-07 | Session valide | JWT access_token valide | `UserProfile` avec login, email, role, discord_id | 200 |
| AUTH-08 | Token expiré | JWT expiré | Erreur token expiré | 401 |
| AUTH-09 | Token invalide | JWT malformé | Erreur token invalide | 401 |
| AUTH-10 | Token sans user_id | JWT valide sans claim `user_id` | Erreur credentials | 401 |
| AUTH-11 | Rôle invalide dans token | JWT avec rôle inexistant | Erreur rôle insuffisant | 403 |

### 1.3 — `POST /auth/refresh` (Rafraîchir le token)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| AUTH-12 | Refresh réussi | refresh_token valide | Nouveau couple access_token + refresh_token | 200 |
| AUTH-13 | Refresh avec access_token | access_token au lieu de refresh | Erreur type de token invalide | 401 |
| AUTH-14 | Refresh token expiré | refresh_token expiré | Erreur token expiré | 401 |
| AUTH-15 | Utilisateur désactivé entre-temps | refresh_token d'un utilisateur désactivé | Erreur utilisateur désactivé | 401 |
| AUTH-16 | Utilisateur supprimé entre-temps | refresh_token d'un utilisateur supprimé | Erreur utilisateur supprimé | 401 |

---

## 2. User

**Controller** : `user_controller.py`  
**Service** : `UserService.py`  
**DTO** : `DeleteAccountRequest` (inline dans controller)

### 2.1 — `DELETE /user/delete` (Auto-suppression)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| USR-01 | Suppression avec confirmation correcte | `confirmation: "SUPPRIMER"` | Utilisateur soft-deleted, message succès | 200 |
| USR-02 | Mauvaise confirmation | `confirmation: "supprimer"` (minuscules) | Erreur "saisir SUPPRIMER" | 400 |
| USR-03 | Confirmation vide | `confirmation: ""` | Erreur validation | 422 |
| USR-04 | Utilisateur déjà supprimé | User avec `deleted_at` existant | Erreur déjà supprimé | 400/409 |
| USR-05 | Non authentifié | Aucun token | Erreur non authentifié | 401 |

---

## 3. Game Account

**Controller** : `game_account_controller.py`  
**Service** : `GameAccountService.py`  
**DTOs** : `dto_game_account.py`

**Constantes** : `MAX_GAME_ACCOUNTS_PER_USER = 10`

### 3.1 — `POST /game-accounts` (Création)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| GA-01 | Création basique | `game_pseudo: "Player1"` | Game account créé | 201 |
| GA-02 | Premier compte auto-primary | Aucun compte existant | `is_primary: true` automatiquement | 201 |
| GA-03 | Pseudo trop court | `game_pseudo: "A"` (1 char, min=2) | Erreur validation | 422 |
| GA-04 | Pseudo trop long | `game_pseudo: "A" * 17` (17 chars, max=16) | Erreur validation | 422 |
| GA-05 | Pseudo longueur min | `game_pseudo: "AB"` (2 chars) | Création réussie | 201 |
| GA-06 | Pseudo longueur max | `game_pseudo: "A" * 16` (16 chars) | Création réussie | 201 |
| GA-07 | Maximum 10 comptes | 11ème création | Erreur "Maximum 10 game accounts" | 400 |
| GA-08 | Marquer comme primaire | `is_primary: true` avec comptes existants | Nouveau compte primary, ancien démarqué | 201 |
| GA-09 | Non authentifié | Aucun token | Erreur non authentifié | 401 |

### 3.2 — `GET /game-accounts` (Mes comptes)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| GA-10 | Liste ses comptes | Utilisateur avec 3 comptes | 3 comptes, primary en premier | 200 |
| GA-11 | Aucun compte | Utilisateur sans game account | Liste vide | 200 |
| GA-12 | Avec info alliance | Compte lié à une alliance | `alliance_tag`, `alliance_name` renseignés | 200 |

### 3.3 — `GET /game-accounts/{id}` (Détail)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| GA-13 | Son propre compte | ID valide, propriétaire | Détail du game account | 200 |
| GA-14 | Compte d'un autre | ID d'un autre utilisateur | Erreur forbidden | 403 |
| GA-15 | ID inexistant | UUID inconnu | Erreur not found | 404 |

### 3.4 — `PUT /game-accounts/{id}` (Mise à jour)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| GA-16 | Mise à jour pseudo | Nouveau pseudo valide | Pseudo mis à jour | 200 |
| GA-17 | Changement de primary | `is_primary: true` | Ancien primary démarqué | 200 |
| GA-18 | Compte d'un autre | ID d'un autre utilisateur | Erreur forbidden | 403 |
| GA-19 | Pseudo invalide | Trop court ou trop long | Erreur validation | 422 |

### 3.5 — `DELETE /game-accounts/{id}` (Suppression)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| GA-20 | Suppression basique | Compte sans alliance | Game account supprimé | 204 |
| GA-21 | Compte d'un autre | ID d'un autre utilisateur | Erreur forbidden | 403 |
| GA-22 | ID inexistant | UUID inconnu | Erreur not found | 404 |
| GA-23 | ⚠️ Owner d'une alliance | Compte owner d'une alliance | **[À IMPLÉMENTER]** Erreur 400 — actuellement supprimé sans vérification | 400 |

---

## 4. Alliance

**Controller** : `alliance_controller.py`  
**Service** : `AllianceService.py`, `AllianceInvitationService.py`  
**DTOs** : `dto_alliance.py`, `dto_invitation.py`

**Constantes** : `MAX_MEMBERS_PER_ALLIANCE = 30`, `MAX_MEMBERS_PER_GROUP = 10`

### 4.1 — `POST /alliances` (Création)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-01 | Création valide | name, tag, owner_id valides | Alliance créée, owner auto-ajouté comme membre | 201 |
| ALL-02 | Nom trop court | `name: "AB"` (min=3) | Erreur validation | 422 |
| ALL-03 | Nom trop long | `name: "A" * 51` (max=50) | Erreur validation | 422 |
| ALL-04 | Tag vide | `tag: ""` (min=1) | Erreur validation | 422 |
| ALL-05 | Tag trop long | `tag: "ABCDEF"` (max=5) | Erreur validation | 422 |
| ALL-06 | Owner pas son compte | `owner_id` d'un autre user | Erreur forbidden | 403 |
| ALL-07 | Owner déjà dans une alliance | Game account avec `alliance_id != null` | Erreur conflict "already in alliance" | 409 |
| ALL-08 | Owner ID inexistant | UUID inconnu | Erreur 404 | 404 |
| ALL-09 | Limites valides | `name: "ABC"` (3), `tag: "A"` (1) | Création réussie | 201 |

### 4.2 — `GET /alliances` (Liste)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-10 | Liste toutes | Aucun filtre | Toutes les alliances avec membres/officers | 200 |
| ALL-11 | Aucune alliance | Base vide | Liste vide | 200 |

### 4.3 — `GET /alliances/mine` (Mes alliances)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-12 | Mes alliances | Utilisateur dans 2 alliances | 2 alliances retournées | 200 |
| ALL-13 | Pas dans d'alliance | Utilisateur sans alliance | Liste vide | 200 |

### 4.4 — `GET /alliances/my-roles` (Mes rôles)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-14 | Owner d'une alliance | Owner d'alliance A | `is_owner: true, can_manage: true` pour A | 200 |
| ALL-15 | Officer d'une alliance | Officer dans alliance B | `is_officer: true, can_manage: true` pour B | 200 |
| ALL-16 | Simple membre | Membre sans rôle spécial | `is_owner: false, is_officer: false, can_manage: false` | 200 |
| ALL-17 | account_ids retournés | N'importe | `my_account_ids` contient tous les UUIDs des game accounts | 200 |

### 4.5 — `GET /alliances/{id}` (Détail)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-18 | Alliance existante | ID valide | Détail avec nom, tag, owner_pseudo, members, officers | 200 |
| ALL-19 | Alliance inexistante | UUID inconnu | Erreur 404 | 404 |

### 4.6 — `PUT /alliances/{id}` (Mise à jour)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-20 | Mise à jour par owner | Nouveau nom/tag valide | Alliance mise à jour | 200 |
| ALL-21 | Mise à jour par officer | Officer tente la maj | Erreur forbidden "Only owner" | 403 |
| ALL-22 | Mise à jour par membre | Simple membre tente | Erreur forbidden | 403 |
| ALL-23 | Mise à jour par non-membre | Utilisateur hors alliance | Erreur forbidden | 403 |

### 4.7 — `DELETE /alliances/{id}` (Suppression)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-24 | Suppression par owner | Owner supprime son alliance | Alliance supprimée, membres détachés (alliance_id=null) | 204 |
| ALL-25 | Suppression par officer | Officer tente | Erreur forbidden "Only owner" | 403 |
| ALL-26 | Officers nettoyés | Owner supprime | Officers supprimés, game accounts gardent alliance_group=null | 204 |
| ALL-27 | Alliance inexistante | UUID inconnu | Erreur 404 | 404 |

### 4.8 — Invitations

#### `POST /alliances/{id}/invitations` (Inviter)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-28 | Invitation par owner | game_account_id libre | Invitation créée, status PENDING | 201 |
| ALL-29 | Invitation par officer | game_account_id libre | Invitation créée | 201 |
| ALL-30 | Invitation par membre | Simple membre invite | Erreur forbidden | 403 |
| ALL-31 | Inviter un compte déjà dans une alliance | game_account avec alliance | Erreur conflict | 409 |
| ALL-32 | Maximum 30 membres | Alliance à 30 membres | Erreur "maximum reached" à l'acceptation | 409 |

#### `POST /alliances/invitations/{id}/accept` (Accepter)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-33 | Acceptation valide | Invitation pending + propriétaire du game account | Game account rejoint l'alliance | 200 |
| ALL-34 | Acceptation par mauvais user | Invitation pour un game account d'un autre | Erreur forbidden | 403 |

#### `POST /alliances/invitations/{id}/decline` (Refuser)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-35 | Refus valide | Invitation pending + propriétaire | Invitation déclinée | 200 |
| ALL-36 | Refus par mauvais user | Pas propriétaire du game account | Erreur forbidden | 403 |

#### `DELETE /alliances/{id}/invitations/{inv_id}` (Annuler)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-37 | Annulation par owner | Invitation pending | Invitation annulée | 200 |
| ALL-38 | Annulation par officer | Invitation pending | Invitation annulée | 200 |
| ALL-39 | Annulation par membre | Simple membre | Erreur forbidden | 403 |

### 4.9 — Gestion des membres

#### `DELETE /alliances/{id}/members/{ga_id}` (Exclure)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-40 | Owner exclut un membre | Cible = simple membre | Membre exclu, alliance_id → null | 200 |
| ALL-41 | Owner exclut un officer | Cible = officer | Officer exclu + officership supprimée | 200 |
| ALL-42 | Officer exclut un membre | Cible = simple membre | Membre exclu | 200 |
| ALL-43 | Officer exclut un officer | Cible = autre officer | Erreur "officer cannot remove officer" | 403 |
| ALL-44 | Exclure le owner | Cible = owner du alliance | Erreur "Cannot remove owner" | 400 |
| ALL-45 | Membre exclut | Simple membre tente | Erreur forbidden | 403 |
| ALL-46 | Game account pas dans l'alliance | UUID d'un compte externe | Erreur 404 "not a member" | 404 |

### 4.10 — Gestion des officers

#### `POST /alliances/{id}/officers` (Ajouter)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-47 | Owner ajoute un officer | game_account_id d'un membre | Officer créé | 201 |
| ALL-48 | Officer tente d'ajouter | Officer tente | Erreur forbidden "Only owner" | 403 |
| ALL-49 | Ajouter un non-membre | game_account pas dans l'alliance | Erreur "must be member" | 400 |
| ALL-50 | Déjà officer | game_account déjà officer | Erreur conflict "already officer" | 409 |

#### `DELETE /alliances/{id}/officers` (Retirer)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-51 | Owner retire un officer | Officer existant | Officership supprimée | 200 |
| ALL-52 | Retirer un non-officer | game_account non officer | Erreur 404 "not an officer" | 404 |
| ALL-53 | Officer tente de retirer | Officer tente | Erreur forbidden "Only owner" | 403 |

### 4.11 — Gestion des groupes (BG)

#### `PATCH /alliances/{id}/members/{ga_id}/group` (Assigner un groupe)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-54 | Assigner groupe 1 | `group: 1` | Membre dans groupe 1 | 200 |
| ALL-55 | Assigner groupe 2 | `group: 2` | Membre dans groupe 2 | 200 |
| ALL-56 | Assigner groupe 3 | `group: 3` | Membre dans groupe 3 | 200 |
| ALL-57 | Retirer du groupe | `group: null` | `alliance_group → null` | 200 |
| ALL-58 | Groupe invalide (0) | `group: 0` | Erreur validation (ge=1) | 422 |
| ALL-59 | Groupe invalide (4) | `group: 4` | Erreur validation (le=3) | 422 |
| ALL-60 | Max 10 par groupe | 11ème membre dans groupe 1 | Erreur conflict "maximum reached" | 409 |
| ALL-61 | Owner/officer requis | Simple membre tente | Erreur forbidden | 403 |
| ALL-62 | Cible non-membre | game_account hors alliance | Erreur 404 "not a member" | 404 |

### 4.12 — Eligibilité

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ALL-63 | Eligible owners | User avec 3 comptes, 1 dans une alliance | 2 comptes sans alliance retournés | 200 |
| ALL-64 | Eligible officers | Alliance avec 5 membres, 1 owner, 1 officer | 3 membres éligibles | 200 |
| ALL-65 | Eligible members | 10 comptes libres, 2 avec invitations pending | 8 comptes éligibles | 200 |

---

## 5. Champion (Admin)

**Controller** : `champion_controller.py` (deux routeurs : read + admin)  
**Service** : `ChampionService.py`  
**DTOs** : `dto_champion.py`

### 5.1 — `GET /champions` (Liste paginée — utilisateur)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| CHP-01 | Liste page 1 | `page=1, size=20` | 20 champions max, total count | 200 |
| CHP-02 | Filtre par classe | `champion_class=Cosmic` | Seuls les champions Cosmic | 200 |
| CHP-03 | Recherche par nom | `search=Spider` | Champions contenant "Spider" | 200 |
| CHP-04 | Page invalide | `page=0` | Erreur validation (ge=1) | 422 |

### 5.2 — `GET /champions/{id}` (Détail — utilisateur)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| CHP-05 | Champion existant | UUID valide | `ChampionResponse` complet | 200 |
| CHP-06 | Champion inexistant | UUID inconnu | Erreur 404 | 404 |

### 5.3 — `POST /admin/champions/load` (Chargement — admin)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| CHP-07 | Chargement réussi | Liste de champions valides | Compteurs created/updated/skipped | 200 |
| CHP-08 | Champion existant mis à jour | Même nom, nouvelle classe | `updated` incrémenté | 200 |
| CHP-09 | Nom trop long | `name: "A" * 101` (max=100) | Erreur validation | 422 |
| CHP-10 | Utilisateur non-admin | Token USER | Erreur rôle insuffisant | 403 |

### 5.4 — `PATCH /admin/champions/{id}/alias` (Alias — admin)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| CHP-11 | Mise à jour alias | `alias: "spidey;peter"` | Alias mis à jour | 200 |
| CHP-12 | Alias null | `alias: null` | Alias supprimé | 200 |
| CHP-13 | Alias trop long | `alias: "A" * 501` (max=500) | Erreur validation | 422 |

### 5.5 — `PATCH /admin/champions/{id}/ascendable` (Toggle ascendable — admin)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| CHP-14 | Toggle true → false | Champion ascendable | `is_ascendable: false` | 200 |
| CHP-15 | Toggle false → true | Champion non-ascendable | `is_ascendable: true` | 200 |

### 5.6 — `DELETE /admin/champions/{id}` (Suppression — admin)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| CHP-16 | Suppression réussie | UUID d'un champion | Champion supprimé | 200 |
| CHP-17 | Champion inexistant | UUID inconnu | Erreur 404 | 404 |

---

## 6. Champion User / Roster

**Controller** : `champion_user_controller.py`  
**Service** : `ChampionUserService.py`  
**DTOs** : `dto_champion_user.py`

**Contraintes** :
- Raretés valides : `6r4, 7r1, 7r2, 7r3, 7r4, 7r5` (enum `ChampionRarity`)
- Ascension : 0, 1 ou 2 (forcé à 0 si champion non-ascendable)
- Signature : ≥ 0
- Dédoublonnage : même `champion_id` + même `stars` → mise à jour au lieu de doublon

### 6.1 — `POST /champion-users` (Ajout au roster)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-01 | Ajout valide | rarity=7r3, signature=200 | Champion ajouté au roster | 201 |
| ROS-02 | Rareté invalide | rarity=5r1 | Erreur "Invalid rarity" | 400 |
| ROS-03 | Rareté valide 6r4 | rarity=6r4 | Ajout réussi | 201 |
| ROS-04 | Rareté max 7r5 | rarity=7r5 | Ajout réussi | 201 |
| ROS-05 | Signature négative | signature=-1 | Erreur validation (ge=0) | 422 |
| ROS-06 | Ascension 0 | ascension=0 | Ajout réussi | 201 |
| ROS-07 | Ascension max 2 | ascension=2, champion ascendable | Ajout réussi, ascension=2 | 201 |
| ROS-08 | Ascension > 2 | ascension=3 | Erreur validation (le=2) | 422 |
| ROS-09 | Ascension sur non-ascendable | ascension=2, champion non-ascendable | Ajout réussi, ascension **forcé à 0** | 201 |
| ROS-10 | Game account d'un autre | game_account_id d'un autre user | Erreur forbidden | 403 |
| ROS-11 | Game account inexistant | UUID inconnu | Erreur 404 | 404 |
| ROS-12 | Champion inexistant | champion_id inconnu | Erreur 404 | 404 |
| ROS-13 | Doublon → mise à jour | Même champion+stars déjà en roster | Rank/signature mis à jour (pas de doublon) | 201 |

### 6.2 — `POST /champion-users/bulk` (Import en masse)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-14 | Bulk réussi | 5 champions valides | 5 entrées créées | 201 |
| ROS-15 | Dédoublonnage intra-requête | 2x même champion_name+rarity | Premier gagné, second ignoré | 201 |
| ROS-16 | Champion existant mis à jour | Champion déjà en roster | Signature/rank mis à jour | 201 |
| ROS-17 | Liste vide | `champions: []` | Erreur validation (min_length=1) | 422 |
| ROS-18 | Champion inconnu dans le bulk | champion_name inexistant | Erreur 404 | 404 |
| ROS-19 | Game account d'un autre | game_account_id d'un autre user | Erreur forbidden | 403 |

### 6.3 — `GET /champion-users/by-account/{ga_id}` (Roster par compte)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-20 | Son propre roster | game_account_id à soi | Liste des champions avec détails | 200 |
| ROS-21 | Roster d'un allié | game_account dans la même alliance | Liste visible | 200 |
| ROS-22 | Roster d'un non-allié | game_account dans une autre alliance | Erreur forbidden | 403 |
| ROS-23 | Roster d'un compte sans alliance | game_account sans alliance, pas à soi | Erreur forbidden | 403 |

### 6.4 — `PATCH /champion-users/{id}/preferred-attacker` (Toggle attaquant préféré)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-24 | Toggle false → true | champion_user à soi | `is_preferred_attacker: true` | 200 |
| ROS-25 | Toggle true → false | champion_user à soi | `is_preferred_attacker: false` | 200 |
| ROS-26 | Champion d'un autre | champion_user d'un autre | Erreur forbidden | 403 |

### 6.5 — `PUT /champion-users/{id}` (Mise à jour)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-27 | Mise à jour rarity | rarity=7r4 | Rarity mise à jour | 200 |
| ROS-28 | Rarity invalide | rarity=8r1 | Erreur "Invalid rarity" | 400 |
| ROS-29 | Champion d'un autre | champion_user d'un autre | Erreur forbidden | 403 |

### 6.6 — `DELETE /champion-users/{id}` (Suppression du roster)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-30 | Suppression valide | champion_user à soi | Supprimé | 204 |
| ROS-31 | Champion d'un autre | champion_user d'un autre | Erreur forbidden | 403 |
| ROS-32 | ID inexistant | UUID inconnu | Erreur 404 | 404 |

### 6.7 — `PATCH /champion-users/{id}/upgrade` (Rank up)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-33 | Upgrade 7r2 → 7r3 | Champion en 7r2 | Rarity → 7r3 | 200 |
| ROS-34 | Upgrade 7r4 → 7r5 | Champion en 7r4 | Rarity → 7r5 | 200 |
| ROS-35 | Upgrade 7r5 (max) | Champion en 7r5 | Erreur "already at max rank" | 400 |
| ROS-36 | Champion d'un autre | champion_user d'un autre | Erreur forbidden | 403 |
| ROS-37 | Auto-complete upgrade request | Upgrade request pending pour cette rarity | Request marquée done_at | 200 |

### 6.8 — `PATCH /champion-users/{id}/ascend` (Ascension)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ROS-38 | Ascend 0 → 1 | Champion ascendable, ascension=0 | ascension=1 | 200 |
| ROS-39 | Ascend 1 → 2 | Champion ascendable, ascension=1 | ascension=2 | 200 |
| ROS-40 | Ascend 2 (max) | Champion ascendable, ascension=2 | Erreur "max ascension" | 400 |
| ROS-41 | Non-ascendable | Champion non-ascendable | Erreur "cannot be ascended" | 400 |
| ROS-42 | Champion d'un autre | champion_user d'un autre | Erreur forbidden | 403 |

---

## 7. Defense

**Controller** : `defense_controller.py`  
**Service** : `DefensePlacementService.py`  
**DTOs** : `dto_defense.py`

**Constantes** :
- Battlegroup : 1, 2 ou 3
- Nodes : 1 à 55
- `MAX_DEFENDERS_PER_PLAYER = 5`
- Champion unique par BG (par `champion_id`, pas par `champion_user_id`)

### 7.1 — `GET /alliances/{id}/defense/bg/{bg}` (Vue défense)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-01 | Défense BG1 | Membre de l'alliance, bg=1 | `DefenseSummaryResponse` avec placements | 200 |
| DEF-02 | BG invalide (0) | bg=0 | Erreur "Battlegroup invalid" | 400 |
| DEF-03 | BG invalide (4) | bg=4 | Erreur "Battlegroup invalid" | 400 |
| DEF-04 | Non-membre de l'alliance | Utilisateur hors alliance | Erreur forbidden "not a member" | 403 |
| DEF-05 | Défense vide | BG sans placements | Placements vides, member_defender_counts vide | 200 |

### 7.2 — `POST /alliances/{id}/defense/bg/{bg}/place` (Placement)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-06 | Placement valide | Node libre, champion libre, joueur dans BG | Placement créé | 201 |
| DEF-07 | Remplacement de node | Node déjà occupé | Ancien placement supprimé, nouveau créé | 201 |
| DEF-08 | Champion déjà placé | champion_id déjà sur un autre node du BG | Erreur conflict "already placed" | 409 |
| DEF-09 | Max 5 defenders/joueur | Joueur avec 5 placements | Erreur "already has 5 defenders" | 400 |
| DEF-10 | Joueur pas dans le BG | game_account.alliance_group ≠ battlegroup | Erreur "not in this battlegroup" | 400 |
| DEF-11 | Joueur pas dans l'alliance | game_account.alliance_id ≠ alliance_id | Erreur "not in this alliance" | 400 |
| DEF-12 | Champion pas dans le roster | champion_user d'un autre game_account | Erreur "does not belong" | 400 |
| DEF-13 | Node invalide (0) | node_number=0 | Erreur validation (ge=1) | 422 |
| DEF-14 | Node invalide (56) | node_number=56 | Erreur validation (le=55) | 422 |
| DEF-15 | Owner place pour un autre | Owner place un champion pour un membre | Placement réussi (owner est manager) | 201 |
| DEF-16 | Officer place pour un autre | Officer place pour un membre | Placement réussi | 201 |
| DEF-17 | Membre place pour un autre | Simple membre place pour un autre | Erreur forbidden | 403 |
| DEF-18 | Membre place pour soi | Simple membre place son propre champion | Placement réussi | 201 |

### 7.3 — `DELETE /alliances/{id}/defense/bg/{bg}/node/{node}` (Retirer)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-19 | Retrait par owner | Node occupé | Placement supprimé | 204 |
| DEF-20 | Retrait par officer | Node occupé | Placement supprimé | 204 |
| DEF-21 | Retrait par membre | Simple membre | Erreur forbidden | 403 |
| DEF-22 | Node vide | Node sans placement | Erreur 404 "No defender on this node" | 404 |

### 7.4 — `DELETE /alliances/{id}/defense/bg/{bg}/clear` (Vider tout)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-23 | Clear par owner | BG avec placements | Tous les placements supprimés | 204 |
| DEF-24 | Clear par officer | BG avec placements | Tous supprimés | 204 |
| DEF-25 | Clear par membre | Simple membre | Erreur forbidden | 403 |
| DEF-26 | Clear BG vide | Aucun placement | Pas d'erreur, count=0 | 204 |

### 7.5 — `GET /alliances/{id}/defense/bg/{bg}/available-champions` (Champions disponibles)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-27 | Champions disponibles | Membres avec rosters, certains placés | Exclut les champions déjà placés (par champion_id) | 200 |
| DEF-28 | Joueur à 5 defenders | Membre avec 5 placements | Ses champions exclus de la liste | 200 |
| DEF-29 | BG sans membres | BG vide | Liste vide | 200 |
| DEF-30 | Non-membre | Utilisateur hors alliance | Erreur forbidden | 403 |

### 7.6 — `GET /alliances/{id}/defense/bg/{bg}/members` (Membres du BG)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-31 | Membres avec counts | BG avec des placements | Liste avec `defender_count`, `is_owner`, `is_officer` | 200 |
| DEF-32 | BG vide | Aucun membre dans ce BG | Liste vide | 200 |

### 7.7 — `GET /alliances/{id}/defense/bg/{bg}/export` (Export)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-33 | Export par owner | BG avec placements | Liste `DefenseExportItem` (champion_name, rarity, node, owner_name) | 200 |
| DEF-34 | Export par officer | BG avec placements | Export réussi | 200 |
| DEF-35 | Export par membre | Simple membre | Erreur forbidden | 403 |
| DEF-36 | Export BG vide | Aucun placement | Liste vide | 200 |

### 7.8 — `POST /alliances/{id}/defense/bg/{bg}/import` (Import)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| DEF-37 | Import réussi | JSON d'un export valide | `DefenseImportReport` avec before/after/success_count | 200 |
| DEF-38 | Import efface l'existant | BG avec placements + import | `before` contient les anciens, `after` les nouveaux | 200 |
| DEF-39 | Import avec erreurs partielles | Certains champions/joueurs introuvables | `errors` contient les détails, `error_count > 0` | 200 |
| DEF-40 | Champion inconnu | champion_name inexistant | Erreur dans `errors`: "Unknown champion" | 200 |
| DEF-41 | Joueur pas dans le BG | owner_name pas dans le BG | Erreur: "Player not found in BG" | 200 |
| DEF-42 | Rarity incorrecte | rarity ne correspond pas au roster | Erreur: "owns at X, not Y" | 200 |
| DEF-43 | Node dupliqué dans l'import | 2 placements sur le même node | Erreur: "Node already occupied by previous import" | 200 |
| DEF-44 | Champion dupliqué dans l'import | Même champion 2x | Erreur: "already placed on another node" | 200 |
| DEF-45 | Max 5 defenders/joueur | 6 placements pour un joueur | Erreur: "already has 5 defenders" | 200 |
| DEF-46 | Import par membre | Simple membre | Erreur forbidden | 403 |
| DEF-47 | Liste vide | `placements: []` | Erreur validation (min_length=1) | 422 |

---

## 8. Admin

**Controller** : `admin_controller.py`  
**Service** : `UserService.py`

### 8.1 — `GET /admin/users` (Liste utilisateurs)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ADM-01 | Liste paginée | `page=1, size=10` | `UserAdminViewAllUsers` avec pagination | 200 |
| ADM-02 | Filtre par statut | `status=disabled` | Seuls les utilisateurs désactivés | 200 |
| ADM-03 | Filtre par rôle | `role=admin` | Seuls les admins | 200 |
| ADM-04 | Recherche par login/email | `search=test` | Utilisateurs correspondants | 200 |
| ADM-05 | Accès USER refusé | Token role=USER | Erreur rôle insuffisant | 403 |
| ADM-06 | Accès ADMIN autorisé | Token role=ADMIN | Liste retournée | 200 |

### 8.2 — `PATCH /admin/users/disable/{id}` (Désactiver)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ADM-07 | Désactiver un USER | UUID d'un USER actif | `disabled_at` positionné | 200 |
| ADM-08 | Désactiver un ADMIN | UUID d'un ADMIN | Erreur "target is admin" | 403 |
| ADM-09 | Désactiver un SUPER_ADMIN | UUID d'un SUPER_ADMIN | Erreur "target is super_admin" | 403 |
| ADM-10 | Utilisateur déjà désactivé | UUID d'un USER déjà disabled | Erreur "already disabled" | 400 |
| ADM-11 | Utilisateur supprimé | UUID d'un USER deleted | Erreur "target is deleted" | 400 |
| ADM-12 | UUID inexistant | UUID inconnu | Erreur "doesn't exist" | 404 |

### 8.3 — `PATCH /admin/users/enable/{id}` (Réactiver)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ADM-13 | Réactiver un USER | UUID d'un USER désactivé | `disabled_at → null` | 200 |
| ADM-14 | Utilisateur déjà actif | UUID d'un USER enabled | Erreur "already enabled" | 400 |
| ADM-15 | Utilisateur supprimé | UUID d'un USER deleted | Erreur "target is deleted" | 400 |

### 8.4 — `DELETE /admin/users/delete/{id}` (Supprimer)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ADM-16 | Supprimer un USER | UUID d'un USER | `deleted_at` positionné | 200 |
| ADM-17 | Supprimer un ADMIN | UUID d'un ADMIN | Erreur "target is admin" | 403 |
| ADM-18 | Supprimer un SUPER_ADMIN | UUID d'un SUPER_ADMIN | Erreur "target is super_admin" | 403 |
| ADM-19 | Déjà supprimé | UUID d'un USER deleted | Erreur "already deleted" | 400 |
| ADM-20 | UUID inexistant | UUID inconnu | Erreur "doesn't exist" | 404 |

### 8.5 — `PATCH /admin/users/promote/{id}` (Promouvoir — SUPER_ADMIN only)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ADM-21 | Promouvoir USER → ADMIN | UUID d'un USER, appelant SUPER_ADMIN | `role → ADMIN`, `disabled_at → null` | 200 |
| ADM-22 | Déjà ADMIN | UUID d'un ADMIN | Erreur "already admin" | 400 |
| ADM-23 | Cible SUPER_ADMIN | UUID d'un SUPER_ADMIN | Erreur "target is super_admin" | 403 |
| ADM-24 | Appelant ADMIN (pas super) | ADMIN tente de promouvoir | Erreur rôle insuffisant (SUPER_ADMIN requis) | 403 |
| ADM-25 | Utilisateur supprimé | UUID d'un USER deleted | Erreur "target is deleted" | 400 |

### 8.6 — `PATCH /admin/users/demote/{id}` (Rétrograder — SUPER_ADMIN only)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| ADM-26 | Rétrograder ADMIN → USER | UUID d'un ADMIN, appelant SUPER_ADMIN | `role → USER` | 200 |
| ADM-27 | Cible pas ADMIN | UUID d'un USER | Erreur "not admin" | 400 |
| ADM-28 | Cible SUPER_ADMIN | UUID d'un SUPER_ADMIN | Erreur "target is super_admin" | 403 |
| ADM-29 | Appelant ADMIN (pas super) | ADMIN tente de rétrograder | Erreur rôle insuffisant | 403 |
| ADM-30 | Utilisateur supprimé | UUID deleted | Erreur "target is deleted" | 400 |

---

## 9. Upgrade Requests

**Controller** : `champion_user_controller.py` (endpoints upgrade-requests)  
**Service** : `UpgradeRequestService.py`

### 9.1 — `POST /champion-users/upgrade-requests` (Créer une demande)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| UPG-01 | Demande pour soi | champion_user_id à soi | Upgrade request créée | 201 |
| UPG-02 | Demande par officer pour un allié | Officer demande pour membre de l'alliance | Créée, requester = officer's game account | 201 |
| UPG-03 | Demande pour un non-allié | champion_user d'un joueur hors alliance | Erreur forbidden | 403 |
| UPG-04 | Champion inexistant | champion_user_id inconnu | Erreur 404 | 404 |
| UPG-05 | Non-officer pour un autre | Simple membre pour un autre joueur | Erreur forbidden | 403 |
| UPG-06 | Game account non trouvé | champion_user sans game account | Erreur 404 | 404 |

### 9.2 — `GET /champion-users/upgrade-requests/by-account/{ga_id}` (Voir les demandes)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| UPG-07 | Ses propres demandes | game_account_id à soi | Liste des upgrade requests pending | 200 |
| UPG-08 | Demandes d'un allié | game_account dans même alliance | Visible | 200 |
| UPG-09 | Demandes d'un non-allié | game_account d'une autre alliance | Erreur forbidden | 403 |

### 9.3 — `DELETE /champion-users/upgrade-requests/{id}` (Annuler)

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| UPG-10 | Annulation par officer | request dans l'alliance de l'officer | Request supprimée | 204 |
| UPG-11 | Annulation par owner | request dans l'alliance du owner | Supprimée | 204 |
| UPG-12 | Annulation par simple membre | Membre non officer/owner | Erreur forbidden | 403 |
| UPG-13 | Request inexistante | UUID inconnu | Erreur 404 | 404 |
| UPG-14 | Cible hors alliance | champion_user dans une autre alliance | Erreur forbidden | 403 |

### 9.4 — Auto-complétion

| # | Cas de test | Entrée | Résultat attendu | Code |
|---|-------------|--------|-------------------|------|
| UPG-15 | Auto-complete sur upgrade rank | Upgrade request pour 7r3, champion upgradé à 7r3 | `done_at` positionné automatiquement | — |
| UPG-16 | Auto-complete sur bulk import | Import avec rarity correspondante | Requests matching auto-completed | — |
| UPG-17 | Pas d'auto-complete si rarity différente | Request pour 7r5, champion à 7r3 | Request reste pending | — |

---

## Matrice de couverture par rôle

| Action | Non-auth | USER | ADMIN | SUPER_ADMIN | Owner | Officer | Membre |
|--------|----------|------|-------|-------------|-------|---------|--------|
| Login Discord | ✅ | — | — | — | — | — | — |
| Refresh token | ✅ | — | — | — | — | — | — |
| Session | ❌ | ✅ | ✅ | ✅ | — | — | — |
| Self-delete | ❌ | ✅ | ✅ | ✅ | — | — | — |
| CRUD game account | ❌ | ✅ | ✅ | ✅ | — | — | — |
| Voir alliances | ❌ | ✅ | ✅ | ✅ | — | — | — |
| Créer alliance | ❌ | ✅ | ✅ | ✅ | — | — | — |
| Maj/Suppr alliance | ❌ | — | — | — | ✅ | ❌ | ❌ |
| Inviter/annuler | ❌ | — | — | — | ✅ | ✅ | ❌ |
| Exclure membre | ❌ | — | — | — | ✅ | ⚠️¹ | ❌ |
| Gérer officers | ❌ | — | — | — | ✅ | ❌ | ❌ |
| Gérer groupes BG | ❌ | — | — | — | ✅ | ✅ | ❌ |
| Placer défenseur | ❌ | — | — | — | ✅ | ✅ | ⚠️² |
| Retirer/vider défense | ❌ | — | — | — | ✅ | ✅ | ❌ |
| Export/Import défense | ❌ | — | — | — | ✅ | ✅ | ❌ |
| CRUD roster (soi) | ❌ | ✅ | ✅ | ✅ | — | — | — |
| Voir roster allié | ❌ | — | — | — | — | — | ✅ |
| Load champions | ❌ | ❌ | ✅ | ✅ | — | — | — |
| Admin - list users | ❌ | ❌ | ✅ | ✅ | — | — | — |
| Admin - disable/enable | ❌ | ❌ | ✅ | ✅ | — | — | — |
| Admin - promote/demote | ❌ | ❌ | ❌ | ✅ | — | — | — |

¹ Officer peut exclure les membres simples mais PAS les autres officers  
² Membre peut placer uniquement ses propres champions

---

## Constantes de validation (récapitulatif)

| Paramètre | Min | Max | Spécial |
|-----------|-----|-----|---------|
| `alliance.name` | 3 | 50 | — |
| `alliance.tag` | 1 | 5 | — |
| `alliance.group` | 1 | 3 | `null` pour retirer |
| `game_account.game_pseudo` | 2 | 16 | — |
| `champion.name` | — | 100 | unique |
| `champion.champion_class` | — | 20 | — |
| `champion.alias` | — | 500 | nullable |
| `champion_user.rarity` | — | — | enum: 6r4, 7r1-7r5 |
| `champion_user.signature` | 0 | ∞ | — |
| `champion_user.ascension` | 0 | 2 | forcé 0 si non-ascendable |
| `defense.node_number` | 1 | 55 | — |
| `defense.battlegroup` | 1 | 3 | — |
| `MAX_GAME_ACCOUNTS_PER_USER` | — | 10 | — |
| `MAX_MEMBERS_PER_ALLIANCE` | — | 30 | — |
| `MAX_MEMBERS_PER_GROUP` | — | 10 | — |
| `MAX_DEFENDERS_PER_PLAYER` | — | 5 | — |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | — | 60 | — |
| `REFRESH_TOKEN_EXPIRE_DAYS` | — | 30 | — |
