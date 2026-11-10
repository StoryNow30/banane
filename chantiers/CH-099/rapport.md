# CH-099 : rapport (10/11/2026) — la recherche large en mode « différer », rejouée hors ligne sur les fautes des 06 et 08/11

**Effectif et biais, d'abord.** 7 lots des 04, 05, 06 et 08/11 : 3 309 cuts posés, dont 360 jugés par l'Écho (10,9 %), **choisis par l'opérateur**. 10 fautes de plus de 50 mm, en 5 séries, sur 3 parties et 2 journées, toutes en appareil de voie. Ces parties ont déjà été lues cut par cut (apprentissage, D-322) : rien ici n'est un examen, tout est **PROBABLE au mieux**. La règle et ses seuils sont ceux de CH-034, figés le 01/11, avant ces lots ; les trois variantes, les mesures et les seuils du verdict sont dans `plan.md`, commité avant tout calcul. Aucun réglage n'a été touché, `src/recherche-large.js` est appelé tel quel, une lecture par variante. Qualifications : ÉTABLI = compté par `tools/ch099-rejeu.cjs` ; nombres par cut dans `sorties/`.

## 1. Verdict (seuils du plan § 6) : candidat pour l'ombre, de justesse
| Variante (soutien du dessus) | fautes différées | posés différés | poses jugées justes différées (avec / sans « visité sans action ») | 10 à 50 mm différées |
|---|--:|--:|--:|--:|
| S0 (règle examinée par CH-034) | 8 sur 10 [49 ; 94] % | 98 sur 3 309 (3,0 %) | 14 sur 331 / 9 sur 257 | 0 sur 19 |
| **S60 (variante du verdict)** | **7 sur 10 [40 ; 89] %** | **37 sur 3 309 (1,1 % [0,8 ; 1,5])** | **4 sur 331 (1,2 %) / 4 sur 257** | 0 sur 19 |
| S90 | 7 sur 10 | 27 sur 3 309 (0,8 %) | 3 sur 331 / 3 sur 257 | 0 sur 19 |

