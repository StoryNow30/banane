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
**362 tests verts sur 364**. Les deux tests rouges sont exactement :

| # | Test | Fichier |
|---|------|---------|
| 222 | `the three read-only Terra exports reproduce the demonstrated geometry loss` | `tests/native-geometry-audit.test.cjs` |
| 277 | `built installable archive contains runtime sources, offline results and documentation without bulky reference fixtures` | `tests/package.test.cjs` |

Les deux échouent **uniquement** parce que les trois fichiers ci-dessus sont
absents. Aucun autre test ne dépend de ce dossier.

Mesure effectuée sur une copie jetable de l'arbre, `datasets/native/` retiré,
le reste identique au bit près. Sur le poste de travail complet, le banc est à
**364/364** avec `geometryUnchanged: true`.

## Rétablir le banc complet

Replacer les trois fichiers aux chemins ci-dessus, puis :

```sh
node tools/verify.cjs
```

Attendu : `{"tests":364,...,"pass":364,"fail":0}` et
`Geometry unchanged: true`.
