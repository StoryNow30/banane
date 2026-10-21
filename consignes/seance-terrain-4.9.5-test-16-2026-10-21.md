# Séance terrain « 4.9.5 test 16 (L1-e5) » : la GCV2 cherche les rails là où ils sont, et laisse moins de cuts sans pose

**Ce qui change par rapport à la test 15 : seulement les différés.**

- Tout ce que la chaîne du lot posait avant, elle le pose comme avant.
- Sur un cut que la chaîne laisse rouge, la GCV2 de la test 15 décidait avec des preuves prises près de la pose de départ d'ESV. La test 16 va chercher les rails là où ils sont dans le nuage.

C'est la **v5**. Elle reprend la décision de la test 15, plus les réglages ci-dessous. Ils étaient **coupés** en test 15 ; ils sont **actifs** dans la test 16, sans rien à régler.

Ce que la GCV2 fait de plus :

- **Recherche recentrée.** En test 15, elle ne lisait le nuage que sur une bande étroite autour de la pose de départ. Dans les ADV, un rail à 20 cm de cette pose était hors de la bande : elle prenait alors un faux champignon. Maintenant elle relance sa recherche **autour de l'endroit où le rail est** (pose du voisin, paire de la test 13, départ). Elle joue en **ADV et aux abords**.
- **Voie absolue des voisins cohérents.** Elle calcule la voie en position absolue, à partir des cuts voisins déjà validés. Elle écarte les voisins dont la voie saute d'un cut à l'autre.
- **Écartement toléré de 15 mm.** La paire trouvée doit être à ± 15 mm de l'écartement des voisins valides de la liste d'ESV.
- **Rail par rail, en dernier recours.** Si aucune paire n'est sûre, elle essaie un rail à la fois. Cette branche ne joue que s'il ne reste rien d'autre à essayer.
- **Gardes de robustesse.** Elle refuse une paire dans ces cas :
  - pour une paire trouvée par la recherche, le dessus d'un rail repose sur moins de **60 points** ;
  - la voie s'écarte de plus de **35 mm** en travers du voisin validé le plus proche, quand la paire de la test 13 est gardée sans correction ;
  - la hauteur s'écarte de plus de **20 mm** de celle du voisin ou de la pose de départ ;
  - une pose existante est contredite par une cellule forte du nuage à 22 à 45 mm : elle est remplacée par la paire recentrée, et sans paire, rien.
- **Coût.** Elle s'arrête à la première paire sûre et saute la recherche en ADV quand la pose est à 2,5 mm de celle du voisin. Au banc, ces deux raccourcis ne déplacent que quatre poses de la partie 17, de 3 mm au plus. La décision peut être plus longue qu'en test 15 sur les cuts d'ADV.
- **Pas de pose approchée.** Comme en test 14 et 15, un cut qu'elle ne valide pas reste rouge, à la pose de départ d'ESV.

**Pas de deuxième passe en fin de lot.** La test 16 ne contient pas la deuxième passe en fin de lot ; elle viendra dans une test 17. Tu n'as rien à activer à ce sujet.

**Vocabulaire.** Un **cut laissé sans pose** est un cut que la chaîne n'a pas posé et que la GCV2 n'a pas posé non plus, alors que le nuage est là. Les cuts à nuage vide ne comptent pas dans ce chiffre. **Moins il y en a, mieux c'est.**

**Ce que dit le banc.** Ce sont des rejeux de tes lots contre tes Échos, pas des mesures terrain. Ces neuf lots (huit parties) ont **tous servi à régler** la GCV2 : les chiffres ne disent pas ce qu'elle fera sur une partie nouvelle.

Chaîne mesurée : celle de la test 16 telle que tu l'auras, **sans** deuxième passe.

