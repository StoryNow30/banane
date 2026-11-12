# CH-117 : la mauvaise voie à sa source (rapport, D-351)

Branche `chantier/CH-117`, partie de `db936a9`. Aucun fichier protégé n'est touché sur la branche : les changements sont dans `gcv2-voie-adv.patch` (`src/gcv2-l1.js` et ses essais), `sw-veto-chaine.patch` (`background.js` et son essai) et `banc-veto-chaine.patch` (`tools/banc-differes.cjs`). Outils : `outils/autopsie.cjs` et `outils/comparer.cjs`. Sorties par cut (numéros et mm) : `sorties/`. Juge : celui de CH-113 (pire rail, 3D ; juste ≤ 10 mm ; mauvaise voie > 50 mm).

## 1. Autopsie (ÉTABLI, lots de conception 11/11 p16 et 12/11 p23, 19 mauvaises voies au rejeu)
- **Chaîne sur la voie de départ d'ESV (3 racines : 3959, 4508, 3747).** Premier passage sans appui à 3 cuts au plus. ESV part sur l'autre voie et le moteur reste près de la pose de départ. Les voisins posés à 4-6 cuts donnaient la bonne voie.
- **GCV2 sous τ « cohérent », sans voie, en ADV (4 racines : 3694, 4672, 5132, 3966).** Probabilité de 0,07 à 0,36.
- **Bonne paire absente du pool (1 : 5204).** En p16, la vérité n'est jamais dans le pool (de 90 à 185 mm de la plus proche hypothèse) ; en p23, elle y est pour 5 cuts sur 13.
- **Cascades (11).** La chaîne ou la GCV2 suit la racine fausse : appui, voie « proche » à 1-2 cuts. La liste d'ESV n'y joue aucun rôle (aucun appui validé de la liste).

## 2. Correctifs (patchs, leviers coupés par défaut)
- **C1 `vetoChaine`** : en ADV, une pose de la chaîne à plus de 100 mm en travers de la droite des voisins validés du lot (le plus proche à 6 cuts au plus, sinon 8) n'est pas posée ; la GCV2 décide le cut.
- **C2 `sousTauVoieZones`** : en ADV, un sous-τ « cohérent » n'est validé que si une voie de voisins le porte à 40 mm au plus.
- **C5 `vetoVoieAbsMaxCuts`** : la garde de voie absolue de la GCV2 tranche aussi avec un voisin à 7-8 cuts.
- **Rejetés** : C3 (premier passage sans voisin en ADV) passe les différés de p16 de 45 à 257 ; C4 (GCV2 sans voie en ADV) aussi.
- **Réglage figé** avant tout jugement : `reglage-fige.json`, commit `4d4fbc7`.

## 3. Jugement du réglage figé (passe éteinte)
| Lots | > 50 mm | justes > 10 mm | justes différés | différés |
|---|---|---|---|---|
| Conception (11/11 p16, 12/11 p23) | 19 → 6 (+1 : 16/4510) | 0 | 7 | 90 → 106 |
| Non vus chez moi (10 lots : 11/11 p15, p17 ; 06/11 p13, p15, p16 ; 08/11 p6 ×2 ; 12/11 p0, p1, p2) | **10 → 0**, aucun nouveau | 0 | 2 (7268, 9126) | 97 → 92 |
| Banc complet de CH-116 (message de l'intégrateur) | non vus 10 → 0 ; examen 05/11 identique au livré ; total 29 → 6 | — | bons bloqués 4 → 12 | — |
- **Éteint = livré.** 12/11 p23 : 311 cuts sur 311 identiques (hors le temps de calcul). Banc de CH-116 : 4 016 sur 4 016.
- **16/4510** :
  - Chez livré, son seul appui était 4508, faux, à 2 cuts : différé.
  - C1 retire 4508. 4510 n'a plus d'appui et passe en premier passage sans garde, à 168 mm de la vérité. C'est une conséquence du retrait de 4508 (ÉTABLI).
  - Pourquoi C1 ne le retient pas : SUPPOSÉ. Ses voisins sont à 7-8 cuts et leurs poses zigzaguent ; ce n'est pas mesuré.

## 4. Garde de pose (`garde-gcv2 --rejouer`, 11 lots d'octobre, deuxième passe livrée) : ROUGE
- **Éteint : retour 0.** Aucun recul ; mêmes signalements que le code du tronc.
- **Figé : retour 1, 20 reculs.**
  - 2-18 204 : de 2,0 à 11,5 mm.
  - 2-11 8285, avec passe : de 5,3 à 11,2 mm.
  - Nouvelle mauvaise voie avec passe : 0-2310-lot1 1358 (144 mm).
  - Cuts sans pose : 25 → 31.
  - 14 verts changés non jugés, dont 2-18 203, 451 et 0-2310 1359 : la chaîne y est vetoée à 190-230 mm, et la GCV2 pose environ 200 mm plus loin.
  - Gains : mauvaises voies du terrain du 23/10 de 5 à 2 sans passe, de 5 à 3 avec passe ; 6 cuts nouvellement posés justes en 3-0.
- **Attribution** (sans retouche du réglage figé) :
  - **C1 seul : 17 reculs.** Il porte 2-18 204, 1358, 940 (de 2,1 à 6,0 mm) et tous les verts changés. Lecture PROBABLE : quand les voisins validés sont eux-mêmes sur l'autre voie, C1 retire une pose juste de la chaîne.
  - **C2 + C5 seuls : 7 reculs, aucune nouvelle faute, aucun vert changé.** Coût : 5 justes différés (2-11 8283-8285, 2-17 9800, 9803), cuts sans pose de 25 à 30 ; avec passe, 2-11 8285 passe de 5,3 à 11,2 mm. Gain : mauvaises voies du 23/10 de 5 à 3, sans comme avec passe.
- Les octobre comptent désormais comme vus.

## 5. Parité banc / service worker (`parite-l1se-sw --passe`)
06/11 p15, éteint et figé : 161 lignes sur 161 identiques, deuxième passe comprise (figé : 4 + 1 poses de passe des deux côtés). 12/11 p23 : en cours au moment d'écrire, résultat envoyé à part.

## 6. Ce que je propose
- **Le réglage figé ne s'allume pas** : il ne passe pas la garde.
- **C1 reste coupé.** Son mode d'échec (voisins faux) est PROBABLE et non jugé. Il ne doit pas devenir une règle sans un examen qui le juge.
- **C2 + C5 est un candidat plus propre, mais c'est un NOUVEAU réglage.** Il faut l'écrire et le figer, puis le juger sur des lots qu'il n'a pas vus : les prochains Échos. Il n'a pas été jugé seul sur les lots récents.
- **Reste :**
  - la bonne voie hors du pool (p16 : de 90 à 185 mm) : seule la recherche peut la trouver ;
  - les cascades sur une racine fausse ;
  - 16/4510 ;
  - le coût en différés de C2 (sous-τ justes sans voisin, par exemple 16/5897).
