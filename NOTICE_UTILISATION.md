# Ariane 5 — notice d'utilisation

Ariane 5 est une extension Chrome (et Edge) qui travaille dans ESV : **Écho** observe votre travail, **Orbite** place et valide les rails d'un lot de cuts, la **Constellation** enchaîne plusieurs parties, **Aurore** corrige dans Orbite. Cette notice dit comment s'en servir et quoi faire quand quelque chose se passe mal.

## 1. Installer

1. Décompressez `ariane-v5.zip` dans un dossier **fixe** (ne le supprimez pas ensuite).
2. Page des extensions du navigateur → mode développeur → « Charger l'extension non empaquetée » (ou « Recharger » si Ariane est déjà là : **ne supprimez pas l'extension**, le stockage en cours serait perdu).
3. Désactivez les anciennes versions d'Ariane (un seul Ariane à la fois).
4. **Rechargez la page ESV.** Le bouton blanc « Ariane 5 · ouvrir » apparaît au bas d'ESV ; le panneau s'ouvre aussi par l'icône de l'extension.
5. À l'ouverture, un court écran de lancement passe (un clic, une touche ou « Passer » le ferme). Le numéro de version « 5 » est affiché sous ARIANE, sur l'accueil.

## 2. Les deux onglets

- **Écho** : « Démarrer l'observation » enregistre ce que vous faites dans ESV ; « Pause » / « Reprendre » ; « Terminer et télécharger » produit le fichier. Vous pouvez noter la raison d'une correction avec les touches 1 à 6 (0 efface).
- **Orbite** : le lot, la file de parties, les règles, les résultats et la relecture.

## 3. Un lot (une partie)

1. Ouvrez ESV sur la partie voulue.
2. Onglet Orbite → « Démarrer le lot ».
3. Ariane pose les rails cut après cut ; les cuts qu'elle ne sait pas résoudre sont **différés** (jamais validés à l'aveugle). Une deuxième passe reprend les différés.
4. Boutons utiles : « Pause » / « Reprendre », « Réessayer ce cut », « Reprise manuelle » (vous prenez la main sur un cut), « Arrêter le lot ».
5. À la fin, le panneau montre le résumé de la partie et la liste « À contrôler » (cuts verts à regarder).

## 4. La Constellation (plusieurs parties à la suite)

1. « Préparer la file » : choisissez les parties à traiter, dans l'ordre.
2. « Lancer la file » : Ariane traite la première partie, passe à la suivante (ESV ouvre la partie), et ainsi de suite jusqu'à la dernière.
3. « Arrêter la file » l'arrête proprement ; « Reprendre la file » reprend là où elle s'est arrêtée.
4. Après un **F5** (rechargement d'ESV), la file reprend seule : elle attend qu'ESV soit prêt, retourne à la bonne partie et relance le lot. Si le message dit qu'elle n'a pas pu, cliquez « Reprendre la file ».
5. Si la page est occupée (une action d'Ariane n'est pas finie), Ariane attend jusqu'à environ 1 min 45 avant de renoncer ; ensuite la file s'arrête et le panneau dit pourquoi.

## 5. Aurore

La case « Passer d'une partie à l'autre pour ouvrir un cut » autorise Ariane à changer de partie pour ouvrir un cut d'une autre partie (correction dans Orbite). Décochée, elle reste dans la partie courante.

## 6. La relecture

Après un lot, la relecture revérifie les cuts validés. Trois modes (carte « Relecture ») : **Coupée**, **Ombre** (elle regarde et note, sans rien changer), **Corriger** (valeur par défaut : elle corrige les verts sûrs et les valide). Elle se met en pause et reprend, même après un F5.

## 7. Veille de l'ordinateur — important

Pendant un lot, une file, une deuxième passe ou une relecture, Ariane demande à Chrome de **garder l'ordinateur éveillé et l'écran allumé**. Conséquences :

- l'écran ne s'éteint pas tant que le travail tourne ; il redevient normal dès que tout est fini ;
- **ne mettez pas l'ordinateur en veille à la main** (fermer le capot, menu Démarrer → Veille) : Ariane ne peut pas l'empêcher et ESV perd sa connexion ;
- si, malgré tout, la veille a eu lieu, ESV est lent au réveil : rechargez la page ESV (F5) ; la file reprend seule, sinon « Reprendre » ;
- le journal garde la trace d'une veille (`veille-detectee`) : joignez l'export si cela arrive.

## 8. Exporter pour analyse

« Tout télécharger pour l'analyse » produit un export en **plusieurs volumes** (un zip par volume ; il faut tous les volumes). Gardez-les ensemble et transmettez-les à l'intégrateur. Ces fichiers contiennent des données de projet : ne les mettez jamais dans le dépôt du code.

## 9. Si ça se passe mal

| Constat | Que faire |
|---|---|
| « Lecture LiDAR instable … rafraîchis la page ESV (F5) » | F5 sur ESV, puis « Reprendre » (la file reprend seule si elle était lancée). |
| La file s'arrête avec « occupé » | Attendez quelques secondes, puis « Reprendre la file ». Faites ensuite un export. |
| ESV ne change pas de partie | Vérifiez que la partie existe ; « Reprendre la file ». |
| Le panneau est vide ou figé | Rechargez la page ESV ; si besoin, « Recharger » l'extension. |
| Un cut reste différé | C'est voulu : Ariane ne valide pas un cut qu'elle ne sait pas résoudre. Traitez-le à la main (« Reprise manuelle »). |

Ariane n'envoie jamais « SKIP » et ne valide jamais un cut non résolu.
