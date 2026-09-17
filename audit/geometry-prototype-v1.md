# Geometry Prototype V1

Lot **EXPÉRIMENTAL**. Branche `lab-geometry-prototype-v1`. Aucun merge, aucune conclusion de production, aucune action ESV.

**Statut du lot : `INCONCLUSIVE`.** Récupérations publiées (status `candidate`) : **0**. Aucun prototype PROMISING.

- Base : `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` (`src/geometry-baseline.js`)
- Géométrie courante : `5a8667079ab22ed67f60ce196ace35615e5cba72a3b51b0de3aa65143518eca3`
- Baseline inchangée : **oui**
- Données : `StoryNow30/banane-data` `infra/materialized-native-v46-v1` `@d541686d3a98569125cdbdb261ef121c9f533d6a`
- Dataset : `datasets/native-v4.6-2026-09-16`
- Rails assemblés : **221** / comparables 239 (lock 239)
- Ignorés fail-closed (`chunks-absents`) : **18** — 4 échecs + 14 témoins
- Durée : 97.5 s

## Conclusions

1. **Aucune récupération publiée.** Sur les 17 prototypes, zéro RSF ne devient `candidate`. « Récupéré » = proposition publiable, pas un simple changement de motif d’abstention.
2. **Couverture 221/239.** 18 rails lock sont absents des shards nuage (`chunks-absents`) : 4 échecs + 14 témoins. Fail-closed. Baseline reproduite **59 / 162** (lock 63 / 176). Familles **53 / 4 / 2** (science établie 56 / 5 / 2). Les 4 échecs manquants expliquent 3+1 sur 56 et 5.
3. **Les 53 n’ont aucun support de grille** (`gridSupported` médian 0, `topRowsCoarse` 0). Ranking, raffinement, seed de paire et fenêtre `searchZ` ne peuvent pas inventer des points. C’est un problème de générateur / cadre, pas de scoring.
4. **Les 4 + 2 sont un autre mécanisme.** Après C+D ils passent `robustLine` (`topRows` 3–7) puis échouent à `minTop=15` / flanc. `CD_MINTHRESH` (diagnostique, pas un candidat) sort 6/59 du motif RSF : 4 « Flanc interne insuffisamment observé. », 1 flanc + pente, 1 ambiguïté. Aucun ne publie.
5. **Ne pas élargir `searchZ` vers le bas** (A : 0 récupéré, 2–4 témoins perdus). **Ne pas promouvoir le seed / lock nuage** (B : 0 récupéré, jusqu’à 76 déplacements de témoins, 4–12 perdus). B+C, attaque principale prévue, est REGRESSIVE dès que le seed nuage est actif ; `BC_LOCK` est NEUTRAL et toujours à 0.
6. **La paire ne masque pas un mauvais générateur.** `P_PAIR_Z` rejoue B+C+D : mêmes 4 témoins perdus, 76 déplacements, 0 récupéré.

### Conservés comme leviers diagnostiques (pas des candidats d’intégration)

- `C_PREFER_SUPPORT`
- `D_PRESERVE_COARSE`
- `CD`
- `CD_MINTHRESH`

### Écartés comme candidats

- `A_SEARCHZ_008`
- `A_SEARCHZ_010`
- `A_TOPBAND_024`
- `B_CLOUD_Z_SEED`
- `B_LOCK_CLOUD_Z`
- `G_STRICT_AMBIGUITY`
- `BC`
- `BCD`
- `BCDG`
- `P_PAIR_Z`

## Baseline reproduite

| cohorte | n |
|---|---:|
| RSF `Plan de roulement non estimable.` | **59** |
| contrôles engine-candidate | **162** |
| autres unresolved | 0 |

### Familles 56 / 5 / 2

| famille | n |
|---|---:|
| `aucun-support-nulle-part-sur-la-grille` | **53** |
| `raffinement-a-quitte-le-support` | **2** |
| `support-ailleurs-mais-perte-nettement-superieure` | **4** |

## Tableau comparatif

