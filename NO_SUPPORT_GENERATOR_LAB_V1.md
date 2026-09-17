# No-Support Generator Lab V1

Lot **EXPÉRIMENTAL / DIAGNOSTIQUE**. Branche `lab-no-support-generator-v1`. Aucun merge, aucun prototype moteur, aucune action ESV.

- Branche : `lab-no-support-generator-v1`
- HEAD : `6f2f2389018cea6bcbbd467ea9056282d87c8c65`
- Base : `82ea59b97996beb5e23317cdd82f89428be24995` (Flank Support Lab V1)
- Commande : `node tools/no-support-generator-lab-v1.cjs`
- Tests : `node tests/no-support-generator-lab-v1.test.cjs` (13/13)

**Statut du lot : `INCONCLUSIVE`.** Outil offline uniquement. Ce n’est pas un correctif.

- Base géométrie : `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` (`src/geometry-baseline.js`)
- Géométrie courante : `21701c6de3e0f61f1000a609017de5b43c3eef83e901524e8fbd0a89d1f560ad`
- Baseline inchangée : **oui**
- Données : `StoryNow30/banane-data` `infra/materialized-native-v46-v1` `@d541686d3a98569125cdbdb261ef121c9f533d6a`
- Rails failures assemblés : **53** / 53
- Témoins : **53**
- Durée : 24.4 s

## Question

Les 53 failures n’ont-ils réellement aucune solution géométrique observable, ou le moteur actuel ne regarde-t-il simplement pas au bon endroit / avec une résolution suffisante ?

## Réponse mesurée

Le support existe, mais hors du domaine U du moteur. La grille n’est pas trop lâche : le dense in-domaine reste à zéro. Le nuage local est centré au-delà de searchY=0,08. Élargir searchZ — déjà régressif dans Geometry Prototype V1 — n’est pas la bonne direction ; l’espace utile est latéral. Ceci n’est pas une proposition de searchY de production.

Ce n’est **pas** une proposition de nouveaux `searchY` / `searchZ` / `grid`. Les extensions sont diagnostiques.

## Population

| cohorte | n |
|---|---:|
| failures `gridSupported = 0` | 53 |
| témoins engine-candidate appariés | 53 |
| 4+2 exclus | 6 |

## Distribution des catégories — failures

| catégorie | n |
|---|---:|
| `NO_SUPPORT_FOUND` | 0 |
| `SUPPORT_BETWEEN_GRID` | 0 |
| `SUPPORT_OUTSIDE_Z` | 1 |
| `SUPPORT_OUTSIDE_U` | 51 |
| `SUPPORT_OUTSIDE_UZ` | 1 |
| `SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE` | 0 |
| `INCONCLUSIVE` | 0 |

## Distribution des catégories — témoins

| catégorie | n |
|---|---:|
| `NO_SUPPORT_FOUND` | 0 |
| `SUPPORT_BETWEEN_GRID` | 0 |
| `SUPPORT_OUTSIDE_Z` | 0 |
| `SUPPORT_OUTSIDE_U` | 0 |
| `SUPPORT_OUTSIDE_UZ` | 0 |
| `SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE` | 0 |
| `INCONCLUSIVE` | 0 |
| `ENGINE_SUPPORT_PRESENT` | 53 |

Le même protocole sur les témoins dit si la méthode révèle une propriété des failures ou simplement beaucoup de placements alternatifs partout. Témoins avec support hors grille moteur (B–E) : **53**.

## Tests d’espacement (diagnostiques, pas des paramètres candidats)

| id | domaine | pas | rôle |
|---|---|---|---|
| A | searchY=0.08 searchZ=0.04 | 0.003 | grille actuelle |
| B | identique | 0.001 | entre les mailles |
| C | Z → 0.10 | 0.003 | hors domaine Z |
| D | U → 0.20 | 0.003 | hors domaine U |
| E | U+Z | 0.003 | hors domaine U et Z |

## Position du min de loss moteur

- Failures dont le coarse est collé à la borne Z : **36**
- Failures dont le coarse est collé à la borne U : **17**
- |u| médian du nuage (failures) : **0.138** (searchY = 0,08)
- z médian du nuage (failures) : **0.0071** (searchZ = 0,04)
- Fraction médiane des points hors |u|>0,08 : **86 %**
- Support qui n’apparaît que si l’on élargit le voisinage de points (hors filtre moteur) : **0**

## Placements supportés découverts (failures)

Failures avec au moins un cell `topRows ≥ 3` dans A–E : **53**.

### SUPPORT_BETWEEN_GRID

- *(aucun)*

### SUPPORT_OUTSIDE_Z

- `0c58c033-f2e7-4aa5-ad8c-80b081a83932|3d0da416-a1c4-4b67-914b-88fc3820df5b|2|836|left` cut 836 left

