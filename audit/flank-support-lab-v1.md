# Flank Support Lab V1

Lot **EXPÉRIMENTAL**. Branche `lab-geometry-prototype-v1`. Aucun merge, aucune conclusion de production, aucune action ESV.

**Statut du lot : `INCONCLUSIVE`.** Récupérations publiées (status `candidate`) : **0**.

- Base : `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` (`src/geometry-baseline.js`)
- Géométrie courante : `21701c6de3e0f61f1000a609017de5b43c3eef83e901524e8fbd0a89d1f560ad`
- Baseline inchangée : **oui**
- Données : `StoryNow30/banane-data` `infra/materialized-native-v46-v1` `@d541686d3a98569125cdbdb261ef121c9f533d6a`
- Rails assemblés : **221** (témoins 162, RSF 59)
- Cibles 4+2 : **6** — les 53 sans support de grille sont hors périmètre
- Durée : 36.3 s

## Conclusions

1. **Aucune récupération candidate sûre.** Les variantes A–F n’ont transformé aucun des 6 rails en `candidate`. Un changement de motif d’abstention n’est pas une publication. Ne pas forcer un résultat positif.
2. **Les 6 ont un plan de roulement fragile, pas un plan absent.** Après C+D, `robustLine` passe (topRows 3–7) mais **aucun** n’atteint `minTop=15`. Le plus fort est cut 826 (7 points).
3. **Le flanc n’est pas caché par le clipping.** Aucune cible n’a ≥3 points de flanc exclus par clip. Présence : `{"structure-de-flanc-absente-du-nuage-local":3,"flanc-clairseme-sous-robustLine":2,"flanc-partiel-dans-la-fenetre-moteur":1}`. Le critère exige une nappe (3 points, puis 6) dans `|u−best.u|<0,01` et drop 9–34×10⁻³ — structure souvent absente du nuage local.
4. **Cut 839 est le seul flanc partiel réel** (3 points, `robustLine` du flanc existe). `DIAG_CD_MINTHRESH` le fait sortir vers l’ambiguïté (ratio 1,23 < 1,5), pas vers une candidate. Cut 826/2335 ont 2 et 1 points (sous le plancher 3). Cuts 5098/228 ont un seed latéral collé à `searchY` et 0 point de flanc. Cut 742 a une pente de roulement saturée à −0,5.
5. **Ne pas remplacer minFace par un ratio du dessus.** `D_RELATIVE_FACE` perd **153** témoins : un rail publié a souvent beaucoup de points sur le dessus et seulement 6–8 sur le flanc ; le ratio 6/15 exige alors 10–20 points de flanc.
6. **`DIAG_CD_MINTHRESH` reste diagnostique** : 0 candidate, 0 témoin perdu. Ne pas le présenter comme candidat.
7. **Les 53 sans support de grille restent hors périmètre.**

### Statuts A–F

| variante | famille | statut | RSF récupérés | motif d’abstention changé (6) | témoins perdus | témoins déplacés | ambiguïtés nouvelles |
|---|---|---|---:|---:|---:|---:|---:|
| `A_FLANK_UNCHANGED` | A | **NEUTRAL** | 0 | 6 | 0 | 0 | 0 |
| `B_MINTOP_ISOLATED` | B | **NEUTRAL** | 0 | 6 | 0 | 0 | 0 |
| `C_ADAPTIVE_FACE` | C | **NEUTRAL** | 0 | 6 | 0 | 0 | 0 |
| `D_RELATIVE_FACE` | D | **REGRESSIVE** | 0 | 6 | 153 | 0 | 0 |
| `E_PARTIAL_FACE_KEEP` | E | **NEUTRAL** | 0 | 6 | 0 | 0 | 0 |
| `F_EXPLICIT_ABSTAIN` | F | **NEUTRAL** | 0 | 6 | 0 | 0 | 0 |
| `DIAG_CD_MINTHRESH` | diag | **NEUTRAL** | 0 | 6 | 0 | 0 | 1 |

### Conservés comme leviers diagnostiques

