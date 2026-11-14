# Référence : WCAG 2.2 (1.4.1, 1.4.3, 1.4.11, 2.3.3), web.dev prefers-reduced-motion, calculateur APCA — famille « info- »

## Ouvert exactement (toutes lues en entier dans Chromium, statut 200) — ÉTABLI
- W3C « Understanding SC 1.4.1 Use of Color ».
- W3C « Understanding SC 1.4.3 Contrast (Minimum) ».
- W3C « Understanding SC 1.4.11 Non-text Contrast ».
- W3C « Understanding SC 2.3.3 Animation from Interactions ».
- web.dev « prefers-reduced-motion: Sometimes less movement is more ».
- apcacontrast.com (calculateur APCA).

## Ce que j'y ai lu
- **1.4.1** : la couleur n'est jamais le seul moyen visuel de porter une information, d'indiquer une action, d'appeler une réponse ou de distinguer un élément. Une différence de clarté ≥ 3:1 compte comme second indice, **sauf** quand il faut reconnaître une teinte précise (vert = valide / rouge = invalide) : là, un autre indice visuel est exigé quel que soit le contraste.
- **1.4.3** : texte ≥ 4,5:1, grand texte (≥ 24 px, ou ≥ 18,5 px gras) ≥ 3:1 ; seuils non arrondis (4,499 échoue). Les polices fines sont rendues plus pâles par le lissage : viser au-dessus du seuil.
- **1.4.11** : ce qui identifie un composant, son état, et les parties de graphique nécessaires à la compréhension : ≥ 3:1 contre les couleurs adjacentes ; un état « coché » qui ne change que la teinte (étoile jaune/blanche) échoue à 1.4.1.
- **2.3.3** (AAA) : une animation déclenchée par une interaction doit pouvoir être désactivée, sauf si elle est essentielle ; les troubles vestibulaires (nausée, migraine) sont la raison ; utiliser la préférence de mouvement réduit du système.
- **web.dev** : `prefers-reduced-motion: reduce` = « retirer tout mouvement non essentiel » ; poser les animations seulement sous `no-preference` ; en JavaScript, écouter le changement de la requête et arrêter les animations en cours.
- **APCA** : contraste de clarté Lc de 0 à 106 (texte foncé sur clair) et de 0 à −108 (texte clair sur foncé) ; la polarité compte ; la taille et la graisse fixent le seuil (le tableau du calculateur donne la taille minimale par graisse).

## Ce que j'en retiens pour Ariane
- Règle de chaque maquette : **3 éléments sur 4 (Carbon) et lecture en niveaux de gris** ; je fais en plus une capture en niveaux de gris par maquette pour le vérifier (filtre CSS appliqué au cadre, hors dépôt).
- Seuils pratiqués : texte normal ≥ 4,5:1 mesuré par le vérificateur ; je vise Lc ≥ 75 pour le texte courant et Lc ≥ 60 pour les libellés de 14 px gras (mesuré avec mon outil APCA).
- Marques non textuelles porteuses de sens (`data-forme`) ≥ 3:1.
- Mouvement : chaque animation est posée sous `no-preference` ET hors `html[data-mouvement="reduit"]` ; l'équivalent réduit garde l'opacité et la couleur et retire déplacement, échelle, rebond (règle beui « keep meaning, remove travel »). Aucun clignotement : au plus deux pulsations lentes (bien sous 3 éclairs par seconde, critère 2.3.1).

## Ce que j'écarte
- Prendre APCA comme seuil réglementaire : il ne l'est pas ; WCAG 2 reste l'exigence (et le vérificateur), APCA sert de second regard sur le texte clair sur fond sombre, où le rapport WCAG est trop optimiste.
