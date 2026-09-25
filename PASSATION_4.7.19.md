# Passation — Banane au 25/09/2026 (4.7.19 TEST livrée)

À lire en premier par la conversation qui reprend. La conversation précédente est
conservée par l'utilisateur (historique complet) ; ce fichier suffit pour reprendre.

## Contexte

- Extension Chrome/Edge MV3 qui place les rails sur le LiDAR d'ESV. Utilisateur :
  SIG, parle français, opérateur terrain et direction du projet.
- Dépôts : `StoryNow30/banane` (branche `claude/banane-48-cahier`, dernier commit
  `a58c048` + ce fichier), `StoryNow30/banane-data` (branche
  `claude/banane-47-gate-audit-vaktr1`, collectes et relectures).
- Release officielle : **4.7.0**. Les 4.7.x suivantes sont des builds TEST.
- Version terrain : **4.7.19** (paquet `banane-v4.7.19-test.zip`, SHA-256
  `c2430279…0a1d65`, reconstruit depuis `a58c048` par `git archive` +
  `tools/package.py`). Retour arrière : 4.7.18 (`RETOUR_ARRIERE.md`).

## Règles non négociables

- AUCUN reset destructif, force push, merge dans `main`, tag ni release sans
  autorisation explicite de l'utilisateur.
- Contrat d'écartement [1405, 1470] mm : admissibilité seulement, jamais une
  cible ni un « plus proche de 1435 ». Écartement des voisins : garde seulement.
- Pas d'application partielle (les deux rails ou rien) ; pas de VALIDATE/SKIP
  automatique d'un cut non résolu.
- Aucune pose humaine en entrée du moteur ou de la décision (cahier §10, §14 I).
- Cuts 9033 et 9241 exclus. Dépôts publics : jamais de code source d'ESV.
- `src/engine.js` épinglé : les correctifs vont dans `background.js` ou
  `src/lot-decision.js`.
- Commits terminés par `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  et la ligne `Claude-Session` ; aucun identifiant de modèle dans les fichiers.
- Chaque fichier d'essai tient en 10 s. `node tools/verify.cjs` doit sortir en 0
  avant chaque commit (restaurer `audit/verification.*` si seuls les temps changent).
- Pas de fichier non suivi en fin de tour (commit et push).

## Où en est le travail

- 4.7.19 (D-053, amendement n°13) : lecteur « passage à niveau » en dernier
  recours (`src/level-crossing.js`), voie encadrée, lot « Reprise des
  différés », arrêt au dernier cut du lot, correctif KI-059 (messages 64 Mio).
  Banc relu : +45 décidés, 36 jugés, 1 faux (p34 4551, 10,5 mm), 0 juste perdu.
  Bilan : `audit/passage-niveau-lecteur-2026-09-25.md`.
- Lots terrain 4.7.18 : p2 (16/30, 2 faux au passage à niveau : 772, 773, non
  corrigés), p3 (49/82, 0 faux / 48, arrêté par KI-059). Les différés viennent
  des reliquats (1,7 cut par suite), pas des règles
  (`audit/lot-4718-p3-2026-09-25.md`).

- Lot terrain 4.7.18 p9 (346 cuts, 0–8539, sans relecture) : 262 appliqués,
  parité 346/346, +12 au rejeu 4.7.19 (passages à niveau) ; fin 8504–8539
  perdue hors de la vue (pose ESV à 20 cm du rail gauche, KI-051/D-043)
  (`audit/lot-4718-p9-2026-09-25.md`).

- Lot terrain 4.7.19 p9 sur les différés (lot ordinaire, pas « Reprise ») :
  14/85 appliqués, parité 85/85 ; les 12 cuts du rejeu (passages à niveau)
  appliqués à l'identique ; 8504–8541 toujours différés. Une reprise après
  rechargement de la page ignore les appuis (autre `frameId`)
  (`audit/lot-4719-p9-2026-09-25.md`).

## En attente de l'utilisateur

1. **Retour terrain de la 4.7.19** (partie neuve avec passages à niveau, puis
   « Reprise », relecture, export journal + diagnostic + corpus). Premier
   export attendu : le journal du lot p3 (cause exacte du cut 8209).
2. **Ne pas lancer la 4.7.20 avant ce retour.** La 4.7.20 = interface **H**
   avec animations (maquettes : `design/pistes-retenues/`, canevas
   https://claude.ai/artifact/1yFX4HYMC4UiNzVSt4w2cZ).
3. Décisions de direction ouvertes : appuis validés à la main pour les cuts
   isolés (amendement §14 I) ; seuil C4 ; définition d'un lot complet (proposé
   ≥ 100 cuts consécutifs) ; P2 (30 cuts replacés à l'aveugle).

## Chantiers ouverts

- C5 : balayage `gaugeGap` / `gaugeCount` (scripts dans le scratchpad de la
  session précédente, à relancer si besoin avec `tools/choice-anchor-study.cjs
  --option …`).
- C2/P2 : outil de mesure du plancher humain et protocole.
- C4 et livraison : seuil, cahier consolidé, contrôle visuel §14 H dans Edge.

## Outils utiles

- `tools/acceptance-report.cjs --lot DOSSIER --relecture DOSSIER` : C1–C5 d'un lot.
- `tools/choice-anchor-study.cjs` : banc de la décision sur le lot (Natif + lots relus).
- `tools/passage-niveau-scan.cjs` : repérage des passages à niveau, lecteur contre pose humaine.
- Données : banane-data `collections/*/manifest.json` (archives + empreintes).
- Fichiers de travail de la session précédente (bancs, balayage C5 à finir,
  relevés, scripts) : banane-data `travail/2026-09-25_session-4.7.19/` (voir son README).

## Consommation

La conversation précédente a coûté cher (contexte très long, sorties brutes,
bancs relancés). Ici : réponses courtes, sorties filtrées, un seul banc ciblé
avant livraison.
