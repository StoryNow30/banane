# CH-057 — Apprendre les cuts du 05/11 avec les avancées récentes (05/11/2026)

Branche `chantier/CH-057` (depuis `claude/50-test17`). Hors ligne, EN OMBRE : aucun réglage actif changé, aucun paramètre actif remplacé, aucun fichier interdit touché. D-287 : les parties 8 à 12 du 05/11 (projet 12) sont en apprentissage ; avec les parties 10, 13, 14, 15 du 04/11 (projet 11), **9 parties** apprennent et jugent, aucune n'est réservée. Juge = pose finale de l'opérateur (Écho = union des envois « -auto » ; partie 11:10 : l'export final seul). ÉTABLI = compté par un outil ; PROBABLE = indices concordants ; SUPPOSÉ = non mesuré. Intervalles : Wilson 95 %. Agrégats : `chantiers/CH-057/agregats.json`.

## 1. Jeux (ÉTABLI)
- Jointures Écho ↔ Orbite, jeux `gcv2-jeu` (relecture et usage lot, 0 erreur, copie du moteur à 0 écart) et jeux E5 des 9 parties. 805 cuts calculés, **99 corrections de plus de 10 mm**. Rappel atteignable à 10 mm : 82,8 % (82/99, H0-H6) ; **usage lot 64,6 % (64/99)**.
- Apprenables : **284/750 (37,9 %) strict, 302/750 (40,3 %) assoupli**. Par partie, strict : 11:10 63 %, 11:13 67 %, 11:14 57 %, 11:15 52 %, 12:8 48 %, 12:10 52 %, 12:11 40 %, 12:12 34 %, **12:9 8,6 %** (192 états initiaux non qualifiés sur 210, dont 106 fins `CLIP_CHANGED`, 68 sans fin anormale ; 0 récupérable par la définition assouplie).

## 2. Voie des différés : `b1-ecart-serie` et ses réglages (ÉTABLI)
Rejeu par partie (`chantiers/CH-057/rejeu.cjs` sur l'outil de CH-056) : grille fenêtre 20/30/50 mm × choix 10/15/30 mm autour du réglage livré (30/15, `voieB1EcartOmbre`).

| différés du lot jugés | n | témoin (lot rejoué) | `b1-ecart-serie` livré | validation croisée (choix sur les 8 autres) |
|---|--:|--:|--:|--:|
| corrections > 10 mm | 67 | 10 justes | **44 justes (65,7 % [54 ; 76])**, 5 faux, 0 > 50 mm | 44/67, 0 > 50 mm sur 49 posés [0 ; 7] |
| tous | 82 | 18 | **58 (70,7 % [60 ; 79])**, 5 faux, 0 > 50 | 58/82, 0 > 50 sur 63 [0 ; 6] |

- Le réglage livré est choisi dans **les 9 plis**. Fenêtre 20 ou 50, choix 10 : mêmes poses à un cut près. **Choix 30 : pire** (41 justes au lieu de 44, et une pose à 117 mm, 11:13/6329). Aucun réglage nouveau : **pas de fichier candidat pour b1-écart**.
- Les 5 faux (10,8 à 31 mm) sont ceux de CH-053-M (11:10/4221, 4224, 4228 ; 11:13/5808 ; 11:15/469) ; les parties du 05/11 n'en ajoutent aucun (12:x : 16 justes sur 22). Sur le 04/11 seul, le rejeu redonne CH-053-M exactement (28/45).
- Le complément par l'écartement **seul** (`ecart-serie`) pose une fois à 130 mm (12:10/4981) : la liste d'ESV d'abord reste nécessaire.

## 3. Garde « après un différé » (ÉTABLI)
- Lecture A (cuts réellement retenus au journal, pose du témoin jugée) sur les 9 parties : **25 retenus, identiques à CH-056** (la garde n'a joué que dans 11:13, 11:14, 12:8, 12:10, 12:12). Hors PN/ADV : 11 jugés, **11 justes [74 ; 100]**, 0 > 50 [0 ; 26]. En PN/ADV : 9 jugés, 5 justes, 2 faux (33, 35 mm), **2 à 60 mm** (11:14/4135, 4136). La proposition de CH-056 (garde limitée aux PN/ADV) est confirmée, sans donnée nouvelle.
- **Interaction mesurée** : dans la chaîne `b1-ecart-serie`, les différés 11:14/4131-4134 sont posés justes (5 à 9 mm) ; la garde ne voit plus de différé avant 4135 et **les deux poses à 60 mm reviennent** (avec la garde livrée comme avec la garde PN/ADV). Sans effet aujourd'hui (b1-écart est en ombre, la garde lit le lot réel). Condition si b1-écart passe un jour en écriture : la garde doit compter les cuts **différés par la décision du lot avant la seconde chance** (PROBABLE suffisant ; non rejoué).

## 4. GCV2, hauteur, écartement (ÉTABLI sauf mention)
- **GCV2, paramètres actifs** (`gcv2-parametres-h6.json`, 11 parties d'octobre), jugés sur les 9 parties, usage lot : 367 actions, 27 justes, 8 erreurs, **1 mauvaise voie** (11:10). **Ré-appris** en validation croisée sur les 9 (usage lot) : 33 actions, 5 justes, 0 erreur, 0 mauvaise voie (seule la zone ADV s'active ; règle prudente : 12 actions, 5 justes). Candidat appris sur les 9 : `datasets/gcv2-parametres-ch057-candidat.json` (non actif, ADV seule). Il n'est PAS meilleur que l'actif en justes ; il n'apprend pas sur les 11 parties d'octobre (jeux absents ici). Ne pas le substituer en l'état.
- **Hauteur apprise** : 378 rails jugés (6 parties ayant des posés jugés), **2 faux verts** ; aucun modèle ne bat « aucun ». Rien à changer.
- **Écartement de l'opérateur** (distance des deux points de pose, 745 validations) : médiane 1 438 mm, 92,6 % dans 1 430-1 447, 0 hors 1 420-1 470 (PROBABLE : la distance inclut le dévers). La convention 1 435 et la fenêtre de L1-e tiennent. Le modèle appris L1-e (fiche L1 § 4, écarté) **n'a pas été rejoué** : NON MESURÉ.

## 5. Ce que je propose
1. **Rien à activer.** `b1-ecart-serie` garde ses réglages (fenêtre 30, choix 15) ; ses chiffres sur 9 parties sont la référence : 44/67 justes, 0 > 50 mm sur 49 posés (borne 7 %).
2. Garde : la restriction PN/ADV de CH-056 reste la bonne proposition ; à son écriture, garder la règle « différé du lot avant seconde chance » pour le jour où b1-écart écrirait.
3. GCV2 : ne pas remplacer les paramètres ; réapprendre sur 11 + 9 parties quand les jeux d'octobre seront réunis (coût : reconstruire 11 jeux).
4. 12:9 (8,6 % d'apprenables) : la découpe change pendant la capture ; à suivre par CH-053-C.

## 6. Reproduire
`chantiers/CH-057/rejeu.cjs` (outil de rejeu de CH-056), `synthese.cjs`, `garde-reelle.cjs`, `gcv2-fige.cjs`, `agregats.cjs` ; essais `tests/ch057-outils.test.cjs` (6). Jeux dérivés (jsonl, détails, jointures) : `banane-data`, `collections/2026-11-05_v5_apprentissage-9-parties/derive/`.
