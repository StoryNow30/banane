# CH-115 : rapport (agent) — direction B intégrée pour la Vision 18

Décisions : D-349 (passe de design), D-350 (direction B), D-353 (épure de la Constellation), D-354 (Glacier et Sarcelle validés, bascule sans recharger). Base : `integration/vision18-n-aj5` (2b1aafd) fusionnée dans `chantier/CH-115`, sans réécriture.

## Ce qui change (ÉTABLI : vrai panneau dans Chromium, API simulée)
- **Épure** : par défaut, la tuile d'état (mot, anneau, phrase en une ligne), la trace des huit derniers cuts en points sans texte, la ligne « à poser » et les actions. Le fil en texte, les étapes, les compteurs, les bornes et le bilan de fin s'ouvrent par le bouton « Détails » de la tuile. Constellation : la frise, l'état et le rang ; les temps, le bilan par partie et les départs d'ESV derrière « Bilan et départs ». Une alerte qui demande un geste passe devant la trace. Rien n'est retiré du panneau d'origine, du journal ni des exports.
- **Palettes** (thème sombre, fond Moyen) : Glacier par défaut, Sarcelle ; réglage « Palette » dans Réglages, sans rechargement, gardé dans `chrome.storage.local` (`banane51Palette`). Le thème clair reste celui de B.
- **Mouvement** : ressorts (`linear()`), sortie de l'ancienne tuile d'état puis entrée de la nouvelle morceau par morceau, glissement de page au changement d'onglet, chiffres qui roulent (copie de l'ancien posée hors du panneau dessiné), anneau qui se remplit avec élan (0,8 s). Seules transform et opacity sont animées, sauf l'arc de l'anneau (exception déjà écrite en CH-104) ; « réduire les animations » coupe tout.
- **Vision 18** : la case d'essai « Ajuster la hauteur des poses sur le dessus du rail » est aussi dans les réglages du panneau (ligne « À l'essai : hauteur des poses », Coupé ou Allumé) ; elle clique la case d'origine `#ajustement-hauteur`, qui seule parle au service worker.
- Aucun message nouveau vers le service worker, aucun bouton ni ordre retiré.

## Fichiers
- `panel-signal.css` : une section ajoutée en fin de feuille (source : `chantiers/CH-115/directions/`).
- `src/signal-rendu.js` : bouton des détails (Orbite, Écho, Constellation), lignes Palette et ajustement dans Réglages.
- `src/ui5.js` : `ui.details`, `ui.palette` (lu et gardé), `data-palette` et `data-details` sur `#ui5`, choix `palette` et `ajustement`, sortie de la tuile, glissement d'onglet, chiffre qui roule.
- Essais : `tests/ch115-palette-epure-navigateur.test.cjs` (nouveau) ; `tests/ch104-mouvement-navigateur.test.cjs` (ouvre « Détails » avant de lire les étapes, repliées par défaut).
- Aucun fichier protégé. Aucun nouveau fichier à mettre au paquet.

## Preuves (ÉTABLI)
- Essais du panneau : 74 fichiers, 268 réussis sur 268 (série de référence avant changement : 268 sur 268), dont `vision18-ajustement-essai`.
- `ch115-palette-epure-navigateur` : 4 rouges sur la base Vision 18, 5 verts après.
- `capturer.cjs` : 140 photos, deux tailles et deux thèmes, aucun débordement, aucune troncature, aucun contraste sous 4,5:1.
- Lot en cours d'emblée (600 × 760, `compter.cjs`) : 15 blocs, 21 mots, 4 nombres (Vision 15 : 60, 105, 26). « Vers la partie N » : 17, 33, 8 (57, 112, 40).
- Maquette ESV : voir le message de fin.

## Non vérifié
- Le vrai panneau dans Chrome à côté d'ESV ; les images par seconde ; le verify complet (intégrateur).
