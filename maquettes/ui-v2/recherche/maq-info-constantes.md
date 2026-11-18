# Maquette info-constantes — « Constantes »

Fichier : maquettes/ui-v2/sources/info-constantes.html. Police : Atkinson Hyperlegible Next + Atkinson Hyperlegible Mono.

## Logique en une phrase
Le lot se lit comme un moniteur de constantes : une colonne de cinq chiffres alignés, lisibles de loin, chacun avec une case de score (vide = normal, 1 = à regarder, 3 = à agir) à la manière d'un score d'alerte précoce.

## Notes de départ
But : lire « où en est le lot » à trois mètres sans confondre un chiffre. Ligne d'arrivée : 0 écart / 0 erreur ; aucun chiffre ambigu ; commandes toujours à la même place.

## Références et ce qui en est pris
- Scores d'alerte précoce (santé) : un score par constante, 0 = normal, seulement les constantes utiles (« les autres diluent »). Les scores 1 et 3 reprennent l'échelle de ces tableaux.
- Atkinson Hyperlegible (Braille Institute) : formes de chiffres non ambiguës ; version Mono pour la colonne (zéro barré visible sur les captures).
- swiftpieces Odometer (Odometer.mdx, Odometer.swift) : un chiffre par fente, seuls les chiffres qui changent bougent, pas de rebond, en réduit le chiffre change sur place.
- beui Number Animation (Digit Swap) et Motion Guides.
- Laws of UX : mémoire de travail (≤ 5 constantes), Fitts (commandes larges, fixes en bas), proximité.
- Radix slate / amber / red / indigo.

## Sens des signes
- Case vide (pas dessinée) : normal. Case ambre « 1 » : à regarder. Case rouge « 3 » : à agir. Le chiffre dans la case suffit sans couleur ; la couleur ne touche jamais une valeur.
- Le score 3 se pose sur la cause (encadré), jamais sur une constante innocente.
- « inconnu » en mots quand le total est inconnu : aucun chiffre deviné.
- Indigo = action principale uniquement.

## Pourquoi sans filiation
Aucune interface d'Ariane consultée ; la grammaire vient du moniteur de constantes et des tableaux de score.

## Pourquoi elle n'illustre ni une voie ni un nuage
Elle ne dessine rien d'autre que des chiffres, des cases de score et une table : aucune image de voie ni de points (la coupe n'apparaît que dans la vue « Examiner », comme outil).

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Une constante change (traités, cut, reste) | seulement les chiffres qui changent, montant de 70 % dans leur fente | 260 ms, (0.16, 1, 0.3, 1), sans rebond | « ce chiffre-là a changé » ; les autres restent immobiles | chiffre remplacé sur place |
| Une case prend un score | deux pulsations de bordure | 1 200 ms, ease-in-out | une constante sort de la normale | pas de pulsation |
| Changement d'état | colonne et titre entrent | 220 ms | la lecture a changé de nature | sur place |
| Message | encadré entre | 200 ms | retour d'action | sur place |
Mesuré en cours de lot : `roule` 89 échantillons sur 7,5 s (un ou deux chiffres par seconde), `entree` 16 ; réduit : aucune.

## Journal des tours
- r0 : quatre-vingt-seize écarts (case de score mesurée contre elle-même) → case redessinée en contour SVG porteur du sens.
- r1 : cases vides = cases à cocher (pire) ; score 3 sur le mauvais objet ; phrase redondante en cours ; « Cuts 240 cuts ».
- r2 : « 112 sur ? » ambigu → « total inconnu » ; doublon de la case 3 en haut.
- r3 : texte d'accessibilité dans l'encadré rouge à 2,39:1 → couleurs propres à la case.
- r4 : case « 1 » répétée sur chaque ligne de « Ce qui reste » et mot « Différé » sous le titre « Différés » → retirés.

## Ce qui pourrait encore faire « vibe codé »
- Le bleu indigo du bouton principal est conventionnel ; une encre noire serait plus « instrument ».
- La colonne vide des scores (30 px) au repos peut sembler un retrait injustifié tant qu'on ne connaît pas la règle.

## Chiffres du vérificateur
info-constantes : 8 094 textes mesurés, contraste minimal 5,21:1, **0 écart, 0 erreur de console**.