- `A_FLANK_UNCHANGED`
- `B_MINTOP_ISOLATED`
- `C_ADAPTIVE_FACE`
- `E_PARTIAL_FACE_KEEP`
- `F_EXPLICIT_ABSTAIN`
- `DIAG_CD_MINTHRESH`

### Écartés comme candidats

- `D_RELATIVE_FACE`

## Liste exacte des 6 cas

| rail | famille | topRows coarse | topRows raffiné | topRows C+D | minTop | faceStrict | pente limitée | présence | motif minTop=3/minFace=3 |
|---|---|---:|---:|---:|---:|---:|---|---|---|
| `3876864f-a864-4678-b7b0-3feecc4af418|2a62d36a-664b-4030-83d7-348ec57f11b4|1|5098|left` | `raffinement-a-quitte-le-support` | 3 | 1 | 3 | 15 | 0 | non | structure-de-flanc-absente-du-nuage-local | Flanc interne insuffisamment observé. |
| `0c58c033-f2e7-4aa5-ad8c-80b081a83932|15c0c1da-def9-4fb7-b23e-2310771e7ea7|2|228|right` | `support-ailleurs-mais-perte-nettement-superieure` | 2 | 0 | 4 | 15 | 0 | non | structure-de-flanc-absente-du-nuage-local | Flanc interne insuffisamment observé. |
| `0c58c033-f2e7-4aa5-ad8c-80b081a83932|32cb7e14-93cc-4249-8f1c-b59ac3d09139|2|742|right` | `support-ailleurs-mais-perte-nettement-superieure` | 2 | 2 | 3 | 15 | 0 | oui | structure-de-flanc-absente-du-nuage-local | Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. |
| `0c58c033-f2e7-4aa5-ad8c-80b081a83932|312d7db2-eb41-48ef-9b24-968af93c005a|2|826|right` | `support-ailleurs-mais-perte-nettement-superieure` | 2 | 2 | 7 | 15 | 2 | non | flanc-clairseme-sous-robustLine | Flanc interne insuffisamment observé. |
| `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a6286fda-0c67-4a54-b857-aac03998ddfc|2|839|right` | `raffinement-a-quitte-le-support` | 3 | 2 | 3 | 15 | 3 | non | flanc-partiel-dans-la-fenetre-moteur | Plusieurs placements concurrents du champignon sont géométriquement plausibles. |
| `0c58c033-f2e7-4aa5-ad8c-80b081a83932|ce9be984-2a77-4311-941c-93448e7d443b|2|2335|right` | `support-ailleurs-mais-perte-nettement-superieure` | 2 | 2 | 3 | 15 | 1 | non | flanc-clairseme-sous-robustLine | Flanc interne insuffisamment observé. |

## Rail par rail

### Cut 5098 left — `raffinement-a-quitte-le-support`