| prototype | famille | statut | RSF récupérés | RSF restants | contrôles perdus | contrôles déplacés | ms |
|---|---|---|---:|---:|---:|---:|---:|
| BASELINE | baseline | BASELINE | — | 59 | — | — | 3268 |
| `A_SEARCHZ_008` | A | **REGRESSIVE** | 0 | 59 | 4 | 21 | 4744 |
| `A_SEARCHZ_010` | A | **REGRESSIVE** | 0 | 59 | 2 | 0 | 10530 |
| `A_TOPBAND_024` | A | **REGRESSIVE** | 0 | 59 | 3 | 0 | 3590 |
| `B_CLOUD_Z_SEED` | B | **REGRESSIVE** | 0 | 59 | 4 | 76 | 4718 |
| `B_LOCK_CLOUD_Z` | B | **REGRESSIVE** | 0 | 59 | 12 | 0 | 2084 |
| `C_PREFER_SUPPORT` | C | **NEUTRAL** | 0 | 59 | 0 | 0 | 2304 |
| `D_PRESERVE_COARSE` | D | **NEUTRAL** | 0 | 59 | 0 | 0 | 2672 |
| `CD` | C+D | **NEUTRAL** | 0 | 59 | 0 | 0 | 3895 |
| `CD_MINTHRESH` | C+D | **NEUTRAL** | 0 | 59 | 0 | 0 | 4119 |
| `E_SUPPORT_PENALTY` | E | **NEUTRAL** | 0 | 59 | 0 | 0 | 4360 |
| `F_MULTI_MINIMA` | F | **NEUTRAL** | 0 | 59 | 0 | 0 | 13722 |
| `G_STRICT_AMBIGUITY` | G | **REGRESSIVE** | 0 | 59 | 2 | 0 | 3728 |
| `BC` | B+C | **REGRESSIVE** | 0 | 59 | 4 | 76 | 4212 |
| `BC_LOCK` | B+C | **NEUTRAL** | 0 | 59 | 0 | 0 | 2237 |
| `BCD` | B+C+D | **REGRESSIVE** | 0 | 59 | 4 | 76 | 4164 |
| `BCDG` | B+C+D+G | **REGRESSIVE** | 0 | 59 | 8 | 73 | 4317 |
| `P_PAIR_Z` | P | **REGRESSIVE** | 0 | 59 | 4 | 76 | 5135 |

## Ablations

Les combinaisons `BC`, `BC_LOCK`, `BCD`, `BCDG` se décomposent en A/B/C/D/G unitaires du tableau ci-dessus. Un gain n’est attribué à une famille que si la variante unitaire le produit déjà, ou s’il n’apparaît que dans la combinaison (interaction).

### `A_SEARCHZ_008` — REGRESSIVE

- Famille : **A**
- Hypothèse : fenêtre verticale élargie searchZ=0.08
- Options : `{"searchZ":0.08}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 137 ; perdus : **4** ; déplacés : 21
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|76b0e766-3781-4919-8a6b-89cff48468f5|1|224|left`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|fbb902d4-c847-4327-9565-ea6a1acd0361|1|2894|left`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|72b8f0dc-10c7-4066-8f34-7b618a850266|2|837|left`

- Changements de candidat (20 premiers) :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|91fd7d79-3898-4a4f-9370-32bef37c1dde|8|9395|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|6a13eafd-d32b-4dd0-abd0-f427fe3fa087|8|9645|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1b5ded13-6358-46e8-bfee-5fb2af7a329b|8|9667|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|16f2083a-ef75-4296-b415-3f59c4375b68|8|9804|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|90a1fb56-33fd-44e5-99f4-b14ea260762b|8|9814|left`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|1877d9fa-0df3-4556-9037-fbeae4f35904|1|188|left`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|8031dca9-d534-4527-84af-43f2d0b79a15|1|217|right`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|a039dff7-20c6-4035-886b-d2cd3600556f|1|218|left`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|fd96830a-465f-435c-997e-6dcc9f226915|1|916|left`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|a67d7b27-8af7-4c13-844d-6de3c3984b21|1|1244|left`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|dd721e34-4df4-4be7-ab6d-9c22da05e7a0|1|1246|left`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|4f0039e2-523b-48d3-8de4-5df63b56a536|1|1867|left`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|c4298734-7fc8-458e-92e4-84958fd109a1|1|2302|right`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|9eb6f18f-f1d8-4cee-a584-ddb0f5504fc8|1|2733|right`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|a4dbd704-8366-438e-8527-82eca8597af8|1|2749|left`
  - `ba703239-af3c-48eb-b830-c31e821bd730|12b2b871-899c-460d-a001-db4278dd2599|1|4027|left`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|7151db50-2d5b-4adb-9e9a-1dee9c4e4158|1|5148|right`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|6bd3a0da-e402-47e8-8614-999fb2ddb5fd|1|5182|right`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|148d26bb-ec9b-4744-8a2f-2147cc809d6f|1|5194|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|e5251564-68d6-405e-a826-fc8adaea0460|2|451|right`

