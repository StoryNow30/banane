# CH-113 : apprentissage des cuts des Échos des 11 et 12/11 (rapport, D-346, méthode D-222)

Étude hors ligne, au banc (`tools/banc-differes.cjs rejouer`, profil livré L1-se). Aucun fichier de l'extension changé : les leviers sont dans `leviers-ch113.patch` (fichier protégé `src/gcv2-l1.js`, tous **éteints par défaut**), rejoués dans une copie hors dépôt. Outils : `outils/` (juge, fidélité, différence de deux rejeux, mesure du consensus). Sorties par cut (numéros et millimètres) : `sorties/`, à verser dans `banane-data/outils/analyse-lots/CH-113/`. Juge unique : pire rail, distance 3D, juste ≤ 10 mm, mauvaise voie > 50 mm ; vérité = `garde-gcv2 verite --avec-regle` (vus sans action comptés justes).

## 1. Inventaire (ÉTABLI)
| Partie (lot 11/11, Écho 12/11) | posés jugés | ≤ 10 | 10-50 | > 50 | différés corrigés | hors lot > 10 mm |
|---|---|---|---|---|---|---|
| 15 | 19 / 96 | 19 | 0 | 0 | 8 / 8 | 4 |
| 16 | 329 / 378 | 318 | 4 | 7 | 42 / 42 | 42 |
| 17 | 33 / 43 | 32 | 1 | 0 | 1 / 1 | 13 |
Taux d'apprenables (CH-049) : p15 77,8 % ; p16 borne basse (Écho partiel : 32 nuages sur 11 970), d'où le rejeu sur les captures du lot. Échos antérieurs utilisés en garde seulement (05, 06, 08/11 : 13 lots, 11 parties).

## 2. Cible (écrite avant le premier rejeu)
0 nouveau posé > 50 mm ; aucun juste passé > 20 mm ; ≥ 97 % des posés jugés ≤ 10 mm ; différés ≤ 41 sur p15-17 (réel 51), chaque reposé ≤ 10 mm. Garde : mêmes conditions sur les Échos antérieurs. **Non atteinte.**

## 3. Fidélité du rejeu (ÉTABLI)
Décisions identiques au lot réel : p15 105/105, p16 419/421, p17 45/46 ; poses à 1 mm 95/96, 372/376, 42/44. Neuf cuts non fidèles, tous en ADV à l'étage GCV2 ou vue déplacée (p16 1294, 4501, 4565, 4566, 4571, 4572 ; p17 551) : même référence d'écartement et mêmes paramètres ; cause SUPPOSÉE (nuage après déplacement de vue, quasi-égalité de probabilités), non établie. Lots anciens : 1 999/2 057 (versions plus anciennes du code).

## 4. Classement des 57 différés du banc (pool d'hypothèses contre l'opérateur)
A, paire des deux rails à 10 mm dans le pool : 11 · B, un seul rail : 23 · C, aucun : 18, tous en ADV (zones de CH-112) · non examinés : 2.

## 5. Leviers essayés (banc, cuts fidèles, contre le code livré)
| Levier | 11/11 p15-17 | Garde 05-08/11 | Verdict |
|---|---|---|---|
| **A** départ hors contrat exclu (`departHorsContratExclu`) | différés 57 → 55 ; 4901 à 2,1 mm, 5896 à 6,0 mm ; 4503 dégradé 2,9 → 9,9 mm | différés 101 → 100 ; 3699 à 3,9 mm ; 9261 4,2 → 8,7 mm ; 4 posés ADV non jugés déplacés ; 0 > 50, 0 juste > 20 | **tient la garde** ; gain 3 cuts sur 26 parties |
| B complétion par l'écartement (abords) | 7 reposés, 3 justes, pire 14,9 mm ; B lui-même 1 pose, le reste en cascade du consensus livré | — | rejeté |
| B, cascade coupée | 5846 à 7,9, 5847 à 13,0 | — | rejeté |
| B, rail confirmé par le nuage (±25/±15 mm) | B : 5847 à 6,0 ; cascade 4 justes, pire 14,9 | — | 1 cut au mieux |
| B toutes zones (démonstration) | 3967 ADV à 140,1 mm (classe C) | — | interdit hors abords |
| Sous-τ cohérent à 11 mm (toutes zones) | 7 reposés, 5 justes ; 5850 à 12,1 et 5851 à 14,9 mm (cascade du consensus) ; 5855 et 5857 déplacés au-delà de 10 mm | — | rejeté |
| Sous-τ cohérent à 11 mm, abords, borné par les cuts sûrs du lot | 0 changement (7532, 7802 sans cut sûr à 12 cuts) | — | sans effet |

**Classe A (PROBABLE comme lecture, chiffres ÉTABLIS)** : 5 des 7 cas « sous τ » ont la bonne paire choisie (1,6 à 3,6 mm) ; ce qui les bloque est l'écart de 8,1 à 20,5 mm entre leur écartement et celui de la liste, pas τ.

**Consensus livré** (code du tronc, 26 parties) : 19 poses, 10 jugées : 7 justes, 2 de 10 à 50 mm (11/11 p16 5856 à 13,3 ; 08/11 p6 231 à 16,9), 1 mauvaise voie (11/11 p16 3968 à 153,7 mm, zone de CH-112). Toutes ont un voisin GCV2 à 2 cuts au plus. Effectif trop faible pour régler « deux voisins » ou « sans le plus récent » : aucune proposition.

## 6. Ce qui reste et pourquoi
- 18 différés C (ADV, pool sans le bon rail) et les 7 mauvaises voies de p16 : CH-112 et CH-114.
- 23 différés B : rail manquant absent du nuage capturé ou trop peu soutenu ; le compléter par l'écartement pose à 12-15 mm (hauteur et écartement réels ≠ prédits) ; la série p15 5075-5247 n'a aucun cut sûr du lot à 12 cuts.
- 9 différés A restants : bonne paire présente mais écartement en désaccord avec la liste ; sans cut sûr du lot à proximité, aucune borne indépendante.

## 7. Ce que je propose de livrer
- **Levier A en ombre** : événement au journal « départ hors contrat », sans action. Gain mesuré : 3 différés reposés justes sur 26 parties ; coût : 2 posés justes déplacés de 4 à 7 mm (restés ≤ 10 mm), 4 posés ADV déplacés non jugés. Allumage : accord écrit de l'opérateur après une séance Écho (PROBABLE jusque-là).
- B et sous-τ à 11 mm : éteints, sans ombre.
- Le patch, s'il est retenu, passe par la garde de pose et la parité chez l'intégrateur : diff de `src/gcv2-l1.js` = un levier par bloc, chacun conditionné par une clé à `false`/`null` dans `LEVIERS_V4` (à l’éteint, rejeu identique au code livré : 572 cuts sur 572, état, pose et motif, p15-17, ÉTABLI).

## 8. Validation croisée
Les leviers ont été conçus sur p15-17 du 11/11 et jugés sur les 13 lots des 05-08/11 (déjà lus en apprentissage, D-322) : tout gain reste PROBABLE jusqu'à la prochaine séance Écho.