- Clé : `3876864f-a864-4678-b7b0-3feecc4af418|2a62d36a-664b-4030-83d7-348ec57f11b4|1|5098|left`
- Session : `3876864f-a864-4678-b7b0-3feecc4af418` · part 1
- Landscape : topRows coarse **3**, raffiné **1**, grille supportée **135**
- Placement C+D : seed `[0.07300000000000006,-0.04]`, loss `0.000535`, topRows **3**, faceCount **0**
- Pente roulement : `0.00` (raw `0.00`, limitée : non)
- Pente flanc : `—` (limitée : non)
- Ratio d’ambiguïté : `1.175` (seuil 1,5) · alternative `[0.07900000000000007,-0.0010000000000000018]`
- Motif A (flanc inchangé) : *Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé.*
- Points moteur (clip ∩ fenêtre) : **73** · clipés dans la fenêtre : **174** · raw total : 1332
- Fenêtre de flanc stricte : **0** · bande×2 : **0** · drop élargi : **0** · boîte z : **0** · flanc près de u=0 : **0**
- Points de flanc exclus par clipping (fenêtre stricte) : **1**
- Présence : `structure-de-flanc-absente-du-nuage-local`
- Ancres profil : top 7 · face 5 · width `0.0640`
- Témoins comparables :
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|c0586b61-9753-4664-a1c0-494906f8007f|8|9686|left` cut 9686 left · topRows 15 · faceCount 7 · Δcut 4588
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|0ee8e953-5a50-47f1-ad6f-e187dd380029|2|154|left` cut 154 left · topRows 16 · faceCount 6 · Δcut 4944
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5c478f42-1ea1-48ad-93ec-8e14618b8daa|8|9644|left` cut 9644 left · topRows 18 · faceCount 8 · Δcut 4546
  - `06c77393-ecb3-4aa1-84e8-7fd9c5b60c7f|d4a4fef1-8b1f-4fe9-83e2-80b001005587|1|2359|left` cut 2359 left · topRows 19 · faceCount 6 · Δcut 2739

| variante | status | motif | top | face |
|---|---|---|---:|---:|
| `A_FLANK_UNCHANGED` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `B_MINTOP_ISOLATED` | unresolved | Flanc interne insuffisamment observé. | 3 | 0 |
| `C_ADAPTIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `D_RELATIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `E_PARTIAL_FACE_KEEP` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `F_EXPLICIT_ABSTAIN` | unresolved | Plan de roulement insuffisamment observé. Flanc interne absent de la fenêtre d’observation ; abstention. | 3 | 0 |
| `DIAG_CD_MINTHRESH` | unresolved | Flanc interne insuffisamment observé. | 3 | 0 |

### Cut 228 right — `support-ailleurs-mais-perte-nettement-superieure`

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|15c0c1da-def9-4fb7-b23e-2310771e7ea7|2|228|right`
- Session : `0c58c033-f2e7-4aa5-ad8c-80b081a83932` · part 2
- Landscape : topRows coarse **2**, raffiné **0**, grille supportée **48**
- Placement C+D : seed `[-0.07900000000000007,-0.027999999999999997]`, loss `0.000445`, topRows **4**, faceCount **0**
- Pente roulement : `-0.118` (raw `-0.118`, limitée : non)
- Pente flanc : `—` (limitée : non)
- Ratio d’ambiguïté : `1.448` (seuil 1,5) · alternative `[-0.061000000000000054,-0.037]`
- Motif A (flanc inchangé) : *Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé.*
- Points moteur (clip ∩ fenêtre) : **64** · clipés dans la fenêtre : **33** · raw total : 3145
- Fenêtre de flanc stricte : **0** · bande×2 : **0** · drop élargi : **0** · boîte z : **0** · flanc près de u=0 : **0**
- Points de flanc exclus par clipping (fenêtre stricte) : **0**
- Présence : `structure-de-flanc-absente-du-nuage-local`
- Ancres profil : top 7 · face 5 · width `0.0640`
- Témoins comparables :
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|e5251564-68d6-405e-a826-fc8adaea0460|2|451|right` cut 451 right (même session) · topRows 45 · faceCount 6 · Δcut 223
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|b6c0ea6f-cb30-4547-adec-3b81ac65e11d|2|741|right` cut 741 right (même session) · topRows 25 · faceCount 6 · Δcut 513
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|c0ff8ed7-5958-4196-befd-aac1aa1d1035|2|751|right` cut 751 right (même session) · topRows 33 · faceCount 8 · Δcut 523
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|7fcdc3a8-98c9-4e7f-be61-35b17b2caf48|2|788|right` cut 788 right (même session) · topRows 41 · faceCount 8 · Δcut 560

| variante | status | motif | top | face |
|---|---|---|---:|---:|
| `A_FLANK_UNCHANGED` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 4 | 0 |
| `B_MINTOP_ISOLATED` | unresolved | Flanc interne insuffisamment observé. | 4 | 0 |
| `C_ADAPTIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 4 | 0 |
| `D_RELATIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 4 | 0 |
| `E_PARTIAL_FACE_KEEP` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 4 | 0 |
| `F_EXPLICIT_ABSTAIN` | unresolved | Plan de roulement insuffisamment observé. Flanc interne absent de la fenêtre d’observation ; abstention. | 4 | 0 |
| `DIAG_CD_MINTHRESH` | unresolved | Flanc interne insuffisamment observé. | 4 | 0 |

