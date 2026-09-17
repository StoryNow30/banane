# U Hypothesis Lab V1

Lot **EXPÉRIMENTAL**. Branche `lab-u-hypothesis-v1`. Aucun merge, aucune action ESV, aucun searchY global.

- Branche : `lab-u-hypothesis-v1`
- HEAD : `(après commit)`
- Base : `616030b`
- Commande : `node tools/u-hypothesis-lab-v1.cjs`
- Tests : `node tests/u-hypothesis-lab-v1.test.cjs`

**Statut du lot : `INCONCLUSIVE`.** Ce n’est pas un correctif de production.

- Base géométrie : `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` (`src/geometry-baseline.js`)
- Géométrie courante : `981e24b9f217ad7ae9a37f0eec9475e3e3c67ecb99b5f856c37c10622c3ec53f`
- Baseline inchangée : **oui**
- Données : `StoryNow30/banane-data` `infra/materialized-native-v46-v1` `@d541686d3a98569125cdbdb261ef121c9f533d6a`
- searchY moteur : **0.08** (inchangé)
- searchZ moteur : **0.04** (inchangé)
- Failures : **53** / 53 (dont 51 hors-U + 2 exceptions)
- Témoins : **53** / 53
- Durée : 30.5 s

## Question

Le problème dominant (51 supports hors domaine U, |u|≈0,17, searchY=0,08) peut-il être corrigé par un meilleur centrage / une meilleure génération d’hypothèses latérales U, **en conservant le domaine local de recherche actuel** ?

## Réponse mesurée

Recentrer la graine U (médiane du nuage local) dans le searchY actuel produit 22/51 candidates. Sans recentrage de la fenêtre d’intersection, les mêmes graines meurent à « hors fenêtre » : ce n’est pas un searchY plus large, c’est un centre déplacé. 27 rails passent de RSF à flanc insuffisant — le plan de roulement est trouvé, la publication bute ensuite sur le flanc. 2 témoin(s) perdu(s). C déplace des témoins de plusieurs centimètres (concurrence de modes) : éliminé. 836/756 restent hors méthode. Lot INCONCLUSIVE comme correctif ; A reste le prototype à confronter, pas à fusionner.

**Ce lot ne propose aucun searchY global de 0,17 ou 0,20.**

## Population

| cohorte | n |
|---|---:|
| failures `gridSupported = 0` | 53 |
| dont hors-U (méthode principale) | 51 |
| exceptions 836 G / 756 G | 2 |
| témoins engine-candidate (lock no-support-v1) | 53 |
| 4+2 exclus | 6 |

## Filtre B (sans oracle humain)

z ≥ q70(z) − topBand(0.012) ; repli z > −0.04 ; sinon nuage complet

Le rail opposé n’entre pas dans la boîte moteur (|u|<0,18). Ballast et semelle sont plus bas que la nappe haute. Aucune correction humaine n’entre dans le filtre.

## Graines observées (51 hors-U)

- |u| médian du nuage complet : **0.138**
- |u| médian nappe haute (B) : **0.143**
- |médiane − robuste| médian : **0.004**
- 51 dont la médiane a topRows≥3 à z nappe : **46**
- 51 dont la robuste a topRows≥3 à z nappe : **51**
- n hypothèses C (médiane, failures) : **2**
- n hypothèses C (médiane, témoins) : **2**

## Variantes

| id | titre | statut | RSF→candidate (51) | encore RSF | motif shift | témoins tenus | témoins perdus | déplacés >grille | déplacés >10 mm | nouvelles ambiguïtés | récup. 836/756 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BASELINE | moteur actuel, graine (0,0) | NEUTRAL | 0 | 51 | 0 | 53 | 0 | 0 | 0 | 0 | 0 |
| A | médiane U du nuage local | INCONCLUSIVE | 22 | 1 | 50 | 51 | 2 | 5 | 0 | 0 | 0 |
| A_NO_WINDOW | A sans recentrage de fenêtre (ablation) | INCONCLUSIVE | 0 | 1 | 50 | 51 | 2 | 5 | 0 | 0 | 0 |
| B | médiane U robuste (nappe haute) | INCONCLUSIVE | 21 | 0 | 51 | 48 | 5 | 2 | 0 | 0 | 0 |
| C | multi-hypothèses U | REGRESSIVE | 21 | 0 | 51 | 50 | 3 | 2 | 2 | 0 | 0 |

