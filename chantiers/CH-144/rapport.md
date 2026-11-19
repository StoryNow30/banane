# CH-144 — lot A3 : trois inconnues de la 5.0

**Ticket :** `chantiers/CH-144.md`. **Branche :** `chantier/CH-144`, partie du tronc `ariane6`.
**Plan :** `fiches/PLAN_ARIANE_6.md`, lot A3 (D-373). **Mesure seule : aucun code livré.**

## 1. La page muette trois minutes après le Maj+Espace du cut 2475 (17/11, partie 3)

**Conclusion : cause établie dans ses deux parties.** Le cut 2475 était **déjà validé** avant le
Maj+Espace ; ESV a répondu « valid » sans écrire, l'attente de 6 s de la relecture a expiré, et le
silence de trois minutes est l'**attente de l'opérateur**, pas une panne de relais.

Preuves, dans l'ordre du journal (`ariane-journal-v4-1794923788826.json`, volume 01/02, 9 999
événements) :

| Heure (17/11) | Événement |
|---|---|
| 13:52:29.043 | `railPairSelected ["3",2475]` (préchauffage) |
| 13:52:29.859 | `PUT rail-pair-write 204`, `rowIndex 2475`, corps `{"SeenByOperator":true}` — **marque « vu », pas une validation** |
| 13:52:30.028 | `demandeA` du `validerMajEspace` |
| 13:52:30.118 | `railPairUpdated ["3",2475,"valid",null,null,0.05004…]` |
| 13:52:31.535 | `adapter-result validerMajEspace`, `acknowledged: true`, `lastStage: maj-espace-command-returned`, `elapsedMs: 1506` |
| 13:52:37.576 | `relecture-ombre`, `action: correction-incertaine`, raison « aucune écriture de validation vue en 6 s », `statutEsv {statut:"valid", operateur:false, vu:false}` |
| 13:52:37.577 | `relecture-fin` |
| 13:52:38.5 → 13:52:40.2 | `correction-liste` (parties 1, 2, 3), `correction-couverture`, `file-parties`, `eveil-relache` |
| 13:55:28.9 | `releve-selecteur-parties`, `contrat-esv`, `avis-contrat-esv` — l'opérateur revient |

