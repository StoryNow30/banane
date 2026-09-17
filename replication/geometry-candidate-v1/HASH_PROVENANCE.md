# Provenance des SHA geometry.js / geometry-baseline.js

Aucun moteur modifié. Lecture seule.

Deux fichiers, deux SHA. Ils ne sont pas interchangeables.

| fichier | SHA-256 | rôle |
|---|---|---|
| `src/geometry.js` | `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503` | moteur **lab** exécuté par Candidate V1 (hooks `lab.*`) |
| `src/geometry-baseline.js` | `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` | **V4.6 figé**, copie octet-identique du `geometry.js` historique |

Le SHA historique `3343330…` cité dans les audits V4.6 comme « src/geometry.js » est **le même blob** que `src/geometry-baseline.js` aujourd’hui. Ce n’est **pas** le `geometry.js` du candidat.

---

## SHA de `src/geometry.js` aux commits demandés

| commit | SHA-256 `src/geometry.js` | octets | note |
|---|---|---:|---|
| `3256d8b329bfa9a9ab13a6b93f2ac78d786f9096` | `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` | 9925 | V4.6. `geometry-baseline.js` **n’existe pas** encore. |
| `0dbcb7a` (Candidate V1) | `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503` | 16913 | déjà le blob lab |
| `318279c` (cette capsule) | `77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503` | 16913 | identique à `0dbcb7a` |

Fichier hashé `77f017…` :

- `src/geometry.js` à `0dbcb7a` et `318279c`
- `replication/geometry-candidate-v1/pinned/src/geometry.js` (copie octet-identique)

---

## Diff

```
3256d8b..0dbcb7a  src/geometry.js  |  +146 −12  (7 hunks)
0dbcb7a..318279c  src/geometry.js  |  vide
```

`src/geometry.js` **a changé** entre la baseline V4.6 (`3256d8b`) et Candidate V1 (`0dbcb7a`). C’était déjà dans le candidat qualifié.

`src/geometry.js` **n’a pas changé** entre `0dbcb7a` et la capsule `318279c`.

DEFAULTS (searchY 0.08, searchZ 0.04, minTop 15, minFace 6, ratio 1.5) : **identiques** entre les deux fichiers.

---

## Chaîne d’introduction (labs, pas un retuning de ce lot)

1. `edd76c2` Geometry Prototype V1 — copie V4.6 vers `src/geometry-baseline.js` (SHA `3343330…` inchangé). `src/geometry.js` reçoit les leviers `options.lab` (`+97 −7`).
2. `82ea59b` Flank Support — `preferSupported` / `preserveCoarseSupport`.
3. `04a4932` U Hypothesis — `uSeeds`, `replaceOrigin`, `recenterWindow` (hooks A_STAR).
4. `2ec9443` Face-Aware — **une ligne** `lab.onCoarse(...)`. Premier commit dont le SHA de `src/geometry.js` est `77f017…`.

À partir de `2ec9443`, le blob `77f017…` est stable jusqu’à `0dbcb7a` / `318279c`.

Sans `options.lab`, `propose()` du lab reste le chemin V4.6. A_STAR passe `lab: { uSeeds, replaceOrigin:false, recenterWindow:true }`.

---

## Conclusion

`77f017…` n’est pas une erreur de manifeste. Ce n’est pas `capture-core`, ni un JSON, ni la baseline.

Candidate V1 **dépend** de `src/geometry.js` lab (`77f017…`) **et** de la baseline V4.6 (`3343330…`, `src/geometry-baseline.js`) pour le replay témoin.

Les audits qui écrivent « geometry.js = 3343330… » parlent du moteur **V4.6**, pas du fichier actuel `src/geometry.js` du candidat.
