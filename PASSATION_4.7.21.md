# Passation — Banane au 26/09/2026 (4.7.21 TEST livrée)

À lire en premier par la conversation qui reprend. Remplace `PASSATION_4.7.20.md`
(gardé pour l'historique). La conversation précédente est conservée par
l'utilisateur ; ce fichier suffit pour reprendre.

## Contexte

- Extension Chrome/Edge MV3 qui place les rails sur le LiDAR d'ESV. Utilisateur :
  SIG, parle français, opérateur terrain et direction du projet.
- Dépôts : `StoryNow30/banane` (branche `claude/banane-48-cahier`), 
  `StoryNow30/banane-data` (branche `claude/banane-47-gate-audit-vaktr1`,
  collectes, relectures, références et fichiers de travail).
- Release officielle : **4.7.0**. Les 4.7.x suivantes sont des builds TEST.
- Version terrain : **4.7.21** (paquet `banane-v4.7.21-test.zip`, SHA-256
  `24f8f1fe5c1616122d1c43c0eb175f34c93f57947ad791408737bc46f4ee2c06`, construit
  depuis `b2e0e5b` par `git archive` + `tools/package.py`, reproductible : deux
  constructions identiques ; chargé dans Chromium comme extension MV3, service
  worker 4.7.21, cerveau actif, `lot-decision-v6`, vues sans erreur). Retour
  arrière : 4.7.20 (`RETOUR_ARRIERE.md`).

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

## Ce que la 4.7.21 a livré (D-056, KI-062)

- **KI-062** : nouveau lot possible après un lot arrêté (le panneau gardait les
  anciennes bornes ; il fallait réinstaller).
- **Bornes remplies par Banane** : premier cut = cut affiché ; dernier cut =
  fin retenue par partie (`bornes-partie`, `chrome.storage.local`
  `banane4Parties` : saisie ou fin constatée), sinon « fin de partie »
  (`endMode:'partie'`, borne 999999 ; clôture quand ESV quitte la partie).
- **Réglages fixes** (différer, appliquer, tenter), **cerveau actif** par
  défaut, **détails ouverts**, **Assisté retiré** de l'interface. Les 4 essais
  4.7.0 de `panel-policies` sont gardés (§14 A) : lignes « politique effective »
  pendant un lot, champ caché `#policy`.
- **Mouvement** sans clignotement (panel.js, API Web Animations ; panel.css).
- **Outils** : lot arrêté à sa borne = complet ; `acceptance-report --batch`.
- Captures et vidéo : banane-data `travail/2026-09-26_interface-4721/`.

## Lot 4.7.20 de la partie 12 (26/09)

`audit/lot-4720-p12-2026-09-26.md` : premier lot mené à sa borne (1–8144),
84/106 (79,2 %), parité 106/106, sans relecture ; 7852–7861 : 10 différés
d'affilée (paires trop étroites, sans appui). Second lot 4.7.20 (partie 11,
556–8146, arrêté au cut 712) : pas encore exporté.

## Relecture de la partie 9 (26/09)

`audit/relecture-p9-2026-09-26.md` ; archives banane-data
`collections/2026-09-25_v4.7.19_/relecture p9/` ; scénarios
`travail/2026-09-26_relecture-p9/scenarios.cjs` (7 min, 13 Go).

- Partielle : 151/346 cuts du lot 4.7.18 relus (8066–8502 et 5151–5192
  sautés). 2 faux sur 66 appliqués jugés (4903, 7523 : premiers passages,
  vertical, rail trop bas) ; lot 4.7.19 : 0/11. Rapports
  `audit/acceptance-p9-2026-09-26-47{18,19}-relecture.json` ; rapport de sortie
  régénéré (partie 9 en « validation »).
- Rejeu 4.7.20 jugé : 80,3 % décidés ; vue corrigée (D-049) 85,8 % ; + voisins
  validés en dernier recours 90,8 %, 4 faux réels sur 102.
