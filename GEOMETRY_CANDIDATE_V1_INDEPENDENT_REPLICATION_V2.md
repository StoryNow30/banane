# Geometry Candidate V1 — Independent Replication V2

Lot d'audit. Branche `lab-gcv1-independent-replication-v2`.
Aucun merge, aucun tuning, aucun ESV, aucun runtime modifié.

**Verdict : `INCONCLUSIVE`.**

Arrêt fail-closed à l'étape 4 (VERIFY CAPSULE). La commande officielle
n'a pas été exécutée. Aucun compteur scientifique n'est publié.

---

## 1. Mode, périmètre, SHA de départ

- Mode : **réplication indépendante stricte**.
- Consigne : rejouer exclusivement
  `replication/geometry-candidate-v1/run.cjs` depuis la capsule
  `infra-gcv1-replication-capsule-v1` @ `2366d48`.
- Base de branche livrable : `3256d8b329bfa9a9ab13a6b93f2ac78d786f9096`
  (`lab-flank-support-shadow`).
- Interdit et respecté : ancienne implémentation A_STAR / SUPPORT_FALLBACK_15,
  JSON historique `86780db9…`, hypothèses de recentrage V1, compteurs Grok,
  oracle humain.

## 2. Contrats lus

- Consigne V2 (cette mission) — seul contrat d'exécution disponible.
- `StoryNow30/banane` `git ls-remote` — liste complète des refs.
- `StoryNow30/banane-data@d541686d3a98569125cdbdb261ef121c9f533d6a`
  `datasets/README.md` et `datasets/native-v4.6-2026-09-16/manifest.json`.

Non lus, parce qu'absents :

- `HASH_PROVENANCE.md`
- `REPLICATION_CAPSULE_MANIFEST.json`
- `pinned/src/geometry.js`
- `pinned/src/geometry-baseline.js`
- `replication/geometry-candidate-v1/run.cjs`
- tout objet git `2366d48` ou `0dbcb7a`

## 3. Fichiers produits

| chemin | rôle |
|---|---|
| `GEOMETRY_CANDIDATE_V1_INDEPENDENT_REPLICATION_V2.md` | ce rapport |
| `GEOMETRY_CANDIDATE_V1_REPLICATION_FREEZE.json` | gel avant confrontation |
| `audit/geometry-candidate-v1-independent-replication-v2.json` | artefact (rows vides) |

Aucun fichier de capsule modifié : aucun n'était présent.

## 4. Vérification capsule — STOP

| contrôle | attendu | obtenu |
|---|---|---|
| branche `infra-gcv1-replication-capsule-v1` | existe | **absente** de `StoryNow30/banane` et `banane-data` |
| HEAD `2366d48` | résolu | **404** API + absent de `git ls-remote` |
| candidate base `0dbcb7a` | résolu | **404** |
| variante `infra/gcv1-replication-capsule-v1` | — | **404** |
| `REPLICATION_CAPSULE_MANIFEST.json` | présent | **absent** |
| `HASH_PROVENANCE.md` | présent | **0 hit** code search |
| `replication/geometry-candidate-v1/run.cjs` | présent | **0 hit** |
| `pinned/src/geometry.js` SHA `77f01766…` | vérifié | **non vérifiable** |
| `pinned/src/geometry-baseline.js` SHA `3343330e…` | vérifié | **non vérifiable** (fichier pinned absent) |
| dataset commit `d541686d…` | résolu | **oui** `infra/materialized-native-v46-v1` |
| `datasets/native-v4.6-2026-09-16` | présent | **oui** (manifeste `banane-data-materialized-dataset-v1`) |
| 239/239 via runner officiel | assemblés | **non** — runner absent |

Preuves :

```
git ls-remote https://github.com/StoryNow30/banane.git
# 21 branches listées ; aucune infra-gcv1-replication-capsule-v1
# aucun objet 2366d48 / 0dbcb7a

GET /repos/StoryNow30/banane/commits?sha=2366d48          → 404
GET /repos/StoryNow30/banane-data/commits?sha=2366d48     → 404
GET /repos/StoryNow30/banane/commits?sha=0dbcb7a          → 404
```