| Partie | Cuts laissés sans pose : test 15 → test 16 | Poses jugées | À 5 mm ou moins | À 10 mm ou moins | À plus de 20 mm |
|---|---|---|---|---|---|
| 19 | 3 → 2 | 236 | 196 | 235 | 0 |
| 20, second lot | 2 → 1 | 175 | 134 | 172 | 0 |
| 20, premier lot | 8 → 1 | 15 | 11 | 13 | 0 |
| 11 | 3 → 2 | 9 | 3 | 7 | 0 |
| 6 | 3 → 2 | 9 | 5 | 7 | 0 |
| 7 | 2 → 2 | 19 | 13 | 18 | 0 |
| 13 | 0 → 0 | 0 | 0 | 0 | 0 |
| 17 | 18 → 4 | 37 | 26 | 35 | 0 |
| 18 | 18 → 11 | 25 | 19 | 23 | 0 |
| **Total** | **57 → 25** | **525** | **407** | **510** | **0** |

Lecture :

- **Cuts laissés sans pose : 57 → 25.** Les neuf lots, tous rejoués avec la chaîne de la test 16, sans deuxième passe. Il reste en plus 30 cuts rouges à nuage vide (29 dans le premier lot de la partie 20, 1 dans la partie 19) : le banc ne peut rien en faire.
- **Sur 525 poses jugées contre ta vérité : 407 à 5 mm ou moins (77,5 %), 510 à 10 mm ou moins (97,1 %).** La test 15 donnait 471 sur 494 à 10 mm ou moins (95,3 %).
- **0 pose à plus de 20 mm** (la test 15 en avait 5 : 3 en partie 17, 2 en partie 7). **0 pose à plus de 50 mm. 0 mauvaise voie. 0 vert changé.**
- Les parties 17 (4) et 18 (11) gardent le plus de cuts sans pose. **La partie 18, avec 11, reste au-dessus de la cible de moins de 5.** La partie 7 reste à 2.
- Les « poses jugées » comptent toutes les poses que la chaîne du lot ne faisait pas déjà (GCV2 et chaîne refaite sur les différés) et pour lesquelles tu as une vérité.


## 1. Installer et vérifier

1. Exporte d'abord ce que ta version actuelle garde.
2. **Contrôle l'empreinte du zip** (PowerShell, dans le dossier du zip) : `Get-FileHash .\ariane-4.9.5-test.16.zip -Algorithm SHA256`. Les 64 caractères doivent être ceux de mon message, sinon n'installe pas.
3. **Pose la test 16 par-dessus la test 15** : décompresse le zip dans le même dossier, en remplaçant les fichiers. Dans `chrome://extensions`, clique sur **Recharger** sur la carte Ariane.
4. **F5 sur l'onglet ESV**, puis choisis-le dans Ariane.
5. **Vérifie la version** : la carte, le panneau et le bouton blanc d'ESV disent « 4.9.5 test 16 (L1-e5) ».

Il n'y a rien à régler : le nouveau comportement est actif pour chaque lot.

Comme en test 14 et 15, il a besoin de la **liste des coupes d'ESV** de la partie. Ariane la garde quand ESV la charge, au chargement de la partie. Si elle manque, le lot fait comme la test 13, sans poses approchées.

## 2. L'essai à faire

Le but : savoir ce que la test 16 fait sur une partie qu'elle **n'a jamais vue**.

1. **Choisis une partie neuve** : ni les parties 6, 7, 11, 13, 17, 18, 19 ou 20 du second projet, ni une partie dont tu as déjà fait l'Écho. La partie 0 du troisième projet a déjà été jouée avec la test 15 : tu peux t'en servir pour comparer, mais ce n'est pas une partie neuve.
2. **Lance le lot** comme d'habitude. Ne touche à aucun cut pendant le lot.
3. **Exporte le lot** (Orbite) tout de suite, avant tout Écho.
4. **Premier Écho : seulement les cuts laissés sans pose.** Ce sont les cuts restés **rouges** à la fin du lot. Corrige-les comme des différés ordinaires. Ne touche à aucun cut vert. « Terminer et télécharger », puis exporte cet Écho **seul**.
5. **Second Écho : toute la partie.** Passe tous les cuts, y compris les verts posés par la GCV2. Corrige ceux qui sont faux. « Terminer et télécharger », puis exporte cet Écho **seul**.

**Un export séparé pour chaque Écho** : il me permet de juger les poses de la GCV2 contre ta vérité sans mélanger les deux passages.

