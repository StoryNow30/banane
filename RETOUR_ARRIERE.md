# Procédure de retour arrière — Banane 4.7.0

**Depuis la 4.7.4**, la cible de retour est la **4.7.3**, commit `e570f4a` :

```bash
git archive e570f4a | tar -x -C /tmp/banane-4.7.3
cd /tmp/banane-4.7.3 && python3 tools/package.py --output /tmp/banane-v4.7.3-test.zip
```

La 4.7.4 ne change dans l'extension que l'arrêt des lectures LiDAR après un
déplacement de rail par l'opérateur.

**Depuis la 4.7.3**, la cible de retour est la **4.7.2**, commit `d96543c` :

```bash
git archive d96543c | tar -x -C /tmp/banane-4.7.2
cd /tmp/banane-4.7.2 && python3 tools/package.py --output /tmp/banane-v4.7.2-test.zip
```

La 4.7.3 ne change que la fin de session Natif et la relance après une
modification de la découpe ESV.

**Depuis la 4.7.2**, la cible de retour est la **4.7.1**, commit `8199451` :

```bash
git archive 8199451 | tar -x -C /tmp/banane-4.7.1
cd /tmp/banane-4.7.1 && python3 tools/package.py --output /tmp/banane-v4.7.1-test.zip
```

La 4.7.2 ne change que la capture du mode Natif (lecteur, garde, relances,
service worker). Revenir en 4.7.1 ne change aucun placement ni aucune décision
du Pilote ; seule la capture Natif redevient celle qui perdait les visites
rapides.

**Depuis la 4.7.1**, build de mesure, la cible de retour est la release
officielle **4.7.0**, étiquetée `v4.7.0` :

```bash
git archive v4.7.0 | tar -x -C /tmp/banane-4.7.0
cd /tmp/banane-4.7.0 && python3 tools/package.py --output /tmp/banane-v4.7.0-test.zip
```

La 4.7.1 ne diffère de la 4.7.0 que par le coût de lecture du LiDAR : les points
retenus sont les mêmes, aucune science n'est touchée. Revenir en arrière ne
change donc aucun comportement, seulement le temps passé à lire.

Cible de retour depuis la **4.7.0** : **4.6.0**, checkpoint
`5e6d0e8b14ea880195672e5b9da914f046701e0c`. C'est la dernière version dont le
paquet a été réellement installé et utilisé dans Edge sur ESV.

Aucune donnée collectée n'est perdue par un retour arrière : les sessions vivent
dans IndexedDB, pas dans le code.

## 1. Reconstruire le paquet de la version précédente

Le dépôt ne conserve **aucune archive binaire** : `releases/` et `*.zip` sont
exclus par `.gitignore`. Le paquet de retour se reconstruit depuis Git, et il
est reproductible bit à bit :

```bash
git archive 5e6d0e8 | tar -x -C /tmp/banane-4.6.0
cd /tmp/banane-4.6.0 && python3 tools/package.py --output /tmp/banane-v4.6.0-test.zip
```

Contrôles attendus sur l'archive obtenue : **582 047 octets**, **94 entrées**,
`manifest.json` exactement une fois à la racine, aucun dossier parent, CRC OK.

Construire depuis `git archive` et non depuis un répertoire de travail : les
dates des entrées viennent alors du commit, ce qui rend l'empreinte du ZIP
reproductible. Un build depuis un clone donne le même contenu mais une autre
empreinte.

Réinstaller ensuite ce ZIP **dans le dossier déjà chargé par Edge**, recharger
l'extension dans `edge://extensions`, puis recharger la page ESV. Le panneau
doit afficher `V4.6.0 · TEST`.

## 2. Ce que le retour annule, et ce qu'il n'annule pas

