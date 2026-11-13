# CH-122 : cible chiffrée (écrite et poussée avant le premier rejeu, D-222, D-352)

Écrite le 13/11 avant tout rejeu de cette session. Toute retouche après un jugement est un nouveau réglage, jugé à nouveau.

## Banc et référence
- Banc de CH-116 (`chantiers/CH-116/outils/banc.cjs`), corpus de 4 016 cuts, juge de CH-113 (pire rail, 3D ; juste ≤ 10 mm ; mauvaise voie > 50 mm).
- Référence = rejeu du code livré « livre » (rapport CH-116 § 2, ÉTABLI) : 561 posés jugés, 496 ≤ 10 mm, 36 de 10 à 50, 29 > 50 ; 591 différés ; 20 différés reposés justes, 1 faux ; 4 bons bloqués. Fautes (> 10 mm) : 65.
- Je refais ce rejeu dans ma session ; si mes chiffres livrés diffèrent, la référence devient la mienne, écrite au rapport avec l'écart.

## Évaluation (aucun lot jugé par un modèle qui l'a vu)
- Lots réglables : 0411, 0611, 0811a, 0811b, 1111, 1211. Validation croisée « un lot dehors » : pour chacun, le modèle (coefficients ET seuil de décision) est appris sur les 5 autres seulement, figé, puis le lot dehors est rejoué une fois avec ce modèle.
- Examen 0511 (D-285) : modèle appris sur les 6 lots réglables, jamais sur 0511.
- Chiffre publié = somme des 7 jugements hors apprentissage. Aucun chiffre « sur lots vus » n'est publié comme gain.

## Cible (une des deux, l'autre non dégradée)
- **A (moins de fautes à coût égal)** : différés ≤ 591 ; fautes > 10 mm 65 → ≤ 32 ET mauvaises voies > 50 mm 29 → ≤ 14.
- **B (plus de posés justes à fautes égales)** : fautes > 10 mm ≤ 65 et > 50 mm ≤ 29 ; posés ≤ 10 mm 496 → ≥ 521 (+ 5 %).
- Dans les deux cas : bons bloqués ≤ 4 + 2 ; aucune mauvaise voie nouvelle sur un lot où le livré n'en a pas (0411, 0511, 0811a).

## Gardes (après la cible, sur le réglage final figé)
- Garde de pose d'octobre (`node tools/garde-gcv2.cjs --rejouer`, 11 lots) : retour 0, aucun recul.
- Parité banc / service worker (`tools/parite-l1se-sw.cjs --passe`) sur au moins un lot réglable : identique.
- À l'éteint (clé `null`/`false`) : rejeu identique au livré, 4 016 cuts sur 4 016.

## Qualification
Tous ces lots sont « vus » au sens de D-347 : un gain, même hors apprentissage ici, reste PROBABLE jusqu'à un Écho neuf.
