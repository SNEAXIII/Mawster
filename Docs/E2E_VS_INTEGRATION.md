# Tests E2E vs Tests d'intégration

## Qu'est-ce qu'un test d'intégration ?

Un test d'intégration vérifie qu'un **module isolé** fonctionne correctement en interagissant avec ses dépendances directes (base de données, service externe, etc.), mais dans un environnement **contrôlé** où une grande partie du système est mockée ou simplifiée.

**Exemple concret (backend Mawster)** : un test d'intégration pour la création d'un compte de jeu :
- Envoie une requête `POST /game-accounts` via `httpx.AsyncClient`
- Utilise une **vraie base SQLite** en mémoire
- L'authentification est **mockée** (token injecté directement)
- Vérifie **uniquement la réponse HTTP** (status code, body JSON)

## Qu'est-ce qu'un test E2E (End-to-End) ?

Un test E2E simule un **parcours utilisateur complet**, du navigateur jusqu'à la base de données, en traversant **toutes les couches** de l'application sans simplification.

**Exemple concret (frontend Mawster avec Cypress)** :
1. L'utilisateur se connecte via Discord OAuth
2. Navigue vers "Game Accounts"
3. Remplit le formulaire et crée un compte
4. Vérifie que le compte apparaît dans la liste
5. Le modifie, puis le supprime
6. Vérifie qu'il a disparu

## Comparaison détaillée

| Critère | Test d'intégration | Test E2E |
|---|---|---|
| **Portée** | Un endpoint / un service | Un parcours utilisateur complet |
| **Couches traversées** | API → Service → BDD | Navigateur → Frontend → API Proxy → Backend → BDD |
| **Mocks** | Auth, services externes, parfois la BDD | Minimum (uniquement OAuth externe) |
| **Vitesse** | Rapide (~50ms/test) | Lent (~2-10s/test) |
| **Fragilité** | Stable | Plus fragile (dépend du DOM, réseau, timing) |
| **Confiance** | Moyenne — valide la logique métier | Élevée — valide l'expérience réelle |
| **Maintenance** | Faible | Plus élevée (sélecteurs CSS, texte UI) |

## Ce que les tests E2E apportent en plus

### 1. Validation du rendu et de l'interaction UI
Les tests d'intégration ne vérifient **jamais** si un bouton est visible, si un formulaire est fonctionnel, ou si un message d'erreur s'affiche. Les tests E2E le font.

```
// E2E : vérifie que le toast de succès apparaît réellement
cy.contains('Game account created successfully!').should('be.visible');
```

### 2. Vérification du routing et de la navigation
Le middleware d'authentification, les redirections, les pages protégées — tout cela n'est testé que par les E2E.

```
// E2E : vérifie qu'un utilisateur non-authentifié est redirigé
cy.visit('/game/accounts');
cy.url().should('include', '/login');
```

### 3. Validation de l'intégration Frontend ↔ Backend
Les tests d'intégration backend ne vérifient pas que le frontend envoie les **bonnes données** au backend. Un champ renommé côté frontend peut casser l'application sans qu'aucun test d'intégration ne le détecte.

### 4. Détection des régressions visuelles et UX
- Un composant qui ne se monte plus à cause d'une prop manquante
- Un état de chargement infini
- Un formulaire qui ne se réinitialise pas après soumission
- Un dialogue de confirmation qui ne se ferme pas

### 5. Tests des flux multi-étapes
Certaines fonctionnalités nécessitent une **séquence d'actions** :
1. Créer un compte de jeu
2. Créer une alliance avec ce compte
3. Inviter un autre joueur
4. Accepter l'invitation
5. Placer un défenseur

Aucun test d'intégration ne couvre cette chaîne complète.

### 6. Validation de l'internationalisation (i18n)
Les tests E2E peuvent vérifier que les textes s'affichent correctement dans les deux langues (EN/FR).

### 7. Tests cross-browser
Les tests E2E avec Cypress/Playwright peuvent s'exécuter sur Chrome, Firefox, Edge, et détecter des incompatibilités navigateur.

## Pyramide des tests — Mawster

```
        ╱╲
       ╱ E2E ╲          ← Peu nombreux, haute confiance
      ╱────────╲            Cypress (front) + httpx (back)
     ╱ Intégration╲      ← Nombreux, confiance moyenne
    ╱──────────────╲        pytest + AsyncClient + SQLite
   ╱  Tests unitaires ╲  ← Très nombreux, rapides
  ╱────────────────────╲    pytest + mocks complets
```

## Résumé

| Type de bug | Détecté par intégration ? | Détecté par E2E ? |
|---|---|---|
| Logique métier incorrecte | ✅ | ✅ |
| Mauvais status code API | ✅ | ✅ |
| Bouton cassé dans l'UI | ❌ | ✅ |
| Redirection manquante | ❌ | ✅ |
| Champ de formulaire mal connecté | ❌ | ✅ |
| Message d'erreur non affiché | ❌ | ✅ |
| Problème de timing/chargement | ❌ | ✅ |
| Flux multi-utilisateur cassé | ❌ | ✅ |
| Proxy API mal configuré | ❌ | ✅ |
| Incompatibilité navigateur | ❌ | ✅ |

**En résumé** : les tests d'intégration valident que le **code fonctionne**, les tests E2E valident que l'**application fonctionne**.