## Ablations

- `A_NO_WINDOW` : même graine A, fenêtre d’intersection toujours centrée à 0. Si A récupère et A_NO_WINDOW non, le recentrage de fenêtre (pas l’élargissement de searchY) est la condition de publication.
- searchY et searchZ ne varient dans aucune variante.

## Failures réellement récupérés en candidate

### A — médiane U

- cut 326 right `92dbb85e-9534-4de6-83c5-289d3ecdf766|5cc47c6d-0f86-4bd2-a896-eff610c9d21b|1|326|right`
- cut 5087 right `3876864f-a864-4678-b7b0-3feecc4af418|f0e4410e-ad2b-4ea3-ad67-ccca1fa7b4a0|1|5087|right`
- cut 5096 right `3876864f-a864-4678-b7b0-3feecc4af418|4bc0d0d6-c4f8-4be7-bf78-d48eb8d20971|1|5096|right`
- cut 5098 right `3876864f-a864-4678-b7b0-3feecc4af418|2a62d36a-664b-4030-83d7-348ec57f11b4|1|5098|right`
- cut 5103 right `3876864f-a864-4678-b7b0-3feecc4af418|7a4f7fdf-58c1-4d0a-8edb-3df71e682de5|1|5103|right`
- cut 5110 right `d9ccb545-25db-4262-b383-794ab3272ec7|99db44b7-b341-44a2-b64e-e2094808fbf8|1|5110|right`
- cut 5115 right `d9ccb545-25db-4262-b383-794ab3272ec7|b0c281c4-8a0f-4ed5-8996-727f4b219259|1|5115|right`
- cut 5116 right `d9ccb545-25db-4262-b383-794ab3272ec7|522149f8-96a5-4b7d-889e-a429f2cc52e6|1|5116|right`
- cut 5119 right `d9ccb545-25db-4262-b383-794ab3272ec7|416c49b5-1a17-41c9-ac95-455c426be2c5|1|5119|right`
- cut 5122 right `d9ccb545-25db-4262-b383-794ab3272ec7|376f3419-5088-40c4-abc5-44bf6370b6a5|1|5122|right`
- cut 5126 right `d9ccb545-25db-4262-b383-794ab3272ec7|7f133557-f55f-429d-be9e-0d61ab05f044|1|5126|right`
- cut 5127 right `d9ccb545-25db-4262-b383-794ab3272ec7|41b9e375-8421-49e2-9aef-fedf45c670c1|1|5127|right`
- cut 5134 right `d9ccb545-25db-4262-b383-794ab3272ec7|a692482a-5f22-42be-a29e-9e532791c1f3|1|5134|right`
- cut 5137 right `d9ccb545-25db-4262-b383-794ab3272ec7|dbb0c8f7-d58f-4865-9659-1f23a6fe7507|1|5137|right`
- cut 5139 right `d9ccb545-25db-4262-b383-794ab3272ec7|20423cc7-9095-4437-995d-09930d5a094f|1|5139|right`
- cut 5149 right `d9ccb545-25db-4262-b383-794ab3272ec7|9f35aec3-1d29-40bb-8c5a-fa1be9fe2125|1|5149|right`
- cut 5165 right `d9ccb545-25db-4262-b383-794ab3272ec7|69464602-93fd-4839-8df8-63cfdcb19c1a|1|5165|right`
- cut 5211 right `d9ccb545-25db-4262-b383-794ab3272ec7|bf97193c-6ff7-4a16-9f2f-a4251c3eb154|1|5211|right`
- cut 5265 right `d9ccb545-25db-4262-b383-794ab3272ec7|3ca4e404-ca5a-439c-971c-74fa644ecac5|1|5265|right`
- cut 5266 right `d9ccb545-25db-4262-b383-794ab3272ec7|d93f83d7-08af-40f3-a036-ca315d1a6fdd|1|5266|right`
- cut 5276 right `d9ccb545-25db-4262-b383-794ab3272ec7|fa388fc4-8f78-4b97-a394-d66140405706|1|5276|right`
- cut 427 right `0c58c033-f2e7-4aa5-ad8c-80b081a83932|7c552493-96b6-4ead-832a-a6b3d471eb31|2|427|right`

