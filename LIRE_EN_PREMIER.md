# Démarrer avec Banane V4.4.3 TEST

Installe seulement `releases/banane-v4.4.3-test.zip` dans Edge ; `releases/banane-v4.4.3-source-tests.zip` contient les sources et tests reproductibles. Vérifie d'abord « V4.4.3 · TEST » dans la fenêtre Banane et « Banane 4.4.3 · ouvrir » quand toutes les fenêtres sont fermées. En V4.4.2, le bouton restait affiché malgré l'ouverture ; en V4.4.3 il doit se masquer et revenir après fermeture de toutes les fenêtres. Ce correctif attend ton essai Edge. Le Mode Natif conserve son instantané de chaque rail avant intention. Voir `NATIVE_GEOMETRY_ACCEPTANCE.md`.

## Mise à jour

1. Décompresse le ZIP et remplace les fichiers dans **le dossier de Banane déjà chargé dans Edge**.
2. Dans `edge://extensions`, clique sur **Recharger**. Recharge ensuite **la page ESV**.
3. Ouvre Banane. Pour vérifier le nouveau collecteur géométrique sans piloter ESV, choisis **Mode Natif**. La connexion est automatique s’il n’y a qu’un onglet ESV.

## Ton essai du Mode Natif corrigé

Lis `NATIVE_GEOMETRY_ACCEPTANCE.md` : démarre l'observation, travaille normalement dans ESV sur quelques cuts (deux rails chargés, rail seul, retour sur un cut, pause), puis termine et télécharge le JSON. Banane ne sélectionne rien et ne valide rien à ta place. Le rapport de trois anciens exports explique le défaut corrigé ; seul un nouvel essai ESV peut démontrer la capture des points et sa fluidité réelle.

## Mes corrections : essai séparé de deux ou trois cuts

- Clique une fois sur **Démarrer l’enregistrement**.
- Attends **Cut prêt**, puis travaille comme d’habitude : gauche → `d` → droit → `Shift + Espace` pour valider ou `Shift + Retour arrière` pour skipper.
- Continue sur les cuts suivants. Banane s’occupe de l’enregistrement.
- À la fin, clique une fois sur **Terminer et télécharger** et envoie le JSON obtenu.

Le fichier contient toute la session. Les boutons avant/après ont disparu de cette fenêtre.

Un cut SKIP reste dans le fichier avec son LiDAR disponible et les états avant/final des deux rails, mais il est exclu des exemples de pointage correct pour l’entraînement. Aucun SKIP n’est déclenché automatiquement.

**Pilotage automatique** est une autre fenêtre. L’**assisté**, accessible depuis l’accueil, sert simplement à demander puis accepter ou ignorer une proposition sur un cut.

La V4.4.2 ne change pas le placement ni le pilote. Les exemples géométriques candidats du Natif ne sont pas automatiquement utilisables pour entraîner le moteur ; ils nécessitent une revue humaine.
