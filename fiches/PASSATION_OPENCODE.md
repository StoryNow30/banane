# Passation complète à OpenCode (D-364, D-373)

But (D-364, mots de l'opérateur) : « progressivement léguer toute la production et tout le développement […] au fur et à mesure c'est OpenCode qui aura la main à 100 % ». La suspension de D-365 (« d'abord clore Ariane 5.0 ») est tombée : la 5.0 est close (D-370, Vision 20, sur `main`). Le 18/11, l'opérateur a demandé la passation complète et le plan d'Ariane 6 (D-373). Ce document est tout ce qu'il faut à OpenCode pour faire, seul, le travail de l'exécutant puis celui de l'intégrateur. Le plan de travail est `fiches/PLAN_ARIANE_6.md`.

**D-375 (18/11) : l'opérateur confie tout à OpenCode** (« on confie tout à opencode »). Les étapes 2 à 4 ci-dessous sont levées : après CH-131 (contrôle que le VPS refait le livré), tu es l'intégrateur, avec la main entière. Le tableau reste comme rappel de ce que chaque rôle fait.

## 0. Ton rôle, étape par étape
Chaque étape ne s'ouvre que si la précédente est **tenue**, constaté par l'intégrateur et écrit au hub.
| Étape | Tu fais | Claude fait | Tenue quand |
|---|---|---|---|
| **1. Prise en main** | CH-131 : refabriquer la Vision 20 sur le VPS (verify, maquette, paquet) et dire où tu diffères du livré. | Relit ton rapport. Livre la Vision 21 (CH-137, CH-138). | Paquet identique au livré fichier pour fichier (CRC, hors `BUILD` et `telecommande-relais.json`), verify vert, rapport au hub. |
| **2. Exécutant** | Chantiers `chantier/CH-NNN` du lot A d'Ariane 6 (mesures par script, correctifs). | Tickets, relecture de chaque diff, intégration, paquets. | Deux chantiers rendus sans retouche de fond, essais rouges puis verts, aucun interdit franchi. |
| **3. Intégrateur sous relecture** | Intégration sur `integration/…`, verify, maquette, paquet, journal des versions, puis avance du tronc après accord. | Relit et autorise l'avance du tronc. | Une version livrée par toi, acceptée par l'opérateur sur le terrain. |
| **4. La main entière** | Tu pousses le tronc, écris les tickets, proposes la direction à l'opérateur, tiens `DECISIONS.md`. | Relecture à la demande. | Décision écrite de l'opérateur. |

Tant que l'étape 3 n'est pas ouverte, tu es **exécutant** : jamais de poussée sur le tronc, jamais de fichier protégé (liste dans `CLAUDE.md`), un ticket lu en entier avant de commencer.

## 1. Préparer le VPS (l'opérateur, une fois)
1. Accès GitHub en écriture à `StoryNow30/banane` et `StoryNow30/banane-data` : `gh auth login` (le hub, les pull requests et les publications passent par `gh`), puis `git config --global user.name …` et `user.email …`.
2. Node.js 22, Python 3, Playwright et Chromium (`npm i -g playwright && npx playwright install chromium`, puis `export CHROMIUM=<chemin du binaire>` ; ou `PLAYWRIGHT_MODULE=<chemin>` si Playwright n'est pas trouvé).
3. Clones côte à côte : `banane` **complet** (pas de `--depth` : le verify lit l'historique, essai `typage-ch075`) sur `claude/50-test17` ; `banane-data` en `--filter=blob:none --sparse` sur `claude/execute-prompt-00-18ra5a` (ou `BANANE_DATA=<chemin>`).
4. Hors dépôt, dans le profil du shell ou `~/.ariane/` : l'adresse du relais dans `~/.ariane/relais.txt` (une ligne ; elle contient le nom de l'opérateur) ; les motifs confidentiels du scan dans `ARIANE_MOTIFS_INTERDITS` (et `ARIANE_MOTIFS_INTERDITS_CASSE`). Jamais dans un fichier de `banane`, un commit, ni le hub.
5. Contrôle : `node tools/vps-pret.cjs` doit dire « Prêt ». Il n'affiche jamais l'adresse ni les motifs.
6. OpenCode lit `AGENTS.md` à la racine, qui renvoie à `CLAUDE.md` et à ce document.

## 2. Lire, dans l'ordre
`AGENTS.md`, `CLAUDE.md`, ce document, `fiches/PLAN_ARIANE_6.md`, `LIRE_EN_PREMIER.md` (état), `CHANGELOG.md` (Visions 18 à 20), `hub/PROTOCOLE.md`, `fiches/RESEAU_IA.md` (organisation), puis à la demande `DECISIONS.md` (D-xxx, jamais réécrites ; les plus utiles au quotidien : D-259 plafond de 10, D-264 « non résolu », D-306 et D-364 données, D-363 deuxième passe, D-370 à D-373 état d'aujourd'hui).

## 3. Carte du dépôt
- **Moteur et décision (protégés pour un exécutant)** : `src/engine.js`, `src/adapter-page.js`, `src/geometry*.js`, `src/gcv2*.js`, `src/lot-decision.js`, l'écriture dans ESV. `background.js` (service worker) : en chantier, on le change par un patch posé dans `chantiers/CH-NNN/` que l'intégrateur applique (pratique de CH-121, CH-124, CH-136).
- **Panneau** : `panel.html` (ordre des scripts), `src/ui5.js` (état, actions `data-act`, variantes d'interface), `src/signal-rendu.js` (Glacier), `src/mix-rendu.js` (Mix, CH-137, à venir), `panel-signal.css`, `src/stockage-neuf.js`, `src/telecommande-*.js`, `fonts/` (IBM Plex, OFL).
- **Télécommande** : `telecommande/` (Worker Cloudflare de l'opérateur ; `INSTALLATION.md` § G pour le redéployer).
- **Essais** : `tests/*.test.cjs` (vm et navigateur), `tests/esv-maquette/` (ESV simulé : `essais.cjs`, `navigateur.cjs`), scènes du panneau `chantiers/CH-135/outils/scenes.cjs`.
- **Outils** : `tools/verify.cjs` (suite complète, 20 s par fichier), `tools/garde-gcv2.cjs`, `tools/parite-relecture-sw.cjs`, `tools/parite-l1se-sw.cjs`, `tools/package.py` (+ `relais_paquet.py`), `tools/hub.cjs`, `tools/scan-identite.cjs`, `tools/bilan-lot.cjs`, `tools/compteur-gcv2.cjs`, `tools/vps-pret.cjs`.
- **Pilotage** : `chantiers/` (tickets, rapports, patchs), `fiches/`, `DECISIONS.md`, `CHANGELOG.md`, `LIRE_EN_PREMIER.md`, `audit/verification.*` (écrit par le verify seulement).
- **`banane-data`** : `collections/<date>_<version>_<objet>/` (exports de terrain et `NOTES.md`), `outils/analyse-lots/` (scripts de jugement), `maquettes/` (exports Figma : `figma-signal-mix-q4/` est la maquette en cours). Rien de ce dossier ne passe dans `banane`.

## 4. Un chantier (exécutant)
1. `git switch -c chantier/CH-NNN origin/claude/50-test17` ; lis `chantiers/CH-NNN.md` en entier.
2. Ouvre son canal : `gh pr create --base claude/50-test17 --draft` (titre « CH-NNN : … »). Pas d'autre pull request.
3. Plan en cinq lignes au hub avant de coder : `node tools/hub.cjs dire --chantier CH-NNN --de opencode --type info "…"`. Une `question` bloque : attends la `reponse`.
4. Essai rouge, code, essai vert : `node --test tests/<fichier>.test.cjs` (chaque fichier sous 20 s, machine chargée comprise). Si un chemin navigateur change : `node tests/esv-maquette/essais.cjs`. Si un module de décision change (intégrateur seulement) : garde et parités, diff des décisions vide ou expliqué ligne à ligne.
5. Commits en français, préfixés « CH-NNN : », un par étape ; pousse au moins toutes les 30 minutes. L'action « Chantier » lance le verify sur GitHub et poste le `verdict`.
6. Fin : `chantiers/CH-NNN/rapport.md` d'une page (fait, pas fait, mesures qualifiées) et un `rapport` au hub.

## 5. Une version (intégrateur, à partir de l'étape 3)
1. `git switch -c integration/<nom> origin/claude/50-test17` ; `git merge --no-ff chantier/CH-NNN` par chantier (jamais de rebase) ; essais ciblés après chaque fusion.
2. Machine au repos : `node tools/verify.cjs` (environ 14 min le 18/11 : 3 732 essais, 3 724 réussis, 0 échec, 8 sautés) ; on commite `audit/verification.*` tel qu'il sort.
3. `node tests/esv-maquette/essais.cjs` ; garde et parités si un module de décision a changé.
4. `CHANGELOG.md` (entrée de la version : contenu, preuves, ce qui n'est pas couvert, installation), `LIRE_EN_PREMIER.md`, `fiches/PASSATION_SESSION.md`.
5. Paquet : `python3 tools/package.py --output visionNN.zip` (l'adresse du relais vient de `~/.ariane/relais.txt` ; sans elle le paquet sort sans télécommande) ; `sha256sum` ; `BUILD` dans le zip = commit. Le zip contient l'adresse du relais : il se remet à l'opérateur par le canal convenu avec lui, **jamais** dans un commit ni en pièce d'une publication GitHub.
6. Tronc en avance simple : `git push origin integration/<nom>:claude/50-test17` (refusé si ce n'est pas une avance simple : alors fusionne le tronc d'abord). `main` et les étiquettes (`gh release create vX …`) : seulement sur décision de l'opérateur.

## 6. Après un lot de terrain
L'opérateur envoie ses exports (zips). Ils vont dans `banane-data/collections/<date>_<version>_<objet>/` avec un `NOTES.md` (ce qui a tourné, ce qui est jugé, chiffres qualifiés) ; jugement par `node tools/bilan-lot.cjs` et les scripts de `outils/analyse-lots/`, jamais à la main. Commit dans `banane-data` avec `git add --sparse` (le clone est partiel). Rien n'en passe dans `banane` : ni adresse, ni code de projet, ni UUID, ni coordonnée, ni capture.

## 7. Pièges mesurés
- Clone partiel de `banane` : `typage-ch075` échoue ; `git fetch --unshallow`.
- Un fichier d'essais au-delà de 20 s échoue au verify : découpe-le (CH-135 coupé en cinq le 18/11).
- Essais fragiles connus sous charge : CH-028, CH-110 (préchauffage), ch104, la molette du Cadran. Une seule relance, jamais un essai sauté ou désactivé ; cause non trouvée (lot A3 d'Ariane 6).
- Un `MutationObserver` qui écrit un attribut qu'il observe gèle la page : n'écrire que si la valeur change (CH-136).
- `tests/noms-modeles.test.cjs` refuse tout nom de modèle d'IA dans le dépôt, commits compris : écris « le modèle le plus fort », jamais un nom.
- Le hub refuse un message qui contient une adresse web hors liste blanche, un courriel, un code de projet ESV, un UUID ou un motif confidentiel (code 2) : reformule, n'esquive pas.
- `banane-data` partiel : `git add` refuse les chemins hors du cône ; `git add --sparse`.
- Les réglages d'Ariane vivent dans le stockage local de Chrome d'un poste : deux postes, deux réglages (CH-136, ÉTABLI). Avant de conclure à un réglage perdu, vérifier le poste.

## 8. Ce que Claude faisait autrement
- `send_message` entre sessions : pour toi, **le hub** (et rien d'important hors du hub).
- Figma : tu n'y as pas accès. Les maquettes sont exportées dans `banane-data/maquettes/` (images, `jetons.json`, `LISEZMOI.md`) ; pour une maquette neuve, demande-la à l'opérateur ou à Claude.
- Pages de démonstration publiées : pose le HTML autonome dans `chantiers/CH-NNN/` (un fichier, sans réseau) ; l'opérateur l'ouvre d'un double-clic.
- Réveils programmés et abonnements aux PR : `gh pr checks`, `node tools/hub.cjs lire --chantier CH-NNN`.
- Étiquettes et publications : `gh` le fait (le proxy de Claude ne le permettait pas).

## 9. État au 18/11/2026
- 5.0 close : Vision 20 (build `a19c5ed5`) livrée ; `main` = 5.0 (d44ebb10). L'étiquette `v5.0` est à créer par une publication GitHub (en attente).
- Arrêtés proprement par Claude le 18/11 (quota de l'opérateur épuisé), à intégrer par toi : CH-137 (interface alternative « Mix », D-372, D-374 ; `chantier/CH-137` à `91601a5`) et CH-138 (compteur des cuts appris ; `chantier/CH-138`, lire son rapport). C'est la Vision 21 : `chantiers/VISION-21.md`.
- En attente de l'opérateur : réglages d'un poste à l'autre ; relais à redéployer ; validation du plan d'Ariane 6 et de son tronc.
- À faire, dans l'ordre : `node tools/vps-pret.cjs` ; CH-131 (`chantiers/CH-131.md`, CRC de référence `chantiers/CH-131/crc-vision20.txt`) ; la Vision 21 (`chantiers/VISION-21.md`) ; puis le plan d'Ariane 6 une fois validé par l'opérateur.

## 10. Premier message à donner à OpenCode
> Tu reprends le développement d'Ariane. Lis `AGENTS.md`, `CLAUDE.md` et `fiches/PASSATION_OPENCODE.md` en entier, puis lance `node tools/vps-pret.cjs` et dis-moi ce qui manque. Quand il dit « Prêt », fais le chantier CH-131 (`chantiers/CH-131.md`), rends ton rapport au hub, puis fabrique la Vision 21 (`chantiers/VISION-21.md`). Tu as toute la main (D-375). Tout en français, seulement du mesuré.

## Ce qui ne change pas
Les interdits de `CLAUDE.md`, pour toi comme pour Claude ; les décisions de l'opérateur ; une version = un verify complet, la maquette si un chemin navigateur change, les parités si un module de décision change.
