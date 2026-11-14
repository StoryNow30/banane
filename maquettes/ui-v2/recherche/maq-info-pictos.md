# Maquette info-pictos — « Pictogrammes du lot »

Fichier : maquettes/ui-v2/sources/info-pictos.html. Police : Public Sans.

## Logique en une phrase
Un jeu de pictogrammes dessinés pour ce métier, sur une grille de 24 et un trait de 2, qui tient en noir et blanc ; les quantités se comptent en signes identiques répétés (méthode Isotype), et le contenant dit la gravité (grammaire ISO 7010).

## Références et ce qui en est pris
- Isotype : plus de signes identiques plutôt qu'un signe plus grand ; pas de perspective ; toujours avec des mots.
- Pictogrammes des Jeux de 1972 : un système cohérent dessiné comme un tout.
- ISO 7010 : carré = information, triangle = avertissement, cercle = obligation (« à vous d'agir »).
- Carbon : forme + symbole + couleur + mot ; une forme ne change pas de couleur.
- GOV.UK / NHS Tag : états en adjectifs, actions en verbes.
- Radix gray / amber / red ; Public Sans.

## Sens des signes
- Tranche pleine = posé ; tranche en contour + chevron = différé ; tranche pleine + signet = posé à examiner ; tranche hachurée = en cours ; tranche pointillée grise = à faire.
- Avancement : une tranche = 20 cuts (échelle écrite sous la rangée). Total inconnu : la rangée s'arrête sur « … ».
- Différés et posés à examiner : une marque par cut jusqu'à 12, puis « +N ».
- Contenant carré gris = information ; triangle ambre = à regarder ; cercle rouge plein = à agir.
- Pictogrammes d'objets : ESV relié (deux fenêtres liées) / non relié (lien coupé), onglet à choisir (barre d'onglets, un plein), Orbite (flèche qui pose sur une tranche), Écho (tranche et ondes), file (trois groupes soulignés), partie relue (tranche + coche), reprise (flèche de retour).
- Une légende complète, dessinée avec les mêmes pictogrammes, est dans les notes.

## Pourquoi sans filiation
Jeu dessiné de zéro sur grille ; aucune interface ou icône d'Ariane consultée, pas de bibliothèque d'icônes générique.

## Pourquoi elle n'illustre ni une voie ni un nuage
L'unité est une tranche abstraite (un cut compté), pas un rail ni un relevé : aucune voie, aucun point dessiné hors de la vue « Examiner ».

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Une tranche d'avancement se remplit (tous les 20 cuts) | la tranche monte depuis sa base (scaleY 0,15 → 1) | 420 ms, (0.16, 1, 0.3, 1) | 20 cuts de plus sont faits | la tranche change d'état sur place |
| Nouveau différé / posé à examiner | la dernière marque de la rangée arrive « en tampon » (échelle 0,6 → 1) | 240 ms | une unité s'ajoute au compte | apparaît sur place |
| Changement d'état | le contenant fond, le pictogramme glisse de 4 px | 200 / 240 ms | l'objet ou la gravité a changé | sur place |
| Message | entrée de 4 px | 200 ms | retour d'action | sur place |
Mesuré : `remplit` observé au passage d'une tranche, `glisse` 10, `fondu` 16 ; réduit : aucune.

## Journal des tours
- r0 : 99 écarts (pictogrammes de titre sans taille → débordement ; triangle mesuré sur son remplissage) corrigés.
- r1 : tranches trop étroites, le contour se lisait « 0 » (pire défaut : un signe confondu avec un chiffre) ; « ▯> » lu « 0> » ; trois rouges pour une cause en « ESV non relié ».
- r2 : pictogramme « onglet » lu comme une mallette (générique et faux) → barre d'onglets.

## Ce qui pourrait encore faire « vibe codé »
- Les pictogrammes d'Orbite et d'Écho, à 28 px, restent petits et demandent la légende la première fois.
- La hachure de la tranche « en cours » est fine à 26 px.

## Chiffres du vérificateur
info-pictos : 7 104 textes mesurés, contraste minimal 5,19:1, **0 écart, 0 erreur de console**.
