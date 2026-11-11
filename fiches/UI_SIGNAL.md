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
- **Réglages** : les choix du panneau (après le lot, clic, série de différés, deuxième passe, raison, F5 pendant la relecture, bandeau), plus le thème, les exemples d'apprentissage et l'historique des parties.
- **Détails techniques** : santé de la collecte, qualité de capture, départs, résumé de la partie, exports et journal. Ce sont les vrais éléments de l'ancien panneau, déplacés le temps de la lecture, puis remis à leur place. Rien n'est perdu.
- **Palette** (Ctrl K) : les quatre commandes du moment, le reste en tapant. Une commande grisée dit pourquoi et ne se lance pas.
- Les présentations d'essai « ariane2 » et « palette » ont été retirées à la test 23 (voir plus bas).

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

## Test 23 : présentations d'essai retirées, mouvement repris sur la test 22

- **Retiré** : les présentations d'essai « ariane2 » et « palette seule » (`src/ui5-rendu.js` et son essai), le choix « Interface » des réglages, et le lien « Essayer le nouveau panneau » de `panel.html`. Il n'y a plus que Signal.
- Un ancien choix enregistré (« ancienne », « ariane2 », « palette ») ouvre Signal.
- `panel-ui5.css` ne garde que la base : cacher le panneau d'avant et placer `#ui5`.
- **Secours** : si Signal ne s'affiche pas, l'ancien panneau revient, avec la raison, jusqu'à la prochaine ouverture du panneau.
- **Mouvement** : il est repris par-dessus la revue de la test 22. Le temps ne déclenche toujours pas de réécriture (R6) ; quand il y en a une, elle est faite en place.
- **Corrigé au passage** : en Écho aussi, ESV perdu s'affiche (« ESV n'est pas connecté »).
- **Essais adaptés** :
  - `tests/t20a-connexion-sw.test.cjs` et `tests/t20a-panneau.test.cjs` vérifient maintenant le message de connexion et Reconnecter dans Signal ;
  - `tests/connexion-t21.test.cjs` vérifie qu'un ancien choix « ariane2 » ouvre Signal.

## CH-028 : l'onglet « Correction » (correction dans Orbite)

- **Quand** : dès qu'une liste de cuts à corriger existe. Le panneau la demande une fois par lot clos, ou par file finie, quand ni la relecture, ni la deuxième passe, ni la file ne tournent. L'écran de fin du lot affiche alors la ligne « À corriger » et le bouton « Corriger · N cuts ».
- **Quoi** : la liste vient de `src/correction-liste.js`, en deux groupes. « À corriger » regroupe les posés signalés, avec le signal le plus fort en clair ; « À poser » regroupe les différés restants. Le statut de chaque cut est lu dans les visites de la séance Écho marquée : à faire, ouvert dans ESV, corrigé (1 ou 2 rails), validé tel quel, vu sans validation.
- **Gestes** : chaque bouton clique un déclencheur caché du panneau (`#correction-liste`, `-demarrer`, `-ouvrir` avec `#correction-cible`, `-terminer`, `-fermer`). « Télécharger la séance Écho » clique `#native-download`. Aucun message nouveau ne part de `ui5.js`.
- **Barre à quatre onglets** :
  - en compact (moins de 480 px), le logo s'efface et la puce garde sa pastille ;
  - entre 480 et 560 px, le nom « Ariane » s'efface.
- **Essais** : `tests/ui5-correction.test.cjs`, `tests/ui5-navigateur-signal-correction.test.cjs`, `tests/esv-maquette/correction-signal.test.cjs`.

## CH-036 : Constellation et Aurore

