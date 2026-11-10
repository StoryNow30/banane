# CH-099 : rapport (10/11/2026) — la recherche large en mode « différer », rejouée hors ligne

**Effectif et biais.** 10 fautes de plus de 50 mm, en 5 séries, sur 3 parties et 2 journées (06 et 08/11), toutes en appareil de voie ; 360 posés jugés sur 3 309, **choisis par l'opérateur**. Aucune partie d'examen (D-322) : chaque compte est ÉTABLI (script, nombres par cut dans `sorties/`), sa portée est PROBABLE au mieux. Règle et seuils de CH-034, figés le 01/11 ; variantes, mesures et verdict écrits dans `plan.md` avant tout calcul ; module appelé tel quel. Détails, écarts au plan, contrôles : `annexe.md`.

## 1. Verdict du plan : candidat pour l'ombre, de justesse et sous une condition
Rejeu STATIQUE (la décision sur la pose réellement écrite, le reste du lot inchangé).

| Variante | fautes différées | posés différés : populations du plan / tous les lots lus | justes différées (avec / sans « visité sans action ») |
|---|--:|--:|--:|
| S0 | 8 sur 10 | 62 sur 2 208 (2,8 %) / 98 sur 3 309 (3,0 %) | 14 sur 331 / 9 sur 257 |
| **S60 (verdict)** | **7 sur 10 [40 ; 89] %** | **15 sur 2 208 (0,7 %) / 37 sur 3 309 (1,1 %)** | **4 sur 331 / 4 sur 257** |
| S90 | 7 sur 10 | 14 sur 2 208 (0,6 %) / 27 sur 3 309 (0,8 %) | 3 sur 331 / 3 sur 257 |

- Seuils (au moins 7 sur 10, moins de 8 %) tenus par S60 **à une faute près**. L'intervalle suppose des fautes indépendantes ; par série : 2 entièrement différées sur 5, une à 4 fautes sur 5, 2 manquées.
- **Condition** : le dénominateur 10 suppose le constat du § 4. Avec la lecture de CH-056 (2 fautes de plus, que les trois variantes gardent), S60 fait 7 sur 12 : « ni candidat ni abandon ».
- Là où sont les fautes (06 et 08/11) : 3 poses justes différées sur 116 (2,6 % [0,9 ; 7,3]) ; le 05/11, sans faute, dilue (1 différé sur 831).
- Nuages pauvres : 590 posés sur 3 309 sans aucune paire forte (06/11 : 38 %), où le levier garde la pose ; aucune des 10 fautes n'y est. Fautes gardées : 7260, 7423, 9272.

## 2. Face aux trois gardes en ombre (06 et 08/11 : 1 521 posés, 116 justes, les 10 fautes)
| | fautes | justes signalées | posés signalés |
|---|--:|--:|--:|
| garde « après un différé » / grappe / garde de voie | 4 / 4 / 3 | 33 / 24 / 4 | 59 / 35 / 28 |
| les trois réunies | 6 | 37 (31,9 %) | 84 (5,5 %) |
| recherche large S60 | 7 | 3 (2,6 %) | 19 (1,2 %) |
| union | 8 | 39 | 95 (6,2 %) |

Garde de voie rejouée, son seuil est calé par CH-079 sur 3 de ces fautes. La recherche large voit seule 9266 et 9267 ; les gardes voient seules 7260 ; 7423 et 9272 échappent à tout.

## 3. Seconde chance : banc CONJOINT, deuxième passe livrée (1 094 cuts : les 3 lots des séries et 3 lots voisins, S60)
- Sous le plafond D-259 (10 écritures par lot ; ordre des cuts SUPPOSÉ), poses jugées : témoin 114 justes, 16 entre 10 et 50 mm, **10 fautes** ; avec levier 119, 15, **3 fautes** (sans « visité sans action » : 87 / 16 / 10 contre 92 / 15 / 3). Posés 1 026 contre 1 022 ; différés 68 contre 72. Sans plafond : 124 / 15 / 3.
- Les 10 fautes : 3 restent fausses ; **3 sont reposées justes** (9266 à 1,8 mm et 220 à 3,0 mm par la passe ; 361 à 9,4 mm par la GCV2, son voisin faux n'étant plus un appui) ; 4 restent différées (9267, 9270, 9271, et 360 que la passe reposerait à 2,9 mm au-delà du plafond).
- Mesure M4 stricte : 14 cuts différés par le levier, 5 reposés par la passe, 3 jugés, 3 justes (borne haute 56 %).
- Prix : 5 poses justes perdues (9160, 9162, 182 différées par le levier ; 9274, 9275 par effet indirect), 1 différé réel que la passe posait à 6,5 mm (170), 3 poses justes dégradées à 17-19 mm (9175, 9176, 9178). Aucune faute nouvelle parmi 30 poses changées jugées (borne haute 11 %).
- Fidélité du banc (profil complet, 1 001 poses) : médiane 0,45 mm, 12 poses à plus de 10 mm, 18 états différents sur 1 094 : une part des effets indirects est du bruit de rejeu.
- B1-écart sur les cuts différés par le levier (rejeu fidèle : 50 événements réels sur 50 retrouvés à 0,0 mm ; contrefactuel statique, PROBABLE) : sur les 7 fautes, 2 ou 3 poses justes selon l'hypothèse d'appuis (360 à 2,9 ; 9267 à 0,9 ; 361 à 2,3 mm), les autres sans pose.

## 4. Constat à part : les « 4 poses fausses sans la garde » des 04 et 05/11 (comptes ÉTABLIS, conclusion PROBABLE jusqu'au contrôle de l'intégrateur)
CH-056 § 2 et CH-057 § 3 comptent 14/4135 et 4136 à 60 mm, 8/2734 et 2735 à 33 et 35 mm. Trois lectures : la pose que le lot allait valider (journal) et celle du banc sans garde, identiques à 0,1 mm, sont à **2,7 ; 3,5 ; 0,5 ; 2,7 mm** de la pose finale de l'opérateur ; et l'Écho, arrivé après l'écriture de la deuxième passe, a vu la pose de la passe (écartement vu 1 453,2 et 1 442,8 mm ; écrit 1 453,1 et 1 442,7 ; un différé voisin montre 1 500) : sa correction part de là. Les 53 à 61 et 33 à 35 mm sont le déplacement depuis le départ. Objection : l'opérateur, ancré par la pose de la passe, l'aurait acceptée à tort ; pour 4135 et 4136 la meilleure paire du nuage est à 4,0 et 7,0 mm de sa pose finale, pour 2734 et 2735 il n'y a qu'une validation sans mouvement.

## 5. Contrôles
Rejeu indépendant (script écrit sans lire le premier, 536 cuts dont tous les jugés) : 1 608 décisions, 0 désaccord. Juge commun de CH-100 : 0 désaccord sur 3 168 posés, mêmes 10 fautes. Critique adverse : comptes confirmés, trois erreurs et ses reproches de fond corrigés ici (annexe § 8).

## 6. Proposition (décision de l'opérateur ; D-275 tient)
Consigner la recherche large **en ombre**, soutien 60, sur chaque pose, sans rien différer, et la juger à la prochaine relecture Écho tirée au sort, avec trois critères écrits d'avance : au moins 7 fautes sur 10 différées, moins de 8 % de posés différés, moins de 3 % de poses justes différées. Ce banc ne prouve aucun budget.
