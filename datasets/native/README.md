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

Depuis un clone propre, `node tools/verify.cjs` **échoue**, avec
**369 tests verts sur 371** (362 sur 364 avant le lot V4.6.0, qui a ajouté sept
tests). Les deux tests rouges sont exactement les mêmes, à la renumérotation
près :

| # | Test | Fichier |
|---|------|---------|
| 229 | `the three read-only Terra exports reproduce the demonstrated geometry loss` | `tests/native-geometry-audit.test.cjs` |
| 284 | `built installable archive contains runtime sources, offline results and documentation without bulky reference fixtures` | `tests/package.test.cjs` |

Les deux échouent **uniquement** parce que les trois fichiers ci-dessus sont
absents. Aucun autre test ne dépend de ce dossier.

Mesure effectuée sur une copie jetable de l'arbre, `datasets/native/` retiré,
le reste identique au bit près. Sur le poste de travail complet, le banc était à
**364/364** avant V4.6.0 ; **371/371 n'a pas été mesuré ici**, faute des trois
fichiers — c'est l'attendu, pas un relevé. Les trois fichiers gelés à 4.4.0
restent identiques ; `src/engine.js`, dégelé en V4.6.0, est vérifié contre
`audit/v4.6.0-engine-baseline.json`.

## Rétablir le banc complet

Replacer les trois fichiers aux chemins ci-dessus, puis :

```sh
node tools/verify.cjs
```

Attendu : `{"tests":371,...,"pass":371,"fail":0}` et
`Geometry unchanged: true`.
