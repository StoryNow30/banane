# CH-118 : biais latéral à un rail, sur le corpus de CH-116 (12/11)

Outil : `outils/lateral-corpus.cjs` sur `chantiers/CH-116/sorties/corpus.jsonl` (branche `chantier/CH-116`). Écart = pose finale − pose d'Ariane, repère profil de la pose de départ. Écartement = écartement de départ − (lat droit − lat gauche), calibré sur 117 cuts des jointures des 11 et 12/11 (|écart| moyen 1,0 mm). Mauvaises voies (> 50 mm) exclues : CH-117. Lot d'examen 0511 exclu de l'analyse (voir § 4).

## 1. Constat (ÉTABLI, 328 posés jugés hors examen)
- 105 posés au-delà de 5 mm ; 47 sont un **seul rail faux en latéral** (rail > 5 mm, latéral dominant, autre rail < 2 mm), |lat| médian 7,2 mm. Sens : 18 vers l'intérieur, 29 vers l'extérieur.
- **L'étage le porte** : `deferred` (cut d'abord différé par la chaîne, posé par la GCV2 dans le lot) a 49 des 105 retouches au-delà de 5 mm et 16 au-delà de 10 mm, pour 122 jugés. `first-pass` : 29 au-delà de 5 mm pour 132, écartement juste en médiane (Δ 0,0).
- Dans `deferred`, l'erreur d'écartement **change de signe selon la zone** :
  - en abords, trop large : Ariane 1 441,0 → opérateur 1 436,4 en médiane ; 18 resserrés de plus de 3 mm contre 1 élargi (surtout le rail gauche : 06/11 p13, 11/11 p16 5854-5856) ;
  - en ADV, trop étroit : 1 437,3 → 1 441,5 ; 22 élargis contre 7 resserrés ;
  - en PN, élargi par l'opérateur (5 cuts, +5,5 mm) ; toutes étapes confondues, 8 PN à un rail sur 8 sont élargis, mais il s'agit de 4 séries d'un même lieu chacune, et 12 PN sont justes à 2 mm.

## 2. Références essayées pour prédire l'écartement vrai (ÉTABLI, médiane |référence − vérité|)
| `deferred` | pose d'Ariane | voisins posés avant, non différés (±10 cuts) | départ d'ESV | 1 435 nominal |
|---|---|---|---|---|
| abords (40) | 2,8 | 3 couverts sur 40 : 4,8 | 63,2 | 2,3 |
| ADV (77) | 0,0 (p90 10,0) | 51 couverts : 7,4 (29 pires, 7 meilleurs de 2 mm) | 57,9 | 7,9 |
Aucune référence ne bat la pose d'Ariane, sauf le nominal en abords, de 0,5 mm en médiane. Même conclusion que CH-042 (§ 3 et § 9) : l'écartement réel varie d'un cut à l'autre en appareil de voie, et les voisins ne le disent pas.

## 3. Une règle chiffrée, puis abandonnée
« `deferred`, abords, écartement > 1 440 : rail gauche ramené à 1 437 » : hors examen, 22 cuts touchés, ≤ 10 mm 18 → 21 (3 gagnés, 1 perdu), 4 dégradés de plus de 5 mm, 3 justes déplacés, aucun au-delà de 20 mm. Sur 0511 : 38 touchés, 37 → 35 (0 gagné, 2 perdus), 11 justes déplacés. **Ne tient pas** ; aucune autre variante (rail droit, les deux rails, seuil 1 442) ne gagne sur les deux jeux.

## 4. Faute de méthode à signaler
Le jugement de 0511 au § 3 a été affiché dans la même commande que la mise au point, sans réglage figé ni écrit avant. Pour toute règle d'écartement en abords de cet étage, **0511 n'est plus un examen jamais vu** ; un tel levier devra être jugé sur un Écho neuf. Les autres familles de leviers ne sont pas touchées.

## 5. Verdict
Le biais latéral à un rail est un écartement faux des poses de la GCV2 dans le lot, de sens opposé en abords et en ADV, sans prédicteur dans le corpus. Pas de patch. Levier latéral clos avec ses chiffres ; à rouvrir seulement avec une information nouvelle sur l'écartement réel du cut (et non sur les voisins).
