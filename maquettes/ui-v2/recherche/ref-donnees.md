# Référence : composants de données — beui.dev, swiftpieces « Data and charts », v0 « Dashboards », skill dataviz — famille « info- »

## Ouvert exactement
### beui.dev (Chromium, statut 200) — ÉTABLI
- Charts : **Line Chart**, **Bar Chart**, **Sparkline**, **Sankey Chart**, **Status Bar**, Composition Chart, Heat Calendar (texte + captures).
- Components > Motion : **Timeline**, **Number Animation** (Digit Swap), **Animated Alert**, Action Swap.
- Docs : **Motion Guides** (« Motion that explains, not distracts »), lu en entier.

### swiftpieces (dépôt cloné /home/user/saivion/swiftpieces, lecture seule) — ÉTABLI
- Catégorie « Data and charts » trouvée dans `lib/hubs.ts` (slug `data`) et `registry/summaries.ts`.
- Lu : `registry/swift/data/Odometer.mdx` + le début de `Odometer.swift` (≈ 200 lignes : rouleaux par chiffre, retenue, ressort sans rebond, puce de différence), `LiveStat.mdx` + commentaires de `LiveStat.swift`, `ScrubChart.mdx`, `ActivityHeatmap.mdx` + commentaires de `ActivityHeatmap.swift`, `RangeLens.mdx`, `RingBreakdown.mdx`.

### v0.app/templates « Dashboards » — PROBABLE (vu en liste)
- La liste (miniatures) et 14 pages de gabarits ouvertes (titres : Pulse — Engineering Metrics & Incident Response Console, Financial Dashboard, SalesOps, Dashboard design requirements, Futuristic Dashboard, Tasko…). **L'aperçu intégré de chaque gabarit est resté vide**, même après 20 s d'attente (cadre gris) : je n'ai vu que les miniatures de la liste. Pas de contournement.

### Skill locale dataviz — ÉTABLI (SKILL.md, choosing-a-form, marks-and-anatomy, anti-patterns).

## Ce que j'y ai lu, et ce que j'en retiens
- **beui Sparkline** : tuile = libellé, valeur, puce de variation signée (+33,6 %), petite courbe avec point final. Je garde : le point final marque « maintenant » ; je refuse la puce colorée seule (le signe porte le sens, la couleur est en plus).
- **beui Status Bar** : 48 barres journalières vertes/orange/rouges + légende. Leçon négative : la distinction n'y est que par la teinte (1.4.1) — dans ma version, une forme ou une hauteur différente porte l'état.
- **beui Timeline** : événements datés sur un axe, un seul ouvert à la fois. Je garde l'idée d'un axe de temps du lot avec ses événements (différés, alerte) — dans info-allure.
- **beui Motion Guides** : quatre questions (fréquence, but nommé, physique, repli réduit) ; ease-out (0.16, 1, 0.3, 1) pour entrer, ease-in-out (0.77, 0, 0.175, 1) pour déplacer, **linéaire pour la progression** ; < 300 ms par défaut ; « pour un petit changement de vue, l'ancien contenu part plus vite que le nouveau n'arrive, quelques pixels de course » ; « mouvement réduit = état dessiné : garder opacité et couleur, retirer course, échelle, rebond ». C'est ma grammaire de mouvement.
- **swiftpieces Odometer** : chaque chiffre roule dans sa fente, **seuls les chiffres qui changent bougent**, ressort sans rebond pour ne jamais montrer une valeur que le nombre n'a pas eue, durée croissant avec l'écart (≤ 1,2 s), en mouvement réduit le chiffre change en place. Je le reprends comme principe (sans son code) pour le compteur de cuts.
- **swiftpieces LiveStat / ScrubChart** : pas d'axe Y, une ligne de base pointillée à la première valeur, repères min/max, point final ; chiffres « semibold », la taille seule fait la hiérarchie. Je garde : pas d'axe Y, une référence unique.
- **swiftpieces ActivityHeatmap** : niveaux = mélanges opaques de l'accent dans le fond, jamais de transparence ; en mouvement réduit, une case changée est marquée par un fin anneau intérieur au lieu d'un saut. Je garde : un changement se signale par un trait, pas par un saut, en mouvement réduit.
- **v0 Dashboards (miniatures)** : rangée de tuiles KPI + graphique principal + liste latérale. C'est le modèle que je refuse pour 360 px (la grille craft.md : « petits écrans : listes plutôt que graphiques complexes »).
- **dataviz** : un seul nombre → tuile, pas de graphique ; série unique → pas de légende ; texte en encre de texte, jamais en couleur de série ; couleurs d'état réservées, toujours avec mot ou forme ; pas de double axe ; `tabular-nums` seulement en colonne.

## Ce que j'écarte
- Sankey, treemap, donut : pas de flux ni de composition à plus de trois parts dans ce produit (posés / différés / à examiner se lisent mieux en trois chiffres).
- Le verre (« liquid glass ») de swiftpieces : décor sans sens ici, et fond non mesurable par le vérificateur.

## Erreurs d'accès
- v0 : aperçus vides après 20 s (noté). Aucun défi ni refus.