### SUPPORT_OUTSIDE_U

- `92dbb85e-9534-4de6-83c5-289d3ecdf766|5cc47c6d-0f86-4bd2-a896-eff610c9d21b|1|326|right` cut 326 right
- `3876864f-a864-4678-b7b0-3feecc4af418|ed020057-9947-4bd8-892f-fe51c54c5313|1|5083|right` cut 5083 right
- `3876864f-a864-4678-b7b0-3feecc4af418|1662e842-7a01-4766-817a-88121218a3ef|1|5084|right` cut 5084 right
- `3876864f-a864-4678-b7b0-3feecc4af418|6adb7d89-ab3a-4ab8-a325-d7dd40166733|1|5085|right` cut 5085 right
- `3876864f-a864-4678-b7b0-3feecc4af418|f0e4410e-ad2b-4ea3-ad67-ccca1fa7b4a0|1|5087|right` cut 5087 right
- `3876864f-a864-4678-b7b0-3feecc4af418|5718fbfe-c435-4589-86be-5b1b647c9b9f|1|5088|right` cut 5088 right
- `3876864f-a864-4678-b7b0-3feecc4af418|35326a18-0e61-4415-8f9c-1d3259431530|1|5089|right` cut 5089 right
- `3876864f-a864-4678-b7b0-3feecc4af418|c1f00c8d-6228-423e-82b8-d98fb7135255|1|5090|right` cut 5090 right
- `3876864f-a864-4678-b7b0-3feecc4af418|28d373f0-4de2-4d6b-bff9-47c4f80b61da|1|5091|right` cut 5091 right
- `3876864f-a864-4678-b7b0-3feecc4af418|aaa0bffa-2693-44db-9b67-38b0124f7423|1|5093|right` cut 5093 right
- `3876864f-a864-4678-b7b0-3feecc4af418|abd17eb5-f89f-4a21-bee5-e21fd1e9d0f3|1|5094|right` cut 5094 right
- `3876864f-a864-4678-b7b0-3feecc4af418|4bc0d0d6-c4f8-4be7-bf78-d48eb8d20971|1|5096|right` cut 5096 right
- `3876864f-a864-4678-b7b0-3feecc4af418|2a62d36a-664b-4030-83d7-348ec57f11b4|1|5098|right` cut 5098 right
- `3876864f-a864-4678-b7b0-3feecc4af418|7a4f7fdf-58c1-4d0a-8edb-3df71e682de5|1|5103|right` cut 5103 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|99db44b7-b341-44a2-b64e-e2094808fbf8|1|5110|right` cut 5110 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|ee7ec8bc-9855-4c46-a74e-af5051d1e142|1|5111|right` cut 5111 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|d74c9483-311e-41aa-b2dc-2beae9ea5c32|1|5112|right` cut 5112 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|b78647c7-8252-42a1-8407-bd72c7bc4875|1|5113|right` cut 5113 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|cad1141c-18a5-4d3c-946e-a066296367d5|1|5114|right` cut 5114 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|b0c281c4-8a0f-4ed5-8996-727f4b219259|1|5115|right` cut 5115 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|522149f8-96a5-4b7d-889e-a429f2cc52e6|1|5116|right` cut 5116 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|416c49b5-1a17-41c9-ac95-455c426be2c5|1|5119|right` cut 5119 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|3fd5eb26-ad5a-448b-9506-42ff8a9cf88e|1|5120|right` cut 5120 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|f688dde3-3c87-4596-b664-25674a7042f6|1|5121|right` cut 5121 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|376f3419-5088-40c4-abc5-44bf6370b6a5|1|5122|right` cut 5122 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|81fb80c4-02a6-4493-8e69-5513cdbe68b9|1|5124|right` cut 5124 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|3c15bf5d-0de3-4365-9835-3450e7dfcfd2|1|5125|right` cut 5125 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|7f133557-f55f-429d-be9e-0d61ab05f044|1|5126|right` cut 5126 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|41b9e375-8421-49e2-9aef-fedf45c670c1|1|5127|right` cut 5127 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|e18144e2-c968-4a49-846c-5f564ac95800|1|5129|right` cut 5129 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|f5c88f79-ccd5-48d8-ac1d-677b3e3cc71c|1|5130|right` cut 5130 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|7f08899d-3b85-4057-9a01-1e3b59effc4a|1|5133|right` cut 5133 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|a692482a-5f22-42be-a29e-9e532791c1f3|1|5134|right` cut 5134 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|cc599784-cc9e-4b98-a64e-e34961fffb8f|1|5135|right` cut 5135 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|dbb0c8f7-d58f-4865-9659-1f23a6fe7507|1|5137|right` cut 5137 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|20423cc7-9095-4437-995d-09930d5a094f|1|5139|right` cut 5139 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|78b8f581-337d-4ae0-8404-223074a0ed00|1|5146|right` cut 5146 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|9f35aec3-1d29-40bb-8c5a-fa1be9fe2125|1|5149|right` cut 5149 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|924d8d80-92a5-4b75-93a1-70cea9376180|1|5151|right` cut 5151 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|148ddbcc-c195-4ccd-9576-da72a837df83|1|5164|right` cut 5164 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|69464602-93fd-4839-8df8-63cfdcb19c1a|1|5165|right` cut 5165 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|bf97193c-6ff7-4a16-9f2f-a4251c3eb154|1|5211|right` cut 5211 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|83367af8-6255-41d9-9e91-ea559fb8a5db|1|5226|right` cut 5226 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|1f40f0f1-02a7-45de-87ca-4620614a25a1|1|5240|right` cut 5240 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|f9e47a99-a70d-47e6-9732-3618249cd1a2|1|5261|right` cut 5261 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|3ca4e404-ca5a-439c-971c-74fa644ecac5|1|5265|right` cut 5265 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|d93f83d7-08af-40f3-a036-ca315d1a6fdd|1|5266|right` cut 5266 right
- `d9ccb545-25db-4262-b383-794ab3272ec7|fa388fc4-8f78-4b97-a394-d66140405706|1|5276|right` cut 5276 right
- `0c58c033-f2e7-4aa5-ad8c-80b081a83932|8f7d2d15-2c2d-4227-b0f0-d24d770b7fbe|2|425|right` cut 425 right
- `0c58c033-f2e7-4aa5-ad8c-80b081a83932|7c552493-96b6-4ead-832a-a6b3d471eb31|2|427|right` cut 427 right
- `0c58c033-f2e7-4aa5-ad8c-80b081a83932|aaff2a3f-d03d-4d22-9ac4-94ee55765c84|2|2269|left` cut 2269 left

### SUPPORT_OUTSIDE_UZ

- `0c58c033-f2e7-4aa5-ad8c-80b081a83932|269cf493-35e6-4145-a4a2-997b775eff50|2|756|left` cut 756 left

### SUPPORT_FOUND_BUT_GEOMETRICALLY_IMPLAUSIBLE

- *(aucun)*

### NO_SUPPORT_FOUND

- *(aucun)*

### INCONCLUSIVE

- *(aucun)*

## Cas intéressants

### Cut 326 right

- Clé : `92dbb85e-9534-4de6-83c5-289d3ecdf766|5cc47c6d-0f86-4bd2-a896-eff610c9d21b|1|326|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 66 · z médian 0.0085 · width 0.063992
- Min loss moteur : u=-0.074 z=-0.04 loss=0.0009930297663550947 topRows=0 · borne Z=true borne U=false
- A nSupported=0 · B=0 · C=165 · D=289 · E=502
- Meilleur support : {"u":-0.17,"z":0.005,"topRows":35,"loss":0.000051340772621068414,"faceCount":5,"binsTop":8,"slopeLimited":false,"topSlope":0.043373617519773366,"outsideU":true,"outsideZ":false,"distOutside":0.08999999999999998,"distSeed":0.1700735135169495,"plausible":true}

