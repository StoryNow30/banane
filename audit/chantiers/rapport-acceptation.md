# Chantier 4 — rapport d’acceptation automatique

**23 septembre 2026.** Outil `tools/acceptance-report.cjs` : les critères C1 à
C4 (cahier §6, §14 G, D-038) calculés de la même façon à chaque collecte F1 à
F4, partie par partie puis au total. Essai sur le lot Pilote 4.7.6 de la
partie 19 et comparaison avec l’amendement n°6 §6.2.

Base : commit `a74c225` (code 4.7.8, branche `claude/banane-48-cahier`).
Branche de travail : `claude/execute-attached-prompt-2eqnl7`, et non
`chantier-48/rapport-acceptation` comme le demande la consigne : la session
n’autorise la poussée que sur la branche qui lui est attribuée. La branche a été
avancée en *fast-forward* sur `a74c225` (aucun historique réécrit).

## 1. Fait

- **`tools/acceptance-report.cjs`** (CommonJS, aucune dépendance nouvelle).
  Entrée : un dossier par lot, contenant les exports JSON décompressés,
  reconnus par leur format (diagnostic GCV1, corpus GCV1 + LiDAR, journal du
  Pilote, segments de la relecture Natif). Sorties JSON et Markdown.
  Réutilise sans les dupliquer : `tools/merge-segments.cjs` (`mergeFiles`,
  fusion en mémoire de la relecture), `tools/placement-lab.cjs`
  (`referenceFor`, règles strictes de la référence humaine ; `distribution`,
  médiane et p90), `src/gauge.js` (écartement et contrat),
  `src/continuity-observer.js` (`translated`), `src/lot-decision.js` (rejeu).
- **`tools/placement-lab.cjs`** : seule modification d’un fichier existant,
  `distribution` ajoutée aux exports (une ligne, aucune logique changée).
- **Essais** : `tests/acceptance-report.test.cjs` (12 essais : C1 à C4,
  exclusions, repère, non jugeables, partie par partie, P2, déterminisme) et
  `tests/acceptance-report-lot.test.cjs` (5 essais : décision sur le lot,
  faux nouveaux, rejeu, parité, ligne de commande de bout en bout). Données
  synthétiques construites par `tests/helpers/acceptance-lot.cjs` : rails
  droits, aucune donnée terrain.
- **Relevé de la partie 19** : `audit/acceptance-p19-2026-09-23.json` et
  `audit/acceptance-p19-2026-09-23.md`.
- Aucun fichier gelé ni aucun fichier du moteur modifié (contrôle du banc,
  §2).

### Règles appliquées par l’outil

| Règle | Mise en œuvre |
|---|---|
| Cuts du lot | union des observations GCV1 du lot (`batchId`), des cuts traités et différés du journal, et des cuts dont le Pilote a relevé la pose AVANT après le départ du lot. Un cut atteint sans décision reste au dénominateur. |
| Revisite | un cut compte une fois ; les revisites sont comptées à part. |
| Issue du Pilote | faits persistés du diagnostic (`runtime` : application vérifiée et validation acceptée ; différé confirmé par `defer-finalized`), puis journal. « Refusé par l’écartement » : `pairGaugeRejected`. « Sans entrée » : aucune observation, erreur GCV1, capture absente, ou différé faute de point LiDAR (motif `input`). |
| Référence humaine | dernière visite **validée** de la relecture ; règles strictes de `referenceFor` (une seule intention VALIDATE, état associé, fraîcheur 0–1 500 ms). Lue après toute décision du moteur, pour juger seulement. |
| Erreur | pose laissée par le Pilote contre pose humaine, dans le repère de profil du rail ; latérale et verticale, valeurs brutes ; **faux au-delà de 10 mm sur l’une ou l’autre** (D-038). |
| Repère | jointure par partie et cut. Même `frameId` ; sinon une translation unique du lot (médiane), acceptée si la majorité des cuts la vérifient, puis **chaque cut contrôlé seul** : la pose AVANT de sa première visite relue doit être la pose laissée par le Pilote à 1 mm près, rotation identique. Sinon : non jugeable. |
| Écartement | contrat `[1405, 1470]` mm en admissibilité seulement : liste des paires refusées, contrôle qu’aucune paire appliquée n’est hors contrat. Jamais une cible. |
| Exclusions | 9033 et 9241 (partie 19) toujours exclues, comptées à part avec leur motif ; la configuration peut en ajouter, jamais en retirer. |
| Décision sur le lot | `lotObservation` (4.7.8) si présent ; sinon, avec `--rejeu-lot`, rejeu exact de `observeLot` (`background.js`) sur le corpus et la science GCV1 du diagnostic, marqué « rejeu hors ligne ». Quand les deux existent : parité mesurée. |
| P2 | `--p2` : relevé JSON ; affiché « P2 (un opérateur) ». Sans relevé : « P2 non mesuré ». |
| Parties tenues à l’écart | `--config` : `tuningParts` liste les parties ayant servi à un réglage ; les autres sont « tenues à l’écart ». |

