technique:
    mesurer la portabilité des 25 migrations alembic sur postgres (conteneur jetable, upgrade head à vide)
        prérequis à toute décision de bascule — voir adr 0009, tant qu'il n'y a pas de chiffre c'est un avis
    auditer la chaîne jwt : aucune révocation, aucun logout serveur, refresh de 7 jours en prod
        access 60min mais un refresh volé = 7 jours d'accès sans moyen de couper. choix assumé, jamais audité
    résorber les 16 warnings sonarjs du front puis passer la ci en --deny-warnings
    faire lire le détail du gate sonar par /merge-pr quand il est rouge (mcp sonarqube)
        aujourd'hui le skill donne juste l'url du check ; get_project_quality_gate_status +
        search_sonar_issues_in_projects diraient quelle condition casse (couverture new code,
        duplication) sans ouvrir le navigateur
    repasser sur oxfmt quand il sort en 1.0 (équivalent à prettier, 3x plus rapide, mais 0.66 = churn possible)
        piège connu : il faut un .oxfmtrc.json dans cypress/ aussi, sinon 106 specs réécrites
    un écran de visualisation / comparatif des persos monté par groupe/par alliance avec filters
    je veux que ce groupe aie tel perso monté def par les admins (commme la update request mais pas nominatif a une personne spécifique)
    "je compte up ce perso"

low:
    mettre un champ texte pour les notes

medium:
    fixer les multi appel api auth me
    fixer la nav bar qui met 3 ans a render
    bloquer les lignes si le boug peut pas aller a un endroit

prio:
    meilleure affiche pour la def (déja placé etc)

criTIQUE
    corriger la vérification d'audience oauth (discord + google)
        un token émis pour une autre application authentifie son porteur ici -> prise de compte
        plan prêt : docs/superpowers/plans/2026-09-03-oauth-audience-verification.md