La consigne impose : toute divergence de hash / capsule → **STOP**.
Inventer un runner ou reprendre le harness V1 violerait le contrat.

## 5. Dataset (accessible, non rejoué)

Commit : `d541686d3a98569125cdbdb261ef121c9f533d6a`

Archives sources du manifeste :

- historique 34 509 008 o SHA `32e48aa79de988ab8bb6efc65d7038d4e27535e2a5f2486768438616f518bfc0`
- finale 56 657 500 o SHA `7cac220bd6e097f14ff1d39cbc431e7c6e918b819bdf521883bc33847ec12c66`

Le manifeste décrit des sessions JSON sharded, pas un lock 239 rails
prêt à `run.cjs`. Sans le chargeur officiel de la capsule, 239/239
n'est pas mesurable ici.

## 6. Exécution

Commande exigée :

```bash
NODE_OPTIONS=--max-old-space-size=4096 \
node replication/geometry-candidate-v1/run.cjs \
  --dataset /datasets/native-v4.6-2026-09-16 \
  --out geometry-candidate-v1-replay.json
```

| run | tenté | SHA |
|---|---|---|
| 1 | non | n/a |
| 2 | non | n/a |
| run1 == run2 | n/a | n/a |

## 7. Gel (avant confrontation)

Fichier : `GEOMETRY_CANDIDATE_V1_REPLICATION_FREEZE.json`

```
sha256 = 39f45733ad9f327874513243dd0ebf68d1eaea99b83b76c10fc9a0ea6d835bc4
covers = tout sauf frozenAt
```

Contenu gelé : refs demandées, sondes 404, population `not-replayed`,
compteurs `null`, confrontation non ouverte.

## 8. Analyse indépendante

Non calculable. Pas de sortie rail par rail.

| grandeur | valeur |
|---|---|
| population assemblée | non mesurée |
| failures publiés / unresolved | non mesuré |
| controls publiés / unresolved | non mesuré |
| Δ vs baseline V4.6 | non mesuré |
| activations A_STAR / S1 | non mesuré |
| PARTIAL / WEAK | non mesuré |
| candidats éloignés | non mesuré |

## 9. Confrontation après gel

**Non ouverte.**

Sans sortie propre, comparer au lab Candidate V1 reviendrait à lire
des résultats étrangers sans référentiel. Interdit par la consigne §8–§9.

Classification des divergences rail par rail : aucune ligne à classer.

## 10. Oracle humain

Fermé. La reproductibilité algorithmique n'est pas conclue.

## 11. Verdict

**`INCONCLUSIVE`**

| plan | statut | preuve |
|---|---|---|
| Capsule figée exécutable | absente | 404 `2366d48` / branche introuvable |
| Hashes pinned | non vérifiés | fichiers absents |
| Repro algorithmique vs lab | non mesurée | runner officiel absent |
| Qualité géométrique | non jugée | oracle fermé |

Ce n'est pas `NOT_REPLICATED` : on n'a pas obtenu un désaccord
rail par rail, on n'a pas obtenu de rails.

La première réplication (lecture de consigne, SHA `86780db9…`) reste
un résultat historique **séparé**. Elle n'est pas réutilisée ici.

## 12. Ce qu'il faut pour débloquer

1. Pousser `infra-gcv1-replication-capsule-v1` @ `2366d48` sur un dépôt
   accessible à cet agent.
2. Confirmer `0dbcb7a` et les SHA pinned.
3. Relancer uniquement `run.cjs`, deux fois, depuis un clone propre.

## 13. Reproduction des sondes

```bash
git ls-remote https://github.com/StoryNow30/banane.git | grep -E 'gcv1|2366d48|0dbcb7a'
# attendu aujourd'hui : aucune ligne

git ls-remote https://github.com/StoryNow30/banane.git | wc -l
# 21 heads + PRs ; capsule absente
```