- **Noms** (D-274, décisions de l'opérateur du 01/11) : l'onglet de la file de parties s'appelle « Constellation », celui de la correction « Aurore ». Les libellés que l'opérateur lit changent ; les identifiants (`file*`, `correction*`, `sg:onglet-file`, `sg:onglet-correction`, `#file-*`, `#correction-*`), les messages, l'export et le journal ne changent pas. Les textes écrits par `panel.js` (carte d'origine) sont traduits dans `src/signal-rendu.js` (`vf`) : rattrapage (deuxième passe), à poser (différés), passage (changement de partie), sautés (skipped).
- **Dessin** : Figma, fichier Signal, page « CH-036 · Constellation et Aurore » (48 fenêtres, 600 et 360, sombre et clair).
- **Constellation** : les étoiles, une par partie (à venir, en cours, faite, interrompue, alerte), reliées par le fil ; sous l'étoile en cours, ses quatre temps (Pose, Rattrapage, Relecture, Passage). Une action pleine : Lancer, Reprendre à la partie N, ou, à la fin, « Ouvrir l'Aurore · N cuts ». Puis, visibles d'emblée : le bilan par partie (chiffres, puis une ligne de motifs en clair) et les départs des parties. Le bilan structuré vient de la vue `fileParties.bilan` (`src/ui5.js`, `parties`).
- **Aurore** : l'horizon (revus sur total, une portion par partie), la liste groupée par partie puis « à corriger » / « à poser » ; le cut ouvert est la seule ligne vivante ; « Suivant · cut N ». Terminée : le bilan par partie, l'export en action pleine.
- **Traversée des parties (CH-035, fusionné)** : Signal lit `snap.correction.entreParties` (booléen), `snap.correction.passage` { etat: 'en-cours' | 'refuse' | null, vers, texte }, dérivé par `src/ui5.js`, et le parcours (`parcours.suivant`, `parcours.parties`) pour le suivant et l'état de chaque partie. Une partie revue reste dépliée (retour en arrière possible). Allumée : « Ouvrir » sert aussi pour une autre partie, « Passer à la partie N · cut M » ; passage en cours : écran verrouillé. Absente ou éteinte : l'écran de la 4.9.5.29 (« Ouvre la partie N dans ESV »).
- **Orbite** : en fin de lot, la ligne « Aurore » et « Ouvrir l'Aurore · N cuts » en action pleine (« Voir ce qui reste » en second). Bandeau et boîte : « Constellation ».
- **Barre compacte** (< 480 px) : la bascule a son propre rang sous la barre, pleine largeur, les quatre libellés gardés.
- **Essais** : `tests/ui5-constellation-aurore.test.cjs` (vm), `tests/ui5-navigateur-signal-constellation-aurore.test.cjs` (navigateur, 360 à 600 par pas de 40, sombre et clair).
- **Orbite dans les mots de l'opérateur** (même chantier) : Rattrapage (deuxième passe), à poser (différés), sautés (skipped, ignorés au départ), dans les libellés visibles seulement. Essai : `tests/signal-vocabulaire-orbite.test.cjs`.
- **Direction B « Cadran »** (choisie par l'opérateur le 02/11) : en-tête avec l'anneau segmenté (`anneauHtml`, un arc par partie), le mot, la phrase et les actions en pilules ; rubriques filées ; registre des parties ; temps numérotés ; Aurore sans troncature, trois chiffres à la fin. Puce de l'onglet ESV réduite à sa pastille entre 480 et 559 px avec quatre onglets (décision de l'intégrateur).

## CH-104 : le panneau en « Graphite » (D-333)