- Voisins validés : 62 des 360 cuts validés avant le lot corrigés à la
  relecture, en groupes cohérents ; la garde D-054 livrée retire 6 décisions
  justes au passage à niveau 4890–4902. « Dernier recours » proposé, non décidé.
- Biais vertical propre à la partie 9 (24 rails retouchés sur 27 relevés, 16
  dans les passages à niveau) ; absent des parties de réglage : hypothèse, pas
  de calage.
- Défauts de la relecture : 8516, rail droit validé sans correction (155 mm).
- Outils : `acceptance-report.cjs --batch ID` (diagnostic couvrant plusieurs
  lots) ; `validated-anchors-study.cjs --regles-actuelles`, partie lue sur les
  cuts pour un lot sans journal.

## Où en est le cahier (objectif 80 %, cap 90 %)

- Partie 9 : 276/348 cuts posés par le Pilote (79,3 %), 82,5 % estimés avec une
  Reprise dans la même page, 89 à 93 % hors fin de partie hors vue (KI-051).
  Relue le 25/09 (partielle) : 2 faux sur 66 jugés, C4 non évaluable.
- Partie 6 (reliquat pur) : 73/125 (58,4 %) ; seul levier : voisins validés.
- Partie 12 (4.7.20, neuve) : premier lot mené à sa borne, 84/106 (79,2 %),
  sans relecture.
- Rapport de sortie : C1 non démontré (aucun lot de validation complet et
  relu), C2 non publiable (P2), C3 tenu, C4 seuil à trancher (2 faux sur 77
  jugés, partie 9), C5 à jour.

## En attente de l'utilisateur

1. **Relecture de la partie 12** (lot complet, partie neuve) ; export du lot de
   la partie 11 ; fin de la relecture de la partie 9 (8066–8502, 5151–5192,
   rail droit de 8516) ; qui a validé les cuts hors lot de la partie 9 ?
   ESV affiche-t-il quelque part le dernier cut d'une partie ?
2. **Source des voisins validés** : ESV permet-il d'ouvrir un cut donné (numéro,
   précédent/suivant même validé) ? Sans cela, la garde D-054 reste sans source.
3. **KI-061** : ce que montre ESV à la fin de partie (rechargement, autre partie).
4. Décisions : D-049 (décentrer la caméra) avancé en 4.8 ? ; voisins validés
   en dernier recours ; rotation réglage / validation (statut de la partie 9) ;
   définition d'un lot complet pour un lot arrêté par l'opérateur,
   seuil C4, D4 (statut des 90 %), fin hors vue (D-043 à revoir : 10 points sur
   la partie 9), P2 (30 cuts replacés à l'aveugle).

## Chantiers ouverts

- P2 : outil prêt (`tools/p2-plancher.cjs SESSION --json P2.json`, puis
  `acceptance-report.cjs --p2 P2.json`) ; il manque la session terrain F2
  (30 cuts déjà validés, rails éloignés d'au moins 5 cm puis replacés).
- Les 9 choix `minTop` 5 à juger sur le terrain.
- Version candidate : calage sur une autre partie, contrôle visuel §14 H dans
  Edge (interface 4.7.21), audit indépendant, cahier consolidé, paquet reproductible.

## Outils utiles

- `tools/acceptance-report.cjs --lot DOSSIER --relecture DOSSIER` : C1–C5 d'un lot.
- `tools/choice-anchor-study.cjs` : banc de la décision (Natif + lots relus).
- banane-data `benchmarks/partie-9-2026-09-25/extraire.py` : exports de la partie 9.
- banane-data `travail/2026-09-25_partie-9/` : parité, reprise simulée, hors vue.
- banane-data `travail/2026-09-25_c5-4720/` : balayage C5 et son agrégation.

## Consommation

Réponses courtes, sorties filtrées, un banc ciblé à la fois.
