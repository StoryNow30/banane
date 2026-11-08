# CH-077 — Rapport : préchauffer le cache du navigateur pour la coupe suivante (piste 3, D-305)

**Livré** (branche `chantier/CH-077`) : `src/prechauffage.js` (module de page, pur) ; réglage `lot.chargement.prechauffer` **éteint** ; `chantiers/CH-077/adapter-page.patch` et `background-page-files.patch` (à appliquer par l'intégrateur) ; relais des événements réduits aux comptes dans `src/esv-observer.js` et `obsFields` de `background.js` ; maquette EPT (`ept=1`) ; banc `tools/ch077-banc.cjs` (`banc.json`).

## Conditions d'ouverture
- **(a) Le cache du navigateur peut-il servir les nœuds d'ESV ? INCONNU.** Le relevé `depuisCache` arrive avec « Vision 4 ». Sur le terrain, le préchauffage le dit lui-même : l'événement `prechauffage-entetes` donne une classe (max-age, no-store, no-cache, revalidation, heuristique, aucun), sans aucune valeur. Il s'éteint seul pour la page après 5 coupes justes sans aucun nœud servi par le cache.
- **(b) Chaîne d'étages plutôt que décompression : PROBABLE** (« Vision 3 » : téléchargement en cours pendant 37 % des attentes, 1 à 2 nœuds en vol). Non tranché ici : la maquette modélise la chaîne, elle ne la prouve pas.

## Écart au ticket (accepté par l'intégrateur)
Le préchauffage part **à la fin de la capture**, pas après la pose : c'est là qu'est le réseau libre (environ 1,3 s contre 0,4 s, CH-078). Rien n'est attendu : la pose ne dépend jamais de lui. Il ne part que si le compteur effectif vaut 0. Il s'arrête au premier chargement de Potree qui repart, au changement de coupe, à toute nouvelle capture.

## Mesures (maquette, Chromium au repos, charge de départ 0,22 ; 15 répétitions, médiane / P90, ÉTABLI sur la maquette)
Latence serveur : 60 ms par nœud ; temps mort : 900 ms ; une page neuve par répétition ; seconde transition mesurée.

| Mode | Chaîne du cut suivant | Nœuds servis par le cache | Requêtes au serveur par transition | Nœuds demandés par le préchauffage | Octets demandés |
|---|---|---|---|---|---|
| sans | 267 / 275 ms | 0 / 14 | 14 | 0 | 0 |
| avec (rayon 1,5 m, défaut) | **146 / 157 ms (−45 %)** | 6 / 14 | **20 (+6)** | 24 (plafond) | 1,5 Mo |
| avec « finir » | 147 / 150 ms | 6 / 14 | 20 | 24 | 1,5 Mo |
| avec rayon 0,75 m | **146 / 151 ms** | 6 / 14 | **14 (+0)** | 6 | 0,4 Mo |

- **Prédiction** : juste 45 fois sur 45 (trois modes allumés). La coupe prédite est la prochaine ligne non validée de la table B1.
- **Nœuds visés, connus, demandés** (point 1 de l'intégrateur) :
  - par cut, 38 nœuds connus dans la zone au rayon de 1,5 m, contre 6 au rayon de 0,75 m ;
  - 6 sous-arbres de frontière, dont la hiérarchie n'est pas encore lue : ce sont les 8 nœuds sur 14 qui ne peuvent pas être servis ;
  - la répartition par cut est constante sur la maquette (médiane = P90).
- **Retard du cut en cours** :
  - validation 88 / 91 ms contre 88 / 89 ms ; pose 17 / 29 ms contre 15 / 20 ms ;
  - capture 2 031 / 2 092 ms contre 2 001 / 2 062 ms. Aucun préchauffage ne tourne pendant une capture (il est annulé au début et le précédent est fini) : bruit de la maquette, **PROBABLE**.
- **« finir »** n'apporte rien ici : le préchauffage finit avant la navigation.
- **Rayon** : le rayon de 0,75 m donne le même gain sans aucune requête de plus. Le rayon de 1,5 m demande 18 nœuds inutiles par cut. Le rayon de 0,75 m est donc à préférer pour un premier essai terrain, mais il reste SUPPOSÉ hors maquette (géométrie synthétique).

## Coût pour le serveur
Prédiction juste et cache qui sert : aucune requête de plus quand la zone colle à ce que Potree charge. Pire cas par cut : `noeudsMax` (24) ou `octetsMax` (8 Mo). Sur le terrain, `noeuds − couverts` par cut (bilan) donne la part inutile. **Accord écrit de l'opérateur requis au moment de livrer** (D-305).

## Preuves
- **Essais rouges d'abord, puis verts** :
  - `ch077-prechauffage` 12/12 : identité d'opération, annulation, plafonds, aucune adresse ni clé dans un seul événement, choix des nœuds, en-têtes, arrêt automatique ;
  - `ch077-relais` 2/2 ; `ch077-adaptateur` 3/3, patch appliqué sur une copie ;
  - `pose-lot-inchanges-4959` 6/6 (réglage déclaré, assertion « éteint ») ; `lot-signal-ligne-de-base` vert.
- **Maquette** :
  - `ch077-prechauffage` 3/3 : sans préchauffage, 0 nœud servi par le cache ; avec, 8/12 ; en `no-store`, 0 ;
  - suite `essais.cjs` : 76 réussis, 2 sautés (export réel absent), 1 échec. L'échec est un délai de 10 s dépassé dans `correction-signal` pendant l'exécution en parallèle ; ce fichier passe seul, sur le même code (1/1).
- **Scan** : `scan-identite` et `noms-modeles` verts, mais quatre motifs publics seulement (`ARIANE_MOTIFS_INTERDITS` est absente de cet environnement).

## Ce qui reste SUPPOSÉ, et consigne d'essai terrain
SUPPOSÉ :
- que les en-têtes d'ESV permettent le cache ;
- même clé de cache entre le XHR de Potree et le `fetch` du préchauffage (origine des nœuds, jeton éventuel dans l'adresse) ;
- part des nœuds de la coupe suivante déjà connus dans la hiérarchie ;
- gain réel, s'il y a bien une chaîne d'étages.

Consigne, après l'accord de l'opérateur :
1. Appliquer les deux patchs et allumer avec `rayonM: 0.75` sur une partie témoin.
2. Lire `prechauffage-entetes` : si la classe est `no-store` ou `no-cache`, la piste est morte.
3. Lire les bilans (`juste`, `couverts`, `servisCache`) et comparer la durée de capture à « Vision 3 ».