Si la partie est longue, tu peux faire le lot et le premier Écho un jour, le second Écho le lendemain. Ne lance pas un autre lot entre les deux.

## 3. Pendant et après le lot

**Chaque pose est définitive dans ESV.** Moins il y a de cuts à reprendre à la main, mieux c'est ; mais un vert faux est pire qu'un rouge.

Les cuts **verts** posés par la GCV2 se contrôlent comme tout vert d'Orbite. Note ceux qui sont **faux** : mauvaise voie, mauvais rail, ou plus de 1 cm de ta pose.

Zones à surveiller :

- les **ADV**, surtout là où deux voies ont un écartement proche ;
- les **abords** des ADV : la recherche y joue pour la première fois ;
- les cuts posés **rail par rail** (le dernier recours) : note leur numéro s'ils te paraissent douteux ;
- les **longues suites** de cuts posés par la GCV2 : elle s'appuie sur ses propres poses du lot pour trouver la voie.

**Temps.** La décision peut être plus longue sur les cuts d'ADV. Si un cut te paraît bloqué, note l'heure et le numéro avant d'arrêter.

**Nuage vide.** Si un cut reste rouge alors que le nuage s'affiche bien chez toi, note son numéro. Cette version ne corrige pas ce problème (une recapture existe dans le code, mais elle est coupée et tu ne peux pas l'activer).

## 4. À la fin : les exports

**Orbite** : l'export du lot, comme d'habitude.

**Écho**, deux exports séparés (un par Écho) : choisis « Terminer et télécharger » et envoie pour chacun :

- **tous les volumes et tous les segments automatiques** ;
- leurs SHA-256 (`Get-FileHash` sur chaque zip) ;
- tes notes (cuts verts faux, cuts douteux, nuages vides).

Dis-moi lequel est le premier Écho et lequel est le second.

Vide le cache seulement après ma confirmation de réception.

## 5. Pas de deuxième passe dans cette version

La test 16 ne contient pas la deuxième passe en fin de lot ; elle viendra dans une test 17. Il n'y a donc rien à activer, ni en lecture seule ni en écriture.

À titre de perspective seulement : au banc, avec une deuxième passe, il reste **12** cuts laissés sans pose au total sur les mêmes neuf lots. Elle n'est **pas livrée**. Les chiffres du tableau ne l'incluent pas.

## 6. Si quelque chose ne va pas

1. Arrête le lot.
2. Note l'heure et le message.
3. Exporte et envoie les zips.

**Ne désinstalle pas Ariane.**

Retour arrière vers la v4 :

1. Exporte.
2. **Désactive** la test 16 dans `chrome://extensions`, sans la supprimer.
3. Décompresse le zip de la **4.9.5 test 15** (`ariane-4.9.5-test.15.zip`) dans le même dossier.
4. **Réactive** la carte, puis clique sur **Recharger**.
5. F5 sur ESV.

Les poses déjà validées dans ESV restent : le retour arrière ne les défait pas.

## 7. Ce qui n'est pas vérifié

- La test 16 n'a jamais posé dans ESV. Tout vient du rejeu des lots des parties 6, 7, 11, 13, 17, 18, 19 et 20 du second projet.
- **Ces neuf lots (huit parties) ont aussi servi à régler** les seuils. Les chiffres ci-dessus sont donc optimistes : la preuve de terrain est nécessaire.
- **L'écartement toléré de 15 mm** et **la branche rail par rail** ne sont appuyés que par deux ou trois parties.
- **La paire de la test 13 gardée sans correction d'écartement** (probabilité d'au moins 0,8, voie à 35 mm au plus du voisin validé) ne repose que sur six cuts, trois gardés et trois refusés, dans quatre parties.
- **Le plancher de 60 points** de dessus repose sur trois cuts ; aucune paire fausse n'a été vue entre 31 et 45 points, donc le seuil n'est pas serré.
- Une nouvelle pose change la voie des cuts suivants. Le banc rejoue en chaîne, mais le terrain peut en tirer d'autres effets.
- Parité du vrai code de l'extension avec le banc sur cette chaîne v5 : en cours (paquet candidat).
- Edge n'a pas été vu.
