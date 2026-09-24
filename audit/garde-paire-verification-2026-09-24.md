# Chantier 2 — vérification de la garde de paire dans le Pilote actuel

**24 septembre 2026.** Livraison relue : branche `chantier-48/faux-isoles`,
commit `c434a9a` (base `a74c225`, 4.7.8). Quatre fichiers, aucun dans `src/` ;
`tests/isolated-wrong-study.test.cjs` : 2/2 réussis ; le relevé
`audit/chantiers/faux-isoles.json` rend bien, pour la garde proposée, 2 faux
arrêtés (241, 409) et 0 juste perdu sur les cinq sessions de l'analyste.

**Garde proposée** : différer la paire si un rail est publié par S1 **et** si
le calage de convention signale `shift-out-of-domain` sur l'un des deux rails.

## Simulation exacte, dans l'architecture du Pilote

L'analyste a mesuré la variante à deux passages de l'étude de phase 0 ; le
Pilote décide en **un seul passage**, cut après cut (`src/lot-decision.js`). La
garde est donc rejouée ici dans cette architecture, appuis recalculés : un
premier passage signalé est différé et ne devient pas appui
(`tools/choice-anchor-study.cjs --garde-paire`), sur les six sessions Natif et
les trois lots Pilote relus — dont quatre jeux que l'analyste n'avait pas :
Natif partie 30, lots Pilote de la partie 31 (4.7.8 et 4.7.9), lot Pilote de
la partie 19.

| | Sans garde | Avec garde |
|---|---|---|
| Natif, 6 sessions | 449 appliqués, 5 faux / 294 jugés | 448 appliqués, **3 faux** / 293 jugés |
| Pilote, 3 lots relus | 131 appliqués, 1 faux / 125 jugés | identique : la garde ne se déclenche pas |

- Différés par la garde : **241** (40,5 mm) et **409** (140,5 mm), faux tous les
  deux. Aucun cut juste perdu. Par ricochet, **243** est gagné (reprise depuis
  la voie, juste).
- **407** n'existe pas en un seul passage : c'était un effet du second passage,
  qui prenait 409 comme appui. La question 1 de l'analyste est close.
- Faux restants : **398** (159,9 mm) et **402** (273 mm), premiers passages
  **sans aucun appui** (la variante à deux passages les différait grâce aux
  appuis des deux côtés) ; **983** (15 mm) ; **7026** (choix à un appui, KI-050).
- Sur les quatre jeux inédits, la garde ne se déclenche jamais : aucun coût,
  mais aucune preuve de généralisation non plus.

Relevé : `audit/choice-anchors-garde-paire-2026-09-24.json` (lignes par cut),
à comparer à `audit/choice-anchors-2026-09-24.json` (sans garde).

## Lecture

La garde ne fait que différer : son seul risque est une perte de couverture,
nulle partout où elle a été mesurée. Elle ne démontre pas « zéro faux » : trois
faux du moteur restent au banc Natif de la partie 20, dont deux sans appui,
que ni la garde de continuité ni celle-ci ne peuvent voir.
