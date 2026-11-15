# Base de la garde de pose, Vision 18 (CH-116, 15/11, demandée par l'intégrateur)

`datasets/garde-gcv2/base-vision18.json`, à côté de `base-test18.json` (inchangée). Mêmes 12 lots, mêmes vérités (mêmes octets, `verites/`), même manifeste et mêmes pertes acceptées (`manifeste.json`), mêmes leviers de banc (`deuxiemePasse 2`, `passe2Leviers.sansVoieRien`).

## Comment
1. Tronc `claude/50-test17` à e65348f (`src/` et `tools/` identiques au build 581fa4b de la Vision 18). N allumé sans réglage : `reglerLeviers(null).ancre = true` ; en-tête des rejeux : `ancre: true`, `ajustementFin: null` (seules différences d'en-tête avec base-test18).
2. `BANANE_LOTS=… node tools/garde-gcv2.cjs comparer --base datasets/garde-gcv2/base-test18.json --rejouer` (un lot à la fois) : rejeux du tronc.
3. `garde-gcv2.cjs sceller --manifeste manifeste.json --rejeux <ces rejeux> --verites verites --commit e65348f… --version "Vision 18"`, dans un dossier à part (`sceller` réécrit le `SHA256SUMS` de son dossier avec la seule nouvelle base). Puis `base-vision18.json` copiée dans `datasets/garde-gcv2/` et `SHA256SUMS` recalculé (sha256 des deux bases et des 12 vérités) : une seule ligne ajoutée, `sha256sum -c` vert.

## Preuves (ÉTABLI)
- Tronc contre `base-test18.json` (`--rejouer`) : retour 1, 9 reculs : 3 « cuts laissés sans pose » (sans passe : reglage-9 25→27, 3:0 14→18, terrain 23-10 98→105) et 6 « verts changés » (2-18 203, 451 ; 3-0 843, 861, 864, 867 ; 0-2310-lot1 199 ; 0-2310-lot2 282). Ce sont les 13 refus de N déjà jugés (liste identique à `refus-N.csv` de CH-124, 13 vraies corrections, 0 autre cut changé contre le livré) ; aucun autre recul.
- Tronc contre `base-vision18.json` : retour 0 (`--rejeux` des mêmes rejeux ; `--rejouer` : voir plus bas). 2 signalements : « perte acceptée sans objet » 2-17 9521, 9522 (déjà sans pose en base Vision 18).
- Depuis le même dossier, après le recalcul des sommes : la garde se rend sur les deux bases (retour 1 sur base-test18, identique au passage `--rejouer` ; retour 0 sur base-vision18). `node --test tests/garde-gcv2.test.cjs` : 15/15 vert (tronc et branche).
- Rejeux du tronc contre ceux de fed03f7 (`v18-n`) : décisions et poses identiques ; seuls les diagnostics d'ancre (`ecartMm`, `axeMm`) bougent, de 1 mm au plus (4 lots ; `tools/banc-differes.cjs` a changé de 3 lignes entre les deux).

## Écart de recalcul entre les deux bases, ligne à ligne (2 362 cuts ; 21 différents)
**Les 13 refus de N** (les deux colonnes, sans et avec passe) :
- posés justes en base (« verts ») → différés : 2-18 203, 2-18 451, 3-0 843, 3-0 861, 3-0 864, 3-0 867, 0-2310-lot1 199, 0-2310-lot2 282 ;
- posés GCV2 en mauvaise voie → différés : 0-2310-lot1 201 (225,2 mm), 1134 (135,2), 1373 (117,4) ; 0-2310-lot2 1325 (220,4), 1333 (288,8).
Contre la vérité, les 13 poses refusées sont à 117 à 289 mm (les 8 « verts » le sont au sens de la base, pas de la vérité : vraies corrections, R6).

**8 cuts de la colonne « avec passe » seulement, déjà changés dans le livré SANS N** (même état dans le rejeu `ancre:null` de fed03f7 ; la garde éteinte les signalait : reglage-9 avec passe 12→14, terrain 79→83) :
- 2-17 9521 (2,74 mm), 9522 (2,57 mm) : posés par la passe → différés (garde-appuis) : les deux pertes acceptées de D-252 ;
- 0-2310-lot1 1135 (150,3 mm, veto-voie-absolue), 0-2310-lot2 1328 (212,4, garde-appuis), 1329 (236,1, recherche ADV contredite), 1331 (232,5, garde-appuis), 1332 (265,8, sans approche) : poses de la passe en mauvaise voie → différés ;
- 0-2310-lot1 1132 : différé → posé par la passe à 4,7 mm.
La base Vision 18 enregistre donc aussi ces 8 changements, faits avant N. base-test18 ne les comptait que comme pertes acceptées ou signalements.

Rien d'autre ne change : groupes recalculés en conséquence, mêmes paramètres (gcv2-g1b-1), mêmes leviers de banc.
