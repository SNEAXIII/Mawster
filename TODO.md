# TODO

## Bugs

- [ ] **War attacker — champion déjà en défense toujours sélectionnable**
  Un champion placé en défense régulière (onglet Defense) peut encore être sélectionné
  comme attaquant dans la guerre (onglet War > Attackers), malgré la validation ajoutée
  dans `WarService.get_available_attackers` et `assign_attacker`.
  À debugger : vérifier que le `battlegroup` côté défense correspond bien au `alliance_group`
  du compte, et que la jointure `DefensePlacement` retourne bien les bonnes lignes.

- [ ] **War attacker — limite de 3 attaquants par membre mal gérée**
  Le compteur de 3 attaquants max par membre dans un BG ne fonctionne pas correctement.
  À debugger : la condition dans `assign_attacker` s'appuie sur `attacker_champion_user.game_account_id`
  via les relations chargées — vérifier que `selectinload` charge bien `attacker_champion_user`
  sur tous les placements, et que le comptage est juste.
