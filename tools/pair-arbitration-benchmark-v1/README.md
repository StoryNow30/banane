# Pair Arbitration Benchmark V1

Banc hors ligne, gelé, pour évaluer plus tard une politique externe d’arbitrage de paire.

Ce n’est pas une spécification runtime. Aucun seuil de production. Pas un écartement ESV. Pas de cible 1436. Les unités sont des unités de scène ; `physicalCalibrationStatus = not-attested`.

## Fichiers

| fichier | rôle |
|---|---|
| `benchmark.json` | Cuts 17 + 20 (1 397 245 octets). SHA-256 ci-dessous. |
| `manifest.json` | SHA-256, sources, effectifs, no-tuning holdout |
| `score-policy.py` | Score une politique externe sans la modifier |
| `unpack-benchmark.py` | Vérifie le SHA-256 d’un `benchmark.json` local |
| `README.md` | Ce protocole |

## SHA-256 canonique de benchmark.json

```
3a700609dc264e2df8eae515ff9289a834c402023b4d80f222f32f60d0326ecf
```

Le fichier non compressé (1,4 Mo) est l’artefact gelé. Il est conservé tel quel dans le workspace du banc (`artifacts/pair-lab/benchmark-v1/benchmark.json`). GitHub Contents via le connecteur ne transporte pas ce blob en un seul POST ; le protocole, le manifeste et le scorer sont sur cette branche. Ne pas régénérer `benchmark.json`.

## Espace de candidats

Au plus **3 × 3**, produit cartésien des noms réellement exposés par `geometry.js` / `propose()` :

| nom | origine exacte |
|---|---|
| `graine` | `metrics.seed = [sign * best.u, best.z]` après recherche fine du gabarit |
| `surface` | `metrics.surfaceIntersection` des nappes dessus / flanc (diagnostique ; le moteur pose la graine) |
| `alternative` | `metrics.templateAmbiguity.alternative` = meilleur point de grille grossière séparé de la graine |

Si un nom manque sur un rail, le produit a moins de 9 cases. **Aucun candidat n’est inventé.**

Le moteur, quand il pose une paire, pose la combinaison dont les deltas correspondent aux seeds : empiriquement `graine×graine`.

## Oracle

Uniquement pour l’évaluation. Combinaison qui minimise, dans l’ordre :

1. max des erreurs d’origine `profileOriginSceneRelative` gauche/droite vs humain ;
2. somme de ces erreurs ;
3. `|paire_combo − paire_humaine|`.

L’humain n’est jamais une feature d’entrée.

## Catégories (bande 10e-3, non-runtime)

- `CURRENT_ENGINE_CORRECT`
- `CURRENT_ENGINE_WRONG_CHOICE`
- `CURRENT_ENGINE_ABSTAINED_BUT_RECOVERABLE`
- `NOT_RECOVERABLE_WITH_CURRENT_CANDIDATES`

Sensibilités reportées : 5e-3 / 10e-3 / 20e-3. Ce ne sont pas des seuils à brancher.

## Splits

- **develop** : toute la part 17, et la part 20 hors 9031–9047.
- **no-tuning holdout / réserve sans réglage** : cuts **9031–9047** part 20.

Ces cuts ont déjà été inspectés analytiquement (Pair Lab part 20, audit d’arbitrage). Ce n’est **pas** un holdout aveugle. Ils restent interdits pour choisir une règle, une feature ou un paramètre. Le scorer les calcule à part, après coup.

Le champ JSON `split: "holdout"` est conservé tel quel dans `benchmark.json` (fichier gelé). Lire « no-tuning holdout ».

## Scoring d’une politique future

```bash
python3 score-policy.py \
  --benchmark benchmark.json \
  --policy politique.json \
  --out score.json
```

Format politique :

```json
{
  "format": "banane-pair-arbiter-policy-v1",
  "decisions": [
    {"part": 20, "cut": 5123, "left": "graine", "right": "alternative"},
    {"part": 20, "cut": 485, "decision": "ABSTAIN"}
  ]
}
```

Une décision hors des candidats exposés du cut est `INVALID`. Un cut absent de la politique est `UNCOVERED`, pas une abstention.

## Exclusions

- pas de modification de `geometry.js`, du moteur, du cerveau, des hashes ;
- pas de nouveau candidat ;
- pas de conversion en mm ;
- pas d’usage de la réserve 9031–9047 pour caler quoi que ce soit ;
- pas de pool 17+20 pour choisir une règle ;
- aucun nouveau travail de sélection ou de tuning jusqu’à livraison de la politique Claude.