### B — médiane robuste

- cut 5087 right `3876864f-a864-4678-b7b0-3feecc4af418|f0e4410e-ad2b-4ea3-ad67-ccca1fa7b4a0|1|5087|right`
- cut 5096 right `3876864f-a864-4678-b7b0-3feecc4af418|4bc0d0d6-c4f8-4be7-bf78-d48eb8d20971|1|5096|right`
- cut 5098 right `3876864f-a864-4678-b7b0-3feecc4af418|2a62d36a-664b-4030-83d7-348ec57f11b4|1|5098|right`
- cut 5103 right `3876864f-a864-4678-b7b0-3feecc4af418|7a4f7fdf-58c1-4d0a-8edb-3df71e682de5|1|5103|right`
- cut 5110 right `d9ccb545-25db-4262-b383-794ab3272ec7|99db44b7-b341-44a2-b64e-e2094808fbf8|1|5110|right`
- cut 5115 right `d9ccb545-25db-4262-b383-794ab3272ec7|b0c281c4-8a0f-4ed5-8996-727f4b219259|1|5115|right`
- cut 5116 right `d9ccb545-25db-4262-b383-794ab3272ec7|522149f8-96a5-4b7d-889e-a429f2cc52e6|1|5116|right`
- cut 5119 right `d9ccb545-25db-4262-b383-794ab3272ec7|416c49b5-1a17-41c9-ac95-455c426be2c5|1|5119|right`
- cut 5122 right `d9ccb545-25db-4262-b383-794ab3272ec7|376f3419-5088-40c4-abc5-44bf6370b6a5|1|5122|right`
- cut 5126 right `d9ccb545-25db-4262-b383-794ab3272ec7|7f133557-f55f-429d-be9e-0d61ab05f044|1|5126|right`
- cut 5127 right `d9ccb545-25db-4262-b383-794ab3272ec7|41b9e375-8421-49e2-9aef-fedf45c670c1|1|5127|right`
- cut 5134 right `d9ccb545-25db-4262-b383-794ab3272ec7|a692482a-5f22-42be-a29e-9e532791c1f3|1|5134|right`
- cut 5137 right `d9ccb545-25db-4262-b383-794ab3272ec7|dbb0c8f7-d58f-4865-9659-1f23a6fe7507|1|5137|right`
- cut 5139 right `d9ccb545-25db-4262-b383-794ab3272ec7|20423cc7-9095-4437-995d-09930d5a094f|1|5139|right`
- cut 5149 right `d9ccb545-25db-4262-b383-794ab3272ec7|9f35aec3-1d29-40bb-8c5a-fa1be9fe2125|1|5149|right`
- cut 5165 right `d9ccb545-25db-4262-b383-794ab3272ec7|69464602-93fd-4839-8df8-63cfdcb19c1a|1|5165|right`
- cut 5211 right `d9ccb545-25db-4262-b383-794ab3272ec7|bf97193c-6ff7-4a16-9f2f-a4251c3eb154|1|5211|right`
- cut 5265 right `d9ccb545-25db-4262-b383-794ab3272ec7|3ca4e404-ca5a-439c-971c-74fa644ecac5|1|5265|right`
- cut 5266 right `d9ccb545-25db-4262-b383-794ab3272ec7|d93f83d7-08af-40f3-a036-ca315d1a6fdd|1|5266|right`
- cut 5276 right `d9ccb545-25db-4262-b383-794ab3272ec7|fa388fc4-8f78-4b97-a394-d66140405706|1|5276|right`
- cut 427 right `0c58c033-f2e7-4aa5-ad8c-80b081a83932|7c552493-96b6-4ead-832a-a6b3d471eb31|2|427|right`

### C — multi-hypothèses

