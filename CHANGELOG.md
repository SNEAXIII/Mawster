# Changelog

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versionnage suit
[Semantic Versioning](https://semver.org/lang/fr/).

## [1.6.0](https://github.com/SNEAXIII/Mawster/compare/v1.5.0...v1.6.0) (2026-08-27)


### Ajouté

* add visitor leave functionality to alliance page ([0d63a32](https://github.com/SNEAXIII/Mawster/commit/0d63a32217ef9f674bf5c53acb6593bb12fdbf48))
* block deletion for visiting accounts and cancel their pending invitations ([1f3ceff](https://github.com/SNEAXIII/Mawster/commit/1f3ceff09fdc252942a6f098807cc56900e5b6bb))
* **ci:** announce production deploys on Discord ([1276e22](https://github.com/SNEAXIII/Mawster/commit/1276e2269d009efe186132f60cf2675b22cecd27))
* **ci:** refresh uv.lock on the release pull request ([01c6cfe](https://github.com/SNEAXIII/Mawster/commit/01c6cfe27cccf48dcdba266b2d616d4313fd550e))
* **ci:** tag the images with the released version ([3b3e9d8](https://github.com/SNEAXIII/Mawster/commit/3b3e9d82c21b7907921c680d8ee6855de83fc6e5))
* **ci:** version the project with release-please ([32c9979](https://github.com/SNEAXIII/Mawster/commit/32c9979228162befabc53df58ff79fab617dbb56))
* **ci:** version the project with release-please ([993a57a](https://github.com/SNEAXIII/Mawster/commit/993a57a70e475461442c528c80942a84244cf866))
* confirm game account deletion by name and offer a 7-day restore ([489eabd](https://github.com/SNEAXIII/Mawster/commit/489eabdd2598dba014925cb69a51dac39970485d))
* **front:** let a visitor leave the alliance they visit ([587d1b8](https://github.com/SNEAXIII/Mawster/commit/587d1b8214f28926c1e1e938b4978e424abd0907))
* soft-delete alliances with owner-only confirmation ([f5debcc](https://github.com/SNEAXIII/Mawster/commit/f5debcc066fd33ef48aa6a2a0afc485db5e69c4e))
* soft-delete an alliance, leader only and only when alone ([c140aff](https://github.com/SNEAXIII/Mawster/commit/c140affe066474d7d1d8efc4be3f030b96a5dd68))
* soft-delete game accounts with a 7-day restore window ([94471c8](https://github.com/SNEAXIII/Mawster/commit/94471c882594dab6e0b38783ecd5fbdf952a5295))


### Corrigé

* **a11y:** make three click-only controls keyboard operable ([37200d6](https://github.com/SNEAXIII/Mawster/commit/37200d6509b53e701e75f51811a921e1b5f81367))
* **ci:** keep uv.lock in step with the release version ([99bbe9e](https://github.com/SNEAXIII/Mawster/commit/99bbe9e01a05bef29f3b7eb83ace10416ad6f840))
* **ci:** pass branch metadata through env, and audit workflows with z… ([0c05c70](https://github.com/SNEAXIII/Mawster/commit/0c05c705119b7e70b1b99d39a32764729fc46513))
* **ci:** pass branch metadata through env, and audit workflows with zizmor ([aef87c7](https://github.com/SNEAXIII/Mawster/commit/aef87c76922e8f7e601afd35735255ec93beae6a))
* **dev:** keep a log marker title on a single line ([7026b73](https://github.com/SNEAXIII/Mawster/commit/7026b73fac3803dfbc91a3c33c913ed139029158))
* **docker:** refuse sdists and pin uv in the image builds ([a70bbf6](https://github.com/SNEAXIII/Mawster/commit/a70bbf6b633125c59e07eb66093e7fd6d099e6ec))
* **docker:** refuse sdists in the container entrypoints too ([2ac24b8](https://github.com/SNEAXIII/Mawster/commit/2ac24b87f82253cbc2038ec4ef525c2d762210a9))
* **e2e:** target the remove button by data-cy, not by DOM order ([5f333e5](https://github.com/SNEAXIII/Mawster/commit/5f333e5a31da31e46632da53df9efc06ec675078))
* front/package.json & front/package-lock.json to reduce vulnerabilities ([096ebba](https://github.com/SNEAXIII/Mawster/commit/096ebba2f265314203c48baff72a3d95b0649f81))
* **front:** restore peer dependency resolution, unbreak the build ([5f297c3](https://github.com/SNEAXIII/Mawster/commit/5f297c3e2bb231a322f57814caa75460b219b9d7))
* **front:** restore peer dependency resolution, unbreak the build ([d8bad0c](https://github.com/SNEAXIII/Mawster/commit/d8bad0c484ee50cd265ab2456778f1f2f408fffc))
* **scripts:** anchor version tags on the promoted commit ([a4e4fe6](https://github.com/SNEAXIII/Mawster/commit/a4e4fe64b4ea54d7dcdd98862b7366274111c116))
* stop dumping a traceback every 5s when RabbitMQ is unreachable ([bd23a5c](https://github.com/SNEAXIII/Mawster/commit/bd23a5cdff916dbd9df492973c0da2d64e7ab49e))
* stop dumping a traceback every 5s when RabbitMQ is unreachable ([f191f26](https://github.com/SNEAXIII/Mawster/commit/f191f26d3e99c7203eec177b4227da1c64523167))


### Modifié

* **api:** annotate the last Depends defaults and enforce B008 ([fd855fe](https://github.com/SNEAXIII/Mawster/commit/fd855feec0e52b3b0ce2cb9de7f5ad7c471b66c2))
* **api:** migrate Query parameters to Annotated ([463bbea](https://github.com/SNEAXIII/Mawster/commit/463bbea94ce1795e133081db9917a400e06a360e))
* **tests:** hoist setup calls out of pytest.raises blocks ([6aa5cb7](https://github.com/SNEAXIII/Mawster/commit/6aa5cb747bdf427a2ff0d106cf5ae9be54180a47))

## [1.5.0] — 2026-08-25

### Ajouté

- Suppression d'un compte de joueur avec fenêtre de restauration de 7 jours et confirmation par
  saisie du nom ; un compte en visite ne peut pas être supprimé, et ses invitations en attente
  sont annulées
- Suppression d'une alliance, réservée au chef et seulement s'il est seul
- Un visiteur peut quitter l'alliance qu'il visite

### Sécurité

- Correction d'une traversée de chemin dans le chargement des fixtures

## [1.4.0] — 2026-08-24

### Ajouté

- **Rafraîchissement automatique des champions** : le catalogue est mis à jour chaque jour depuis
  le wiki, et les nouveaux champions arrivent en production au déploiement suivant
- **Tableau de bord des imports par vision** pour les administrateurs
- Export des écrans de guerre et de défense en haute résolution, ouvert à tous les membres de
  l'alliance, et export de l'historique en image
- Aperçu de la variation d'ELO dans la fenêtre de fin de guerre
- Colonne saison, portraits encadrés et tag d'alliance dans la base de connaissances
- Sélection de la saison affichée dans le tableau de statistiques

### Modifié

- Cartes de champion et nœuds de carte de guerre compactés

### Corrigé

- Les placements de défense d'un membre survivaient à son départ, à son exclusion et à son
  changement de groupe de bataille, laissant des défenseurs fantômes sur la carte
- Les demandes d'amélioration d'un membre restaient en attente après son départ de l'alliance

### Performance

- Chargement paresseux des images de champion
- Connexion atterrissant directement sur la page demandée

## [1.3.0] — 2026-08-14

### Ajouté

- Une connexion Discord ou Google peut être rattachée à un compte existant quand l'adresse e-mail
  est vérifiée, avec explication du motif quand une connexion est refusée

### Performance

- Chargement des alliances accessibles en une seule requête

### Corrigé

- Un officier ne pouvait pas quitter son alliance : seul le rôle de membre simple passait le
  contrôle d'autorisation

## [1.2.0] — 2026-08-03

### Ajouté

- Envoi des captures d'écran directement depuis le navigateur, sans transiter par l'API
- Validation écran par écran des imports par vision

### Corrigé

- Les bascules de rareté 6★ n'étaient pas rendues dans les sélecteurs de champion

## [1.1.0] — 2026-07-29

### Ajouté

- Dialogue d'aide « comment importer », avec capture d'exemple et possibilité de ne plus l'afficher

### Performance

- Vignettes de revue regroupées en une seule image

### Corrigé

- Un import de roster réinitialisait le marquage « attaquant préféré » des champions concernés

## [1.0.0] — 2026-07-23

**Import du roster à partir de captures d'écran du jeu.**

### Ajouté

- Import par vision : envoi d'une capture, détection des champions, écran de revue avec le score
  de confiance et l'image découpée de chaque ligne, correction manuelle avant validation
- Choix du bon champion parmi les candidats proposés, lignes regroupées par niveau de certitude
  et repliables
- Un import à la fois et quota horaire ; relance d'une capture en échec ; annulation d'un import ;
  les images sont supprimées au bout de 7 jours
- Imports en attente signalés sur le roster
- Résolution des champions à l'import CSV

## [0.18.0] — 2026-07-13

### Ajouté

- **Matchups** : notation des affrontements attaquant contre défenseur, avec moteur de verdict et
  règles de jouabilité, grilles croisées en miroir avec code couleur, filtres de nœuds par palier
  et filtre joueur ; saisie réservée aux officiers, consultation ouverte aux visiteurs

## [0.17.0] — 2026-07-08

### Ajouté

- **Statistiques de joueur sur le profil** : carte de synthèse, évolution du ratio, usage des
  champions et liste des saisons, avec la participation en assistance comptabilisée
- Badge de saison terminée pendant l'intersaison
- Déconnexion unifiée

## [0.16.0] — 2026-07-06

### Ajouté

- **Recherche de champion à l'échelle de l'alliance** : onglet dédié, filtre par groupe de
  bataille, défilement infini, couronne du préféré, signature colorée et ascension
- **Sagas par saison** : les rôles de saga d'un champion dépendent désormais de la saison en cours
  au lieu d'être définis une fois pour toutes

## [0.15.0] — 2026-07-02

### Ajouté

- Filtres de roster
- Lien de partage d'une guerre, et page de guerre navigable par l'adresse
- Filtre de rareté conservé et tri par rang dans les sélecteurs d'attaquant et de défense

## [0.14.0] — 2026-06-29

### Ajouté

- **Page d'accueil publique** avec témoignages et présentation de la planification d'attaque et de
  défense

### Modifié

- Un combat non terminé compte pour 3 KO dans le ratio de kills, au lieu d'être ignoré : le ratio
  ne récompense plus l'abandon d'un combat

## [0.13.0] — 2026-06-26

### Ajouté

- **Notes de combat de guerre** : rédaction dans le popover du nœud, réservée aux officiers, avec
  badge sur la carte, nom de l'auteur et note dépliable dans la base de connaissances
- **Modération** : signalement d'une note, blocage automatique à 3 signalements en attente,
  panneau d'administration avec mise en sourdine, avertissement, résolution et levée, historique
  des suppressions et réactivation

## [0.12.0] — 2026-06-04

### Ajouté

- **Import CSV des relevés de combat** : page dédiée réservée aux officiers, aperçu mettant en
  évidence les champions non reconnus, doublons ignorés avec compte rendu, filtre
  « importé / non importé » dans la base de connaissances
- Édition du nom de l'adversaire et des bans d'une guerre
- Confirmation saisie avant de déclarer une guerre
- Badges de rôle d'alliance sur les comptes de jeu du profil
- Boutons d'export séparés pour la carte et les assignations

## [0.11.0] — 2026-05-26

### Ajouté

- Export PNG de la carte de guerre, de la carte de défense et des panneaux d'assignation
- Rareté 7r6
- Transfert de propriété d'une alliance vers un officier

## [0.10.0] — 2026-05-22

### Ajouté

- Filtre par saison dans la base de connaissances
- Validation des caractères autorisés sur les pseudos, noms et tags d'alliance

## [0.9.0] — 2026-05-19

### Ajouté

- **Assistance de guerre** : désignation d'un assistant sur un combat, avec badge, regroupement
  dans le panneau, comptage distinct des aides et colonne dédiée dans les statistiques de saison
- Total de combats pondéré à l'affichage, distinct de celui qui alimente le score
- Les visiteurs d'alliance accèdent aux relevés de combat

### Performance

- Suppression des appels répétés à la session à chaque navigation

## [0.8.0] — 2026-05-16

### Ajouté

- Courbe d'historique d'ELO dans l'onglet de statistiques
- Statistiques de participation aux guerres et filtre des anciens membres
- Filtres par drapeau, conservés au rechargement

## [0.7.0] — 2026-05-13

### Ajouté

- **Usage des champions** : camembert avec les portraits en légende, modale de détail triable,
  métriques KO et sans-mort, filtres attaquant/défenseur, nombre de champions affichés réglable
- **Visiteurs d'alliance** : un joueur peut consulter une alliance dont il n'est pas membre
- Badge de type sur les invitations en attente et reçues

## [0.6.0] — 2026-05-08

**Base de connaissances.** Les combats sont figés à la fin de la guerre et deviennent consultables
et filtrables.

### Ajouté

- Page `/game/knowledge-base` : pagination, tri, colonne des prefights, nom de l'alliance
- Filtres par champion et par pseudo, avec remise à zéro
- Drapeaux « combat non fait » et « erreur de planification » réservés aux officiers, exclus du
  score, avec badge et filtre dédiés
- Instantané forcé et statistiques d'instantané côté administration

## [0.5.0] — 2026-05-02

### Modifié

- Les entrées et les nœuds hors filtre de combat sont atténués au lieu d'être masqués, pour que
  la carte reste lisible pendant un filtrage

## [0.4.0] — 2026-04-30

**Première mise en production.**

### Ajouté

- Déploiement en Docker Swarm derrière Traefik, avec supervision (métriques, journaux centralisés)
  et sauvegardes automatiques
- **Serveur d'images dédié** pour les portraits de champions, redimensionnés automatiquement
- **ELO et palier** : édition en ligne par les officiers, fenêtre de fin de guerre avec bascule
  victoire/défaite et saisie d'ELO conditionnée à la saison, statistiques d'alliance avec
  classement et score de saison par joueur
- **Connexion Google** en complément de Discord, avec génération d'un identifiant à l'inscription
- Complétion de combat, même champion autorisé sur plusieurs nœuds de défense, édition de son
  propre identifiant
- Nœuds de prefight mis en évidence sur la carte de guerre

### Corrigé

- La limitation de débit comptait les requêtes par IP du reverse proxy et non par client, ce qui
  plafonnait tout le monde d'un coup ; elle est désactivée le temps de fiabiliser la lecture de
  l'en-tête `X-Forwarded-For`

## [0.3.0] — 2026-04-19

### Ajouté

- **Synergies d'attaque** : recherche de candidats, refus du même champion comme fournisseur
- **Bans de guerre** : jusqu'à 6 champions bannis, avec suggestion d'alias dans l'affichage de défense
- **Prefight** : sélecteur regroupé par joueur, badge et portrait dans la ligne d'attaquant,
  activation par champion côté administration, un champion utilisable sur plusieurs nœuds
- **Saisons** : gestion côté administration, bannière sur la page de guerre, guerre rattachée à la
  saison active à sa création
- **Maîtrises** : catalogue administrable et saisie par compte de jeu
- Compteur de KO, remplacement de défenseur avec confirmation, attaquant préféré porté par le
  placement de guerre
- Filtres partagés par classe, saga, joueur et préférence dans les sélecteurs

## [0.2.0] — 2026-03-31

### Ajouté

- **Guerre d'alliance** : carte de guerre, placements, panneau d'attaquants
- **Sauvegardes** : dump planifié, purge locale et distante, restauration manuelle
- Administration des champions et des utilisateurs, promotion et rétrogradation
- Import et export de défense, rafraîchissement automatique de l'affichage
- HTTPS forcé, en-têtes durcis, limitation de débit sur la connexion, cookies sécurisés
- Réglages mobiles pour la langue et le thème

## [0.1.0] — 2026-02-14

Première version de Mawster.

### Ajouté

- Connexion par Discord
- Comptes de joueur, alliances, champions et roster
- Alliances : membres, officiers, groupes de bataille, invitations
- Roster de champions, demandes d'amélioration avec annulation, attaquant préféré
- Placements de défense
