# H — Preuve serveur : pourquoi `serverConfirmed` est faux sur le lot de la 4:2

Statut : diagnostic en lecture seule (étape H de T21a, architecture 5.0), aucun rejeu ni verify lancé ; citations de code recontrôlées par l'orchestrateur. Correctif proposé, non écrit : à faire dans T21a. Les numéros de ligne valent pour le code d'avant T20a (4.9.5.20 a modifié `background.js`).
Code lu : commit `86ea20c` (dernier commit portant la version 4.9.5.18). Le tronc `claude/50-test17` ne diffère de ce commit, pour `background.js` et `src/`, que par les numéros de version (test 19) : les numéros de ligne ci-dessous valent pour les deux.
Données lues : lot du 21/10 (journal, bilan, diagnostic, liste d'ESV, verts à contrôler ; le corpus, qui porte les nuages, n'a pas été extrait) et Écho du 22/10 (export final, liste d'ESV). Chaque conclusion porte son niveau : ÉTABLI (mesure ou ligne de code), PROBABLE, SUPPOSÉ.

## 1. Le constat est-il vrai ? Oui sur un champ, non sur les autres

Définition stricte du brief : `serverConfirmed === true` et pas de navigation observée.

Le lot compte 68 cuts complétés et 1 différé (cut 2256), soit 68 poses (68 `applied-verified`, 68 cuts distincts, 68 `validation-accepted`).

| Champ du journal | n | `serverConfirmed` faux | vrai |
|---|---|---|---|
| événement `applied-verified` | 68 | 68 | 0 |
| événement `validation-intent` | 68 | 68 | 0 |
| événement `validation-observation` (et son `evidence`) | 68 | 67 | 1 |
| événement `validation-accepted` (`evidence`) | 68 | 67 | 1 |
| `records[]` avec commande envoyée | 68 | 67 | 1 |
| `state.batch.processed[].evidence` | 68 | 67 | 1 |
| diagnostic, `runtime.validationObservation` | 68 | 67 | 1 |
| bilan, `closureSummary.withoutServerConfirmation` | 68 complétés | 67 « sans confirmation » | 1 |

- ÉTABLI : « 68 sur 68 » n'est exact que pour le champ de l'événement `applied-verified` (et `validation-intent`). Sur tous les champs qui portent la preuve de validation, c'est **67 sur 68**.
- ÉTABLI : le seul cut vrai est le **4702**, le dernier invalide de la partie, validé sur place (Ctrl+Entrée). Il a `validationProof: server-confirmed`, `navigationObserved: false`. C'est le seul qui satisfait la définition stricte complète : 1 sur 68.
- ÉTABLI : pour les 67 autres, la navigation **est** observée (`navigationObserved: true` 67 fois), `validationProof: navigation-only`, `acceptedOnNavigationEvidence: true`, `afterStateStatus: AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED`. La formule « pas de navigation observée » de l'architecture décrit donc la définition, pas le lot : la navigation est précisément ce sur quoi le lot a avancé.
- ÉTABLI : `serverConfirmationStatus` n'existe pas dans le journal ni dans le bilan du lot (0 occurrence) ; il n'existe que dans les visites d'Écho.

## 2. Cause : la preuve existe, mais n'est jamais rattachée au cut

### 2.1 Le champ est posé à faux en dur, ou jamais mis à jour (ÉTABLI, lignes de code)

- `src/engine.js:308-310` : `applied-verified` (et `this.s.applied`) écrit `serverConfirmed:false` en dur. À cet instant, la pose est relue dans la scène ; la validation n'est pas partie. Le champ est faux **par construction** : 68/68 n'apprend rien. Il n'a de sens que comme « pas encore ».
- `src/engine.js:820` : `validation-intent` pareil, avant la requête.
- `src/adapter-page.js:921-972` (`decisionAndNext`, le « valider et suivant » du lot) : l'évidence naît avec `serverConfirmed:false` (ligne 949) et n'est jamais modifiée ; la phrase finale (ligne 971) le dit : « confirmation serveur indisponible ».
- `background.js:1171` : `adapter.capabilities={serverConfirmation:false}`, déclaré tel quel ; `src/engine.js:881` exige donc `allowNavigationEvidence` pour démarrer un lot.
- `src/engine.js:842-856` : `validationProof` vaut `server-confirmed` si `serverConfirmed`, `after-state-observed` si l'état après est relu, sinon `navigation-only` quand la politique l'accepte ; le record reçoit ces valeurs (ligne 845). Aucune lecture d'une écriture HTTP.
- `src/engine.js:911` (`closingState`) : toute action sans `serverConfirmed` interdit « Terminé confirmé » ; un lot qui valide par navigation ne peut donc jamais le porter.
- Le seul `serverConfirmed:true` du chemin du lot est `src/adapter-page.js:1021` (`validateInPlace`) : posé quand le **compteur affiché** « N on M treated » passe de N à N+1 (lignes 997 et 1012-1016). C'est une preuve d'interface, pas une réponse HTTP. ÉTABLI par le code ; la preuve HTTP du cut 4702 existe par ailleurs (§3).

### 2.2 L'observateur passif voit pourtant l'écriture, et le lot la jette (ÉTABLI)

- `src/esv-observer.js:304-310` : l'observateur enregistre chaque `PUT` de ligne de rail (`kind:'write'`, statut HTTP, corps, `rowIndex`, `railPairId`).
- Mesuré sur le journal du lot : 138 écritures, toutes `PUT` 204. 68 portent `ExtractionStatus: valid` + `TreatedByOperator: true` + les six bords (validation) : **une et une seule par cut posé**, 68 `rowIndex` distincts = les 68 cuts. 70 portent `SeenByOperator` seul (les 68 cuts, plus les lignes 0 et 2256). Le cut différé 2256 n'a aucune écriture de validation. Aucun événement `ecriture-refusee` dans le journal.
- `background.js:467` envoie chaque écriture à `ecritureObservee` (644), qui ne sert qu'à : rapprocher une ligne d'un cut, effacer un refus en attente, ou en lancer un (pause du lot, 4.9.5.1). Pour un 2xx, elle **n'écrit rien dans le record** : aucun chemin du lot ne pose `serverConfirmed` ni un équivalent.
- Contraste : l'Écho le fait. `src/native-session.js:593-617` (`noteServerWriteNow`) rattache une écriture `ExtractionStatus valid` + `TreatedByOperator` 2xx à la visite (par `rowIndex`, sinon par fenêtre de 5 s) et pose `serverConfirmed:true`, `serverConfirmationStatus:'observed-validation-write-204'` ; appelé depuis `background.js:473`, seulement si une session Écho est active. Dans l'Écho de la 4:2 : 30 visites sur 77 sont ainsi `serverConfirmed`.
- Les passes (relecture, deuxième passe) lisent aussi l'écriture, via `ecritureAttendue` (`background.js:2731`, champ `a.ok`), pour attendre l'enregistrement d'un cut précis. Le lot, lui, n'a rien de tel.

### 2.3 Pourquoi un test synchrone ne suffirait pas : l'écriture part après la navigation (ÉTABLI, mesure)

Pour les 68 cuts, le début du `PUT` (`startedEpochMs`) tombe **après** l'événement `validation-observation` : écart minimum 182 ms, médiane 281 ms, maximum 456 ms. Durée du `PUT` : médiane 40 ms, maximum 491 ms. Le lot a donc validé « sur la navigation » 0,2 à 0,5 s avant que la requête parte. Aucune lecture faite à ce moment ne peut voir l'écriture ; la preuve doit être rattachée après coup (comme le fait l'Écho). Réserve : écart entre l'horloge de la page et celle du service worker non mesuré (même machine) ; l'ordre est le même pour les 68 cuts.

Conclusion de la cause : instrumentation. La cause d'instrumentation, plausible dans le brief, est démontrée.

## 3. Les poses ont-elles été écrites côté serveur ? Oui (preuve non enregistrée, écriture faite)

- ÉTABLI : 68 `PUT` de validation, 68 réponses 204, à 0,2 à 0,5 s de chaque validation du lot.
- ÉTABLI : liste d'ESV relue par la page au départ de l'Écho, le lendemain 08 h 35, avant la première visite : 9 555 valides, 1 invalide (le cut 2256). Au départ du lot : 9 487 valides, 69 invalides. Les 68 cuts sont passés d'invalide (drapeaux 0) à valide, traité et vu (drapeaux 3) ; les 9 487 verts d'origine n'ont bougé d'aucun millimètre ; les seuls autres changements sont le drapeau « vu » sur les cuts 2, 3 et 2256.
- ÉTABLI : les positions des six bords de ces 68 cuts dans la liste du lendemain égalent **exactement** (écart 0,0 mm, pour 68 sur 68) le corps de la dernière écriture observée par Ariane ; elles diffèrent de la liste d'avant le lot de 2,2 à 74,5 mm (médiane 48,8 mm). Le rail a donc bien été déplacé puis enregistré, cut par cut, et rien d'autre.
- ÉTABLI : le cut 4702 (le « vrai » du lot) a, lui aussi, son `PUT` 204 ; il n'est pas différent des 67 autres côté serveur.
- Limites : la liste de l'Écho est la réponse d'ESV vue par la page (pas un accès direct à la base) ; l'intervalle lot-Écho est d'environ 14 h 20. L'égalité à 0,0 mm sur 68 cuts rend improbable une retouche manuelle intermédiaire ; elle ne la prouve pas.
- Complément mesuré (Écho) : l'opérateur a revisité les 68 cuts et réécrit 30 d'entre eux (34 écritures 204 ; pour 24 de ces 30, la dernière écriture diffère de plus de 1 mm de celle d'Ariane). Cela confirme que les poses étaient en place à relire ; ce n'est pas un jugement de qualité, non fait ici.

Verdict : le constat « serverConfirmed faux » dit seulement que la preuve n'a pas été enregistrée. Il ne dit pas que les poses n'ont pas été écrites. ÉTABLI pour le lot 4:2 (4.9.5.18).

## 4. Effet sur la lecture des lots de terrain

- Tout filtre `serverConfirmed === true` sur un journal de lot en 4.9.5.18 retient 1 pose sur 68 (98,5 % écartées) : il fait passer des poses écrites pour des poses non prouvées. ÉTABLI sur ce lot ; SUPPOSÉ pour les autres lots de la même version (même code), non relus ici.
- Les champs `applied-verified.serverConfirmed` et `validation-intent.serverConfirmed` ne doivent jamais servir de preuve : constants à faux.
- Le bilan `withoutServerConfirmation` (67) et l'état `FINISHED_WITH_UNCONFIRMED_ACTIONS` ne distinguent pas une écriture acceptée d'une écriture refusée ; seul `ecriture-refusee` (0 ici) le fait.
- Aucun outil d'analyse de `tools/` ne filtre aujourd'hui sur `serverConfirmed` (seul `tools/navigateur-dernier-cut.cjs`, un essai, le lit) : les mesures de pose existantes ne sont pas faussées. ÉTABLI par recherche dans le code ; le corpus du lot (nuages), non extrait, hérite des mêmes valeurs d'après `src/gcv1-export.js:178-200` (PROBABLE).
- Écho : le résumé de séance dit `serverConfirmationAvailable:false` et `serverConfirmationStatus:'not-observed'` (`src/native-session.js:964-965`, en dur) alors que 30 visites sur 77 sont `serverConfirmed`. Même défaut de lecture, côté résumé.
- Pour T27a : une passe « contrôlée par la preuve serveur » ne peut pas lire `serverConfirmed` tel quel (faux pour 67 poses sur 68) ; elle doit attendre l'écriture 2xx de la ligne, comme `ecritureAttendue`.

## 5. Correctif proposé (non écrit)

1. Ne pas toucher à la décision ni au déroulement du lot : le correctif est additif (journal et record), pour ne pas changer les parités.
2. Dans le lot, rattacher l'écriture après coup, sur le modèle de `noteServerWriteNow` : dans `ecritureObservee` (`background.js:644`), pour une écriture 2xx dont le corps porte `ExtractionStatus: valid` et `TreatedByOperator: true`, retrouver le cut par `rowIndex` (sinon par la fenêtre de `ecritureNoterValidation`, ligne 635) et :
   - compléter le record du cut (`serverWrite: {statut, heure, rapprochement}`) ;
   - poser `serverConfirmed:true` et `serverConfirmationStatus:'observed-validation-write-<statut>'`, mêmes noms que l'Écho ;
   - émettre un événement `validation-ecriture-observee` (cut, statut, délai après la validation) ;
   - recalculer `withoutServerConfirmation` à la clôture.
   `validationProof` garde sa valeur d'origine (`navigation-only`), la preuve serveur étant un second champ.
3. Fixer la sémantique : `applied-verified.serverConfirmed` devient `null` (« non encore évaluable ») au lieu de `false`, ou est retiré des lectures ; documenter dans la fiche d'architecture que le niveau de preuve se lit au niveau du cut validé.
4. Ajouter un état de lot honnête : « terminé, écritures observées » quand chaque cut complété a son 2xx, sans rien changer à `closingState` pour les lots à écriture non observée (observateur absent ou coupé).
5. Écho : calculer `serverConfirmationAvailable` et `serverConfirmationStatus` du résumé à partir des visites (`src/native-session.js:964-965`).
6. Essais : (a) lot de N cuts avec `PUT` 204 retardé de 300 ms après la navigation : N record confirmés ; (b) `PUT` 500 : le refus existant (pause) inchangé, record non confirmé ; (c) observateur coupé : comportement actuel (aucune confirmation, aucune erreur) ; (d) cut validé sur place : confirmé par les deux preuves.
7. Texte de l'architecture, ligne 54 : remplacer « faux sur 68/68 poses » par « 67/68 sur les champs de validation, 68/68 sur `applied-verified` (constant) ; écritures serveur 68/68 observées (204) et retrouvées dans la liste d'ESV ; cause : preuve jamais rattachée ».

## 6. Ce qui reste hors portée

- Les autres lots de la 4.9.5.18 et des versions voisines n'ont pas été relus (même code, mêmes constats attendus : SUPPOSÉ).
- La qualité des poses (écarts à l'opérateur) n'est pas jugée ici.
- Le corpus du lot (nuages) n'a pas été extrait.

## Méthode (reproductible)

Scripts dans `scratchpad/H/scripts/` (Python `-I`, un script Node pour les drapeaux de la liste) ; comparaison des listes avec `tools/diff-liste.cjs` du commit lu, en lecture seule, sorties dans `scratchpad/H/res/`. Les données extraites (`scratchpad/H/data/`) sont supprimées en fin de séance.
