# Passation du développement à l'agent Codex (D-301, 07/11)

À lire en entier, après `CLAUDE.md`, `DECISIONS.md` (D-294 à D-301) et `fiches/ARCHITECTURE_CIBLE.md`. Cette fiche dit où en est chaque chantier, ce qui reste à faire et dans quel ordre.

## Ton rôle
- Par D-301, tu es l'**intégrateur** : toi seul pousses sur le tronc `claude/50-test17`, en avance simple (pas de rebase, pas de force-push), et tu fabriques les paquets.
- Tu peux lire les données terrain du dépôt `banane-data` (branche `claude/execute-prompt-00-18ra5a`), comme Cursor (D-253 étendue par D-301). Ces données ne sont **jamais** versées dans `banane` : ni zip, ni journal, ni nuage, ni capture d'écran, ni UUID, ni adresse ou code projet ESV, ni nom d'opérateur.
- Les interdits de `CLAUDE.md` valent pour toi, en particulier :
  - Ariane n'envoie jamais SKIP et ne valide jamais un cut non résolu ;
  - pas de nom de modèle d'IA dans les fichiers ni les commits ;
  - `manifest.json`, les fichiers gelés (`src/geometry.js`, `vendor/lidar.js`), un réglage qui change une pose ou une validation, toute dépense, toute suppression de données, un merge dans `main` ou une étiquette : seulement sur accord écrit de l'opérateur, consigné en D-xxx.
- Le prochain numéro de décision est **D-303**. Maquette bloquée par la politique du navigateur : voir D-302.

## Avant chaque paquet (preuves obligatoires)
1. `node tools/verify.cjs`, seul sur la machine (environ 15 min) ; commiter `audit/verification.*` qu'il produit, jamais à la main.
2. `CHROMIUM=… node tests/esv-maquette/essais.cjs` (maquette ESV).
3. `node tools/scan-identite.cjs` et `node --test tests/noms-modeles.test.cjs tests/scan-identite.test.cjs`.
4. Changement d'un module de décision : `node tools/garde-gcv2.cjs`, `tools/parite-relecture-sw.cjs`, `tools/parite-l1se-sw.cjs --passe`.
5. Paquet : `python3 tools/package.py --output …` ; entrée dans `CHANGELOG.md` ; consigne d'installation à l'opérateur : « décompresser dans le même dossier, Recharger dans chrome://extensions, F5 sur ESV ».

Rust : `cd ariane-rs && cargo clippy --workspace --all-targets -- -D warnings` (et `--target wasm32-unknown-unknown`), `cargo test --workspace`. Les exceptions de lints de l'espace sont voulues : **ne pas** ajouter `-W clippy::pedantic` en ligne de commande. Plafond mémoire du cœur : 256 Mio.