- cut 5087 right `3876864f-a864-4678-b7b0-3feecc4af418|f0e4410e-ad2b-4ea3-ad67-ccca1fa7b4a0|1|5087|right`
- cut 5096 right `3876864f-a864-4678-b7b0-3feecc4af418|4bc0d0d6-c4f8-4be7-bf78-d48eb8d20971|1|5096|right`
- cut 5098 right `3876864f-a864-4678-b7b0-3feecc4af418|2a62d36a-664b-4030-83d7-348ec57f11b4|1|5098|right`
- cut 5103 right `3876864f-a864-4678-b7b0-3feecc4af418|7a4f7fdf-58c1-4d0a-8edb-3df71e682de5|1|5103|right`
- cut 5110 right `d9ccb545-25db-4262-b383-794ab3272ec7|99db44b7-b341-44a2-b64e-e2094808fbf8|1|5110|right`
- cut 5115 right `d9ccb545-25db-4262-b383-794ab3272ec7|b0c281c4-8a0f-4ed5-8996-727f4b219259|1|5115|right`
- cut 5116 right `d9ccb545-25db-4262-b383-794ab3272ec7|522149f8-96a5-4b7d-889e-a429f2cc52e6|1|5116|right`
- cut 5119 right `d9ccb545-25db-4262-b383-794ab3272ec7|416c49b5-1a17-41c9-ac95-455c426be2c5|1|5119|right`
- cut 5122 right `d9ccb545-25db-4262-b383-794ab3272ec7|376f3419-5088-40c4-abc5-44bf6370b6a5|1|5122|right`
- cut 5126 right `d9ccb545-25db-4262-b383-794ab3272ec7|7f133557-f55f-429d-be9e-0d61ab05f044|1|5126|right`
- cut 5127 right `d9ccb545-25db-4262-b383-794ab3272ec7|41b9e375-8421-49e2-9aef-fedf45c670c1|1|5127|right`
- cut 5134 right `d9ccb545-25db-4262-b383-794ab3272ec7|a692482a-5f22-42be-a29e-9e532791c1f3|1|5134|right`
- cut 5137 right `d9ccb545-25db-4262-b383-794ab3272ec7|dbb0c8f7-d58f-4865-9659-1f23a6fe7507|1|5137|right`
- cut 5139 right `d9ccb545-25db-4262-b383-794ab3272ec7|20423cc7-9095-4437-995d-09930d5a094f|1|5139|right`
- cut 5149 right `d9ccb545-25db-4262-b383-794ab3272ec7|9f35aec3-1d29-40bb-8c5a-fa1be9fe2125|1|5149|right`
- cut 5165 right `d9ccb545-25db-4262-b383-794ab3272ec7|69464602-93fd-4839-8df8-63cfdcb19c1a|1|5165|right`
- cut 5211 right `d9ccb545-25db-4262-b383-794ab3272ec7|bf97193c-6ff7-4a16-9f2f-a4251c3eb154|1|5211|right`
- cut 5265 right `d9ccb545-25db-4262-b383-794ab3272ec7|3ca4e404-ca5a-439c-971c-74fa644ecac5|1|5265|right`
- cut 5266 right `d9ccb545-25db-4262-b383-794ab3272ec7|d93f83d7-08af-40f3-a036-ca315d1a6fdd|1|5266|right`
- cut 5276 right `d9ccb545-25db-4262-b383-794ab3272ec7|fa388fc4-8f78-4b97-a394-d66140405706|1|5276|right`
- cut 427 right `0c58c033-f2e7-4aa5-ad8c-80b081a83932|7c552493-96b6-4ead-832a-a6b3d471eb31|2|427|right`

## Changements de motif (51)

### A

- `rsf→candidate` : 22
- `rsf→flank` : 27
- `rsf→slope` : 1

### B

- `rsf→flank` : 29
- `rsf→candidate` : 21
- `rsf→slope` : 1

### C

- `rsf→flank` : 29
- `rsf→candidate` : 21
- `rsf→slope` : 1

## Témoins

Une méthode qui récupère les failures mais déplace massivement les témoins n’est pas PROMISING.

