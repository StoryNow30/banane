# datasets/native/ — contenu volontairement absent du dépôt

Ce dossier contient, sur le poste de travail, les exports Natif de référence
(nuages de points bruts). Il pèse **47 Mo** et n'est **pas** versionné, sur
consigne : le dépôt est une baseline de code, pas un entrepôt de données LiDAR.

Contenu attendu localement :

```
datasets/native/reference/Banane/banane-native-v4-1789117835514.json
datasets/native/reference/Banane/banane-native-v4-1789120447962.json
datasets/native/reference/Banane/banane-native-v4-1789125861104.json
```

## Conséquence exacte sur le banc — fait mesuré, pas estimation

Depuis un clone propre, `node tools/verify.cjs` **va jusqu'au bout** : les deux
tests qui dépendent de ce dossier s'y **ignorent eux-mêmes**, avec leur raison
dans la sortie TAP, et les contrôles d'empreintes et de baseline s'exécutent
normalement. Avant V4.6.0 ces deux tests échouaient et arrêtaient le banc.

**Un test ignoré n'est pas un test réussi.** `audit/verification.json` le dit
explicitement : `benchMode: "partial"`, `allTestsExecuted: false`,
`skippedForMissingCorpus: 2`, et `nativeCorpus.missing` nomme les fichiers.

| Test | Fichier |
|------|---------|
| `the three read-only Terra exports reproduce the demonstrated geometry loss` | `tests/native-geometry-audit.test.cjs` |
| `built source archive carries the runnable tests, fixtures and the three native reference exports` | `tests/package.test.cjs` |

Le contrôle de l'archive **installable**, lui, n'a plus besoin du corpus : il a
été séparé du contrôle de l'archive source en V4.6.0 et s'exécute donc aussi
depuis un clone propre.

Les deux échouent **uniquement** parce que les trois fichiers ci-dessus sont
absents. Aucun autre test ne dépend de ce dossier.

Mesure effectuée sur une copie jetable de l'arbre, `datasets/native/` retiré,
le reste identique au bit près. Sur le poste de travail complet, le banc était à
**364/364** avant V4.6.0 ; **378/378 n'a pas été mesuré ici**, faute des trois
fichiers — c'est l'attendu, pas un relevé. Les trois fichiers gelés à 4.4.0
restent identiques ; `src/engine.js`, dégelé en V4.6.0, est vérifié contre
`audit/v4.6.0-engine-baseline.json`.

## Rétablir le banc complet

Replacer les trois fichiers aux chemins ci-dessus, puis :

```sh
node tools/verify.cjs --full
```

`--full` (ou `BANANE_BANC=full`) **exige** le corpus et refuse le moindre test
ignoré : c'est le seul mode qui autorise à annoncer un banc entièrement vert.
Sans le corpus, il s'arrête tout de suite en nommant les fichiers manquants.

Attendu : `{"tests":378,...,"pass":378,"fail":0,"skipped":0}`,
`Geometry unchanged: true`, `Engine matches V4.6.0 baseline: true`.
