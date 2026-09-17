# Vertical Alignment Provenance Replication V1

Réplication indépendante. Vocabulaire : **observé** / **calculé** / **hypothèse**.
Unités de scène ; `physicalCalibrationStatus: not-independently-verified`.

## Périmètre

- Population connue : 63 failures « Plan de roulement non estimable. » + 176 controls.
- Classification RSF précédente 56 / 5 / 2 : **contexte**, pas une entrée de cette analyse.
- Branche : `lab-vertical-alignment-provenance-replication-v1` depuis `3256d8b` (lab-flank-support-shadow).
- Aucun runtime. Aucun `G.propose`. Aucun réglage de `searchZ` / `topBand` / `loss`. Aucun oracle humain. Pas de merge.

## Données

**Observé.** Source déclarée : `StoryNow30/banane-data` `infra/materialized-native-v46-v1` `@d541686d3a98569125cdbdb261ef121c9f533d6a`, dossier `datasets/native-v4.6-2026-09-16/`.

Contrôle ponctuel matérialisé : session `ba703239` dans `final/banane-native-v4-2026-09-16T11-44-58-auto-seg01.json/root-object-0000.json`.

**Observé.** Géométrie des 239 rails lue depuis capsule `rsf-v1` `@52d4f52` (mêmes archives Native SHA `32e48aa7…` / `7cac220b…`).

Les points stockés ne sont pas en local profil : exemple observé `[346580.19, 6254776.38, 69.45]`.

## Chaîne

stored-cloud → reconstructed-cloud → profile-world → local-transformed → seed (0,0) → coarse → refined.

## Mesures calculées

| étape | médiane F | médiane C | |\u0394| |
|---|---|---|---|
| Z scène − origine profil | −0.1266 | −0.1405 | 0.0139 |
| Z local tête | +0.0069 | −0.0067 | 0.0136 |
| Z coarse | −0.040 | −0.001 | 0.039 |
| Z refined | −0.043 | −0.003 | 0.040 |

Première étape au-dessus du seuil 0.015 : `coarse-search-z`.

Association : 0 inconsistency / 239.

## Familles par rail (seuil 0.030)

40 coarse-search-offset-while-local-near-plane / 10 local-transformed-already-offset / 13 no-large-offset.

SHA couverture `f168094742af5e7412e4a8689b21d357ee745a63699c1daf746b403f2cd8a721`.
Outil et JSON complets aussi dans artifacts/pair-lab/ (push GitHub outil tronqué par MCP).