### Cut 742 right — `support-ailleurs-mais-perte-nettement-superieure`

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|32cb7e14-93cc-4249-8f1c-b59ac3d09139|2|742|right`
- Session : `0c58c033-f2e7-4aa5-ad8c-80b081a83932` · part 2
- Landscape : topRows coarse **2**, raffiné **2**, grille supportée **178**
- Placement C+D : seed `[0.0019999999999999653,0.022999999999999996]`, loss `0.0000627`, topRows **3**, faceCount **0**
- Pente roulement : `-0.500` (raw `-0.527`, limitée : oui)
- Pente flanc : `—` (limitée : non)
- Ratio d’ambiguïté : `1.999` (seuil 1,5) · alternative `[0.02299999999999996,0.028999999999999995]`
- Motif A (flanc inchangé) : *Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée.*
- Points moteur (clip ∩ fenêtre) : **90** · clipés dans la fenêtre : **45** · raw total : 1095
- Fenêtre de flanc stricte : **0** · bande×2 : **0** · drop élargi : **1** · boîte z : **1** · flanc près de u=0 : **1**
- Points de flanc exclus par clipping (fenêtre stricte) : **0**
- Présence : `structure-de-flanc-absente-du-nuage-local`
- Ancres profil : top 7 · face 5 · width `0.0640`
- Témoins comparables :
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|b6c0ea6f-cb30-4547-adec-3b81ac65e11d|2|741|right` cut 741 right (même session) · topRows 25 · faceCount 6 · Δcut 1
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|c0ff8ed7-5958-4196-befd-aac1aa1d1035|2|751|right` cut 751 right (même session) · topRows 33 · faceCount 8 · Δcut 9
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|7fcdc3a8-98c9-4e7f-be61-35b17b2caf48|2|788|right` cut 788 right (même session) · topRows 41 · faceCount 8 · Δcut 46
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a2611ac0-a08b-4fec-9f79-7985118e67b2|2|815|right` cut 815 right (même session) · topRows 57 · faceCount 6 · Δcut 73

| variante | status | motif | top | face |
|---|---|---|---:|---:|
| `A_FLANK_UNCHANGED` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. | 3 | 0 |
| `B_MINTOP_ISOLATED` | unresolved | Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. | 3 | 0 |
| `C_ADAPTIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. | 3 | 0 |
| `D_RELATIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. | 3 | 0 |
| `E_PARTIAL_FACE_KEEP` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. | 3 | 0 |
| `F_EXPLICIT_ABSTAIN` | unresolved | Plan de roulement insuffisamment observé. Flanc interne absent de la fenêtre d’observation ; abstention. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. | 3 | 0 |
| `DIAG_CD_MINTHRESH` | unresolved | Flanc interne insuffisamment observé. Inclinaison estimée hors du domaine du modèle ; la pente ne sera pas forcée. | 3 | 0 |

### Cut 826 right — `support-ailleurs-mais-perte-nettement-superieure`

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|312d7db2-eb41-48ef-9b24-968af93c005a|2|826|right`
- Session : `0c58c033-f2e7-4aa5-ad8c-80b081a83932` · part 2
- Landscape : topRows coarse **2**, raffiné **2**, grille supportée **267**
- Placement C+D : seed `[0.021999999999999957,-0.030999999999999986]`, loss `0.0000370`, topRows **7**, faceCount **0**
- Pente roulement : `-0.0145` (raw `-0.0145`, limitée : non)
- Pente flanc : `—` (limitée : non)
- Ratio d’ambiguïté : `1.393` (seuil 1,5) · alternative `[-0.004000000000000035,-0.033999999999999996]`
- Motif A (flanc inchangé) : *Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé.*
- Points moteur (clip ∩ fenêtre) : **78** · clipés dans la fenêtre : **27** · raw total : 626
- Fenêtre de flanc stricte : **2** · bande×2 : **2** · drop élargi : **2** · boîte z : **2** · flanc près de u=0 : **3**
- Points de flanc exclus par clipping (fenêtre stricte) : **0**
- Présence : `flanc-clairseme-sous-robustLine`
- Ancres profil : top 7 · face 5 · width `0.0640`
- Témoins comparables :
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|00687e7f-79c9-46fe-b5e2-3e53b8dbc54d|2|820|right` cut 820 right (même session) · topRows 46 · faceCount 8 · Δcut 6
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|bfcecbb3-cadb-4cc5-bad9-8d9669b7044f|2|818|right` cut 818 right (même session) · topRows 49 · faceCount 7 · Δcut 8
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|aae1ee2b-0b5f-4eac-956c-b38e2c29c6d8|2|816|right` cut 816 right (même session) · topRows 40 · faceCount 7 · Δcut 10
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a2611ac0-a08b-4fec-9f79-7985118e67b2|2|815|right` cut 815 right (même session) · topRows 57 · faceCount 6 · Δcut 11