### Cut 5083 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|ed020057-9947-4bd8-892f-fe51c54c5313|1|5083|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 70 · z médian 0.0079 · width 0.063992
- Min loss moteur : u=0.079 z=-0.04 loss=0.001176891532292201 topRows=0 · borne Z=true borne U=true
- A nSupported=0 · B=0 · C=206 · D=275 · E=625
- Meilleur support : {"u":-0.176,"z":0.008,"topRows":32,"loss":0.0000196299973420906,"faceCount":5,"binsTop":7,"slopeLimited":false,"topSlope":0.0543969452297446,"outsideU":true,"outsideZ":false,"distOutside":0.09599999999999999,"distSeed":0.1761817243643619,"plausible":true}

### Cut 5084 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|1662e842-7a01-4766-817a-88121218a3ef|1|5084|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 87 · z médian 0.0048 · width 0.063992
- Min loss moteur : u=-0.002 z=-0.04 loss=0.0006806423365322925 topRows=0 · borne Z=true borne U=false
- A nSupported=0 · B=0 · C=441 · D=230 · E=703
- Meilleur support : {"u":-0.182,"z":0.008,"topRows":37,"loss":0.00012104170280187111,"faceCount":0,"binsTop":8,"slopeLimited":false,"topSlope":0.1742344672684908,"outsideU":true,"outsideZ":false,"distOutside":0.102,"distSeed":0.18217573932881403,"plausible":true}