- **Le cut était déjà validé — ÉTABLI.** La liste instantanée exportée à 13:49:52
  (`ariane-liste-partie3-…134952Z.json`) donne `r[2475] = [0, 3313, 8970, 44, 3365, 8960, -3]` :
  statut `0` = `valid`, drapeaux `0` (ni traité ni vu par l'opérateur). `relectureCorriger` refuse
  d'envoyer le Maj+Espace si le statut relu n'est pas `valid` ; aucun refus n'est journalisé et le
  geste est parti.
- **Aucune écriture de validation — ÉTABLI.** Sur les 426 écritures du journal, une seule porte
  `rowIndex 2475` : le marqueur « vu » de 13:52:29.859, **169 ms avant** la demande de Maj+Espace.
  Toutes les écritures de la fenêtre (13:52:20 → 13:52:29.859) sont des `{"SeenByOperator":true}`.
- **Pourquoi rien n'a été écrit : PROBABLE.** Le cut étant déjà `valid` et ses valeurs inchangées,
  ESV n'a rien à réécrire ; le `railPairUpdated` de 13:52:30.118 dit « valid » mais ne déclenche pas
  de `PUT`. La sémantique interne d'ESV n'est pas observable ici.
- **Le silence de 3 min — ÉTABLI.** Après l'arrêt de la relecture (13:52:37.577), Ariane construit
  la liste de correction (13:52:38.5–40.2), puis **aucun événement** jusqu'à 13:55:28.9 : plus rien
  n'était demandé à la page. Ce n'est pas une coupure du relais ; l'avertissement de contrat à
  13:55:28.925 (`empreinte 335e658f → 844d5fb7`, rails et boutons changés) montre seulement que la
  page a été relue au retour de l'opérateur.

**Ce que cela change :** l'attente de 6 s de la relecture suppose qu'une validation écrit toujours.
Un cut déjà validé ne peut pas la satisfaire ; c'est le mécanisme qui produit « correction
incertaine » et rend le cut à l'opérateur. Le bouton « J'ai contrôlé le cut » (CH-036) est la sortie
prévue.

## 2. La cause des essais fragiles (CH-028, CH-110, ch104, molette du Cadran)

**Conclusion : non trouvée.** Aucun échec n'a été reproduit en **52 passages** : les quinze fichiers
cités passent seuls, les quatre essais sensibles passent cinq fois sur cinq, et douze copies
simultanées de la molette (quatre à la fois, trois tournois) passent aussi.

| Essai | Passages | Résultat | Durée |
|---|---:|---|---:|
| `correction-signal` (CH-028) | 1 + 5 | 6 verts | 32–34 s |
| `ch110-place-rendue` (CH-110) | 1 + 5 | 6 verts | 242–277 s |
| `ch077-prechauffage` (CH-110) | 1 + 5 | 6 verts | 19–20 s |
| `ui5-navigateur-molette` (Cadran) | 1 + 5 + 12 simultanés | 18 verts | 14–15 s ; 4 copies à la fois, 3 tournois |
| `ch104-relecture-pause-navigateur-2` | 1 + 5 | 6 verts | 7–8 s |
| Six autres fichiers ch104, trois autres molettes et `signal-molette` | 1 chacun | 10 verts | 1–15 s |

Ce qui est **ÉTABLI** et peut expliquer une fragilité sans la prouver :

- **CH-110 est lent, pas instable** : son premier sous-essai seul dure **115,3 s** (86 requêtes figées),
  le fichier **242–277 s**. `tools/verify.cjs` impose 20 s par essai (60 s sur GitHub) mais ne lit que
  `tests/` et `tests/v242` : la maquette n'y est pas. Tout exécuteur qui appliquerait ce budget à
  `tests/esv-maquette/` échouerait sur CH-110 de façon déterministe, pas intermittente.
- **ch104 et la molette sont proches du budget local** : 7–15 s pour un budget de 20 s (35–75 %). Sous
  un conteneur plus lent, la marge peut disparaître — c'est l'explication la plus plausible de
  l'échec « sous charge » noté au CHANGELOG (molette, vert seul 5 fois sur 5) et du découpage du
  fichier du Cadran en cinq, décidé après un dépassement des 20 s.
- **Ce qui n'est pas reproduit ici** : douze copies simultanées de la molette n'ont pas fait échouer
  l'essai ; le CH-077, qui échouait 3 fois sur 5 dans son fichier selon le CHANGELOG, est vert 5 fois
  sur 5. Le facteur manquant est donc, au choix, la machine de l'exécuteur, la version de Chromium ou
  un état de fichier, et rien dans les journaux de ces passages ne le nomme — **SUPPOSÉ**.

**Ce qu'il faudrait pour trancher** : rejouer les essais sur l'exécuteur où l'échec a été vu, avec son
budget et son Chromium, et comparer les journaux ; ce n'est pas accessible d'ici.

## 3. Glacier, la vue fil et Mix jamais tournés dans Chrome à côté d'ESV

**Conclusion : non trouvée — et elle ne peut pas l'être hors terrain.**

- **ÉTABLI** : les trois vues ont été auditées en Chromium **sans** ESV (CH-129 : 273 vues du panneau ;
  Instrument 2 772 vues ; Cadran 660 vues), et le lot du 19/11 (Vision 21, build `8e62c5dd`) a tourné
  dans le vrai Chrome à côté d'ESV, mais avec la vue standard seulement.
- **ÉTABLI** : en Mix, à 380 × 640, la ligne d'état de la tuile est à **20 px** du haut, pour un seuil
  « moins de 20 px » écrit pour la tuile de Glacier (CH-115). C'est une mesure de mise en page, pas un
  essai à côté d'ESV — le point reste non tranché.
- **SUPPOSÉ** : aucune cause ne peut être nommée sans une exécution réelle ; rien dans le dépôt ne
  permet de simuler la coexistence avec ESV (charge, timers, mémoire, onglet en arrière-plan).
- **Ce qui manque** : un lot avec Glacier, la vue fil et Mix ouverts dans Chrome à côté d'ESV, journal
  et console relevés. C'est une observation de terrain, hors de portée d'un agent sans navigateur
  connecté à ESV.