| variante | status | motif | top | face |
|---|---|---|---:|---:|
| `A_FLANK_UNCHANGED` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 7 | 0 |
| `B_MINTOP_ISOLATED` | unresolved | Flanc interne insuffisamment observé. | 7 | 0 |
| `C_ADAPTIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 7 | 0 |
| `D_RELATIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 7 | 0 |
| `E_PARTIAL_FACE_KEEP` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 7 | 0 |
| `F_EXPLICIT_ABSTAIN` | unresolved | Plan de roulement insuffisamment observé. Flanc interne trop clairsemé pour estimer une nappe ; abstention. | 7 | 0 |
| `DIAG_CD_MINTHRESH` | unresolved | Flanc interne insuffisamment observé. | 7 | 0 |

### Cut 839 right — `raffinement-a-quitte-le-support`

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|a6286fda-0c67-4a54-b857-aac03998ddfc|2|839|right`
- Session : `0c58c033-f2e7-4aa5-ad8c-80b081a83932` · part 2
- Landscape : topRows coarse **3**, raffiné **2**, grille supportée **212**
- Placement C+D : seed `[-0.0010000000000000347,-0.004000000000000002]`, loss `0.0000571`, topRows **3**, faceCount **3**
- Pente roulement : `-0.303` (raw `-0.303`, limitée : non)
- Pente flanc : `0.00` (limitée : non)
- Ratio d’ambiguïté : `1.235` (seuil 1,5) · alternative `[0.016999999999999963,-0.016]`
- Motif A (flanc inchangé) : *Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé.*
- Points moteur (clip ∩ fenêtre) : **81** · clipés dans la fenêtre : **26** · raw total : 816
- Fenêtre de flanc stricte : **3** · bande×2 : **4** · drop élargi : **3** · boîte z : **3** · flanc près de u=0 : **3**
- Points de flanc exclus par clipping (fenêtre stricte) : **0**
- Présence : `flanc-partiel-dans-la-fenetre-moteur`
- Ancres profil : top 7 · face 5 · width `0.0640`
- Témoins comparables :
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|64577697-0fd5-46d9-860f-f8df984f8d9c|2|840|right` cut 840 right (même session) · topRows 33 · faceCount 6 · Δcut 1
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|00687e7f-79c9-46fe-b5e2-3e53b8dbc54d|2|820|right` cut 820 right (même session) · topRows 46 · faceCount 8 · Δcut 19
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|bfcecbb3-cadb-4cc5-bad9-8d9669b7044f|2|818|right` cut 818 right (même session) · topRows 49 · faceCount 7 · Δcut 21
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|aae1ee2b-0b5f-4eac-956c-b38e2c29c6d8|2|816|right` cut 816 right (même session) · topRows 40 · faceCount 7 · Δcut 23

| variante | status | motif | top | face |
|---|---|---|---:|---:|
| `A_FLANK_UNCHANGED` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 3 |
| `B_MINTOP_ISOLATED` | unresolved | Flanc interne insuffisamment observé. | 3 | 3 |
| `C_ADAPTIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. | 3 | 3 |
| `D_RELATIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. | 3 | 3 |
| `E_PARTIAL_FACE_KEEP` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 3 |
| `F_EXPLICIT_ABSTAIN` | unresolved | Plan de roulement insuffisamment observé. Flanc interne partiellement observé ; abstention plutôt que publication. | 3 | 3 |
| `DIAG_CD_MINTHRESH` | unresolved | Plusieurs placements concurrents du champignon sont géométriquement plausibles. | 3 | 3 |

### Cut 2335 right — `support-ailleurs-mais-perte-nettement-superieure`

- Clé : `0c58c033-f2e7-4aa5-ad8c-80b081a83932|ce9be984-2a77-4311-941c-93448e7d443b|2|2335|right`
- Session : `0c58c033-f2e7-4aa5-ad8c-80b081a83932` · part 2
- Landscape : topRows coarse **2**, raffiné **2**, grille supportée **95**
- Placement C+D : seed `[0.013999999999999964,-0.013000000000000001]`, loss `0.000126`, topRows **3**, faceCount **0**
- Pente roulement : `-0.260` (raw `-0.260`, limitée : non)
- Pente flanc : `—` (limitée : non)
- Ratio d’ambiguïté : `4.115` (seuil 1,5) · alternative `[-0.007000000000000035,-0.019]`
- Motif A (flanc inchangé) : *Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé.*
- Points moteur (clip ∩ fenêtre) : **69** · clipés dans la fenêtre : **24** · raw total : 923
- Fenêtre de flanc stricte : **1** · bande×2 : **1** · drop élargi : **1** · boîte z : **1** · flanc près de u=0 : **2**
- Points de flanc exclus par clipping (fenêtre stricte) : **0**
- Présence : `flanc-clairseme-sous-robustLine`
- Ancres profil : top 7 · face 5 · width `0.0640`
- Témoins comparables :
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|bc197d83-3ed9-4e65-bb02-8bd882649c24|2|1672|right` cut 1672 right (même session) · topRows 41 · faceCount 6 · Δcut 663
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|4acf3728-1f82-4de9-9599-6191d28d8f61|2|1368|right` cut 1368 right (même session) · topRows 39 · faceCount 6 · Δcut 967
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|64577697-0fd5-46d9-860f-f8df984f8d9c|2|840|right` cut 840 right (même session) · topRows 33 · faceCount 6 · Δcut 1495
  - `0c58c033-f2e7-4aa5-ad8c-80b081a83932|00687e7f-79c9-46fe-b5e2-3e53b8dbc54d|2|820|right` cut 820 right (même session) · topRows 46 · faceCount 8 · Δcut 1515