### Cut 5085 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|6adb7d89-ab3a-4ab8-a325-d7dd40166733|1|5085|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 77 · z médian 0.0108 · width 0.063992
- Min loss moteur : u=-0.029 z=-0.04 loss=0.0007764191898567606 topRows=0 · borne Z=true borne U=false
- A nSupported=0 · B=0 · C=164 · D=269 · E=464
- Meilleur support : {"u":-0.176,"z":0.008,"topRows":47,"loss":0.00003870583278598774,"faceCount":4,"binsTop":8,"slopeLimited":false,"topSlope":0.05383559468561261,"outsideU":true,"outsideZ":false,"distOutside":0.09599999999999999,"distSeed":0.1761817243643619,"plausible":true}

### Cut 5087 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|f0e4410e-ad2b-4ea3-ad67-ccca1fa7b4a0|1|5087|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 73 · z médian 0.0098 · width 0.063992
- Min loss moteur : u=-0.044 z=-0.037 loss=0.0006428727109015754 topRows=0 · borne Z=false borne U=false
- A nSupported=0 · B=0 · C=144 · D=251 · E=450
- Meilleur support : {"u":-0.185,"z":0.008,"topRows":38,"loss":0.00015942207461771047,"faceCount":0,"binsTop":7,"slopeLimited":false,"topSlope":0.17668679654685282,"outsideU":true,"outsideZ":false,"distOutside":0.105,"distSeed":0.1851728921845744,"plausible":true}

### Cut 5088 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|5718fbfe-c435-4589-86be-5b1b647c9b9f|1|5088|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 64 · z médian 0.0127 · width 0.063992
- Min loss moteur : u=0.001 z=-0.001 loss=0.0012500002000000003 topRows=0 · borne Z=false borne U=false
- A nSupported=0 · B=0 · C=67 · D=271 · E=342
- Meilleur support : {"u":-0.173,"z":0.008,"topRows":44,"loss":0.00007062035317102876,"faceCount":4,"binsTop":7,"slopeLimited":false,"topSlope":0.05034408285338571,"outsideU":true,"outsideZ":false,"distOutside":0.09299999999999999,"distSeed":0.17318487231857174,"plausible":true}

### Cut 5089 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|35326a18-0e61-4415-8f9c-1d3259431530|1|5089|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 67 · z médian 0.0104 · width 0.063992
- Min loss moteur : u=-0.029 z=-0.04 loss=0.0010038180551791814 topRows=0 · borne Z=true borne U=false
- A nSupported=0 · B=0 · C=148 · D=274 · E=505
- Meilleur support : {"u":-0.179,"z":0.008,"topRows":39,"loss":0.00022270393443059506,"faceCount":0,"binsTop":7,"slopeLimited":false,"topSlope":0.08700780965879629,"outsideU":true,"outsideZ":false,"distOutside":0.09899999999999999,"distSeed":0.17917868176767013,"plausible":true}

### Cut 5090 right

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|c1f00c8d-6228-423e-82b8-d98fb7135255|1|5090|right`
- Catégorie : `SUPPORT_OUTSIDE_U`
- Points locaux : 71 · z médian 0.0100 · width 0.063992
- Min loss moteur : u=-0.029 z=-0.04 loss=0.0010148176840814708 topRows=0 · borne Z=true borne U=false
- A nSupported=0 · B=0 · C=132 · D=259 · E=426
- Meilleur support : {"u":-0.179,"z":0.011,"topRows":46,"loss":0.00012268923487232994,"faceCount":0,"binsTop":7,"slopeLimited":false,"topSlope":0.1145150420031271,"outsideU":true,"outsideZ":false,"distOutside":0.09899999999999999,"distSeed":0.1793376703316958,"plausible":true}


## Conclusion technique (prochaine expérience)

Les extensions A–E ne sont pas des candidats d’intégration. **Ne pas** promouvoir `searchY=0,20` : `maxSingleRailLateral=0,06` rejetterait encore un déplacement de 0,17 m, et Geometry Prototype V1 a déjà montré qu’élargir naïvement une borne est régressif sur les témoins.

Si la masse des 53 est `SUPPORT_OUTSIDE_U` :
1. Le générateur ne manque pas de résolution (B_DENSE = 0).
2. Il ne « n’a pas de solution » : un plan de roulement `topRows` 20–30 existe vers |u|≈0,17, z≈z_nuage.
3. Prochaine expérience utile : **re-centrage U** (graine sur la médiane U du nuage local, ou fenêtre glissante), mesuré sur les mêmes 53 + témoins, sans toucher searchZ.

Les 6 cas 4+2 restent hors périmètre. Cut 756 / 836 (gauche) sont des exceptions où Z sort aussi du domaine.

Ne pas transformer ce laboratoire en nouvelle version Banane.
