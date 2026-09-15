# Plan d’import historique sans perturber le développement

Objectif : compléter le patrimoine Banane sans toucher aux branches actives de Claude, sans modifier les racines runtime et sans réécrire l’historique de `main`.

## 1. Branches

- `main` : baseline stable de développement. Ne pas modifier pour l’archivage historique.
- `v4.6-engine-state-machine` : chantier Claude en cours. Ne pas toucher.
- `astra/history-audit` : branche documentaire indépendante pour inventorier l’historique.

Aucun merge de `astra/history-audit` n’est nécessaire pendant V4.6.

## 2. Arborescence cible proposée

Lorsque les archives exactes auront été retrouvées et validées :

```text
history/
  README.md
  manifests/
    legacy-artifacts.json
  v2/
    v2.4.2/
      README.md
      SHA256SUMS.txt
      [petites sources historiques si autorisées]
  v3/
    README.md
    v3.0.1/
  v4/
    README.md
    v4.0.0/
    v4.4.1/
    v4.4.3/
    v4.5.5/
    v4.5.6/
    v4.5.7/
```

Les archives ZIP peuvent aussi être conservées comme Releases GitHub ou hors Git avec hashes, plutôt que dupliquées dans l’arbre.

## 3. Ce qui peut être importé sans risque élevé

Priorité : petits fichiers textuels historiques dont la provenance est claire.

- prompts et passations historiques ;
- rapports d’audit ;
- manifests / index de hash ;
- changelogs ;
- scripts de diagnostic ;
- petites fixtures non sensibles ;
- README historiques.

Avant import : comparer avec le snapshot courant pour éviter les doublons inutiles.

## 4. Ce qui ne doit pas être importé automatiquement

- exports LiDAR/Natif volumineux ;
- corpus de corrections complets ;
- documents métier internes ;
- captures contenant des informations potentiellement confidentielles ;
- archives dont le contenu ou les droits d’hébergement n’ont pas été vérifiés.

Pour ceux-ci : manifeste seulement, avec SHA-256 et emplacement externe.

## 5. Méthode de validation d’une ancienne archive

Pour chaque archive retrouvée :

1. ne jamais l’ouvrir/modifier dans la branche runtime ;
2. calculer SHA-256 et taille ;
3. inventorier son contenu ;
4. identifier version et provenance ;
5. comparer avec les hashes/chiffres déjà documentés ;
6. déterminer si elle contient des données sensibles ;
7. si import autorisé, la ranger dans `history/` ou une Release ;
8. ajouter son entrée à `legacy-artifacts.json` ;
9. ne jamais utiliser une archive historique comme source active sans décision explicite.

## 6. Priorités de récupération

1. `banane_v2_4_2.zip` — référence historique fondamentale ;
2. `banane-v3-3.0.1.zip` et `banane-v3.zip` — pour restaurer la transition V3 ;
3. `banane-v4.zip` — V4 TEST 4.0.0 ;
4. V4.4.1 et V4.4.3 exactes — très utiles pour la chronologie du collecteur Natif ;
5. V4.5.5/4.5.6/4.5.7 — pour retrouver les diffs du cerveau et de l’intégration ;
6. diagnostics 3392 / part23 et documents de reprise.

## 7. Ce qu’il ne faut surtout pas faire

- force-push `main` pour recréer un faux historique ;
- insérer des commits artificiels prétendant être les anciens commits ;
- réécrire les hashes historiques ;
- importer toutes les données brutes dans Git ;
- fusionner l’archivage documentaire dans le chantier V4.6 pendant qu’il est en cours ;
- modifier `CLAUDE.md`, `PROJECT_STATE.md`, `PASSATION_BANANE.md` ou les baselines actives simplement pour l’archivage.

## 8. Résultat attendu

À terme, GitHub doit offrir deux niveaux clairement séparés :

- **développement actif** : code, tests, branches et PR actuels ;
- **patrimoine historique** : versions, archives, manifests, hashes et rapports, sans dépendance runtime.

Cette séparation permet à Claude de reprendre demain exactement son travail V4.6 sans voir changer sa base, tout en sécurisant progressivement les semaines de travail antérieures.