### Mode d’emploi

```sh
# 1. décompresser l'archive du lot (les noms contiennent des espaces)
7z x "collections/2026-09-23_v4.7.6_/pilote + corr/banane-gcv1-corpus-2026-09-23T06-49-45-seg01.7z" -o"/tmp/p19"
# 2. rapport ; --rejeu-lot seulement pour un export antérieur à la 4.7.8 (ou pour mesurer la parité)
node tools/acceptance-report.cjs --lot "/tmp/p19=pilote-p19" [--relecture DOSSIER] \
  [--config reglage.json] [--p2 p2.json] [--rejeu-lot] --json rapport.json --md rapport.md
```

`reglage.json` : `{"tuningParts":[13,18,19,20], "exclusions":[{"part":…,"cut":…,"motif":"…"}]}`.
`p2.json` : `{"operators":1,"cuts":30,"lateralMm":{"median":…,"p90":…},"verticalMm":{"median":…,"p90":…}}`.
Plusieurs lots : répéter `--lot` ; un journal et un diagnostic par dossier.

## 2. Vérifié (commandes exécutées, sorties)

**Archive.** `sha256sum` de l’archive extraite de
`origin/claude/banane-47-gate-audit-vaktr1` :
`71b7796f…c5bcc841`, identique à `manifest.json`. Extraction faite avec
`py7zr` (7-Zip n’est pas installé dans cet environnement) : 7 fichiers JSON.

**Banc complet**, `node tools/verify.cjs` :

```
{"tests":661,"suites":0,"pass":659,"fail":0,"cancelled":0,"skipped":2,"todo":0}
Syntax: 36 runtime files. Geometry unchanged: true. Engine matches V4.6.0 baseline: true.
Bench mode: partial. Native corpus: absent (3 files). Skipped: 2 — skipped is not passed.
```

Avant le chantier, sur `a74c225` : 644 tests, 642 réussis, 2 ignorés. Les
17 essais ajoutés passent ; les **2 tests ignorés le sont faute du corpus
Natif privé** (`datasets/native/`), comme prévu : ignoré ne veut pas dire
réussi.

**Les essais mordent.** Le critère réduit au seul latéral fait échouer
l’essai C4 (`not ok 2 … latéral OU vertical`), puis le fichier est restauré.

**Moteur du rejeu identique à celui du lot.**
`git diff --stat 6f46f22 a74c225 -- src/gcv1-shadow.js src/geometry-candidate-v1.js src/placement-convention.js src/geometry.js vendor/capture-core.js`
ne liste aucun de ces fichiers : de la 4.7.6 à `a74c225`, seuls
`src/continuity-observer.js` et `src/lot-decision.js` ont été ajoutés.

**Relevé de la partie 19** :

```sh
node tools/acceptance-report.cjs --lot "/tmp/p19=pilote-p19-4.7.6" --rejeu-lot \
  --json audit/acceptance-p19-2026-09-23.json --md audit/acceptance-p19-2026-09-23.md
```
```
partie 19 : C1 14/28 = 50 % · C4 0 faux / 1 jugés · C2 latéral 0 / 0 (max 0) vertical 0 / 0 (max 0) · P2 non mesuré · C3 refusées 5, appliquées hors contrat 0 · lot 16/28, 0 faux / 2 · exclus 2
```