La 4.7.0 ne diffère de 4.6.0 que par des chaînes de version et l'affichage de la
politique effective dans le panneau. **Tout le chemin de commande est identique
octet pour octet** : `src/engine.js`, `src/gauge.js`, `src/gcv1-shadow.js`,
`src/geometry.js`, `src/geometry-candidate-v1.js`, `src/adapter-page.js` et
`src/gcv1-export.js` sont les mêmes fichiers dans les deux versions.

Un retour de 4.7.0 vers 4.6.0 ne change donc **aucun comportement** : ni le
report des rails non résolus, ni le garde d'écartement, ni la navigation sans
décision, ni les exports. Il ne fait que revenir à un panneau qui n'annonce pas
la politique effective de faible confiance.

Pour revenir avant le report différé ou avant le garde d'écartement, il faut
remonter plus loin dans l'historique — ce sont des changements fonctionnels,
pas des changements d'affichage :

| Pour revenir avant | Checkpoint |
|---|---|
| Affichage de la politique effective | `5e6d0e8` (4.6.0) |
| Garde d'écartement de paire | `4057f08` |
| Correctif d'ambiguïté S1 | `28654a7` |
| Correctif caméra / incident 3560 | `65fc065` |
| Report `DEFERRED_UNRESOLVED` | `7c9f76d` |

## 3. Fichiers gelés — contrôlés par le banc

Trois fichiers sont gelés à la référence 4.4.0 et vérifiés octet pour octet par
`tools/verify.cjs` contre `audit/v4.4.0-frozen-engine-hashes.json`, qui n'est pas
modifiable :

| Fichier | SHA-256 |
|---|---|
| `src/geometry.js` | `3343330ee03fab4a20d3d2940fcb32e04ab1d4b912e3acd5f1e6cf8d7f854a53` |
| `vendor/capture-core.js` | `2bc4a70b7ce5d08990875804edea0a2097c0503a3d433a40b4eaeeb4ffd77054` |
| `vendor/lidar.js` | `375f7dfb932143027e2c814f78bf3d66d5fbda5eb97f323735e3fd4932de6311` |

La science GCV1, `src/geometry-candidate-v1.js`, est figée de la même façon à
`77f017669112a38b998a010f100ae681e7624ca864150bd592122a22422e7503`.

`src/engine.js` **n'est plus gelé à 4.4.0** : dégelé sur décision explicite en
V4.6.0, il est ré-épinglé sur `audit/v4.6.0-engine-baseline.json` et vaut
`be15576321f7a1bf7b0c727281b7f8a882eeea254382c83cf96590220740da33` en 4.7.0. Le
banc échoue sur toute dérive non déclarée.

## 4. Neutraliser sans désinstaller

Plutôt qu'un retour arrière, deux réglages suffisent le plus souvent :

- **Revenir au comportement historique des rails non résolus** : dans les
  réglages du lot, choisir « Mettre le lot en pause » avant de démarrer. La
  politique est figée à la création ; les lots déjà lancés ne changent pas.
- **Ne pas utiliser GCV1** : lancer un lot sans sélectionner le moteur
  `geometry-candidate-v1`. Le garde d'écartement du moteur reste actif — il est
  volontairement global — mais la science GCV1 n'est pas sollicitée.

Le garde d'écartement de paire n'a pas d'interrupteur, par construction : c'est
un invariant physique, pas une option.

## 5. Données déjà exportées

Les segments Natif restent au format `banane-native-session-v3-compact` et
restent lisibles après un retour arrière :

```bash
node tools/merge-segments.cjs --out session.json --dir dossier-des-segments
```

produit un export v2 ordinaire, accepté tel quel par `placement-lab.cjs` et
`native-offline-evaluate.cjs`. Conserver ce script même après un retour arrière
du reste, sinon les segments déjà écrits deviennent illisibles.

Les enregistrements `DEFERRED_UNRESOLVED` produits par 4.7 restent dans les
exports après un retour à 4.6.0, puisque le code d'export est identique. Un
retour plus ancien les rendrait illisibles par les outils de cette époque.