| variante | status | motif | top | face |
|---|---|---|---:|---:|
| `A_FLANK_UNCHANGED` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `B_MINTOP_ISOLATED` | unresolved | Flanc interne insuffisamment observé. | 3 | 0 |
| `C_ADAPTIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `D_RELATIVE_FACE` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `E_PARTIAL_FACE_KEEP` | unresolved | Plan de roulement insuffisamment observé. Flanc interne insuffisamment observé. | 3 | 0 |
| `F_EXPLICIT_ABSTAIN` | unresolved | Plan de roulement insuffisamment observé. Flanc interne trop clairsemé pour estimer une nappe ; abstention. | 3 | 0 |
| `DIAG_CD_MINTHRESH` | unresolved | Flanc interne insuffisamment observé. | 3 | 0 |

## Retrace du critère de flanc

Le moteur, après avoir choisi `(best.u, best.z)` et ajusté une nappe de roulement `z = slope·u + intercept`, retient comme flanc interne les points du nuage local tels que :

1. `visibleByClipBoxes !== false` (clipping ESV) ;
2. fenêtre locale `|along| ≤ 0,5`, `|y| < 0,18`, `|z| < 0,10` ;
3. `|u − best.u| < faceBand` avec `faceBand = 0,01` ;
4. `drop = slope·u + intercept − z` ∈ `(0,009 ; 0,034)`.

Il faut **6** points (`minFace`) pour publier, et **3** pour que `robustLine` existe. Ces seuils **ne dépendent pas** du nombre de points réellement visibles dans la zone. Si le clipping ou la fenêtre enlèvent les points du flanc, le critère exige une structure que le nuage *observé* ne contient plus — même si des points existent hors clip.

Les 53 RSF sans aucun support de grille n’atteignent pas cette porte.

## Cohorte de témoins comparable

Sélection : même session et même côté lorsque c’est possible, plus proches cuts ; à défaut même côté, plus petit `topRows` encore publié (proche du seuil 15). Tous ont un plan de roulement **et** un flanc acceptés à la baseline.

| cible | n témoins | dont même session+côté |
|---|---:|---:|
| cut 5098 left | 4 | 0 |
| cut 228 right | 4 | 4 |
| cut 742 right | 4 | 4 |
| cut 826 right | 4 | 4 |
| cut 839 right | 4 | 4 |
| cut 2335 right | 4 | 4 |

Témoins uniques : **15**.

## Ablations

### `A_FLANK_UNCHANGED` — NEUTRAL

- Famille : **A**
- Hypothèse : C+D, critère de flanc actuel inchangé (minTop=15, minFace=6)
- Options : `{"lab":{"preferSupported":true,"preserveCoarseSupport":true}}`
- RSF récupérés (221) : **0** dont cibles 4+2 : **0**
- Motifs d’abstention changés (cibles) : 6
- Témoins conservés : 162 · perdus : **0** · déplacés : **0**
- Ambiguïtés nouvelles : 0
- Rails récupérés : *(aucun)*

### `B_MINTOP_ISOLATED` — NEUTRAL

- Famille : **B**
- Hypothèse : C+D, seul minTop=3 ; minFace=6 inchangé
- Options : `{"minTop":3,"lab":{"preferSupported":true,"preserveCoarseSupport":true}}`
- RSF récupérés (221) : **0** dont cibles 4+2 : **0**
- Motifs d’abstention changés (cibles) : 6
- Témoins conservés : 162 · perdus : **0** · déplacés : **0**
- Ambiguïtés nouvelles : 0
- Rails récupérés : *(aucun)*

### `C_ADAPTIVE_FACE` — NEUTRAL

- Famille : **C**
- Hypothèse : C+D, minFace adapté à la visibilité de la zone de flanc (minTop=15 inchangé)
- Options : `{"lab":{"preferSupported":true,"preserveCoarseSupport":true,"adaptiveFace":true}}`
- RSF récupérés (221) : **0** dont cibles 4+2 : **0**
- Motifs d’abstention changés (cibles) : 6
- Témoins conservés : 162 · perdus : **0** · déplacés : **0**
- Ambiguïtés nouvelles : 0
- Rails récupérés : *(aucun)*

### `D_RELATIVE_FACE` — REGRESSIVE

- Famille : **D**
- Hypothèse : C+D, minFace relatif à topCount (6/15) plutôt qu’un nombre absolu ; minTop=15
- Options : `{"lab":{"preferSupported":true,"preserveCoarseSupport":true,"relativeFace":true}}`
- RSF récupérés (221) : **0** dont cibles 4+2 : **0**
- Motifs d’abstention changés (cibles) : 6
- Témoins conservés : 9 · perdus : **153** · déplacés : **0**
- Ambiguïtés nouvelles : 0
- Rails récupérés : *(aucun)*
- Témoins perdus :
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|475c29ef-69e3-494b-92c7-ba77d2e31d7e|8|8576|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|1e22be7b-1299-401e-b42a-6a437474bf33|8|8578|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|160fde92-e7d8-4d06-bcc4-8770cdb4d901|8|8580|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|ed212e43-60b3-449d-8a0e-cddc0ead7c79|8|9391|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|ed212e43-60b3-449d-8a0e-cddc0ead7c79|8|9391|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|8569d86d-b15e-47c9-bb05-af153b66f59f|8|9392|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|91fd7d79-3898-4a4f-9370-32bef37c1dde|8|9395|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|b1b2a5f1-d59b-4c0b-b782-3ad32ce534d6|8|9396|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|413f4fda-2e80-4861-9dea-d85182cd80ca|8|9401|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|cf8f3cc3-12f6-4b5d-bcc3-2582dd64d234|8|9402|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|62e0c936-b25b-48b7-ac7a-354da5f90e35|8|9403|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|2ee27155-354f-4ac1-ac1d-96898d15500e|8|9539|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|dd90541a-a01e-41c6-b920-becceffd20fc|8|9540|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|2eab86c3-ca24-499c-86c7-ebd51f97d56d|8|9541|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|768f0196-f0cd-4da2-961f-15e01389dc83|8|9542|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|d349e179-75ec-4cc0-a767-81813b9a4e12|8|9544|left`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|5a5d96b4-97c2-462e-8495-3228c4113414|8|9546|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|50c18bb8-6189-4087-9d42-c37a7e69a2a9|8|9548|right`
  - `f938b9f8-e2d7-47c6-bb08-5b00f3debe05|fcf812b8-bf52-4bc9-9646-823f24bd600d|8|9643|left`

### `E_PARTIAL_FACE_KEEP` — NEUTRAL

- Famille : **E**
- Hypothèse : C+D, conserver un candidat si le plan de roulement est fort (top≥15) et le flanc partiel (≥3) ; minFace sinon inchangé
- Options : `{"lab":{"preferSupported":true,"preserveCoarseSupport":true,"partialFaceKeep":true}}`
- RSF récupérés (221) : **0** dont cibles 4+2 : **0**
- Motifs d’abstention changés (cibles) : 6
- Témoins conservés : 162 · perdus : **0** · déplacés : **0**
- Ambiguïtés nouvelles : 0
- Rails récupérés : *(aucun)*

### `F_EXPLICIT_ABSTAIN` — NEUTRAL

- Famille : **F**
- Hypothèse : C+D, abstention explicite selon l’observation réelle du flanc ; aucun assouplissement de seuil
- Options : `{"lab":{"preferSupported":true,"preserveCoarseSupport":true,"explicitFaceAbstain":true}}`
- RSF récupérés (221) : **0** dont cibles 4+2 : **0**
- Motifs d’abstention changés (cibles) : 6
- Témoins conservés : 162 · perdus : **0** · déplacés : **0**
- Ambiguïtés nouvelles : 0
- Rails récupérés : *(aucun)*

### `DIAG_CD_MINTHRESH` — NEUTRAL

- Famille : **diag** (diagnostique, pas un candidat d’intégration a priori)
- Hypothèse : levier diagnostique C+D + minTop=minFace=3 — pas un candidat sauf publication réelle sans perte de témoins
- Options : `{"minTop":3,"minFace":3,"lab":{"preferSupported":true,"preserveCoarseSupport":true}}`
- RSF récupérés (221) : **0** dont cibles 4+2 : **0**
- Motifs d’abstention changés (cibles) : 6
- Témoins conservés : 162 · perdus : **0** · déplacés : **0**
- Ambiguïtés nouvelles : 1
- Rails récupérés : *(aucun)*

## Gains et régressions

- Gains (candidate nouvelle, témoins intacts) : *(aucun)*
- Régressions : `D_RELATIVE_FACE`
- Neutres : `A_FLANK_UNCHANGED`, `B_MINTOP_ISOLATED`, `C_ADAPTIVE_FACE`, `E_PARTIAL_FACE_KEEP`, `F_EXPLICIT_ABSTAIN`, `DIAG_CD_MINTHRESH`

## Commandes

```bash
node tools/flank-support-lab-v1.cjs --output audit/flank-support-lab-v1.json
node tools/flank-support-lab-v1.cjs --from-json audit/flank-support-lab-v1.json
node --test tests/flank-support-lab-v1.test.cjs tests/geometry-prototype-v1.test.cjs
```

Branche `lab-geometry-prototype-v1`. Ne pas merger.