| id | tenus | perdus | déplacés >grille (3 mm) | déplacés >10 mm | ambiguïtés | extra hypothèses | |Δu| médian (déplacés grille) |
|---|---:|---:|---:|---:|---:|---:|---:|
| BASELINE | 53 | 0 | 0 | 0 | 0 | 0 | 0.0000 |
| A | 51 | 2 | 5 | 0 | 0 | 0 | 0.0009 |
| A_NO_WINDOW | 51 | 2 | 5 | 0 | 0 | 0 | 0.0009 |
| B | 48 | 5 | 2 | 0 | 0 | 0 | 0.0063 |
| C | 50 | 3 | 2 | 2 | 0 | 99 | 0.1300 |

## Exceptions — ne pas retuner la méthode principale

- cut 756 left `hors-U+Z` — `0c58c033-f2e7-4aa5-ad8c-80b081a83932|269cf493-35e6-4145-a4a2-997b775eff50|2|756|left`
- cut 836 left `hors-Z` — `0c58c033-f2e7-4aa5-ad8c-80b081a83932|3d0da416-a1c4-4b67-914b-88fc3820df5b|2|836|left`

- 836 G : support hors Z (u déjà dans searchY). Un recentrage U ne traite pas Z.
- 756 G : support hors U et Z. Hors méthode.

## Cas intéressants

### Cut 326 right

- Clé : `92dbb85e-9534-4de6-83c5-289d3ecdf766|5cc47c6d-0f86-4bd2-a896-eff610c9d21b|1|326|right`
- u médiane (A) : -0.13853 · robuste (B) : -0.146541 · C : -0.146541 (quantile-0.5), -0.12432 (quantile-0.75), -0.18 (support-max)
- Points : 66 · |u| médian -0.136477 · nappe B n=43 fallback=high-z-q70
- BASELINE : unresolved rsf topRows=null face=null reason=Plan de roulement non estimable.
- A : candidate candidate topRows=29 face=6 seedU=0.16552999999999995 reason=—
- B : unresolved flank topRows=29 face=5 seedU=0.16454099999999994 reason=Flanc interne insuffisamment observé.
- C : unresolved flank topRows=30 face=5 nHyp=3 reason=Flanc interne insuffisamment observé.

### Cut 5083 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|ed020057-9947-4bd8-892f-fe51c54c5313|1|5083|right`
- u médiane (A) : -0.130794 · robuste (B) : -0.141675 · C : -0.141675 (quantile-0.5), -0.168 (support-max)
- Points : 70 · |u| médian -0.12936 · nappe B n=43 fallback=high-z-q70
- BASELINE : unresolved rsf topRows=null face=null reason=Plan de roulement non estimable.
- A : unresolved flank topRows=32 face=5 seedU=0.17179399999999995 reason=Flanc interne insuffisamment observé.
- B : unresolved flank topRows=32 face=5 seedU=0.17267499999999997 reason=Flanc interne insuffisamment observé.
- C : unresolved flank topRows=32 face=5 nHyp=2 reason=Flanc interne insuffisamment observé.

### Cut 5087 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|f0e4410e-ad2b-4ea3-ad67-ccca1fa7b4a0|1|5087|right`
- u médiane (A) : -0.140489 · robuste (B) : -0.144429 · C : -0.144429 (quantile-0.5), -0.18 (support-max)
- Points : 73 · |u| médian -0.140489 · nappe B n=47 fallback=high-z-q70
- BASELINE : unresolved rsf topRows=null face=null reason=Plan de roulement non estimable.
- A : candidate candidate topRows=36 face=8 seedU=0.17248899999999995 reason=—
- B : candidate candidate topRows=36 face=8 seedU=0.17242899999999994 reason=—
- C : candidate candidate topRows=38 face=8 nHyp=2 reason=—

### Cut 5165 right

- Clé : `d9ccb545-25db-4262-b383-794ab3272ec7|69464602-93fd-4839-8df8-63cfdcb19c1a|1|5165|right`
- u médiane (A) : -0.122915 · robuste (B) : -0.130055 · C : -0.130055 (quantile-0.5), -0.168 (support-max), -0.102 (density-peak)
- Points : 80 · |u| médian -0.121936 · nappe B n=44 fallback=high-z-q70
- BASELINE : unresolved rsf topRows=null face=null reason=Plan de roulement non estimable.
- A : candidate candidate topRows=28 face=12 seedU=0.15191499999999997 reason=—
- B : candidate candidate topRows=29 face=13 seedU=0.15305499999999994 reason=—
- C : candidate candidate topRows=28 face=12 nHyp=3 reason=—

