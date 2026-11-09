# CH-084 — Rapport : attentes observées (D-313, D-315)

**Livré** (branche `chantier/CH-084`) : `chantiers/CH-084/adapter-page.patch`, un seul patch pour `src/adapter-page.js` (fichier gelé, appliqué par l'intégrateur), et les réglages dans `src/settings.js`, allumés pour le lot d'essai de Vision 8 ; `actif:false` ou `imagesMin:3` rendent le comportement d'avant au bit près (prouvé).
- **Capture (D-315)** : `pilote.repliCourt` {actif, 600 ms}, repli à 600 ms seulement si aucun nœud n'a bougé depuis le début de l'attente (sinon 800 ms) ; `pilote.imagesMin` 2, minimum d'images de la règle « signal » (compteur à zéro et deux images identiques inchangés).
- **Validation sur place (D-313)** : `validationSurPlace` {actif, 300 ms, 3 images}. La fenêtre de Maj+Espace (1 500 ms fixes) se ferme dès que l'écriture « valid » + TreatedByOperator de CE cut, envoyée après la frappe, est vue par l'observateur passif, puis le libellé inchangé 300 ms et 3 images ; sinon 1 500 ms, même résultat qu'aujourd'hui. Relecture « corriger » seulement : le lot ne l'appelle pas.
- Non livrés : écritures du service worker en parallèle (chantier dédié après Vision 8) ; `gcv1-shadow-observed` sans sauvegarde (≈ 10 ms par cut, reprise après F5 non prouvée).

**Preuves** (ÉTABLI) :
- Rouge d'abord : `tests/ch084-validation-sur-place.test.cjs` 5 rouges sur le tronc, puis 9/9 ; `tests/ch084-attentes-capture.test.cjs` 3 rouges, puis 7/7.
- Navigation tardive d'ESV à 400 ms : rendue telle quelle. À 800 et 1 400 ms : le service worker la voit au libellé et arrête la passe (pause motivée), ou l'étape suivante revérifie l'identité ; une pose, une validation, aucune visite du cut où ESV s'est égaré.
- Vue qui bouge encore : jamais de sortie à 600 ms, au moins 800 ms après le dernier changement, mêmes points qu'éteint ; vues stables : mêmes points, capture plus courte.
- Garde `tests/pose-lot-inchanges-4959` : blocs déclarés (`sansCH084`, `sansCH084v`, clés vérifiées à part), 6/6. Parité de la relecture : identique. Aucun module de décision touché.
- Verify complet (patch appliqué, tronc 7e4e697 fusionné) : 3 338 essais, 3 331 verts, 0 rouge, 7 sautés. Maquette complète : 78/81 et 7/7, 0 rouge, 3 sautés.
- Banc maquette (`tools/banc-esv.cjs --cuts 10`, 15 lots allumés et 15 éteints, alternés) : commandes du lot, écritures au serveur et poses (au nm) identiques dans les 30 lots. Lot médian 23,83 s contre 24,99 s (−1,16 s, −4,6 %) ; cut médian 3 015 contre 3 070 ms, P90 3 182 contre 3 725 ms. Le seul écart relevé est hors du lot : le `goToCut` de la relecture qui suit, absent de 6 relevés allumés parce que le banc fige le journal avant qu'elle démarre (125 à 215 ms après la fin du lot).

**Gain attendu sur ESV** : Maj+Espace, l'écriture « valid » finit 342 / 447 ms (médianes V6 / V5) après la demande, d'où ≈ 0,7 à 0,8 s par validation sur place, 31 s par relecture V6 et 76 s V5 (PROBABLE). Capture : 2 à 4 s par lot pour le repli (PROBABLE), ≈ 10 s pour les images (SUPPOSÉ ; −4,6 % du lot en maquette, où les images sont simulées).