### `A_SEARCHZ_010` — REGRESSIVE

- Famille : **A**
- Hypothèse : fenêtre verticale maximale searchZ=0.10
- Options : `{"searchZ":0.1}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 160 ; perdus : **2** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `92dbb85e-9534-4de6-83c5-289d3ecdf766|76b0e766-3781-4919-8a6b-89cff48468f5|1|224|left`

### `A_TOPBAND_024` — REGRESSIVE

- Famille : **A**
- Hypothèse : bande de roulement élargie topBand=0.024
- Options : `{"topBand":0.024}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 159 ; perdus : **3** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|bb850919-657a-4427-b635-d6ce740e6091|8|9660|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|51045a69-5d9c-4af8-bf80-aaae7675a343|2|746|left`

### `B_CLOUD_Z_SEED` — REGRESSIVE

- Famille : **B**
- Hypothèse : hypothèse verticale supplémentaire au z médian du nuage local
- Options : `{"lab":{"cloudZSeed":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 82 ; perdus : **4** ; déplacés : 76
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|812f1aa0-a3f9-4690-86e1-77e772b360a4|1|5209|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a2611ac0-a08b-4fec-9f79-7985118e67b2|2|815|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|72b8f0dc-10c7-4066-8f34-7b618a850266|2|837|left`

- Changements de candidat (20 premiers) :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|ed212e43-60b3-449d-8a0e-cddc0ead7c79|8|9391|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|8569d86d-b15e-47c9-bb05-af153b66f59f|8|9392|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|91fd7d79-3898-4a4f-9370-32bef37c1dde|8|9395|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|cf8f3cc3-12f6-4b5d-bcc3-2582dd64d234|8|9402|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|62e0c936-b25b-48b7-ac7a-354da5f90e35|8|9403|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|2ee27155-354f-4ac1-ac1d-96898d15500e|8|9539|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|dd90541a-a01e-41c6-b920-becceffd20fc|8|9540|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|50c18bb8-6189-4087-9d42-c37a7e69a2a9|8|9548|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|fcf812b8-bf52-4bc9-9646-823f24bd600d|8|9643|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|6a13eafd-d32b-4dd0-abd0-f427fe3fa087|8|9645|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8a2ebc3-e9cf-44ad-b3b8-1c3c708085d8|8|9646|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8ddf97b-db5b-445f-a6b8-5e051cc05342|8|9647|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|7a50a190-52b8-46b8-9405-6badaa276cbd|8|9653|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|535d4fa5-1b6d-461a-aca1-838041795cef|8|9655|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|61e3bf2a-9475-4812-9465-695a372ac88c|8|9657|right`

### `B_LOCK_CLOUD_Z` — REGRESSIVE

- Famille : **B**
- Hypothèse : ignorer le min de loss global ; retenir le coarse le plus proche du z médian du nuage (±0.012)
- Options : `{"lab":{"lockZToCloud":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 150 ; perdus : **12** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|dd90541a-a01e-41c6-b920-becceffd20fc|8|9540|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|d349e179-75ec-4cc0-a767-81813b9a4e12|8|9544|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|9822ba5e-8b38-4531-b97e-1a40296b8614|8|9649|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|7a50a190-52b8-46b8-9405-6badaa276cbd|8|9653|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|535d4fa5-1b6d-461a-aca1-838041795cef|8|9655|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|61e3bf2a-9475-4812-9465-695a372ac88c|8|9657|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|c0586b61-9753-4664-a1c0-494906f8007f|8|9686|left`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|4f0039e2-523b-48d3-8de4-5df63b56a536|1|1867|left`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|d4a4fef1-8b1f-4fe9-83e2-80b001005587|1|2359|left`
  - `ba703239-af3c-48eb-b830-c31e821bd730|12b2b871-899c-460d-a001-db4278dd2599|1|4027|left`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|b6c0ea6f-cb30-4547-adec-3b81ac65e11d|2|741|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|51045a69-5d9c-4af8-bf80-aaae7675a343|2|746|left`

### `C_PREFER_SUPPORT` — NEUTRAL

- Famille : **C**
- Hypothèse : parmi la grille coarse, préférer un placement avec topRows>=3 même si loss supérieure
- Options : `{"lab":{"preferSupported":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 162 ; perdus : **0** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - *(aucun)*

### `D_PRESERVE_COARSE` — NEUTRAL

- Famille : **D**
- Hypothèse : si le raffinement perd le support, conserver le coarse
- Options : `{"lab":{"preserveCoarseSupport":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 162 ; perdus : **0** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - *(aucun)*

### `CD` — NEUTRAL

- Famille : **C+D**
- Hypothèse : préférence support puis conservation du coarse si le raffinement le quitte
- Options : `{"lab":{"preferSupported":true,"preserveCoarseSupport":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 162 ; perdus : **0** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - *(aucun)*

### `CD_MINTHRESH` — NEUTRAL

- Famille : **C+D**
- Hypothèse : C+D avec minTop=minFace=3 (seuil de publication aligné sur robustLine)
- Options : `{"minTop":3,"minFace":3,"lab":{"preferSupported":true,"preserveCoarseSupport":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 162 ; perdus : **0** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - *(aucun)*

### `E_SUPPORT_PENALTY` — NEUTRAL

- Famille : **E**
- Hypothèse : score combiné loss + 1e-4 si topRows<3
- Options : `{"lab":{"supportPenalty":0.0001}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 162 ; perdus : **0** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - *(aucun)*

### `F_MULTI_MINIMA` — NEUTRAL

- Famille : **F**
- Hypothèse : minima locaux, puis support puis loss
- Options : `{"lab":{"multiMinima":true,"preferSupported":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 162 ; perdus : **0** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - *(aucun)*

### `G_STRICT_AMBIGUITY` — REGRESSIVE

- Famille : **G**
- Hypothèse : abstention plus stricte (ratio 2.0) sur les seuls placements supportés
- Options : `{"lab":{"preferSupported":true},"minTemplateLossRatio":2}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 160 ; perdus : **2** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|9eb6f18f-f1d8-4cee-a584-ddb0f5504fc8|1|2733|right`
  - `ba703239-af3c-48eb-b830-c31e821bd730|12b2b871-899c-460d-a001-db4278dd2599|1|4027|left`

### `BC` — REGRESSIVE

- Famille : **B+C**
- Hypothèse : graine nuage + préférence support
- Options : `{"lab":{"cloudZSeed":true,"preferSupported":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 82 ; perdus : **4** ; déplacés : 76
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|812f1aa0-a3f9-4690-86e1-77e772b360a4|1|5209|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a2611ac0-a08b-4fec-9f79-7985118e67b2|2|815|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|72b8f0dc-10c7-4066-8f34-7b618a850266|2|837|left`

- Changements de candidat (20 premiers) :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|ed212e43-60b3-449d-8a0e-cddc0ead7c79|8|9391|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|8569d86d-b15e-47c9-bb05-af153b66f59f|8|9392|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|91fd7d79-3898-4a4f-9370-32bef37c1dde|8|9395|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|cf8f3cc3-12f6-4b5d-bcc3-2582dd64d234|8|9402|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|62e0c936-b25b-48b7-ac7a-354da5f90e35|8|9403|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|2ee27155-354f-4ac1-ac1d-96898d15500e|8|9539|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|dd90541a-a01e-41c6-b920-becceffd20fc|8|9540|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|50c18bb8-6189-4087-9d42-c37a7e69a2a9|8|9548|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|fcf812b8-bf52-4bc9-9646-823f24bd600d|8|9643|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|6a13eafd-d32b-4dd0-abd0-f427fe3fa087|8|9645|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8a2ebc3-e9cf-44ad-b3b8-1c3c708085d8|8|9646|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8ddf97b-db5b-445f-a6b8-5e051cc05342|8|9647|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|7a50a190-52b8-46b8-9405-6badaa276cbd|8|9653|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|535d4fa5-1b6d-461a-aca1-838041795cef|8|9655|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|61e3bf2a-9475-4812-9465-695a372ac88c|8|9657|right`

### `BC_LOCK` — NEUTRAL

- Famille : **B+C**
- Hypothèse : lock z nuage + préférence support
- Options : `{"lab":{"lockZToCloud":true,"preferSupported":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 162 ; perdus : **0** ; déplacés : 0
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - *(aucun)*

### `BCD` — REGRESSIVE

- Famille : **B+C+D**
- Hypothèse : graine nuage + support + conservation coarse
- Options : `{"lab":{"cloudZSeed":true,"preferSupported":true,"preserveCoarseSupport":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 82 ; perdus : **4** ; déplacés : 76
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|812f1aa0-a3f9-4690-86e1-77e772b360a4|1|5209|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a2611ac0-a08b-4fec-9f79-7985118e67b2|2|815|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|72b8f0dc-10c7-4066-8f34-7b618a850266|2|837|left`

- Changements de candidat (20 premiers) :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|ed212e43-60b3-449d-8a0e-cddc0ead7c79|8|9391|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|8569d86d-b15e-47c9-bb05-af153b66f59f|8|9392|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|91fd7d79-3898-4a4f-9370-32bef37c1dde|8|9395|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|cf8f3cc3-12f6-4b5d-bcc3-2582dd64d234|8|9402|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|62e0c936-b25b-48b7-ac7a-354da5f90e35|8|9403|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|2ee27155-354f-4ac1-ac1d-96898d15500e|8|9539|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|dd90541a-a01e-41c6-b920-becceffd20fc|8|9540|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|50c18bb8-6189-4087-9d42-c37a7e69a2a9|8|9548|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|fcf812b8-bf52-4bc9-9646-823f24bd600d|8|9643|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|6a13eafd-d32b-4dd0-abd0-f427fe3fa087|8|9645|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8a2ebc3-e9cf-44ad-b3b8-1c3c708085d8|8|9646|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8ddf97b-db5b-445f-a6b8-5e051cc05342|8|9647|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|7a50a190-52b8-46b8-9405-6badaa276cbd|8|9653|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|535d4fa5-1b6d-461a-aca1-838041795cef|8|9655|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|61e3bf2a-9475-4812-9465-695a372ac88c|8|9657|right`

### `BCDG` — REGRESSIVE

- Famille : **B+C+D+G**
- Hypothèse : BCD + abstention stricte
- Options : `{"lab":{"cloudZSeed":true,"preferSupported":true,"preserveCoarseSupport":true},"minTemplateLossRatio":2}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 81 ; perdus : **8** ; déplacés : 73
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|91fd7d79-3898-4a4f-9370-32bef37c1dde|8|9395|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right`
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|9eb6f18f-f1d8-4cee-a584-ddb0f5504fc8|1|2733|right`
  - `ba703239-af3c-48eb-b830-c31e821bd730|12b2b871-899c-460d-a001-db4278dd2599|1|4027|left`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|812f1aa0-a3f9-4690-86e1-77e772b360a4|1|5209|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a2611ac0-a08b-4fec-9f79-7985118e67b2|2|815|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|72b8f0dc-10c7-4066-8f34-7b618a850266|2|837|left`

- Changements de candidat (20 premiers) :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|ed212e43-60b3-449d-8a0e-cddc0ead7c79|8|9391|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|8569d86d-b15e-47c9-bb05-af153b66f59f|8|9392|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|cf8f3cc3-12f6-4b5d-bcc3-2582dd64d234|8|9402|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|62e0c936-b25b-48b7-ac7a-354da5f90e35|8|9403|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|2ee27155-354f-4ac1-ac1d-96898d15500e|8|9539|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|dd90541a-a01e-41c6-b920-becceffd20fc|8|9540|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|50c18bb8-6189-4087-9d42-c37a7e69a2a9|8|9548|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|fcf812b8-bf52-4bc9-9646-823f24bd600d|8|9643|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|6a13eafd-d32b-4dd0-abd0-f427fe3fa087|8|9645|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8a2ebc3-e9cf-44ad-b3b8-1c3c708085d8|8|9646|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8ddf97b-db5b-445f-a6b8-5e051cc05342|8|9647|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|7a50a190-52b8-46b8-9405-6badaa276cbd|8|9653|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|535d4fa5-1b6d-461a-aca1-838041795cef|8|9655|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|61e3bf2a-9475-4812-9465-695a372ac88c|8|9657|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|bb850919-657a-4427-b635-d6ce740e6091|8|9660|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1b5ded13-6358-46e8-bfee-5fb2af7a329b|8|9667|right`

### `P_PAIR_Z` — REGRESSIVE

- Famille : **P**
- Hypothèse : arbitration de paire : transférer z du rail résolu vers le rail RSF
- Options : `{"lab":{"cloudZSeed":true,"preferSupported":true,"preserveCoarseSupport":true,"pairZTransfer":true}}`
- RSF récupérés : **0** ; encore en échec : 59
- Contrôles conservés (delta identique) : 82 ; perdus : **4** ; déplacés : 76
- Rails récupérés :

  - *(aucun)*

- Rails contrôles perdus :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|right`
  - `d9ccb545-25db-4262-b383-794ab3272ec7|812f1aa0-a3f9-4690-86e1-77e772b360a4|1|5209|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a2611ac0-a08b-4fec-9f79-7985118e67b2|2|815|right`
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|72b8f0dc-10c7-4066-8f34-7b618a850266|2|837|left`

- Changements de candidat (20 premiers) :

  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|ed212e43-60b3-449d-8a0e-cddc0ead7c79|8|9391|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|8569d86d-b15e-47c9-bb05-af153b66f59f|8|9392|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|91fd7d79-3898-4a4f-9370-32bef37c1dde|8|9395|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|cf8f3cc3-12f6-4b5d-bcc3-2582dd64d234|8|9402|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|62e0c936-b25b-48b7-ac7a-354da5f90e35|8|9403|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|2ee27155-354f-4ac1-ac1d-96898d15500e|8|9539|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|dd90541a-a01e-41c6-b920-becceffd20fc|8|9540|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|50c18bb8-6189-4087-9d42-c37a7e69a2a9|8|9548|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|fcf812b8-bf52-4bc9-9646-823f24bd600d|8|9643|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|6a13eafd-d32b-4dd0-abd0-f427fe3fa087|8|9645|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8a2ebc3-e9cf-44ad-b3b8-1c3c708085d8|8|9646|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|a8ddf97b-db5b-445f-a6b8-5e051cc05342|8|9647|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|7a50a190-52b8-46b8-9405-6badaa276cbd|8|9653|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|535d4fa5-1b6d-461a-aca1-838041795cef|8|9655|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|61e3bf2a-9475-4812-9465-695a372ac88c|8|9657|right`

## 56 / 5 / 2 — analyse séparée (reproduit 53 / 4 / 2)

| famille établie | n lock | n assemblés | gridSupported médian | topRows coarse | topRows raffiné |
|---|---:|---:|---:|---:|---:|
| `aucun-support-nulle-part-sur-la-grille` | 56 | **53** | 0 | 0 | 0 |
| `support-ailleurs-mais-perte-nettement-superieure` | 5 | **4** | 136.5 | 2 | 2 |
| `raffinement-a-quitte-le-support` | 2 | **2** | 173.5 | 3 | 1.5 |

- **53 (ex-56)** : aucun placement de la grille n’atteint `topRows >= 3`. Ranking (C, E, F) est structurellement inopérant. `searchZ` 0,08 / 0,10 n’ouvre pas de support : le min de loss reste collé à la borne basse, conformément à Loki (`coarse-search-z`).
- **4 (ex-5)** : du support existe ailleurs. `C_PREFER_SUPPORT` en porte un à `topRows=7` (cut 826 right) puis `minTop=15` + flanc le rejettent. Les trois autres restent sous le seuil `robustLine` tant que le raffinement n’est pas conservé (D) et le seuil abaissé.
- **2** : support coarse `topRows=3` perdu au raffinement (`topRowsRefined` 1 et 2). `D_PRESERVE_COARSE` restaure `topRows=3` puis échoue à `minTop=15` + flanc. Ce n’est pas une récupération publiable.

### Diagnostic de porte — `CD_MINTHRESH` (pas un candidat)

Sur 59 RSF assemblés, **6** changent de motif (tous restent `unresolved`, **0** publiés) :

- `Plan de roulement non estimable.` × 53
- `Flanc interne insuffisamment observé.` × 4
- `Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.` × 1
- `Plusieurs placements concurrents du champignon sont géométriquement plausibles.` × 1

Les 53 sans support de grille restent « Plan de roulement non estimable. ». Les 6 déplacés sont exactement les 4+2. Prochaine porte après C+D+minTop : **support de flanc**.

## Confrontation Sol / Loki

Loki (`lab-vertical-alignment-provenance-replication-v1`) : première divergence au-dessus du seuil 0,015 à `coarse-search-z` ; z local tête médian failures **+0,0069**, coarse **−0,040**, refined **−0,043**. Association 0 inconsistency / 239. Compatible avec B et C **comme intuitions**. Les prototypes B et C **ne corrigeant pas** le cadre : B est REGRESSIVE, C est NEUTRAL à 0 récupéré. **N’établit pas** la cause physique du décalage.

Sol (`lab-vertical-alignment-provenance-v1`) : rapport Markdown non publié sur la branche au moment de ce lot — pas d’attente, pas de retune rétrospective.

Signature verticale reproduite sur les 59 RSF assemblés (unités scène) : z nuage local médian **0.006883492154884152**, coarse **-0.04**, refined **-0.044**, désaccord **0.0489928384036757**. Compatible avec la signature établie (failures best.z ≈ −0,043, cloud ≈ +0,0069). `physicalCalibrationStatus: not-independently-verified`.

## Recommandation technique (prochaine expérience)

- Prototypes **PROMISING** (candidats d’intégration) : *(aucun)*
- Leviers **diagnostiques à conserver** : `C_PREFER_SUPPORT`, `D_PRESERVE_COARSE`, `CD`, `CD_MINTHRESH`
- Prototypes **écartés comme candidats** : `A_SEARCHZ_008`, `A_SEARCHZ_010`, `A_TOPBAND_024`, `B_CLOUD_Z_SEED`, `B_LOCK_CLOUD_Z`, `G_STRICT_AMBIGUITY`, `BC`, `BCD`, `BCDG`, `P_PAIR_Z`
- Ne pas transformer un levier NEUTRAL en version Banane. Passage EXPLORATION → CANDIDAT → INTÉGRATION décidé séparément, après confrontation provenance.
- Le prochain levier n’est pas searchZ ni un seed nuage. Les 53 n’ont aucun support de grille : ranking et raffinement ne peuvent pas inventer de points — attendre Sol/Loki sur le cadre vertical, ou un autre générateur. Les 4+2 passent robustLine après C+D mais échouent au flanc (minFace) et/ou minTop=15 : expérience ciblée de support de face, cohorte de contrôle obligatoire.

## Commandes

```bash
node tools/geometry-prototype-v1.cjs --output audit/geometry-prototype-v1.json
node tools/geometry-prototype-v1.cjs --from-json audit/geometry-prototype-v1.json
node --test tests/geometry-prototype-v1.test.cjs
```
