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

## Réponses de Mic (16/10, après les analyses des parties 12 et 13)

- Partie 12 : les cuts 7276–7289 forment bien un **PN**.
- **Les grosses erreurs (30–40 mm) ne sont pas des poses du débutant** : le débutant n'a pas corrigé tout le PN, faute d'appliquer la méthode métier. Ces rails étaient **verts sur la carte, donc non visités** (un rail visité devient violet) : ce sont les poses d'extraction laissées telles quelles. Mic, lui, contrôle tout le PN, et **c'est ce qu'Orbite doit apprendre**.
- Partie 13 :
  - le PN qui commence au cut 6100 se termine au **6115** ;
  - la deuxième zone d'ADV va jusqu'au **4963** (confirmé), et non 4936 ;
  - son aiguille se situe **entre les cuts 4935 et 4936**.
- Les parties 12 et 13 ont été traitées par la **même personne**.
- Règle « visité sans action = bon » : **seuil de 0,8 s** de visite.

## Conséquences

- La signature des 30–40 mm caractérise **l'extraction dans les PN non contrôlés**, et non un humain. À vérifier dans les exports : les cuts concernés devraient avoir `SeenByOperator` faux au départ (vert sur la carte). Le contrôle « écartement à plus de 10 mm de la médiane » (54/54, D-135) est donc un détecteur d'extraction fausse en PN.
- Règle métier n° 3 renforcée : **dans un PN, contrôler chaque cut, marges comprises, sans en sauter un** ; un PN partiellement contrôlé laisse des erreurs de 30–40 mm.

## Second projet, partie 1 (Écho de Mic du 16/10, après le lot Orbite 4.9.5.3)

Notes de Mic :
- **SKIP obligatoire** sur les cuts 0, 1, 2 et 3 : il manque des points, ou un seul scanner est visible sur l'une des deux coupes. Mic l'indique pour mémoire : ce n'est pas une priorité pour Ariane si cela complique.
- Ce projet a bien **3 scanners** (correction de Mic ; il avait d'abord parlé de 2).
- Zones d'ADV :

  | Zone | Début | Aiguilles | Fin |
  |---|---|---|---|
  | 1 | 116 (marge comprise) | 136, à gauche | 165 (marge comprise) |
  | 2 | 271 (marge comprise) | 287, à droite ; fin d'aiguille 320, à gauche ; 552 ; 616, à droite ; fin d'aiguille 626 | non déclarée : succession d'ADV plus ou moins espacés, zone « bordélique », Mic contrôle tout |
  | 3 | 2911 | 2932, à gauche ; 3012 | 3036 |
  | 4 | 5496 | 5520, à droite ; 5591 ; 6159 ; fin d'aiguille 6160 | non précisée |

- Dans la zone 2, certains cuts sont en SKIP au titre d'une règle métier que Mic ne prévoit pas pour le cahier 5.0.
- **Cause probable de nombreux invalides de la zone 2 : le bon rail est hors de la fenêtre ESV visible par Ariane.** Sans pouvoir se déplacer, il est impossible de poser. Mic se déplace soit en dézoomant, soit, le plus souvent, en se décalant d'un côté ou de l'autre par un glisser au clic gauche de la souris.

## Conséquences pour la 5.0

- **Nouvelle capacité candidate, « déplacer la vue »** : quand aucun rail sûr n'est dans la fenêtre, se décaler latéralement, comme Mic au clic gauche, ou dézoomer, puis chercher de nouveau. La trace doit rester celle d'un humain : un glisser de souris est un geste humain ordinaire. À mesurer d'abord : quelle part des différés de ce lot ont leur bon rail hors fenêtre (pose de Mic hors du cadre de capture) ?
- Règle SKIP (points manquants, ou un seul scanner sur une coupe) : à consigner comme règle métier, priorité basse.
- ADV : les marges de Mic vont d'environ 20 cuts (zone 1, aiguille au 136 : de 116 à 165) à des zones entières contrôlées sans fin déclarée.
- Réponses de Mic (16/10) : **PN aux cuts 405–409** ; les cuts 388–396 et 447–449 ne sont pas des PN. Le cut 428 a un écartement final de **1 441 mm**. Les cuts validés puis SKIP restent en SKIP ; sans importance.
