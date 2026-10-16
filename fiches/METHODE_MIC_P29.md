# Méthode métier de Mic, relecture Écho de la partie 29 (16 octobre 2026)

Notes de Mic pendant sa relecture Écho de la partie 29, après un lot Orbite en 4.9.5 test 3. Elles sont recopiées fidèlement, puis traduites en règles candidates pour la 5.0 : M1 (carte de la partie), M4, M6 et GCV2. Mic précise : « Je me suis particulièrement appliqué sur ces corrections ». **Cette relecture est la référence la plus soignée dont on dispose.**

## Notes de Mic

- **Cut isolé** (exemples : 323, 335, 411 et bien d'autres) : il vérifie le cut d'avant et le cut d'après. Ce sont de petits contrôles à intégrer à la méthode métier quand on trouve un cut isolé.
- **Grappes d'invalides** (de 456 à 468, de 495 à 504, et d'autres) : il contrôle toute la plage sans laisser de trou, parce que les invalides sont tous relativement proches.
- **Passages à niveau** : il contrôle toujours quelques cuts avant d'y entrer, et quelques cuts après.

  | Plage contrôlée | PN |
  |---|---|
  | 1652 – 1667 | autour de 1656 |
  | 3342 – 3355 | 3345 – 3352 |
  | 5978 – 5992 | 5981 – 5986 |
  | 6466 – 6478 | 6469 – 6474 |

- **Zones d'ADV** (réponse à la question 3 du cahier) : changement de voie dans la plage 6658 – 6678, aiguille au cut 6638, côté droit. C'est « toute la marge que je peux prendre dans ce genre de cas de figure ; ce sera le but recherché avec Orbite ». Même chose de 7954 à 8066, avec l'ADV vers le cut 8003.
- **Cuts visités mais ni modifiés ni validés** : Mic les considère comme **bons**.
- **F5 en Écho** : il a fait bugger la collecte, et Mic a dû faire de nombreuses manipulations pour pouvoir relancer un lot. Il a refait un F5 en fin de partie. Les exports contiennent peut-être des doublons sous un autre nom.

## Règles candidates (à valider par les mesures, puis par Mic)

1. **Voisinage d'un cut isolé** : quand un cut à traiter est isolé (voisins valides), contrôler le cut d'avant et le cut d'après. Pour M6, M1 et GCV2, un cut isolé vaut un signal faible à vérifier sur ses voisins, et ses voisins forment son contexte.
2. **Grappe** : quand plusieurs invalides sont proches, traiter la plage entière sans trou. C'est le contraire d'un traitement cut par cut ; pour le choix des cuts d'un lot, voir M1.
3. **PN avec marge** : environ 3 à 4 cuts avant l'entrée et 3 à 6 après la sortie, selon les quatre exemples. M1 doit marquer ces zones, et Orbite y applique la prudence des PN (garde, repli).
4. **ADV avec marge** : la zone couvre de l'aiguille au changement de voie, avec une marge large (environ 20 à 40 cuts autour). C'est la cible d'Orbite pour les ADV.
5. **Visité sans action = bon** : dans la jointure Écho ↔ Orbite et dans E5, un cut visité par Mic sans modification ni validation compte comme **confirmé bon**, et non comme « sans référence ». Cela change le calcul des faux verts (borne basse et haute de D-128) et doit être appliqué à la jointure.

## Suites

- La jointure (S3), E5 et M6 doivent compter les cuts « visités sans action » comme bons (règle 5).
- M1 dispose désormais de quatre PN et deux zones d'ADV étiquetés sur une même partie : c'est le premier jeu d'apprentissage de la carte de la partie.
- **F5 en Écho : défaut à reproduire** sur la maquette ESV (S4) et à corriger avant toute nouvelle consigne qui demande un F5. C'est moi qui avais demandé ce F5.

## Partie 12 (opérateur débutant, Écho de Mic du 16/10, 10 h 02 – 10 h 17)

Mic corrige la partie d'un opérateur débutant. Les poses de départ sont humaines. PN, avec les marges de contrôle avant et après comprises : 3944–3965, 6232–6246, 7885–7899, 8380–8394, 9070–9086, soit 15 à 22 cuts par PN marges comprises. Cela confirme la règle 3 (PN avec marge) sur une deuxième partie.

## Partie 13 (partie humaine, Écho de Mic du 16/10, à partir de 10 h 20)

- PN : 124–139, 1284–1300, 6100–(fin non précisée), 6927–6941, 8055–8071, 9456–9469.
- Zones d'ADV, marges comprises : 4644–4713, avec l'aiguille au cut 4682 (environ 38 cuts avant l'aiguille et 31 après) ; 4911–4936 (Mic a noté aussi « aiguille au cut 4682 » pour cette zone : à confirmer).
