# Ariane : quatre pistes de logo (15 octobre 2026)

Demande de Mic : « Il nous faut un logo ». Les pistes reprennent le langage du panneau 4.9 : tuile arrondie, vert profond, traits blancs, un seul vert vif.
`logos.html` : la planche (SVG, sans police externe pour les icônes). `planche-logos.png` : son rendu (`node rendre.cjs`).

| | Piste | Idée |
|---|---|---|
| A | La voie | Deux rails qui fuient vers l’horizon forment un A ; les traverses sont sa barre ; le point vert est le cut posé. |
| B | L’orbite | Un A dont la barre est une orbite verte inclinée, qui passe derrière puis devant. |
| C | Le fil | Le fil d’Ariane : un seul trait qui sort du labyrinthe et s’arrête sur un point vert. |
| D | La tuile du lot | La tuile du panneau en miniature : un A blanc sur un vert qui se remplit. |

Chaque piste est montrée en grand, aux tailles de l’extension (128, 48, 32, 16 px) en sombre et en clair, et avec le nom ARIANE.
Rien n’est intégré : l’extension n’a pas encore d’icône (`manifest.json` sans `icons`). Après le choix de Mic, il faudra produire les PNG 16, 32, 48 et 128 et les déclarer dans le manifeste.

## Choix de Mic : A « La voie » (15 octobre)

- `icons/ariane.svg` : le logo, en source.
- `icons/ariane-16.png`, `-32`, `-48`, `-128` : les icônes de l’extension, rendues par Chromium à la taille exacte, fond transparent (`node design/logo-2026-10/rendre-icones.cjs`).
- Pas encore déclarées dans `manifest.json` : une icône change ce que Mic voit, donc elle doit arriver avec un nouveau numéro de version de test, que la session de pilotage prépare.
- Pour la brancher, ajouter au manifeste `"icons": {"16": "icons/ariane-16.png", "32": "icons/ariane-32.png", "48": "icons/ariane-48.png", "128": "icons/ariane-128.png"}`, et la même liste sous `action.default_icon`.

`comparer.html` et `comparer-A-B.png` : A, B et un hybride en situation (barre du navigateur, page des extensions, tête du panneau, bouton sur la page ESV).
