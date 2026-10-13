# Orbite : quatre variantes de l’UX Porsche (13 octobre 2026)

Commande : `../BRIEF.md`, précisée par Mic le même jour : **toute la vue
Orbite** (pas seulement le bas), et **quatre variantes de l’UX de
l’application Porsche** (captures dans `design/references/ux-2026-10/`). Aucun
logo ni marque repris.

Mêmes données fictives partout (`commun.js`) : lot 8410 → 8640 en cours, cut
8455, partie 34. Chaque maquette s’ouvre avec `?theme=sombre` ou
`?theme=clair` ; PNG 480 px ×2 dans les deux thèmes.

- `planche-comparative.png` : l’actuel et les quatre, en sombre.
- `0-actuel-*.png` : la vue actuelle, reconstituée à partir de `panel.html` et
  `panel.css` du dépôt (la ligne est dessinée par le code de `panel.js`).
- Régénérer : `node rendre.cjs` et `node reconstituer-actuel.cjs`.

## Ce que les quatre reprennent de Porsche

Fond à dégradé vert très profond ; tuiles arrondies translucides, une idée par
tuile ; gros chiffres, petite unité atténuée ; **un seul vert vif**, pour le
progrès (la jauge du lot, l’effet observé) ; libellés de section en capitales
fines ; lignes d’action icône + libellé + chevron ; un objet héros ; presque
pas de texte. Socle commun : `porsche.css`.

## Ce qui est corrigé partout

- Une seule barre de progression (l’actuel en empile six), plus de répétitions
  (partie et plage écrites trois fois).
- Les exports deviennent des lignes lisibles, « Tout télécharger » en tête.
- La politique effective est lisible : « Rail non résolu → continuer et
  différer », « Faible confiance → mettre en pause » (aujourd’hui deux lignes
  « Politique effective de ce lot » avec deux valeurs contraires).
- Invariants de D-045 tenus : politique toujours affichée ; « Différés : N » en
  ambre ; la commande en trois étapes, seul l’effet observé est vert, le
  serveur reste « non disponible ». Une navigation incertaine prendrait la
  place de l’état dans le héros, en rouge, avec son cut.

## Les variantes

| | Écran Porsche | Pour | Contre |
|---|---|---|---|
| **A · Accueil** | L’accueil : « Orbite ⌄ » en grand (le menu bascule vers Écho), bouton « Détails du lot », le cut sur un halo vert avec sa ligne, deux tuiles-icônes Pause / Arrêter, la tuile « batterie » (le lot), la tuile à interrupteur (bandeau dans ESV + écart à la voie) | Tout sur une page ; très proche de l’accueil Porsche | La plus longue ; beaucoup de tuiles |
| **B · Recharge** | La recharge : titre centré, « Orbite pose le cut **8455** », la grande jauge verticale entre « 20 % » et « 45 cuts », tuile processus, puis des lignes à chevron qui ouvrent une page (Activité, La ligne, Partie, Exports, ESV) | Le plus Porsche : un héros, très peu de texte ; le détail est à un toucher | Activité et ligne ne sont plus visibles d’emblée |
| **C · Grille** | Les tuiles en damier : la tuile héros remplie de vert, puis posés, différés, couverture, écart médian, partie, dernière activité | Tout se lit d’un coup d’œil, chiffre par chiffre | Plus « tableau de bord » ; longue aussi |
| **D · Onglets** | La navigation : un écran Lot qui tient sans défiler, barre d’onglets en pied (Lot, Ligne, Exports, Plus) ; `D-onglets-exports-*.png` montre l’écran Exports | Le plus court, le plus calme | Un composant nouveau ; la ligne passe dans un onglet |

## Recommandation

**B · Recharge.** C’est la transposition la plus fidèle de ce qui plaît dans
Porsche : un objet héros (la jauge du lot), deux chiffres, une commande pleine,
et le reste rangé derrière des chevrons. Les `id=` du panneau s’y logent sans
perte (les pages à chevron sont des tiroirs). Si tu veux tout voir sans
toucher : **A**.
