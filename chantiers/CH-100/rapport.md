# CH-100 : rapport (trois mesures sur les coupes non résolues, juge des posés faux)

Étude hors ligne (D-322). Aucun fichier de l'extension modifié, aucun réglage ajusté, aucune règle nouvelle. Il n'y a plus de partie d'examen vierge : rien ici ne dépasse PROBABLE pour un taux général. Chaque mesure a été refaite par un relecteur adverse avec ses propres scripts. Sorties par cut : `chantiers/CH-100/sorties/`.

## 0. Manifeste (commit à part)
Trois blocs ajoutés, décision D-322 : étiquette 13 (parties 13 à 16, lot du 06/11), 14 (parties 3, 4 et 6, lots du 08/11), 15 (partie 1, Écho seul du 10/11). La partie 9 du lot du 10/11 reste réservée (prochain examen). Essais du manifeste verts (47).

## 4. Le juge des « posés faux » : `tools/juge-poses-faux.cjs` (5 essais)
Une définition : mauvaise voie = plus de 50 mm, pire rail, 3D. Validation sans mouvement de moins de 1,5 s écartée (D-285) ; « visité sans action » et deuxième passe à part ; séries et plages jugées ; lit la liste d'une séance tirée au sort.
- **Effectif** (ÉTABLI) : 281 posés validés par l'opérateur sur 2 211 posés (05, 06 et 08/11) ; 73 visités sans action, 26 écartés D-285.
- 05/11 : 0 faute sur 166 validés. 06/11 : 7 sur 84, en 3 séries (15/7260 ; 15/7423 ; 16/9266 à 9272). 08/11 partie 6 : 3 sur 19, en 2 séries (220 ; 360-361). 08/11 parties 3-4 : 0 sur 12.
- Non concluable en taux : jugés choisis par l'opérateur. La séance tirée au sort de la partie 9 (150 coupes, 31 plages) n'a pas encore d'Écho.

