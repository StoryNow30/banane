# Ariane : règles pour tout agent qui travaille dans ce dépôt

Ariane est une extension Chrome qui place des rails dans ESV (LiDAR). Ce fichier est lu par toute session (Claude Code, Cursor, autre harnais). Il résume ce qu'il faut savoir avant d'écrire une ligne. Le détail de l'organisation est dans `fiches/RESEAU_IA.md` ; l'état du projet dans `LIRE_EN_PREMIER.md` et `BANANE_5.0_CAHIER_V2.md` ; les décisions de l'opérateur dans `DECISIONS.md` (D-xxx, jamais réécrites).

## Langue et ton
- Tout en français : code commenté, commits, fiches, rapports. L'opérateur se désigne « l'opérateur ».
- Ne rapporter que du mesuré, qualifié ÉTABLI / PROBABLE / SUPPOSÉ. Jamais un chiffre non mesuré.

## Interdits absolus (aucune exception, aucun ticket ne les lève)
- **Jamais de nom d'opérateur, de code projet ESV, d'adresse ESV, d'UUID ni de capture d'écran** dans un fichier du dépôt ou un commit. Les exports terrain (zips, journaux, nuages) ne sont jamais versés ici ni envoyés à un service externe : ils vivent dans le dépôt `banane-data`.
- **Ariane n'envoie jamais SKIP** et ne valide jamais un cut non résolu.
- **La deuxième passe est en ombre** (`passeDifferesDefaut.ecriture:false`) : la rallumer demande une décision écrite de l'opérateur.
- **Pas de réécriture d'historique** (rebase, amend d'un commit poussé, force-push) sans ordre explicite de l'opérateur. Pas de pull request sans demande.
- **Aucun nom de modèle d'IA** dans les fichiers ni les messages de commit, hors le pied de commit imposé par le harnais.
- Un exécutant (ticket `chantier/…`) ne touche **jamais** `src/engine.js`, `src/adapter-page.js`, `src/geometry*.js`, `src/gcv2*.js`, `src/lot-decision.js`, l'écriture dans ESV, `manifest.json`, la version, le paquet, ni le tronc.

## Branches
- Tronc de la 5.0 : `claude/50-test17`. Seul l'intégrateur y pousse, en avance simple.
- Un chantier = une branche `chantier/<ticket>` partie du tronc, un ticket `chantiers/<ticket>.md` lu en entier avant de commencer.
- Documents de pilotage et données : dépôt `banane-data` (branche `claude/execute-prompt-00-18ra5a`).

## Preuves avant de livrer
- Essai rouge d'abord, puis le code, puis l'essai vert (`tests/*.test.cjs`, vm ou navigateur).
- Essais ciblés en cours de travail : `node --test tests/<fichier>.test.cjs`. Le `verify` complet (`node tools/verify.cjs`, ~2 700 essais, 20 s par fichier, machine au repos) est lancé **une fois par version** par l'intégrateur, pas par chantier.
- Maquette ESV : `CHROMIUM=/opt/pw-browsers/chromium node tests/esv-maquette/essais.cjs` quand un chemin navigateur change.
- Tout changement d'un module de décision passe la garde (`node tools/garde-gcv2.cjs`) et la parité (`tools/parite-relecture-sw.cjs`, `tools/parite-l1se-sw.cjs --passe`) ; le diff des fichiers de décision doit être vide ou expliqué ligne à ligne.

## Commits
- En français, préfixés par le ticket (« CH-012 : … ») ou la version (« Test 24 : … »), un commit par étape cohérente, jamais de fichier généré à la main (`audit/verification.*` vient du verify).

## Coût
- Modèle économique par défaut ; le plus fort seulement pour concevoir ou relire, et on dit pourquoi.
- Pas d'agent pour lire un journal : un script (`banane-data/outils/analyse-lots/`). Un rapport fait une page.
