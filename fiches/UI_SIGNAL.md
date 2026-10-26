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

## Ce qui dépend de T20a (pas encore sur le tronc)

- **État de la connexion** (`connection.status`), bouton `#reconnect`, historique `partsHistory`, déclencheur caché `#goto-cut`. Tant qu'ils manquent, Signal fait ceci :
  - « Ouvrir » est grisé, avec la raison « Disponible avec la prochaine mise à jour du moteur » ;
  - les réglages n'affichent pas l'historique des parties ;
  - le bouton Reconnecter n'apparaît pas.
- Dès que T20a est fusionné, ces éléments s'affichent sans autre changement. Il restera à vérifier les noms et à relancer les essais.

## Essais

- `tests/signal-rendu.test.cjs` (le dessin) ;
- `tests/ui5-panneau.test.cjs` (le branchement dans la page) ;
- `tests/ui5-navigateur-signal-normal.test.cjs`, `-compact` et `-actions` (un vrai navigateur, en 600 × 760 et en 360 × 480, un fichier par partie pour tenir sous les 20 s de `tools/verify.cjs` : aucune erreur, rien qui déborde, un clic sur Signal envoie au service worker exactement ce qu'envoie le bouton d'origine, et les détails techniques s'ouvrent puis se referment).
- Mettre la variable `SIGNAL_CAPTURES=<dossier>` pour obtenir les captures.
