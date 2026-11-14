# CH-116 : corpus jugé et banc « GCV2.1 » (hors ligne, lecture seule)

Aucun fichier de l'extension n'est touché. Données : clone partiel de `banane-data` (branche de documents), extraites hors dépôt dans `CH116_TRAVAIL` (par défaut `~/ch116`).

## Préparer (une fois)
1. `DONNEES=<clone banane-data> CH116_TRAVAIL=~/ch116 bash chantiers/CH-116/outils/extraire.sh` : dézippe les lots et les Échos utiles.
2. `node --max-old-space-size=8192 chantiers/CH-116/outils/preparer.cjs [--lots 1111,1211] [--effacer-segments]` : retrouve chaque lot dans son journal (partie et rang, aucun identifiant écrit au dépôt), réduit les captures aux cuts du lot (`captures/`, parts de 250 Mo), fait la jointure Écho ↔ journal (`j/`), écrit `meta/`.
3. `node chantiers/CH-116/outils/banc.cjs rejouer --nom livre` : rejeu du code livré (profil L1-se) sur tout le corpus (~1 s par cut, 3 tâches en parallèle).
4. `node chantiers/CH-116/outils/corpus.cjs [--sortie DOSSIER]` : `corpus.jsonl` + `resume.md` (par défaut `chantiers/CH-116/sorties/`, à verser par l'intégrateur dans `banane-data/outils/analyse-lots/CH-116/`).

Lots et parties : `lots.cjs` (étiquettes `0411`, `0511` (examen, D-285), `0611`, `0811a`, `0811b`, `1111`, `1211`).

## Le corpus (`corpus.jsonl`, une ligne par cut posé ou différé par le lot)
`lot, partie, rang, cut, ordre` (rang du cut dans le lot), `examen`, `zone` (règles métier du banc), `chemin` (`etage`, `motif` du lot réel ; `rejeu` = étage du rejeu livré), `sortLot` (`pose`/`differe`), `capture` (nuage du corpus du lot avec points), `points`, `ecartementDepartMm`, `poseAriane` (décalages du lot), `poseFinale` (pose finale de l'opérateur), `ref` (`validation`/`visite-sans-action`), `etiquette`, `dureeVisiteS`, `ecart` (`pire3d`, `lat`, `vert`, `rail` : pire rail, pose du lot → pose finale ; pour un différé : départ → pose finale), `classe` (`juste` ≤ 10 mm, `10-50`, `mauvaise-voie` > 50, `differe-corrige`, `differe-juste`, `non-juge`), `exclu` (motif ; `d285-…` = jugé mais écarté par D-285), `poseApresLot` (la pose vue par l'Écho n'est pas celle du lot : relecture ou deuxième passe).
Décalages : mm, `[longitudinal, latéral, vertical]`, repère profil de la pose de départ d'ESV, le même que les poses du banc. Pose finale = déplacement d'Ariane + écart humain de la jointure (cut posé), ou écart humain depuis la première visite si le départ de l'Écho a l'écartement du départ du lot à 2 mm près (cut différé).

## Le banc (`banc.cjs`)
- `rejouer --nom N [--patch P.patch …] [--env CLE=VALEUR …] [--lots …] [--jobs 3]` : copie de HEAD + patchs (fichiers protégés compris : la copie est hors dépôt), rejeu de tout le corpus. Un réglage = un patch et/ou des variables lues par le patch.
- `juger --nom N [--ref livre] [--avec-courtes] [--json] [--csv]` : tableau standard par lot (posés jugés, ≤ 10, 10–50, > 50, différés, différés reposés justes / faux, bons bloqués) et, avec `--ref`, les cuts changés.
- `fidelite --nom livre` : décisions et poses du rejeu identiques au lot réel, lot par lot, écarts listés.
- `croise --noms a,b,c [--ref livre] [--poids JSON] [--examen 0511|aucun]` : validation croisée par lot (réglage choisi au coût minimal sur tous les autres lots réglables, jugé sur celui tenu à l'écart), puis examen (réglage choisi sur tous les lots réglables, jugé sur les lots d'examen, jamais vus). Coût par défaut `100·(>50) + 10·(10–50) + 5·(bons bloqués) + 1·(différés)`.

## Garde d'octobre au banc (`banc.cjs garde`)
`BANANE_LOTS` (défaut `CH116_TRAVAIL/oct/lots`) : un dossier par lot de `datasets/garde-gcv2/base-test18.json`, avec le journal, la liste et les segments du corpus nommés dans la base (extraits de `banane-data`, collections du 16 au 23/10 ; listes des parties 6 et 7 dans les Échos du 19/10). `banc.cjs garde --nom N [--patch P] [--env BANC_LEVIERS=JSON]` rejoue les 12 lots en parallèle comme `garde-gcv2 --rejouer` (leviers de la base + ceux du réglage), lance `garde-gcv2 comparer`, et sépare les reculs réels des « verts changés » (`travail/garde/N/resume.txt`). Environ 15 min à 3 tâches. Contrôles (13/11) : éteint retour 0 ; aj4 de CH-121 retour 1, 16 reculs (10 réels, 6 verts changés), comme `garde-gcv2 --rejouer`.

## Réglages par défaut d'un jugement (décision de l'intégrateur, 14/11)
- **Zones** : la zone d'un cut est celle du lot (service worker à la décision, événement `regles-metier-ombre`). Tout rejeu de jugement passe `--env BANC_ZONES=journal`.
- **Passe livrée** : la passe fidèle est la règle (écriture dans l'ordre de décision, 10 au plus, arrêt au premier refus visible). Tout jugement « passe livrée » passe `--env BANC_PASSE_PLAFOND=10` en plus de `BANC_LEVIERS` avec `"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true}`.
- La référence « livré » d'un jugement se rejoue avec les mêmes réglages (`livre-zj`, et pour la passe `--env BANC_ZONES=journal --env BANC_PASSE_PLAFOND=10`). Les jugements rendus avant le 14/11 ont été faits sans ces réglages.
