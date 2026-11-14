# Maquette instr-gelee (« Gelée »)

**Logique en une phrase.** Le lot est une seule masse de gelée qui s'allonge dans sa fente à chaque cut posé ; ce qu'Ariane n'a pas pu poser se détache en gouttes qui tombent dans un bac, et le bac est ce qui reste à reprendre.

## Références et ce qui en est pris
- Scrubbers, `JellyFace.swift` (+ `JellySim`) : bande épinglée à gauche, longueur = valeur, chaîne de Verlet (ici 15 points, 4 sous-pas, 10 passes), longueur naturelle qui rattrape la poignée (0,3 s), gelée amincie quand on tire (volume conservé), arche quand on la comprime, lumière intérieure et reflet net. Réécrit en JS, sans copie.
- Scrubbers, `FluidFace.swift` et libraries.dev, liquid-gooey (`filter.tsx`) : flou + seuil alpha pour le col gluant ; silhouette dessous, texte net dessus. Démo Gooey jouée sur le site (menu « + » qui se scinde, curseur Move et sa traîne) : la bascule Orbite/Écho coule comme une goutte avec traîne.
- Scrubbers, `ElasticFace.swift` : bout de fente qu'on tire en PRÊT ; `EffortFace.swift` : touches qui s'écrasent et rebondissent.

## Sens des signes
- Longueur de gelée = cuts traités sur la longueur du lot ; fente = bornes ; fente ouverte en pointillés + « total inconnu » = total inconnu.
- Gelée brillante qui frémit = Ariane pose ; figée, mate (reflet éteint) = pause, arrêt ou fin.
- Goutte pleine = différé ; goutte creuse = posé, à examiner. Le bac entier est le bouton « Reprendre ».
- Bord de fente ambre + triangle + mot = Ariane attend votre geste.
- File : une pièce de gelée par partie ; les faites fusionnent en une masse (filtre gluant), la courante est à part, les suivantes sont des moules en pointillés.
- Couleur de la gelée (vert d'eau profond) = ce qu'Ariane a posé et l'action principale ; l'ambre est réservé à l'attente.
- Relecture : une lueur parcourt la gelée d'un bout à l'autre.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Arrivée d'un cut | le bout avance (suivi 0,11 s), la gelée s'amincit puis se rattrape (0,3 s), petite poussée qui la fait frémir | Verlet, amortissement 0,28 s | la masse grossit | longueur posée, droite |
| Nouveau différé / vert | une goutte se pince au bout (col gluant), tombe ; la goutte du bac atterrit en s'écrasant | gravité 900 px/s², atterrissage 0,55 s (1,2 → 0,75 → 1) | se détache, reste à reprendre | gouttes déjà dans le bac |
| Prêt → en cours | gelée remise à sa longueur minimale puis s'allonge | 0,3 s | mise en route | posée |
| → pause / arrêt / fin | reflet et cœur s'éteignent, corps à 72 % | 0,6 s | la gelée fige | direct |
| → arrêté / alerte | bord de fente ambre 2,5 px | immédiat + mot | à vous | idem |
| Relecture | lueur qui court le long de la gelée | 2,4 s en boucle, phase tenue entre rendus | relit | lueur absente, mot « Relecture » |
| Bascule Orbite/Écho | goutte qui coule avec traîne | ressort sous-amorti 0,5 s, amort. 0,55 | changement d'activité | direct |
| Touches | écrasement 1,03 × 0,92 au doigt | 0,1 s | réponse tactile | aucun |
| Liste | lignes « versées » (−10 px, 0,96 × 1,05 → 1) | 0,42 s, 35 ms de décalage, au changement de vue | le bac se vide en liste | aucun |
| Prêt : tirer le bout de fente | la gelée s'étire sous la main, cran de 10 au relâché | Verlet | allonger le lot | flèches clavier |

## Pourquoi sans filiation
Feuille blanche ; aucune interface ni autre maquette ouverte ; la matière gelée vient de Scrubbers et de Gooey, pas d'Ariane.

## Pourquoi ni voie ni nuage
Une bande de gelée dans une fente et des gouttes : ni rail, ni voie, ni points de relevé.

## Autocritique
- Au repos (pause, fin), la gelée ressemble à une barre de progression arrondie ; sa nature « gelée » ne se voit vraiment qu'en mouvement.
- Le bac avec 17 gouttes devient une rangée dense ; au-delà d'une trentaine il faudrait un compte seul.
- La couleur de la gelée est le seul aplat coloré du panneau : à valider avec l'opérateur (il porte un sens, « ce qu'Ariane a posé », mais c'est aussi une couleur de marque possible).

## Vérificateur
`instr-gelee : 7356 textes mesurés, contraste minimal 5.51:1, 0 écarts, 0 erreurs de console`. Jeu complet : 0 erreur ; geste sur le bout de fente : 379 → 459.
