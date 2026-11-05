# CH-057 — Apprendre les cuts du 05/11 avec les avancées récentes (05/11/2026)

Branche `chantier/CH-057` (depuis `claude/50-test17`). Hors ligne, EN OMBRE : aucun réglage actif changé, aucun paramètre actif remplacé, aucun fichier interdit touché. D-287 : les parties 8 à 12 du 05/11 (projet 12) sont en apprentissage ; avec les parties 10, 13, 14, 15 du 04/11 (projet 11), **9 parties** apprennent et jugent, aucune n'est réservée. Juge = pose finale de l'opérateur (Écho = union des envois « -auto » ; partie 11:10 : l'export final seul). ÉTABLI = compté par un outil ; PROBABLE = indices concordants ; SUPPOSÉ = non mesuré. Intervalles : Wilson 95 %. Agrégats : `chantiers/CH-057/agregats.json`.

## 1. Jeux (ÉTABLI)
- Jointures Écho ↔ Orbite, jeux `gcv2-jeu` (relecture et usage lot, 0 erreur, copie du moteur à 0 écart) et jeux E5 des 9 parties. 805 cuts calculés, **99 corrections de plus de 10 mm**. Rappel atteignable à 10 mm : 82,8 % (82/99, H0-H6) ; **usage lot 64,6 % (64/99)**.
- Apprenables : **284/750 (37,9 %) strict, 302/750 (40,3 %) assoupli**. Par partie, strict : 11:10 63 %, 11:13 67 %, 11:14 57 %, 11:15 52 %, 12:8 48 %, 12:10 52 %, 12:11 40 %, 12:12 34 %, **12:9 8,6 %**. Cause en 12:9 : 192 états initiaux non qualifiés sur 210 ; pour **187, trop peu de points utiles au moteur** dans l'instantané de départ (`engine-useful-point-count-below-minimum`, et point de contrôle non qualifié). Seuls 77 cuts sur 210 ont une capture mesurée (12:10 : 152 sur 180). La visite n'est pas plus courte (médiane 2,9 s ; 2,4 à 3,9 ailleurs). Première fin de capture : 106 `CLIP_CHANGED`, 68 sans fin anormale. Le nuage manque au critère 3 pour les mêmes 192 cuts (aucun identifiant de capture qualifiée), et aucun n'est récupérable par la définition assouplie. SUPPOSÉ : le nuage n'est pas encore chargé quand l'opérateur passe au cut suivant ; à vérifier sur un Écho de 12:9 avec un temps d'arrêt imposé.

## 2. Voie des différés : `b1-ecart-serie` et ses réglages (ÉTABLI)
Rejeu par partie (`chantiers/CH-057/rejeu.cjs` sur l'outil de CH-056) : grille fenêtre 20/30/50 mm × choix 10/15/30 mm autour du réglage livré (30/15, `voieB1EcartOmbre`).

| différés du lot jugés | n | témoin (lot rejoué) | `b1-ecart-serie` livré | validation croisée (choix sur les 8 autres) |
|---|--:|--:|--:|--:|
| corrections > 10 mm | 67 | 10 justes | **44 justes (65,7 % [54 ; 76])**, 5 faux, 0 > 50 mm | 44/67, 0 > 50 mm sur 49 posés [0 ; 7] |
| tous | 82 | 18 | **58 (70,7 % [60 ; 79])**, 5 faux, 0 > 50 | 58/82, 0 > 50 sur 63 [0 ; 6] |

- Le réglage livré est choisi dans **les 9 plis**. Fenêtre 20 ou 50, choix 10 : mêmes poses à un cut près. **Choix 30 : pire** (41 justes au lieu de 44, et une pose à 117 mm, 11:13/6329). Aucun réglage nouveau : **pas de fichier candidat pour b1-écart**.
- Les 5 faux (10,8 à 31 mm) sont ceux de CH-053-M (11:10/4221, 4224, 4228 ; 11:13/5808 ; 11:15/469) ; les parties du 05/11 n'en ajoutent aucun (12:x : 16 justes sur 22). Sur le 04/11 seul, le rejeu redonne CH-053-M exactement (28/45).
- Le complément par l'écartement **seul** (`ecart-serie`) pose une fois à 130 mm (12:10/4981) : la liste d'ESV d'abord reste nécessaire.

## 3. Garde « après un différé », coupée par D-288 : ce qu'elle retenait (ÉTABLI)
D-288 (opérateur) coupe la garde partout (ombre seulement) : la référence est désormais le lot SANS garde (le témoin du rejeu).
- Lecture A sur les 9 parties = CH-056 à l'identique : 25 retenus (11:13, 11:14, 12:8, 12:10, 12:12) ; hors PN/ADV, 11 jugés, **11 justes [74 ; 100]** : la coupure n'y coûte rien.
- **En PN/ADV, la coupure rend 4 poses fausses en premier passage** (témoin) : 11:14/4135 et 4136 à **60 mm**, 12:8/2734 et 2735 à 33 et 35 mm. Au lot réel, la garde les avait différés et la **deuxième passe en écriture** (D-259) les a écrits à 10,2 / 3,5 / 0 / 0 mm (§ 4). Ni `b1-ecart-serie` ni la passe ne les reprennent sans la garde : elles n'agissent que sur des différés. Apprendre à les poser juste demande une vérification du premier passage, pas une seconde chance. Aucune source mesurée ici ne le fait (la GCV2 figée corrige 11:14/4135 à 5,4 mm en relecture, en ombre ; un seul cas).
- Le reste des séries est rattrapable : 11:14/4131-4134 (différés, 103 à 110 mm) posés justes par `b1-ecart-serie` (5 à 9 mm). En revanche, 12:8/2733 reste différé (la GCV2 figée le poserait à 4,9 mm, en ombre).
- Risque à garder pour le jour où `b1-ecart` écrirait : dans sa chaîne, une garde rétablie ne voit plus de différé avant 11:14/4135 et laisse passer les deux poses à 60 mm. Elle devrait compter les cuts différés par le lot **avant** la seconde chance (PROBABLE, non rejoué).

## 4. GCV2, hauteur, écartement (ÉTABLI sauf mention)
- **Écrit réellement dans ESV par la deuxième passe** (journal, `passe-differes-ecriture` « ecrit ») : **16 cuts** (10 le 04/11, 6 le 05/11, plafond D-259 respecté). Jugés contre la pose vue à la première visite de l'Écho (écritures 15:31Z et 07:46-08:16Z, avant l'Écho) : **4 justes** (11:14/4136 3,5 mm ; 12:10/4070 5,9 ; 12:8/2734 et 2735 0), **3 faux de 10 à 50 mm** (11:14/4135 10,2 ; 12:10/4069 11,2 ; 12:10/4068 20,3), **0 à plus de 50 mm** ; 9 non jugés (4 hors des 9 parties, 3 absents de l'Écho, 2 passés sans décision).
- **GCV2, paramètres actifs** (`gcv2-parametres-h6.json`), jugés HORS LIGNE sur les jeux des 9 parties, usage lot : 367 actions, 27 justes, 8 erreurs, 1 mauvaise voie. **Ce sont des actions d'ombre, aucune n'est écrite** : 342 portent sur des cuts déjà posés (verts et rouges, relecture en ombre `relecture-ombre`), 25 sur des différés. Les 8 erreurs, cut par cut : 11:10/4224 (62,6 mm, la mauvaise voie), 11:13/5808, 5809, 5820, 5872 (11,7 à 35,5 mm) : différés **sans aucun point LiDAR au lot** (motif « input »), calculables ici seulement grâce au nuage de l'Écho, donc ni décidés ni écrits ; 11:14/4148 et 12:11/2701 : hors du lot ; 12:12/7437 : posé par le lot à 8,4 mm (écrit, juste), la correction d'ombre l'aurait porté à 20,5 mm. **0 des 8 erreurs n'a été écrite dans ESV** ; aucune des 16 écritures de la passe n'est parmi elles.
- **Ré-appris** en validation croisée sur les 9 (usage lot) : 33 actions, 5 justes, 0 erreur, 0 mauvaise voie (seule la zone ADV s'active ; règle prudente : 12 actions, 5 justes). Candidat : `datasets/gcv2-parametres-ch057-candidat.json` (non actif). Il n'est pas meilleur en justes et n'a pas vu les 11 parties d'octobre : ne pas le substituer.
- **Hauteur apprise** : 378 rails jugés (6 parties ayant des posés jugés), **2 faux verts** ; aucun modèle ne bat « aucun ». Rien à changer.
- **Écartement de l'opérateur** (distance des deux points de pose, 745 validations) : médiane 1 438 mm, 92,6 % dans 1 430-1 447, 0 hors 1 420-1 470 (PROBABLE : la distance inclut le dévers). La convention 1 435 et la fenêtre de L1-e tiennent. Le modèle appris L1-e (fiche L1 § 4, écarté) **n'a pas été rejoué** : NON MESURÉ.

## 5. Ce que je propose
1. **Rien à activer.** `b1-ecart-serie` garde ses réglages (fenêtre 30, choix 15) ; ses chiffres sur 9 parties sont la référence : 44/67 justes, 0 > 50 mm sur 49 posés (borne 7 %).
2. Garde (D-288) : la coupure coûte, sur ces 9 parties, 4 poses fausses en PN/ADV (2 à 60 mm) que garde et passe avaient rendues justes ou presque. À suivre dans l'ombre `garde-apres-differe-ombre` des prochains lots ; levier à étudier : une vérification du premier passage en PN/ADV après une série différée.
3. GCV2 : ne pas remplacer les paramètres ; réapprendre sur 11 + 9 parties quand les jeux d'octobre seront réunis (coût : reconstruire 11 jeux).
4. 12:9 (8,6 % d'apprenables) : la découpe change pendant la capture ; à suivre par CH-053-C.

## 6. Reproduire
`chantiers/CH-057/rejeu.cjs` (outil de rejeu, version CH-056, au tronc), `synthese.cjs`, `garde-reelle.cjs`, `ecritures-passe.cjs`, `gcv2-fige.cjs`, `agregats.cjs` ; essais `tests/ch057-outils.test.cjs` (7). Jeux dérivés (jsonl, détails, jointures, 86 Mo) : NON versés. L'écriture sur `banane-data` est refusée à cette session, et les jointures portent des coordonnées. Ils restent dans le conteneur de la session et sont reproductibles par ces commandes.
