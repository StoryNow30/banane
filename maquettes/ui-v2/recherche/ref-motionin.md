# Référence : motionin.design

Lu le 29/10 dans Chromium. Réponses 200, aucun défi. Fichiers : `scratchpad/mouv/rmo/`.

## Ce que j'ai ouvert exactement
- **Galerie d'accueil** (ÉTABLI) : 52 sections décrites ; j'ai extrait les 52 longues descriptions (94 000 caractères, `rmo/descriptions.txt`) et je les ai lues en entier.
- **Catégories** (PROBABLE, liens vus) : Portfolio, Hero, Interactive, Product Showcase, Immersive ; la page « Interactive » ouverte (13 600 caractères, mêmes descriptions filtrées).
- **Fiches détaillées jouées** (ÉTABLI, séquences d'images à 0,7 et 1,2 s d'intervalle) : Benchmark, Pixels, Membrane, Filament. La section vit dans la page ; le bouton « View code » existe mais le code est vendu (« Copy Prompt », « Get all from $9/mo »), donc non lu.

## Les descriptions les plus utiles et ce qu'elles disent de la chorégraphie (ÉTABLI)
- **Benchmark** : une colonne d'affirmations sous une « lentille de focus » : seule la ligne centrée est sombre et grande, les autres grises, la taille décroît avec la distance, **sans flou et à graisse constante** ; la liste avance d'une ligne à la fois sur un `expo.inOut`, marque un temps quand la ligne est alignée sur le chiffre, puis repart ; le chiffre se reconstruit en `scale + y` (`expo.out`, sans flou). Mouvement réduit : « holds each claim still while keeping manual stepping ». Séquence regardée : 25 → 2.4M → 150+.
- **Pixels** : **une seule ligne pleine largeur** monte et tout ce qu'elle franchit passe de l'offre A à l'offre B ; le titre et la description sont **coupés par la même ligne** (l'ancien garde la tranche au-dessus, le nouveau prend celle du dessous), la grille de fond reste parfaitement immobile.
- **Filament** : chaque fil est un ressort vers sa cible ; changer d'onglet = un seul morph continu, pas une coupe ; mouvement réduit = « composed still ».
- **Isle / Loupe** : longue leçon d'optique, à retenir surtout : **un seul élément saturé dans un cadre désaturé est un point focal ; deux, c'est une palette** ; tous les neutres sont teintés de la teinte du sujet ; animer une transformation plutôt qu'une position de fond ; redessiner moins souvent ce qui bouge lentement (« fifty-nine of every sixty redraws paint the same thing »).
- **Emulsion** : « an entrance nobody asked for is a toll charged before the section can even be looked at » ; un seul paragraphe à l'écran à la fois ; ce qui est déjà là n'a pas d'animation d'arrivée.
- **Amour** : toute la séquence est **une fonction pure d'un seul scalaire de temps** ; elle peut être rejouée, arrêtée, pilotée autrement ; en mouvement réduit elle **ouvre sur l'état final**.
- **Moments / Hardback / Riffle / Formation / Revolver** : une seule horloge `requestAnimationFrame` possède toutes les transformations, la bibliothèque d'interpolation ne joue que les « temps forts » ; les cartes gardent leur identité d'un état à l'autre (un objet traverse, il n'est pas remplacé).
- **Lens Bloom** : compteur en fraction relié au nom par un filet qui se dessine ; le deck avance verticalement, la carte passée tombe.
- **Iris** : en mouvement réduit, « slow, gentle crossfade that never flashes to black ».
- **Cutout** : la cascade « n'est pas une cascade, c'est la coupe » : le retard de chaque lettre a une cause visible (la lame passe). Un décalage doit être motivé.
- Presque toutes : thème clair/sombre, pause hors écran et onglet caché, `prefers-reduced-motion` traité comme un état composé (image fixe finale).

## Ce que j'en retiens pour Ariane
1. Une **ligne de focus** qui avance d'un cran par cut, avec un temps d'arrêt : le rythme même dit « ça tourne » (Benchmark).
2. Une **ligne de partage** qui balaie le panneau quand l'état change : au-dessus l'ancien état, en dessous le nouveau (Pixels). Transition d'état lisible, sans fondu générique.
3. **Un seul élément de couleur à la fois** ; tout le reste neutre (Loupe).
4. Pas d'entrée décorative ; l'animation n'arrive que quand quelque chose change (Emulsion).
5. Une horloge locale unique et des états qui sont des fonctions de `t` : c'est la seule façon de survivre au rendu toutes les 0,9 s du moteur (Amour, Moments).
6. Mouvement réduit = état final composé, lisible, avec le même texte (Amour, Benchmark, Iris).

## Ce que j'écarte
- Le 3D, le verre liquide, la réfraction, les murs de photos : ce sont des sections de vitrine plein écran ; dans un panneau de 360 px surveillé de loin, ils coûtent la lisibilité.
- Le défilement capturé (scroll-jacking) : le panneau doit défiler normalement.
- Les grains, aberrations chromatiques, lueurs : décor.

## Limites d'accès (exactes)
- Code des sections : non public (« Copy Prompt », « Get all from $9/mo », « Free in Modulify » sur une partie). Je n'ai lu que les descriptions et regardé les sections jouer.
