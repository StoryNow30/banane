# Passation — Banane au 25/09/2026 (4.7.20 TEST livrée)

À lire en premier par la conversation qui reprend. Remplace `PASSATION_4.7.19.md`
(gardé pour l'historique). La conversation précédente est conservée par
l'utilisateur ; ce fichier suffit pour reprendre.

## Contexte

- Extension Chrome/Edge MV3 qui place les rails sur le LiDAR d'ESV. Utilisateur :
  SIG, parle français, opérateur terrain et direction du projet.
- Dépôts : `StoryNow30/banane` (branche `claude/banane-48-cahier`), 
  `StoryNow30/banane-data` (branche `claude/banane-47-gate-audit-vaktr1`,
  collectes, relectures, références et fichiers de travail).
- Release officielle : **4.7.0**. Les 4.7.x suivantes sont des builds TEST.
- Version terrain : **4.7.20** (paquet `banane-v4.7.20-test.zip`, SHA-256
  `b3a679da5c9a1479203eb14204eb09d3137772cbebab8379c996d40a3572f4cb`, construit
  depuis `f859d8f` par `git archive` + `tools/package.py`, reproductible : deux
  constructions identiques ; chargé dans Chromium comme extension MV3, service
  worker 4.7.20, quatre vues sans erreur). Retour arrière : 4.7.19
  (`RETOUR_ARRIERE.md`).

## Règles non négociables

- AUCUN reset destructif, force push, merge dans `main`, tag ni release sans
  autorisation explicite de l'utilisateur.
- Contrat d'écartement [1405, 1470] mm : admissibilité seulement, jamais une
  cible ni un « plus proche de 1435 ». Écartement des voisins : garde seulement.
- Pas d'application partielle (les deux rails ou rien) ; pas de VALIDATE/SKIP
  automatique d'un cut non résolu.
- Pose humaine : **§14 I amendé (D-054, 25/09)** — des cuts VOISINS validés par
  l'opérateur peuvent servir d'appuis à la voie, sous garde de cohérence ; jamais
  la pose du cut décidé, jamais un écartement cible.
- Cuts 9033 et 9241 exclus. Dépôts publics : jamais de code source d'ESV.
- `src/engine.js` épinglé : les correctifs vont dans `background.js`,
  `src/lot-decision.js` ou les modules autour.
- **La partie 9 est une partie de validation** : ne caler aucun réglage dessus.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  et la ligne `Claude-Session` ; aucun identifiant de modèle dans les fichiers.
- Chaque fichier d'essai tient en 10 s. `node tools/verify.cjs` doit sortir en 0
  avant chaque commit (restaurer `audit/verification.*` si seuls les temps changent).
- Pas de fichier non suivi en fin de tour (commit et push).

## Ce que la 4.7.20 a livré

- **Interface H** (piste « Sans le skill ») sur Natif, Pilote et Assisté, avec
  ses animations (entrée seulement ; en continu : point « en direct » et cut
  courant ; figé si le système réduit les animations), thème clair/sombre,
  polices embarquées (OFL), **bandeau dans ESV** (ligne d'état sans clic).
  Tous les identifiants de la 4.7.19 conservés ; essais `tests/panel-h.test.cjs`.
- **KI-060** : export compact en segments (premier nuage des segments ≥ 2 mal
  référencé) corrigé à l'écriture, réparé à la lecture. Audit de toutes les
  collectes : 4 segments faux, tous des bilans ; aucun banc publié touché.
- **KI-061** : fin de partie dans un reliquat constatée et close proprement.
- **Reprise** refusée après rechargement d'ESV (autre `frameId`).
- **D-054** : garde des voisins validés dans `src/lot-decision.js`
  (`consistentValidated`, `decideCut({validated})`) ; pas de source terrain.
- **C5** : balayage `gaugeGap`, `gaugeCount`, `crossingVoieMm` sur les règles
  actuelles (bilan : `audit/curseurs-c5-4720-2026-09-25.md`).

## Où en est le cahier (objectif 80 %, cap 90 %)

- Partie 9 : 276/348 cuts posés par le Pilote (79,3 %), 82,5 % estimés avec une
  Reprise dans la même page, 89 à 93 % hors fin de partie hors vue (KI-051).
  Pas de relecture encore : C4 non mesuré.
- Partie 6 (reliquat pur) : 73/125 (58,4 %) ; seul levier : voisins validés.
- Rapport de sortie : C1 non démontré (aucun lot de validation relu), C2 non
  publiable (P2), C3 tenu, C4 non mesuré, C5 à jour.

## En attente de l'utilisateur

1. **Relecture Natif de la partie 9** (lots 4.7.18 et 4.7.19) : premier lot de
   validation possible.
2. **Source des voisins validés** : ESV permet-il d'ouvrir un cut donné (numéro,
   précédent/suivant même validé) ? Sans cela, la garde D-054 reste sans source.
3. **KI-061** : ce que montre ESV à la fin de partie (rechargement, autre partie).
4. Décisions : définition d'un lot complet (proposé ≥ 100 cuts consécutifs),
   seuil C4, D4 (statut des 90 %), fin hors vue (D-043 à revoir : 10 points sur
   la partie 9), P2 (30 cuts replacés à l'aveugle).

## Chantiers ouverts

- P2 : outil prêt (`tools/p2-plancher.cjs SESSION --json P2.json`, puis
  `acceptance-report.cjs --p2 P2.json`) ; il manque la session terrain F2
  (30 cuts déjà validés, rails éloignés d'au moins 5 cm puis replacés).
- Les 9 choix `minTop` 5 à juger sur le terrain.
- Version candidate : calage sur une autre partie, contrôle visuel §14 H dans
  Edge (interface H), audit indépendant, cahier consolidé, paquet reproductible.

## Outils utiles

- `tools/acceptance-report.cjs --lot DOSSIER --relecture DOSSIER` : C1–C5 d'un lot.
- `tools/choice-anchor-study.cjs` : banc de la décision (Natif + lots relus).
- banane-data `benchmarks/partie-9-2026-09-25/extraire.py` : exports de la partie 9.
- banane-data `travail/2026-09-25_partie-9/` : parité, reprise simulée, hors vue.
- banane-data `travail/2026-09-25_c5-4720/` : balayage C5 et son agrégation.

## Consommation

Réponses courtes, sorties filtrées, un banc ciblé à la fois.
