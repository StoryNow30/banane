# Maquette matiere-spectre

**Logique (une phrase).** Le lot est une lumière qu'Ariane décompose : chaque cut traité élargit le spectre, chaque différé y laisse une raie sombre à sa place.

**Ni voie ni nuage.** Le dessin est un banc d'optique (fente, prisme, écran) ; aucune voie, aucun rail, aucun point du relevé (la coupe n'apparaît que dans « Examiner un cut », comme contenu).

## Références et ce qui en est pris
- heydamir.design, « One light, every color » : rayon blanc → bloc de verre → spectre ; « Split the light » (la source s'éteint et se rallume) ; lecture de longueur d'onde au survol devenue l'étiquette « cut 252 » ; légendes numérotées « 01 · Source », « 03 · … ».
- backgrounds.supply, Gradient Lab, mode Prism (position, largeur, intensité) : un seul réglage branché sur une donnée, la largeur = part traitée.
- inspora.design (vu en grille) : cartes dont la lumière intérieure est l'avancement, chiffre écrit à côté.
- Physique : les raies d'absorption.

## Sens des signes
Source allumée = Ariane pose. Volet sur la fente + spectre pâli = pause ou arrêt (rien n'est perdu). Fente absente (pointillé) = ESV non relié. Position = cut entre les bornes (violet = début, rouge = fin, numéros écrits aux bouts). Raie sombre pleine hauteur = différé ; encoche en haut = vert à examiner (légende avec compte). Lumière qui entre par la droite + bande accord/écart = Écho. Trait qui revient de droite à gauche = relecture. Bornes en pointillé = prêt ; bout ouvert = fin de partie / total inconnu (jamais deviné : échelle fixe de 240 cuts, « fin inconnue » écrit).

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Nouveau cut | front du spectre et éventail | 0,6 s, approche exponentielle (sortie douce) | Ariane avance d'un cut | saut direct à la valeur |
| Source allumée | intensité du rayon ±4 % | boucle 4 s, sinus | la source vit tant que le lot tourne | rayon fixe |
| Nouveau différé | raie qui s'assombrit | 0,45 s | une longueur d'onde est absorbée | raie posée d'un coup |
| Pause / arrêt | volet qui tombe, spectre qui pâlit | 0,5 s puis 0,8 s | la source est coupée | image fixe pâlie |
| Reprise | rayon qui se rallume | 0,4 s | la même source repart | image fixe |
| Relecture | trait blanc de droite à gauche | boucle 2,6 s, linéaire | on relit ce qui a été fait | trait fixe au milieu |
| Changement d'état | titre puis phrase | 0,36 s, décalés de 0,14 s et 0,22 s | la lumière change d'abord, le mot suit | aucun |
| Valeur qui change | chiffre monte de 5 px | 0,32 s | nouveau compte | aucun |
Rien ne bouge en prêt, pause, arrêt, fin (la boucle d'animation s'arrête).

## Pourquoi sans filiation
Partie d'une feuille blanche à partir des références ci-dessus ; je n'ai ouvert ni `src/`, ni d'autre maquette, ni l'historique.

## Autocritique (ce qui peut encore faire « vibe codé »)
- Le spectre arc-en-ciel est une image très connue ; je l'ai désaturé (0,86) et ne l'utilise que sur l'écran du banc, mais un opérateur qui n'aime pas les couleurs vives peut le trouver criard.
- Le banc reste noir en thème clair (choix assumé : la lumière n'existe que sur le noir) ; cela fait un bloc lourd en haut du panneau clair.
- Deux différés proches forment un bloc sombre qu'on peut lire comme une cassure.
- Plex Mono dans le banc + Archivo ailleurs : deux voix typographiques.

## Chiffres du vérificateur (dernier passage)
5 916 textes mesurés, contraste minimal 6,43:1, 0 écart, 0 erreur de console (20 scènes × 2 thèmes × 3 largeurs). Contrôle du mouvement réel (sans figer) : 0 erreur.
