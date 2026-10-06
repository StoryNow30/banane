# Séance terrain « test 2 » : consigne pour Mic (6 octobre 2026)

Autorisée par D-078 (V1 adopté pour test + observateur passif, journalisation seulement). **Rien ne change dans la façon
dont Ariane pose ou valide** : le paquet mesure et observe, il ne décide rien de plus que la 4.8.6.

## Le paquet

- Fichier : `ariane-4.9.0-test.2.zip` (version 4.9.0.2, « 4.9.0 test 2 »), 1 208 608 octets.
- SHA-256 : `06b1f2f728f584e7b05322a99301441e80712bcfa195f1cb39e05c55000f5ab2`.
- Construit avec `tools/package.py` depuis la tête `9355f1f` de la branche `claude/49-test-2-final` (verify : 1 202 essais,
  1 200 réussis, 0 échec, 2 sautés non réussis). Rien n'est publié ni fusionné.
- Nouveau par rapport à la 4.8.6 : la mesure par phase (V1, relue), le panneau validé (U1, U2) et un **observateur passif**
  qui note, dans la page d'ESV, ce que le site fait déjà : réponse du serveur à chaque validation, listes de coupes, chargements.
  Il ne lit jamais ton identifiant de connexion, n'envoie aucune requête et n'ajoute aucun bouton.

## Avant de commencer

1. **Désinstalle l'ancienne version d'Ariane** (une seule Ariane à la fois), puis installe ce paquet comme d'habitude.
2. **Recharge l'onglet ESV (F5) juste après l'installation**, puis choisis cet onglet dans Ariane. Sans rechargement,
   l'observateur n'est pas en place : Écho refuse de démarrer (« Recharge ESV… ») et, en Orbite, les mesures n'auraient
   pas d'observation d'écriture. Plus besoin d'attendre 15 secondes.
3. Ne fais pas autre chose dans ESV pendant la séance (un seul onglet ESV).

## La partie et les lots

- **Partie proposée : la 23**, déjà mesurée avec V1, qui n'est ni une partie neuve ni une partie de validation : on ne
  consomme aucune partie réservée aux portes. Tu peux en choisir une autre si tu préfères ; **dis-moi laquelle**.
- **Plusieurs lots** : V1 a besoin de plusieurs lots pour être jugé (couverture complète, lots de tailles différentes). À titre
  de suggestion, 50, 50 puis 150 coupes si le temps le permet. Le budget et la durée sont ton choix.
- Travaille normalement avec Orbite. Aucun réglage à changer.

## À la fin de chaque lot

- Exporte comme d'habitude (journal et bilan du panneau, ou « Tout télécharger ») et **envoie-moi les fichiers dans cette
  conversation**. Je lis le bilan et je te dis si l'observateur était bien en place (ligne « Observateur : présent… installé
  avant les scripts de la page : oui »).
- Si le bilan dit « Observateur : absent » ou « marque absente » : recharge l'onglet ESV (F5), choisis-le dans Ariane et
  recommence le lot suivant.

## Si quelque chose d'anormal arrive

Ariane se bloque, ESV se comporte autrement, une fenêtre d'erreur apparaît : **arrête**, note l'heure et ce que tu as vu, envoie-moi
l'export. Pour revenir en arrière, réinstalle la 4.8.6. Il n'existe pas d'interrupteur de l'observateur dans le panneau.

## Ce qui n'est pas vérifié (à savoir avant de partir)

- L'observateur a été essayé dans un vrai Chromium contre notre copie locale d'ESV, **pas sur le vrai serveur** ; le script
  que le vrai serveur ajoute dans chaque page n'a pas été collecté.
- Pas essayé sous Edge ni sous Chrome ou Edge antérieur à 111 (version minimale déclarée : 111).
- Un lot Orbite complet n'a pas pu être essayé dans la copie locale (points seulement pour les coupes 0 à 3 de la partie 21).
- Aucun gain de vitesse n'est attendu de ce paquet : c'est un test de mesure.