## 1. B1-écart, base à battre : `tools/ch100-b1-ecart.cjs`
- **Effectif** : 40 poses d'ombre jugées contre une validation de l'opérateur (23 le 06/11, 17 le 08/11), en 12 plages ; 26 posables sans Écho.
- ÉTABLI : l'ombre n'est consignée qu'à partir du paquet du 06/11 (aucun événement les 04 et 05/11) ; 732 événements sur 11 lots.
- ÉTABLI : 37 justes à 10 mm, 1 à 14,9 mm, **2 à plus de 50 mm** (16/9119 à 180 mm, 16/9269 à 292 mm), soit 5 % [1,4 ; 16,5]. Ombre du lot seul : 33 sur 35, mêmes 2 fautes. Par source : b1 6 sur 6, série 23 sur 24, écart 8 sur 10 ; les 2 fautes sont « écart », étage « choice », confiance 0.
- La référence « 0 sur 49 à plus de 50 mm » n'est pas égalée. La comparaison à « 44 sur 67 » est SUPPOSÉE : la référence vient d'un rejeu, non refait ; mesuré ici 36 sur 70.
- Deux pièges d'outil trouvés, à corriger hors de ce chantier : `juger-lot` compte 5 fautes B1-écart le 06/11 dont 3 artefacts (cuts écrits par la passe, piège de CH-034 § 8) ; la jointure garde le dernier événement dans l'ordre du fichier, pas du temps (le journal n'est pas rangé : 372 cuts concernés pour la passe, 17 décisions changeraient).
- **À demander** : un Écho sur les 26 posables non visités (dont 19 écrits par la passe) ; pour la source « écart » il faut de nouveaux lots avec Écho des différés.

## 2. Deuxième passe : `tools/ch100-passe.cjs` (3 essais), `tools/ch100-un7z.py`
- **Effectif** : 128 écritures réelles sur 93 lots depuis le 26/10 (10 au plus par lot, plafond tenu) ; 29 vues par un Écho, 99 sans Écho. Partie 0 du 23/10 à part : 2 « poserait » justes, 0 écriture.
- ÉTABLI : les 29 sont vues dans l'état exact où la passe les a écrites (0,000 mm, aucune retouche entre-temps) : l'objection d'ancrage du cadrage est levée pour elles.
- ÉTABLI : 25 validées par l'opérateur : 17 justes à 10 mm, 8 entre 10,25 et 20,35 mm (surtout en latéral), **0 au-delà de 50 mm** (borne 13,3 %). Avec 4 « visité sans action » : 0 sur 29 (11,7 %, PROBABLE : une visite de 1,2 s, deux validations suivies d'un « skipped » de l'opérateur). Lecture stricte : 0 sur 23 (14,3 %).
- Concluable au sens du ticket (au moins 20 jugées), mais loin du budget : il manque 44 écritures jugées pour borner à 5 %, 96 pour 3 %. SUPPOSÉ que les 99 sans Écho sont sans faute : aucun indice mesuré (écartement, déplacement, relecture d'Ariane), 34 sans aucun contrôle.
- Ombre (« poserait » non écrits) : 118 jugés, 90 justes, 26 de 10 à 50 mm, 2 au-delà de 50 mm (deux cuts voisins du 28/10, partie 20, 142 et 172 mm) ; 80 des 118 viennent de ce seul lot.
- Garde A : 11 refus, 3 mesurables, **3 bonnes poses retirées** (2,1 ; 3,8 ; 9,3 mm), 0 faute retirée mesurée, 8 sans Écho. Trois cas : non concluable.
- **À demander** : un Écho des cuts écrits par la passe (99 en attente ; les plus fournis : 04/11 partie 4, 03/11 parties 24 et 26, 09/11 partie 11) et des 8 refus de la garde.

## 3. Liste d'ESV autour des fautes : `tools/ch100-liste-esv.cjs`
- **Effectif** : 10 fautes en 5 zones de cibles contiguës (2, 12, 12, 13 et 35 cuts), 166 différés jugés ; lots des 04, 05, 06 et 08/11.
- ÉTABLI : **non mesurable par la preuve exigée.** Un seul instantané de liste est gardé par partie, le dernier ; pour les trois parties à fautes il est postérieur à la décision (106 à 385 s) : 10 fautes sur 10 exclues, 126 différés sur 166.
- ÉTABLI : avec la définition de CH-033 (aucune écriture sur la ligne) on lit 0 sur 10, mais c'est un artefact : les écritures « vu » des voisins viennent toutes de la relecture d'Ariane après le lot. Ce chiffre ne clôt rien.
- PROBABLE : hors preuve stricte, les 10 fautes ont une ligne valide non touchée de chaque côté à 27 cuts au plus (1 à 15 avant, 2 à 21 après ; 9 sur 10 à 15). Le seuil de clôture écrit avant (moins de la moitié) n'est pas atteint : **piste non close**.
- SUPPOSÉ : que ces lignes servent de référence. Elles sont valides d'amont, jamais vues par un opérateur ; la relecture en a déplacé 79 de 8 à 42 mm.
- Le cadrage disait « fautes au fond de zones invalides longues » : faux sur ces lots. La réfutation « par couverture » de CH-033 § 2 porte peut-être le même biais (SUPPOSÉ, non remesuré).
- **À faire pour conclure** : garder un instantané de la liste au départ de chaque partie.

## Ce qu'il faut demander à l'opérateur
1. La séance tirée au sort de la partie 9 (150 coupes) : seul taux présentable des posés.
2. Un coup d'œil sur les cuts 8996 à 9003 de la partie 16 du 06/11 : la passe y a écrit 9002 à 328 mm de l'ombre B1-écart ; l'écriture est continue avec 30 posés voisins du lot, l'ombre suit trois lignes de la liste. Aucun Écho ne tranche.
3. Un Écho des différés et des cuts écrits par la passe sur les lots des 09 et 10/11 (26 poses d'ombre posables).
