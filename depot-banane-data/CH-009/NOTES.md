# CH-009 — détail à déposer dans banane-data

Dossier de transit. L'intégrateur le copie dans `banane-data` et le retire de cette branche avant la fusion. Rien ici n'est un livrable de code. Aucun identifiant de projet, aucune coordonnée : des numéros de partie et de cut, un état, des millimètres.

## Fichiers

`par-cut.json` — 114 lignes. Une pose par objet.

| Champ | Sens |
|---|---|
| `population` | `lot` : pose GCV2 du lot (`gcv2-l1`, vérifiée). `ombre` : passe 1, décision « poserait ». |
| `partie` | Numéro de partie. |
| `version` | Version du lot : 4.9.5.21, 4.9.5.22 ou 4.9.5.23. |
| `cut` | Numéro de cut. |
| `etat` | `juge` (écart contre la dernière validation de l'Écho), `sans-echo`, `sans-pose-finale` (vu dans l'Écho, pas de validation : pas un 0 mm). |
| `ecartMm` | Plus grand des deux rails, 3D, en millimètres. `null` si l'état n'est pas `juge`. |

Comptes : lot 86 (9 jugés, 60 sans Écho, 17 sans pose finale) ; ombre 28, tous jugés. Parties 15, 16, 17, 18, 19, 20, 0 et 1 du 26/10/2026. L'Écho de la partie 19 est perdu : ses 3 poses du lot sont `sans-echo`.

## Commande

```
node tools/precision-poses.cjs --donnees <racine banane-data> --detail par-cut.json
```

Lecture seule. Graine du bootstrap 20261028. La définition et le tableau agrégé sont dans `fiches/PRECISION_BASE_V6_2026-10-28.md`.