- **Référence** : la maquette validée par l'opérateur, `maquettes/bento/panneau-graphite.html` (« Nickel tu peux construire »). Le dessin de Signal décrit plus haut (logo, rail gradué, glyphes, cadran, bande du cache) est remplacé ; les modèles (états, boutons, libellés, `data-act`) ne changent pas, et aucun message nouveau ne part vers le service worker.
- **L'écran** : la barre (onglets à pouce glissant, puce « ESV » avec sa pastille, menu « ··· ») ; la tuile d'état, qui reste en place (pastille et mot, partie, anneau, phrase, bornes du lot, trois compteurs) ; la zone, qui change avec l'état (fil des cuts et étapes du lot, avis, verrou, écran de fin, bornes du prochain lot) ; la ligne « à poser », qui ouvre « Ce qui reste » en feuille ; les actions en pied.
- **Teinte** (`.sg-fen[data-teinte]`) : `marche` (violet, Ariane travaille), `repos` (gris), `toi` (orange), `panne` (rouge), `fait` (vert).
- **Menu « ··· »** : Commandes (Ctrl K), Réglages, Cache des exports (« Vider le cache » et sa raison).
- **Pourcentage** : seulement quand un total est réellement connu : cuts ciblés du lot (fiche de départ, `ar.cibles`), cuts décidés du rattrapage, cuts à relire de la relecture. Sinon l'anneau porte le nombre de cuts traités et tourne tant qu'Ariane travaille ; lot terminé sans total : anneau plein et coche.
- **Fil des cuts** (`sig.fil`, `src/ui5.js`) : les derniers cuts terminés, leur durée (`batch.processed[].durationMs`), leur statut. Le rail n'est dit que pour un cut à poser (`batch.deferred[].unresolvedRails`) : le lot ne garde pas cette donnée pour un cut posé.
- **Étapes du lot** (`ar.etapes`, `relChiffres`) : pose, rattrapage, relecture. Une étape à venir n'est annoncée que si le lot la prévoit (choix du lot, mode effectif du rattrapage).
- **Constellation et Aurore** : même tuile d'état, anneau à un arc par partie ; registre des parties et départs en tuiles ; les boutons en pied.
- **Thème clair** : mêmes variables, palette claire (`#ui5[data-theme="clair"]`) ; non vu par l'opérateur à la livraison.
- **Panneau d'origine** (`panel.css`) : mêmes jetons, même police ; sombre par défaut, clair avec `data-theme=light`. On le voit dans les détails techniques et en secours.
- **Police** : Inter (`fonts/Inter-latin-wght.woff2`, licence `fonts/OFL-Inter.txt`). Les polices IBM Plex, Hanken Grotesk et JetBrains Mono ne sont plus appelées par le panneau.
- **Mouvement** : déplacements et opacités seulement. La zone sort et entre quand l'état change (`data-z`), les chiffres roulent (`.sg-tic`), le pouce glisse. Deux boucles : la pastille qui bat (quand Ariane travaille, « à toi » et en panne ; jamais au repos) et l'anneau ou l'étape qui tourne (seulement quand Ariane travaille). « Réduire les animations » coupe tout.
- **Outils** : `chantiers/CH-104/outils/capturer.cjs` (le vrai panneau dans les treize états, les autres écrans, deux tailles, deux thèmes, mesures de débordement, de troncature et de contraste), `capturer-maquette.cjs`, `page-comparaison.py`. Les images restent hors du dépôt.

## CH-108 : « Épure, un caractère par panneau » (D-339)

- **Référence** : `maquettes/caractere/direction-d.css`, écrite comme une feuille posée sur Graphite ; elle est fondue dans `panel-signal.css` (jetons en tête, règles réécrites à leur place) et la feuille de référence n'est pas chargée par le panneau. Les modèles, libellés, actions et messages ne changent pas.
- **Système** : une seule surface (plus de tuiles : des sections séparées par un trait fin, texte à 2 px du bord) ; la tête de l'écran sans trait, arrondie, porteuse du motif ; grands chiffres fins (graisse 250 à 300) ; peu de gras (540 au plus pour un chiffre ou un mot appuyé) ; étiquettes en petites capitales espacées ; barre d'onglets en mots avec un fil de la couleur du panneau sous l'onglet ouvert ; boutons, molette, choix et sélecteurs en pilule ; couches flottantes (menu, palette, boîte, note de barre) sur le seul fond levé `--flottant`.
- **Identité par panneau** (`.sg-fen[data-activite]`) : Orbite violet `#8F93FF`, une orbite autour de l'anneau et un halo bas ; Écho turquoise `#4FD6CF`, l'onde (deux cercles, le second s'éloigne en boucle seulement quand la collecte tourne, `data-teinte="marche"`) ; Constellation bleu ciel `#62C6F2`, des étoiles fixes (la lueur seule en clair) ; Aurore rose `#F28CC6`, une bande d'aube en haut de la tête. Les couleurs d'état (orange, rouge, vert) ne changent pas ; le motif suit la teinte de l'état.
- **Thème clair** : mêmes jetons (fond `#F5F6F8`, traits plus légers, couleurs de panneau assombries : `#0B8783`, `#0B79AD`, `#BF3E86`, violet `#5357DB`).
- **Panneau d'origine** (`panel.css`) : mêmes jetons de fond et de trait, même police ; cartes changées en sections, boutons en pilules, vues en mots soulignés, étiquettes en petites capitales ; la tuile du lot (remplissage) reste.
- **Police** : Inter à taille optique (`fonts/Inter-latin-opsz-wght.woff2`, licence `fonts/OFL-Inter.txt`) ; l'ancien fichier `Inter-latin-wght.woff2` est retiré.
- **Outils** : `chantiers/CH-104/outils/capturer.cjs` prend `FEUILLE_EN_PLUS` (photographier « tronc + feuille ») et `STYLES=1` (relevé des styles calculés) ; `chantiers/CH-108/outils/ecarts-styles.cjs` compare deux relevés propriété par propriété.
