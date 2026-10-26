# Signal, le panneau par défaut (D-250)

Construit sur le tronc après l'étape R, d'après la maquette `maquettes/ui-5.0/Q-signal.html` et le fichier Figma « Ariane 5.0 · design system et écrans » (pages 03 et 04, relues écran par écran le 25/10).

## Ce qui est construit

- **Fichiers** : `src/signal-rendu.js` (le dessin, sans effet de bord), `panel-signal.css` (le style, polices IBM Plex du dossier `fonts/`), et le branchement dans `src/ui5.js`. Le départ est réglé dans `src/ui5-variante.js`.
- **Au départ, c'est Signal**, en thème sombre. L'ancien panneau n'est plus proposé. Il reste caché, comme moteur de la page : Signal lit ce qu'il affiche et clique ses boutons (`data-act="legacy:<id>"`). Aucun message nouveau vers le service worker. Les exports n'ont pas changé.
- Si la préférence « ancienne » est restée enregistrée, elle est ignorée : Signal s'ouvre quand même.
- **Secours** : si Signal n'arrive pas à se dessiner, l'ancien panneau réapparaît. Sa ligne d'avis dit pourquoi.
- **L'écran** : la barre (logo, bascule Orbite / Écho avec cadenas et raison, puce de l'onglet ESV, palette, réglages), puis l'instrument (glyphe, mot d'état, phrase, rail, ligne d'allure, une seule action principale), puis le tiroir « Ce qui reste », puis la bande du cache. Le mode compact s'active quand la fenêtre fait moins de 480 de large ou moins de 600 de haut.
- **Revue V2** :
  - « Examiner » barre la ligne et fait baisser « reste à examiner ». Cette marque est gardée par lot, dans `chrome.storage.local` (clé `banane51Examines`). Au clavier : ↑ ↓ choisissent une ligne, E marque.
  - « Ouvrir » recopie la cible dans `#goto-cut-cible`, puis clique le bouton caché `#goto-cut` du panneau.
  - Les verts à contrôler arrivent du panneau groupés en plages : « Ouvrir » va au premier cut de la plage.
- **Réglages** : les choix du panneau (après le lot, clic, série de différés, deuxième passe, raison, F5 pendant la relecture, bandeau), plus le thème, l'interface, les exemples d'apprentissage et l'historique des parties.
- **Détails techniques** : santé de la collecte, qualité de capture, départs, résumé de la partie, exports et journal. Ce sont les vrais éléments de l'ancien panneau, déplacés le temps de la lecture, puis remis à leur place. Rien n'est perdu.
- **Palette** (Ctrl K) : les quatre commandes du moment, le reste en tapant. Une commande grisée dit pourquoi et ne se lance pas.
- Les présentations d'essai « ariane2 » et « palette » restent choisissables. Elles pourront être retirées quand Signal sera validé.

## L'allure, honnêtement

- **Calculé** à partir de `batch.processed[].durationMs`, le temps entre l'ouverture du cut et sa validation : la médiane des 20 derniers cuts (au moins 3), les cuts par minute (60 ÷ médiane) et le temps restant (restants × médiane, seulement si le nombre de cuts ciblés est connu).
- **L'anneau « en cours »** se remplit avec le temps passé sur le cut (`batch.cutStartedAt`), rapporté à la médiane.
- **Ce qui manque** :
  - Les cuts par minute ne comptent pas la navigation entre deux cuts. Il faudrait une heure de fin par cut.
  - « En pause depuis » ne s'affiche que si le moteur fournit `batch.pausedAt`, promis dans T20a s'il est simple à ajouter.
  - Il n'y a pas d'allure de relecture : le module de relecture ne garde pas la durée par cut.

## T20a, fusionné

- L'étape T20a du moteur est fusionnée : tronc e17078e, avec T20a puis T21a.
- Signal utilise maintenant :
  - l'état de la connexion (`connection.status`) ;
  - le bouton `#reconnect`, dans la liste des onglets ESV et dans la palette ;
  - l'historique `partsHistory`, dans les réglages ;
  - l'heure de mise en pause `batch.pausedAt`, pour « en pause depuis » ;
  - le déclencheur caché `#goto-cut` pour « Ouvrir dans ESV ».
- « Ouvrir » envoie l'action « aller au cut », qui existait déjà. Elle est refusée pendant un lot en cours ou en pause, une relecture, une deuxième passe, une séance Écho, ou quand ESV n'est pas prêt. La raison s'affiche sur le bouton grisé.
- Le relevé du sélecteur de parties (`partsSelector`) n'est pas encore affiché par Signal.

## Essais

- `tests/signal-rendu.test.cjs` (le dessin) ;
- `tests/ui5-panneau.test.cjs` (le branchement dans la page) ;
- `tests/ui5-navigateur-signal-normal.test.cjs`, `-compact`, `-actions` et `-ouvrir` (un vrai navigateur, en 600 × 760 et en 360 × 480, un fichier par partie pour tenir sous les 20 s de `tools/verify.cjs` : aucune erreur, rien qui déborde, un clic sur Signal envoie au service worker exactement ce qu'envoie le bouton d'origine, et les détails techniques s'ouvrent puis se referment).
- Mettre la variable `SIGNAL_CAPTURES=<dossier>` pour obtenir les captures.

## Mouvement (retour de la test 21)

- **Ce qui n'allait pas** : le panneau redessinait tout l'écran à chaque rendu, soit une fois par seconde. Les transitions prévues (le curseur qui glisse sur le rail, la couleur du glyphe) ne se jouaient donc jamais. Les entrées de la palette ou de la feuille de réglages pouvaient se rejouer. Un clic pouvait tomber sur un élément en train d'être remplacé.
- **Le correctif** : `src/ui5.js` met maintenant l'écran à jour en place. Les éléments qui restent ne bougent pas ; seuls leurs attributs et leurs textes changent. Un élément dont la clé `data-k` change est remplacé, et son entrée s'anime alors une fois.
- **Les mouvements** (`panel-signal.css`, section « mouvement ») : chacun signale un changement, aucun n'est un ornement. Il n'y a qu'une boucle, le glyphe « en cours ».
  - L'écran entre en cascade.
  - Le glyphe entre quand l'état change ; la coche de « Terminé » se trace ; « À toi » s'éclaire deux fois.
  - Le chiffre ou le compteur qui change le signale une fois.
  - Sur le rail : le segment fait avance, le curseur glisse et un nouveau différé se dresse.
  - L'action principale entre quand elle change.
  - Le tiroir glisse, puis ses lignes arrivent en cascade. « Examiné » se raye et la coche s'anime.
  - La palette et la feuille entrent une fois, avec leur contenu en cascade.
  - La note de la barre descend.
  - Avec le réglage système « réduire les animations », tout est à zéro.
- **Essai** : `tests/ui5-navigateur-signal-mouvement.test.cjs`, qui vérifie que le curseur reste le même élément et que sa position change, que le chiffre le signale, et que la palette n'est pas recréée.
