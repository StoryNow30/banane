# CH-124 : parité banc / service worker du levier N, 12/11 partie 23

Outil : `tools/parite-l1se-sw.cjs --passe`, **sans `--leviers`** (vrai `background.js` en vm, nuages réels, ESV simulé, deuxième passe en ombre).
Arbre : `integration/vision18-n-aj5` (1bc4532) : tronc + `ancre.patch` + `sw-ancre.patch` tels quels + recette livrée v7 (`ancre:true`) + ajustement de hauteur éteint. N y est allumé sans réglage, comme chez l'opérateur.
Liste : celle du départ du lot, reconstituée par `outils/liste-depart.cjs` (5 500 lignes ; les 311 cuts du lot à leur pose de départ, sans drapeau et invalides : 311 invalides, comme la fiche de départ du lot), la même pour le banc et le service worker.
Durée : banc 479 s, service worker 5 848 s. Sortie de l'outil : `parite-1211-p23-sortie-outil.json`.

## Verdict : BON (ÉTABLI)
| | lignes |
|---|---|
| identiques (état ; si posé des deux côtés : source, pose à 0,05 mm, passe) | **296 sur 311** |
| différentes | 15 |
| dont déjà différentes à l'éteint (parité de CH-121, fdba60b, `parite-e-1211-p23.txt`) | **15 sur 15**, identiques une à une (cut, état et source des deux côtés, motif, écart en mm) |
| propres à N | **0** |

- **Les 15 refus d'ancre du banc sont différés des deux côtés** : 3694, 3695, 3747, 3748, 3749, 3750, 4672, 4673, 4675, 5132, 5133, 5204, 5210 (première passe : 4 poses de la chaîne, 9 de la GCV2) ; 5203 et 5209 (deuxième passe). Aucun n'est une ligne d'écart.
- **Deuxième passe** : 9 + 4 poses des deux côtés (à l'éteint : 11 + 4 des deux côtés ; les deux poses refusées font la différence).
- **Au banc**, sur la même liste, N ne change que ses 15 refus par rapport à l'éteint : 296 lignes identiques sur 311.

## Les 15 lignes d'écart, antérieures au levier
| cut | banc | service worker | écart (mm) |
|---|---|---|---|
| 5077 | posé, L1-s (vue) | posé, chaîne | 0 |
| 5078 | posé, L1-s (vue) | posé, chaîne | 0,33 |
| 5079 | posé, L1-s (chaîne) | posé, chaîne | 0,23 |
| 5080 | posé, GCV2 (`recherche-adv`) | posé, chaîne | 0,88 |
| 5081 | posé, GCV2 (`recherche-adv`) | posé, chaîne | 0,56 |
| 5082 | posé, GCV2 (`recherche-adv`) | posé, chaîne | 9,61 |
| 5083 | posé, GCV2 (`recherche-adv`) | posé, chaîne | 9,21 |
| 5084 | différé, GCV2 (`plus-de-150-mm`) | posé, GCV2 | — |
| 5085 | posé, GCV2 (`recherche-adv`) | posé, GCV2 | 0,30 |
| 5086 | posé, GCV2 (`recherche-adv`) | posé, GCV2 | 1,23 |
| 5268 | posé, L1-s (vue) | posé, L1-s (chaîne) | 0 |
| 5269 | posé, L1-s (vue) | posé, L1-s (chaîne) | 0 |
| 5270 | posé, L1-s (vue) | posé, chaîne | 0 |
| 5272 | posé, GCV2 (`recherche-adv-remplace`) | posé, GCV2 | 0,47 |
| 5273 | posé, GCV2 (`ecartement-corrige`) | posé, GCV2 | 9,60 |

Ces 15 lignes sont celles de la parité à l'éteint de CH-121, au centième de millimètre. Elles ne touchent aucun cut refusé.

## Ce que cette parité ne couvre pas
- Elle tourne sans `sw-ancre-liste.patch` (lecture de la liste par l'ancre au départ du lot). Ce correctif ne change pas la liste lue quand elle est en place avant le premier cut, ce qui est le cas de toute parité ; son essai propre est `tests/ch124-ancre-liste-sw.test.cjs`. Une parité courte sur l'arbre corrigé le confirmerait.
- L'écriture vers ESV (plafond de 10) n'est pas jouée par l'outil : la passe y est en ombre.

## Première parité, non retenue comme référence
Lancée avant la correction de la liste du départ (les cuts du lot y étaient à tort « valides », ce qui fausse la référence d'écartement de la GCV2 des deux côtés) : 299 lignes identiques sur 311 ; 12 lignes d'écart, toutes sur les mêmes cuts (5077 à 5083, 5268 à 5270, 5272, 5273), aucune sur un des 11 refus de ce montage ; passe 9 + 4 des deux côtés. Sortie : `parite-1211-p23-ancienne-liste-sortie-outil.json`.
