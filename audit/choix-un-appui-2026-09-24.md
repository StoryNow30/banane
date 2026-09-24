# Relecture du lot 2 de la partie 31 : un faux, le choix à un seul appui

**24 septembre 2026.** Lot Pilote 4.7.9 de la fin de la partie 31 (78 cuts
distincts, arrêté), relecture Natif 4.7.9 de l'opérateur (10 segments, 236
visites, 122 cuts validés). Jugement aux règles D-038 et D-040.

## 1. Jugement

| | Cuts | Faux / jugés |
|---|---|---|
| Pilote 4.7.9, appliqués | 47 / 78 (60,3 %) | **0 / 45** (14 validés, 31 acceptés sans retouche) |
| Décision sur le lot, consignée (parité 78/78) | 72 / 78 (92,3 %) | **1 / 69** |

C2 des rails validés : latéral médiane 0,1 mm, p90 4,7 mm (max 8,6) ; vertical
0,1 / 4,9 mm (max 8,6). Écartement : 16 paires refusées, 0 appliquée hors
contrat. Relevés : `audit/acceptance-p31b-2026-09-24.{json,md}`.

**La condition de la 4.7.10 n'est pas remplie** (D-041 : 0 faux sur les cuts
que la décision ajoute). Le faux est le cut **7026**, rail droit à 20,1 mm.

## 2. Le cut 7026

- Pilote : différé (ambiguïté gauche). Décision sur le lot : **CHOIX**, avec
  **un seul appui**, le cut 7023, à trois numéros (3 m).
- La voie prédit bien : le rail droit validé est à **3,2 mm** de la
  prédiction, le gauche à 10 mm.
- Mais le moteur n'a **aucun minimum** à la vraie position du rail droit :
  ses minima sont à −14 et +70 mm de la prédiction. Le seul minimum à moins de
  15 mm, à −14 mm, est à **17 mm** du rail validé. Il est choisi, seul dans la
  tolérance, avec assez de points (59 de dessus, 39 de flanc).
- À gauche, le minimum choisi (−13,4 mm) est à 3,4 mm du rail validé.

Le choix a obéi à sa règle ; c'est la règle qui laisse passer un minimum à
14 mm d'une prédiction juste. Écartement de la paire choisie : 1 408,3 mm,
admissible : le contrat ne joue qu'en admissibilité, il ne pouvait pas et
ne doit pas l'arrêter.

## 3. Toutes les décisions relues, par étape et par nombre d'appuis

`tools/choice-anchor-study.cjs` rejoue la décision sur le lot, en un seul
passage, sur les 3 lots Pilote relus (rejeu de l'outil d'acceptation, D-040)
et sur 6 sessions Natif (banc, référence stricte). Relevé :
`audit/choice-anchors-2026-09-24.json`.

| Étape · appuis | Décidés | Faux / jugés |
|---|---|---|
| Premier passage · 0 | 131 | 3 / 97 |
| Premier passage · 1 | 118 | 0 / 81 |
| Premier passage · 2 | 228 | 2 / 163 |
| Reprise depuis la voie · 1 | 15 | 0 / 14 |
| Reprise depuis la voie · 2 | 30 | 0 / 22 |
| **Choix · 1** | **31** | **1 / 19** (7026) |
| Choix · 2 | 27 | 0 / 23 |

Les cinq faux du premier passage sont tous au banc Natif de la partie 20
longue (241, 398, 402, 409, 983) : ce sont les faux déjà connus du moteur
depuis la pose ESV (cahier 4.8, audit de mi-parcours). Le Pilote les commet
déjà aujourd'hui ; ce n'est pas un ajout de la décision sur le lot. Sur les
trois lots Pilote : 0 faux sur 93 premiers passages jugés.

## 4. Deux règles mesurées, et leurs limites

Un choix n'est jamais appui : l'écarter ne change aucune autre décision, la
mesure par filtre est exacte.

| Règle | Choix écartés | dont justes | dont faux | Toutes données |
|---|---|---|---|---|
| Actuelle | — | — | — | 6 faux / 419 (dont 5 du moteur, §3) |
| **Choix : 2 appuis au moins** | 31 | 18 | 1 | 5 / 400 |
| Choix : 10 mm de la prédiction au plus | 2 | 1 | 1 | 5 / 417 |

- **Deux appuis au moins.** Avec un seul appui, la prédiction n'est qu'une
  translation : elle ne donne pas la direction de la voie. Règle de principe,
  qui coûte 18 choix justes sur toutes les données ; sur le lot 2, 66 cuts
  sur 78 au lieu de 72.
- **10 mm au plus.** Elle vise le mécanisme exact de 7026, mais son seuil est
  lu sur 7026 lui-même (13,4 et 14 mm) et elle écarte aussi un choix juste à
  14 mm. Ajustée après coup : à ne pas retenir sans lot neuf.

Les deux sont décidées **après** avoir vu 7026. Seul un lot neuf, relu,
dira si elles tiennent. Les appuis validés avec la garde ne changent rien à
7026 : ses voisins validés ne passent pas la garde, il reste à un appui
(`audit/validated-anchors-p31b-garde-2026-09-24.json` : 72 / 78, 1 faux / 68).

## 5. Ce que cela change pour la 4.7.10

La règle d'arrêt s'applique : la 4.7.10 ne sort pas sous la forme prévue.
Trois formes possibles, à décider par la direction :

1. **Premier passage gardé + reprise depuis la voie** ; le choix reste
   consigné sans commander. 0 faux ajouté sur toutes les données ; lot 2 :
   62 / 78.
2. **La même, plus le choix à deux appuis au moins** ; le choix à un appui
   reste consigné. 0 faux sur 23 choix jugés à deux appuis ; lot 2 : 66 / 78.
3. Attendre un nouveau lot en observation (4.7.9 telle quelle).

Dans les cas 1 et 2, le premier lot 4.7.10 relu fait foi : un seul faux parmi
les cuts que la 4.7.9 n'aurait pas placés, et le Pilote repasse en
observation.
