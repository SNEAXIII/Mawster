# Changelog

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versionnage suit
[Semantic Versioning](https://semver.org/lang/fr/).

## [1.6.0](https://github.com/SNEAXIII/Mawster/compare/v1.5.0...v1.6.0) (2026-08-27)


### Ajouté

* add visitor leave functionality to alliance page ([0d63a32](https://github.com/SNEAXIII/Mawster/commit/0d63a32217ef9f674bf5c53acb6593bb12fdbf48))
* block deletion for visiting accounts and cancel their pending invitations ([1f3ceff](https://github.com/SNEAXIII/Mawster/commit/1f3ceff09fdc252942a6f098807cc56900e5b6bb))
* confirm game account deletion by name and offer a 7-day restore ([489eabd](https://github.com/SNEAXIII/Mawster/commit/489eabdd2598dba014925cb69a51dac39970485d))

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