- Seuils : au moins 7 fautes sur 10 et moins de 8 % de posés différés : **tenus par S60, à une faute près** (une faute de moins et la règle n'est « ni candidat ni abandon »). 5 séries rejouables (il en fallait 3). ÉTABLI ; la portée est PROBABLE.
- Par série (S60) : 08/11, cut 220 : différée ; 08/11, cuts 360-361 : différée ; 06/11, partie 16, cuts 9266 à 9272 : 4 fautes sur 5 ; 06/11, partie 15, cut 7260 : non ; cut 7423 : non (S0 la diffère). Deux séries sur cinq sont entièrement différées, trois sur cinq sont touchées.
- Les 3 fautes gardées : 7260 (aucune paire forte près de la vérité, la plus proche est à 130 mm) ; 7423 (la meilleure paire est à 16 mm de la vérité mais pauvre, 36 à 39 points de dessus) ; 9272 (la bonne paire existe, à 3,7 mm de la vérité, mais la pose fausse est une paire forte mieux ajustée). Les 5 fautes posées par la chaîne sont toutes différées ; 2 sur 5 de celles posées par la décision L1-e.
- Préalables : la capture couvre ±400 mm en travers pour les 3 cuts du 08/11 et pour 3 307 posés sur 3 309. **Nuages pauvres** : 590 posés sur 3 309 n'ont aucune paire forte (06/11 : 408 sur 1 078 ; 05/11 : 169 sur 831 ; 04 et 08/11 : 13 sur 1 400) ; le levier y garde la pose par défaut. Aucune des 10 fautes n'est dans ce cas (le critère d'abandon « nuages trop pauvres » ne joue pas).
- Coût par lot (S60) : de 0 à 2,8 % des posés ; 26 des 37 posés différés ne sont pas jugés.

## 2. Face aux trois gardes en ombre (ÉTABLI ; source : événements du journal, garde de voie rejouée)
| | fautes (10) | justes signalées (331) | posés signalés (3 309) |
|---|--:|--:|--:|
| garde « après un différé » | 4 | 33 | 59 |
| grappe | 4 (les mêmes) | 31 | 47 |
| garde de voie (seuil calé par CH-079 sur ces 3 cuts) | 3 | 4 | 41 |
| les trois réunies | 6 | 44 (13,3 %) | 109 (3,3 %) |
| recherche large S60 | 7 | 4 (1,2 %) | 37 (1,1 %) |
| union | 8 | 46 | 137 (4,1 %) |

La recherche large seule attrape 2 fautes qu'aucune garde ne voit (9266, 9267) ; les gardes seules en attrapent une qu'elle manque (7260) ; 7423 et 9272 échappent à tout.

## 3. Seconde chance : banc conjoint, deuxième passe livrée (6 lots porteurs des séries, 1 094 cuts, S60)
- Fidélité du rejeu (profil base contre la pose réelle, 700 poses) : médiane 0,4 mm, 5 poses à plus de 2 mm. ÉTABLI.
- De bout en bout, poses jugées : témoin 114 justes, 16 entre 10 et 50 mm, **10 fautes** ; avec le levier 124 justes, 15, **3 fautes** (sans « visité sans action » : 87 / 16 / 10 contre 97 / 15 / 3). Posés : 1 026 contre 1 027 ; différés : 68 contre 67. Aucune faute nouvelle.
- Sort des 10 fautes : 3 restent posées fausses (7260, 7423, 9272) ; **4 sont reposées justes** (9266 à 1,8 mm, 220 à 3,0 mm, 360 à 2,9 mm par la passe ; 361 à 9,4 mm par la GCV2, son voisin faux n'étant plus un appui) ; 3 restent différées (9267, 9270, 9271).
- Plafond D-259 : dans le lot du 08/11 la passe poserait 15 cuts avec le levier (7 sans) ; les 5 au-delà du plafond, dont le 360, resteraient différés.
- Prix : 14 cuts différés par le levier, 5 reposés par la passe, 9 restent sans pose : les 3 fautes, 3 poses justes (9160, 9162, 182), 1 différé réel que la passe posait à 6,5 mm (170), 2 non jugés. Effets indirects (appuis changés) : 59 cuts changent, 34 jugés, 8 meilleurs de plus de 2 mm, 3 pires (9175, 9176, 9178 : de 0,3 à 3,3 mm vers 17 à 19 mm). Poses de la passe avec levier : 24, 18 jugées, 16 justes, 2 entre 10 et 50 mm, 0 faute (borne haute 17,6 %).
- B1-écart sur les cuts différés par le levier : À COMPLÉTER.

## 4. Constat à part : les « 4 poses fausses sans la garde » des 04 et 05/11 ne sont pas fausses (ÉTABLI, trois lectures)
CH-056 § 2 et CH-057 § 3 comptent 14/4135 et 4136 à 60 mm, 8/2734 et 2735 à 33 et 35 mm. La pose que le lot allait valider (journal) et celle du banc sans garde (identiques à 0,1 mm) sont à **2,7 ; 3,5 ; 0,5 ; 2,7 mm** de la pose finale de l'opérateur. Les 53 à 61 et 33 à 35 mm sont le déplacement depuis la pose de départ : l'Écho, arrivé après l'écriture de la deuxième passe, a vu la pose de la passe (écartement vu en arrivant 1 453,2 et 1 442,8 mm ; écrit par la passe 1 453,1 et 1 442,7 ; un vrai différé voisin montre 1 500) et sa correction (10,2 ; 3,5 ; 0 ; 0 mm) part de là, pas du départ. La population « 4 poses fausses » du ticket ne porte donc aucune faute ; sur les 35 cuts retenus par la garde alors active, 19 sont jugeables : 18 justes, 1 à 10,9 mm. À refaire par l'intégrateur avant de corriger ces deux rapports (`sorties/constat-poses-sans-garde.json`).

## 5. Contrôles
- Rejeu indépendant (second agent, script écrit sans lire le premier, 536 cuts dont tous les jugés) : 1 608 décisions, **0 désaccord**, poses identiques.
- Juge commun de CH-100 (commit 3d265c2, repris avec la ligne d'export de `tools/juger-lot.cjs` dont il dépend) : 0 désaccord sur 3 168 posés, mêmes 360 jugés, mêmes 10 fautes, mêmes 5 séries. Comptes du 06/11 (1 078, 108, 7) et du 05/11 (831, 229 dont 18 écartés D-285, 0) retrouvés.
- Critique adverse : À COMPLÉTER.

## 6. Limites et suite
- Dix fautes, cinq séries, deux journées, des jugés choisis : un taux de 7 sur 10 ne distingue pas 40 % de 89 %. Le coût en poses justes repose sur 331 jugés, dont 229 d'une journée sans faute.
- La partie 11 du 05/11 est dans les jugés du ticket ; le manifeste nomme « projet 1, partie 11 » comme témoin sans dire si c'est le même projet. Non établi ; signalé.
- Non mesuré : le temps dans le navigateur (hors ligne : 0,6 s par cut en médiane pour les trois variantes) ; la garde de voie sur les cuts retenus par la garde active.
- **Proposition** (décision de l'opérateur, D-275 tient) : consigner la recherche large **en ombre**, soutien 60, sur chaque pose, sans rien différer, et la juger à la prochaine relecture Écho tirée au sort. Critères à écrire avant : au moins 7 fautes sur 10 différées, moins de 8 % de posés différés, et moins de 3 % de poses justes différées.