### Cut 756 left — exception hors-U+Z

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|269cf493-35e6-4145-a4a2-997b775eff50|2|756|left`
- u médiane (A) : -0.128257 · robuste (B) : -0.126658 · C : -0.126658 (quantile-0.5), -0.156 (support-max)
- Points : 85 · |u| médian -0.128257 · nappe B n=78 fallback=high-z-q70
- BASELINE : unresolved rsf topRows=null face=null reason=Plan de roulement non estimable.
- A : unresolved rsf topRows=null face=null seedU=undefined reason=Plan de roulement non estimable.
- B : unresolved rsf topRows=null face=null seedU=undefined reason=Plan de roulement non estimable.
- C : unresolved rsf topRows=null face=null nHyp=2 reason=Plan de roulement non estimable.

### Cut 836 left — exception hors-Z

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|3d0da416-a1c4-4b67-914b-88fc3820df5b|2|836|left`
- u médiane (A) : 0.053437 · robuste (B) : 0.046474 · C : 0.046474 (quantile-0.5), -0.08895 (quantile-0.25), 0.106575 (quantile-0.75), 0.072 (support-max), 0 (support-max)
- Points : 160 · |u| médian 0.055035 · nappe B n=115 fallback=high-z-q70
- BASELINE : unresolved rsf topRows=null face=null reason=Plan de roulement non estimable.
- A : unresolved rsf topRows=null face=null seedU=undefined reason=Plan de roulement non estimable.
- B : unresolved rsf topRows=null face=null seedU=undefined reason=Plan de roulement non estimable.
- C : unresolved flank topRows=22 face=0 nHyp=5 reason=Flanc interne insuffisamment observé.

### Cut 2269 left

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|aaff2a3f-d03d-4d22-9ac4-94ee55765c84|2|2269|left`
- u médiane (A) : 0.05595 · robuste (B) : -0.101276 · C : -0.101276 (quantile-0.5), -0.132 (support-max)
- Points : 81 · |u| médian 0.05595 · nappe B n=27 fallback=high-z-q70
- BASELINE : unresolved rsf topRows=null face=null reason=Plan de roulement non estimable.
- A : unresolved rsf topRows=null face=null seedU=undefined reason=Plan de roulement non estimable.
- B : unresolved flank topRows=20 face=4 seedU=-0.13027599999999995 reason=Flanc interne insuffisamment observé.
- C : unresolved flank topRows=19 face=4 nHyp=2 reason=Flanc interne insuffisamment observé.


## Prototypes éliminés / restants

Ne pas promouvoir un searchY ∈ {0,17 ; 0,20}.

- `BASELINE` : **NEUTRAL** — search(0,0) searchY=0.08 searchZ=0.04 — aucun lab
- `A` : **INCONCLUSIVE** — une graine = médiane U des points observables moteur ; recherche locale inchangée ; fenêtre recentrée
- `A_NO_WINDOW` : **INCONCLUSIVE** — même graine A, mais la fenêtre d’intersection reste |u|≤searchY+0.01 autour de 0
- `B` : **INCONCLUSIVE** — médiane U du sous-ensemble z ≥ q70(z) − topBand ; recherche locale ; fenêtre recentrée
- `C` : **REGRESSIVE** — pics de densité + maxima de support 1D + quantiles, dédupliqués ; chaque graine a searchY local

## Recommandation technique (prochaine expérience)

Si A/B trouvent le plan de roulement mais meurent au flanc : revenir au Flank Support Lab avec un candidat **déjà recentré**, sans baisser searchY ni minFace en même temps.

Si C déplace les témoins : abandonner les multi-hypothèses naïves ; une graine unique (B, nappe haute) est le générateur à confronter aux provenance Sol/Loki.

Si rien ne publie de candidate : le recentrage U est nécessaire mais non suffisant — le lot reste `INCONCLUSIVE` comme correctif.

Ne pas transformer ce laboratoire en nouvelle version Banane.
