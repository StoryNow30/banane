# Procédure de retour arrière — Banane V4.5-R

Ce chantier est additif et réversible. Le moteur n'a pas été touché.

## 1. Retour immédiat, sans rien supprimer

L'archive de référence `banane-v4.5-lot1-source-tests1.zip`
(SHA-256 `fff99321ec3fdb4a7c475779c3ff8ac9b32ef2c2b641f2e4bdebefb426a2d004`)
est inchangée. La réinstaller dans le dossier chargé par Edge suffit à revenir
exactement à l'état V4.4.3 antérieur. Aucune donnée collectée n'est perdue :
les sessions vivent dans IndexedDB, pas dans le code.

## 2. Fichiers gelés — jamais modifiés

Empreintes identiques avant et après le chantier :

| Fichier | SHA-256 |
|---|---|
| `src/geometry.js` | `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` |
| `src/engine.js` | `2bf19ce7ecc800afccaf9b710bdce0745d4ed379e71e0b8457fca0cd5c5069f6` |
| `vendor/capture-core.js` | `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054` |
| `vendor/lidar.js` | `375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311` |

`node tools/verify.cjs` continue de les contrôler et échouerait si l'un d'eux bougeait.

## 3. Annuler une modification isolée

| Pour annuler | Remettre le fichier de référence |
|---|---|
| Export compact et segmenté | `panel.js`, `panel.html` |
| Seuil de vidage automatique | `src/native-session.js`, `background.js` |
| Récupération de dégradation et file résiliente | `src/native-page.js` |
| Tout l'outillage hors ligne | supprimer `src/native-export.js`, `tools/export-compact.cjs`, `tools/merge-segments.cjs`, `tools/export-simulate.cjs` |

Chaque fichier est indépendant des autres : remettre `src/native-page.js` seul
n'affecte pas l'export, et inversement.

## 4. Neutraliser sans désinstaller

- Vidage automatique : porter `Sessions.EXPORT_WATERMARK_BYTES` à `Infinity`
  dans `src/native-session.js`. Le conseil ne sera jamais émis et le panneau
  n'écrira plus de segment automatique.
- Export compact : dans `panel.js`, appeler `dataset(data, prefix, {compact:false})`.
  Les fichiers reprennent le format v2 intégral.
- Segmentation : porter `EXPORT_SEGMENT_BYTES` à une valeur très grande dans
  `panel.js` pour revenir à un fichier unique.
- Récupération de dégradation : construire l'`Observer` avec
  `{recoveryMs: Infinity}` pour retrouver le comportement irréversible d'origine.

## 5. Données déjà exportées

Les segments produits par cette version sont au format
`banane-native-session-v3-compact`. Ils restent lisibles après retour arrière :

```bash
node tools/merge-segments.cjs --out session.json --dir dossier-des-segments
```

produit un export v2 ordinaire, accepté tel quel par `placement-lab.cjs` et
`native-offline-evaluate.cjs`. Conserver ce script même après un retour arrière
du reste, sinon les segments déjà écrits deviennent illisibles.
