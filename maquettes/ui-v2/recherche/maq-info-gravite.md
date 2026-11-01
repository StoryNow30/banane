# Maquette info-gravite — « Gravité unique »

Fichier : maquettes/ui-v2/sources/info-gravite.html (assemblé : maquettes/ui-v2/info-gravite.html). Police : Overpass + Overpass Mono.

## Logique en une phrase
Une seule échelle à trois niveaux, « rien à signaler / à regarder / à agir », organise tout le panneau : chaque ligne d'un tableau à places fixes porte son niveau, et un bandeau maître prend le niveau le plus haut présent.

## Notes de départ (skill design-refinement)
- But : qu'un opérateur fatigué sache de loin, en une seconde, s'il doit venir.
- Ligne d'arrivée : vérificateur 0 écart / 0 erreur ; aucune rubrique de craft.md en défaut sur les captures clair, sombre, 360/420/600 ; lecture identique en niveaux de gris.
- Surfaces : les 20 scènes du vérificateur.

## Références et ce qui en est pris
- Carbon « Status indicators » : trois éléments sur quatre (forme, mot, couleur) ; statut consolidé au plus grave ; « pas d'indicateur quand rien n'est à faire » ; gris = pas commencé.
- Annonciateurs (aviation et procédés) : voyant maître ; rouge = agir, ambre = regarder ; fenêtres à place fixe (la reconnaissance de motif bat la liste) ; « Alarm management » : éviter l'inondation d'alarmes.
- ISO 7010 : la forme dit la catégorie avant le mot.
- NHS Warning callout : au plus deux encadrés d'alerte, titre précis.
- Radix sand / amber / red ; mesure : red 9 + blanc = 3,91:1, d'où red 11.
- Laws of UX : Von Restorff (une seule saillance), selective attention, Hick (une action principale).
- GOV.UK Task list : ligne entière cliquable dans « Ce qui reste ».

## Sens des signes
- Petit disque gris plein = rien à signaler (voyant éteint). Triangle ambre = à regarder. Octogone rouge barré = à agir.
- Bandeau : le niveau le plus haut, en mot de 28 px + une raison.
- Règle écrite : pendant que le lot tourne, différés et posés à examiner restent au niveau 0 (« à voir après le lot ») — on n'alarme pas ce qui ne peut pas encore être traité.
- Une cause = une ligne rouge (le bandeau, la ligne concernée, un encadré ; jamais plus).
- « Arrêter ce lot » n'a pas de signe : il devient rouge seulement à la confirmation (action destructive).

## Pourquoi sans filiation
Aucune interface existante d'Ariane n'a été ouverte (ni src/, ni autre maquette). La structure vient des panneaux d'annonciateurs et de Carbon, pas d'un panneau antérieur.

## Pourquoi elle n'illustre ni une voie ni un nuage
Ses seuls signes sont trois formes de gravité (disque, triangle, octogone) et un tableau de lignes : aucune image de voie, de rail, de quai ni de points.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Avancement du lot (chaque cut) | barre d'avancement (élément conservé `data-garder`) | 900 ms, linéaire | une progression avance à vitesse constante | la barre saute à la nouvelle valeur |
| Nouveau différé ou posé à examiner | chiffre de la ligne : halo ambre doux qui s'éteint | 700 ms, ease-out | « quelque chose s'est ajouté ici » | rien ; le chiffre change sur place |
| Changement de niveau du bandeau | signe et mot montent de 6 px en apparaissant | 220 ms, (0.16, 1, 0.3, 1) | le niveau a changé | changement sur place |
| Passage à « à agir » | l'octogone fait deux pulsations lentes (1,14×), puis s'arrête | 1 300 ms, ease-in-out, après 240 ms | s'impose une fois, sans boucler (acquittement des annonciateurs) | aucune pulsation |
| Changement d'état (phase, vue) | zone de détail entre | 200 ms, ease-out | la vue a changé | sur place |
| Confirmation d'arrêt | le bouton se remplit de rouge | 160 ms, ease-out | l'appui suivant arrête | remplissage immédiat |
| Message | bandeau noir monte de 6 px | 200 ms | retour d'action | apparaît sur place |
Toutes les animations sont sous `prefers-reduced-motion: no-preference` et hors `html[data-mouvement="reduit"]`. Mesuré (Chromium, 7,5 s en cours de lot) : `width` 139 échantillons, `marque` 27, `entree` 8 ; en mouvement réduit : aucune animation.

## Journal des tours (autocritique avant correction)
- r0 : le carré creux du niveau 0 se lisait comme une case à cocher (pire défaut) ; tableau trop haut, « Préparer » coupé ; valeurs-mots en chasse fixe ; cut dit trois fois ; titre répété.
- r1 : alerte de file = cinq octogones pour une cause ; octogone sur « Arrêter » (deux sens pour un signe) ; « sur » en chasse fixe ; phrase redondante en Prêt.
- r2 : « Ce qui reste » à 360 px = 34 boutons ; chiffres du bilan petits ; titre Écho redondant ; « moins d'une minute » pendant la relecture.
- r3 : lien « Voir ce qui reste » relégué sous l'export (règle pic-fin) → remonté.
- Substitution à council (pas d'auditeurs disponibles) : relecture par la grille rubrics.md, chaque point marqué confirmé avant correction.

## Ce qui pourrait encore faire « vibe codé »
- Le bandeau ambre plein peut paraître criard en fin de lot ; il est juste au sens, mais une version « liseré » serait plus calme.
- Six lignes même au repos : un opérateur expérimenté pourrait vouloir masquer les lignes à 0.
- Les sous-textes en 13 px restent petits pour une lecture à distance.

## Chiffres du vérificateur (dernier passage)
info-gravite : 8 412 textes mesurés, contraste minimal 5,21:1, **0 écart, 0 erreur de console** (20 scènes × 2 thèmes × 3 largeurs).