Deux exécutions donnent des fichiers identiques octet pour octet (SHA-256 du
JSON `f520bacf433ff8d1…`, du Markdown `cd89981b9edc54a3…`). C1 à C4 sont les mêmes avec et sans `--rejeu-lot`.

### Résultat, partie 19 (lot 4.7.6, 23/09)

| Critère | Mesure |
|---|---|
| **C1** | **14 appliqués sur 28 cuts distincts = 50,0 %** ; différés 7 ; refusés par l’écartement 5 ; sans entrée 1 (9406, aucun point LiDAR) ; autre 1 (9407, lot arrêté sur ce cut) ; aucun cut revisité |
| **C4** | **0 faux sur 1 cut appliqué jugé** (9221) ; 13 appliqués non jugés |
| **C2** | 2 rails jugés : latéral 0 / 0 mm, vertical 0 / 0 mm (médiane / p90) ; P2 non mesuré |
| **C3** | 5 paires refusées (9049 : 1 305,6 mm ; 9052 : 1 286,1 ; 9218 : 1 304,9 ; 9242 : 1 311,4 — LOW_INVALID ; 9317 : 1 470,8 — HIGH_INVALID) ; **0 paire appliquée hors contrat** (écartements appliqués 1 433,1 à 1 454,1 mm) |
| Décision sur le lot (**rejeu**, pas une observation) | 16 sur 28 = 57,1 % ; **0 faux sur 2 jugés** (9044 choisi à 2,8 mm ; 9221 à 0,5 mm) ; gagnés 9044 et 9052 ; perdus aucun ; faux nouveaux aucun |
| Exclus | 9033 (appliqué), 9241 (différé) |

**Non jugeables** (motif, cuts) :

- relu sans validation, pose inchangée : 14 cuts, dont **12 appliqués**
  (9019, 9036, 9043, 9045, 9046, 9047, 9051, 9229, 9230, 9234, 9235, 9344)
  et 9405, 9406. L’opérateur passe moins de 5 s sur chacun, sans geste ni
  validation ;
- référence non stricte : 9231 (appliqué) et 9050 (référence
  « timing-uncertain »), 9052 et 9317 (deux intentions) ;
- 9407 : aucune pose du Pilote (lot arrêté avant l’analyse).

**Différés relus** (référence stricte) : la pose de départ est à 33,2 à 46,8 mm
de la pose humaine sur le pire rail (8 cuts).

**Repère.** Le lot (`frameId fcb5a152…`) et la relecture (`53b71338…`) n’ont ni
le même `frameId` ni le même `pageId`. Leurs coordonnées « scène » diffèrent
d’une translation unique (737 962,31 ; 6 762 384,67 ; 86,87) — l’ordre de
grandeur d’une position Lambert-93 et d’une altitude —, rotations identiques,
vérifiée sur **29 cuts sur 29** à moins de 1 mm. La pose AVANT de la relecture
est donc bien celle laissée par le Pilote.

**Contrôle journal** : 15 traités et 14 différés au journal ; 15 appliqués
(9033 compris) et 14 différés recalculés.

## 3. Écart avec l’amendement n°6 §6.2

| Amendement n°6 | Outil | Explication |
|---|---|---|
| 15 appliqués sur 29 (52 %) | 14 sur 28 (50,0 %) ; sans exclusion, 15 sur 30 (50,0 %) | Dénominateur D-038 : 9407 est atteint par le lot (pose AVANT relevée, lot arrêté dessus) et reste au dénominateur ; 9033 (appliqué) et 9241 (différé) sont exclus. |
| 14 différés | 7 différés + 5 refusés par l’écartement + 1 sans entrée + 9241 exclu = 14 | Même total ; l’outil sépare les causes. 9406 est différé faute de tout point LiDAR : « sans entrée » au sens de D-038. |
| 12 différés à 20–47 mm de la pose humaine | 8 avec référence stricte, 33,2–46,8 mm | Les 12 se retrouvent en comptant 9241 (exclu) et 9050, 9052, 9317 (référence non stricte) : 33,2–47,4 mm sur le pire rail. La borne basse de 20 mm n’est pas reproduite (voir §4). |
| 9047 suspect, non relu ; écartement 1 453,8 mm | visité 3,4 s sans geste ni validation : non jugeable ; écartement appliqué 1 454,1 mm | 1 453,8 est l’écartement **prévu** (`pairGaugeMm`), 1 454,1 celui de l’état relu dans ESV après application : 0,35 mm d’écart. |
| Rejeu identique sur les 29 décisions | non mesuré ici | L’outil juge les décisions du Pilote ; il ne rejoue pas le moteur du Pilote. |
| (C4 non établi pour le Pilote) | 0 faux sur **1** cut appliqué jugé | 12 des 14 appliqués n’ont pas été validés à la relecture : C4 et C2 ne sont pas mesurables sur ce lot. |