Rejouer de vraies coupes en maquette : `node --stack-size=60000 tools/banc-esv.cjs --export <corpus GCV1 extrait de banane-data> --extension <paquet décompressé>` (le lecteur d'export dépasse la pile par défaut sur les gros fichiers).

## État au 07/11 (tronc `585b423`, paquet « Vision » livré le 06/11)

| Chantier | Branche, tête | État | Prochaine étape |
|---|---|---|---|
| **Mesure « Vision »** (D-299, étape 2) | — | paquet chez l'opérateur, essai prévu | Analyser son export : événements `rust` (servi ou repli, raison), durée par étape (navigation, chargement ESV, attentes, lecture, calcul, pose, validation), et le **trajet d'une capture de la page au service worker**. |
| **CH-075** typage limité (D-299, étape 1) | ticket `chantiers/CH-075.md` | à lancer | Suivre le ticket : un module, types distincts, annotations séparées des corrections. |
| **CH-064** programme Rust (chef) | `chantier/CH-064` `da422eb` | J1 à J5 et E fusionnés ; CI verte | Lire `chantiers/CH-064/reprise.md`. Relancer la parité Chromium de D (`tools/ch064-d-chromium.cjs --lot 20`), arrêtée au cas 300 240 sur environ 330 000 ; surveiller le tas JS de la page (1,35 Go au dernier relevé). Appliquer les patchs CH-070 (`coeur-aiguillage.patch`, `ariane-js-date-json.patch`), puis CH-071 (`branchement-coeur.patch`). |
| **CH-074** J5, GCV2 L1 | `chantier/CH-074` `b47ff7d` | parité 63 485/63 485, garde des 12 lots verte | Seule la `parite-l1se-sw --passe` de la copie reste (lot 2-19, environ 1 h, seul sur la machine, compteur `gcv2-l1` du cœur supérieur à 0). Commandes dans `chantiers/CH-074/rapport.md`. |
| **CH-069** export | `chantier/CH-069` `7bb2f7f` | relevé + variantes 5 494/5 494 (Node, Chromium) | Parité réelle (arrêtée à 213 cas, 0 écart), Chromium sur un sous-ensemble réel, banc, tri « gain seulement ». Étapes dans son rapport. |
| **CH-070** session | `chantier/CH-070` | PRÊT accepté (d7eb23e) | Rien : patchs à appliquer par CH-064. Seul `reconstruireCut` gagne en WASM ; le reste reste en JS. |
| **CH-071** files | `chantier/CH-071` `18be0a6` | parité 453 637/453 637 (Node, Chromium) | Banc de temps et essai du plafond de 256 Mio (écrits, non lancés), puis PRÊT. |
| **CH-068** J4 | `chantier/CH-068` `7f0eade` | fusionné dans CH-064 | Banc de temps et de mémoire J4, si utile. |
| **CH-072** vue (Cursor, PR #28) | `chantier/CH-072` `48b8d9c` | livré, **non vérifié** | Vérifier (règles du § « Avant chaque paquet », parité, banc) avant toute fusion. |
| **CH-073** rendu (Cursor, PR #29) | `chantier/CH-073` `8914a1d` | non commencé | À reprendre seulement si un gain mesuré est attendu (D-300). |
| **CH-065** lecture LiDAR JS directe | `chantier/CH-065` `9c25fef` | `lidar-direct` en attente (D-297) | Seulement après le relevé de console de l'opérateur (`tools/ch065-releve-accesseur.js`), avec three.js « 124 » et une lecture directe possible sur tous les nœuds. |
| **CH-066** / **CH-067** | PR #26 fusionnée / PR #27 | fini / audit rendu | — |

PR #25 (`chantier/CH-064` → tronc) : brouillon d'audit, **ne pas fusionner** ; y demander `@codex review` à chaque jalon.

## Cap (D-299, D-300)
Pas de refonte. Le Rust calcule là où il gagne, en traitements complets ; on n'ouvre plus de portage fonction par fonction. Ordre : typage limité → mesure de « Vision » → attentes fixes remplacées par des états observés (décision écrite de l'opérateur sur les fichiers gelés, D-293 tient) → lieu du moteur (document hors écran ou Worker) si la mesure le justifie.

## Parler à l'opérateur
En français, simple, sans technique inutile ; seulement du mesuré, qualifié ÉTABLI / PROBABLE / SUPPOSÉ ; une question donne le contexte, la conséquence et une recommandation. Le hub (PR #7, relayé sur Telegram) sert aux décisions et aux paquets prêts.

## Piloter comme l'intégrateur précédent : coder, arbitrer, décider, déléguer

### Ce que tu décides seul
- L'ordre des travaux dans le cap de D-299 et D-300, le découpage en chantiers, l'écriture des tickets (`chantiers/CH-NNN.md`, gabarit des tickets CH-069 à CH-075).
- Accepter ou refuser un PRÊT, après tes propres vérifications (ci-dessous). Refuser est normal : dis pourquoi, en une liste de points vérifiables.
- Garder une fonction en JS quand le Rust ne gagne pas (« gain seulement »), relever un défaut, demander une correction, arbitrer entre deux versions d'un même correctif (prendre la plus simple qui passe les preuves, ou celle qui est déjà fusionnée si elles sont équivalentes).
- Ce qui n'a pas d'usage aujourd'hui n'entre pas (exemple : `ariane-js-extra.patch` de CH-070 refusé tant qu'aucun calcul ne s'en sert).

### Ce qui revient à l'opérateur (tu prépares, il tranche)
Tout ce qui est listé dans « Ton rôle » comme accord écrit, plus : un changement de cap (D-299, D-300), le nom ou la version d'un paquet, l'ordre d'arrêt ou de reprise des chantiers. Une question à l'opérateur se pose ainsi : le contexte en une phrase, la conséquence de chaque option, ta recommandation en premier. Sa réponse devient une décision D-xxx dans `DECISIONS.md`, avec ses mots, jamais réécrite (on complète par une nouvelle D-xxx).

### Vérifier un PRÊT (ne jamais croire un rapport sur parole)
1. La base contient la dernière tête utile (`git merge-base --is-ancestor`).
2. Rust : clippy de l'espace (natif et wasm32) et `cargo test`, un commentaire `// SÛRETÉ :` par `unsafe`, pas d'`unwrap` hors des essais.
3. Les essais ciblés repassent chez toi ; scans d'identité et de noms de modèles.
4. La parité porte sur le **vrai** chemin : un compteur ou un journal prouve que le code nouveau a été appelé (CH-074 : une relecture « identique » qui n'appelait jamais `gcv2-l1` ne prouvait rien ; CH-064-E : un outil rendait « identique » sur un corpus vide).
5. La mémoire est mesurée au plafond réel (256 Mio), pas avec un plafond relevé.
6. Un chiffre de temps vient d'un banc au repos, avec plusieurs répétitions, et compte les échanges JS ↔ WASM.

### Déléguer
- Un chantier = un ticket complet, autonome : but, périmètre, fichiers interdits, preuves exigées, format du rapport, et « envoie un PRÊT, puis arrête-toi ».
- Cursor se lance par un commentaire `@cursor …` sur la PR du chantier (PR en brouillon vers le tronc, ne pas la fusionner telle quelle). Les relectures externes : `@codex review` sur la PR #25 à chaque jalon.
- Donne à chaque exécutant la prochaine étape précise, jamais « continue ». Après un arrêt (quota, redémarrage), relance chaque chantier depuis son état de reprise écrit.
- Ne lance pas deux travaux lourds en même temps sur la même machine (bancs, parités Chromium, verify) : les mesures se faussent et les processus meurent par manque de mémoire.
- Pas plus de chantiers ouverts que tu ne peux vérifier : un PRÊT non vérifié ne vaut rien.

### Arbitrer
- Le mesuré l'emporte sur l'avis, y compris celui d'un relecteur externe : vérifie chaque affirmation dans le code et par une mesure avant de l'adopter ; dis ce qui est juste, ce qui est dépassé, ce qui est faux, preuves à l'appui.
- Tes propres erreurs se disent tout de suite et simplement (exemple : une commande clippy fausse qui avait fait accuser à tort un correct).
- En cas de doute sur une pose, on ne pose pas : pause motivée, jamais SKIP.

### Parler à l'opérateur
Messages courts : ce qui est fait, ce qui reste, ce qui demande son accord (ou « rien ne demande votre accord »). Pas de jargon sans explication. Il préfère n'être sollicité que pour les décisions et les paquets prêts.