## 4. Supposé (non vérifié)

- **Borne « 20 mm » de l’amendement n°6** : probablement le rail le moins
  écarté ou une autre distance (les rails les moins écartés de ces 12 cuts vont
  de 0 à 33,8 mm). La mesure d’origine n’est pas dans le dépôt ; non
  reproduite.
- **Le rejeu de la décision sur le lot vaut l’observation 4.7.8.** Même
  moteur (vérifié), même module, même ordre, même plafond d’ancres ; mais sur
  ce lot 4.7.6, il n’existe aucune observation pour mesurer la parité. Sur un
  lot 4.7.8, `--rejeu-lot` la mesure (essai `rejeu et observation présents`).
  Le rejeu utilise 9033 comme ancre possible : le Pilote ne connaît pas les
  exclusions, qui ne valent que pour la mesure.
- **La translation entre repères est une propriété d’ESV** (une origine de
  scène par ouverture de page) et se retrouvera sur les prochains lots.
  Observé sur un seul lot.
- **Écart appliqué / état relu** : 0,35 à 0,5 mm entre les positions
  calculées (delta GCV1) et l’état relu dans ESV après application (9047,
  9221). Supposé : arrondi d’ESV ; sans effet sur le seuil de 10 mm.
- Les millimètres sont des unités de scène × 1000 ; l’étalonnage physique
  n’est pas vérifié indépendamment.

## 5. Questions pour la direction

1. **Repère différent entre le lot et sa relecture.** La consigne demande une
   jointure par (partie, cut, `frameId`) ; strictement, elle ne joint **aucun**
   cut de la partie 19. L’outil joint par (partie, cut) et exige une
   translation unique vérifiée cut par cut. Faut-il retenir cette règle, ou
   exiger la relecture dans la même ouverture de page ESV que le lot ?
2. **Relecture sans validation des cuts appliqués.** 12 des 14 appliqués ont
   été vus sans être validés : C4 et C2 ne sont pas mesurables sur ce lot.
   Pour F1 à F4, faut-il rendre obligatoire la validation (Maj+Espace) de
   **chaque** cut, y compris ceux que le Pilote a appliqués — ce que dit déjà
   `LIRE_EN_PREMIER.md` — et déclarer un lot « non évaluable » en dessous d’un
   taux de cuts appliqués jugés (par exemple 80 %) ?
3. **Cut atteint puis lot arrêté (9407).** D-038 le garde au dénominateur,
   l’amendement n°6 ne le comptait pas. L’outil le compte, sous « autres ».
   À confirmer.
4. **« Sans entrée » pour un différé faute de point LiDAR (9406).** Classé
   « sans entrée » plutôt que « différé ». À confirmer.
5. **Seuil de rapprochement des repères** : 1 mm et rotation identique à
   1e-6. À confirmer, ou à durcir.
6. Le cahier (§6, C4) définit « −90 % par rapport au dénominateur P5 » ;
   D-037/D-038 et la consigne visent « 0 cut faux ». L’outil rapporte le
   nombre et la liste des faux, ce qui sert les deux lectures ; aucune
   contradiction à trancher, mais le cahier consolidé devra choisir.

## 6. Limites de l’outil

- Un journal par dossier : un lot. Si un même journal contient plusieurs lots,
  seul le dernier (`state.batch`) est rapporté, et les observations GCV1 des
  autres lots sont comptées « hors de ce lot » (jamais mêlées).
- Les archives 7z ne sont pas lues directement (aucune dépendance) : il faut
  les décompresser avant.
- Une relecture volumineuse est fusionnée en mémoire : pour la session Natif
  longue de la partie 20, `node --max-old-space-size=12000`.
