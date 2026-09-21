# Banane V4 TEST 4.4.3 — 13 septembre 2026

## 4.7 — correctif ciblé : préservation de l'ambiguïté S1

La politique S1 pouvait **lever** une abstention d'A_STAR prononcée pour
AMBIGUÏTÉ, sur son seul test « un cluster STRONG compétitif ». Le cas
indépendant partie 23 / cut 2857 / rail droit le montre : A_STAR s'abstenait
parce que plusieurs placements du champignon étaient plausibles, et S1 publiait
u = 161,4 mm, z = 34,0 mm — **139,7 mm** de la correction humaine — alors que
V4.6 proposait u = 26,0 mm, à 0,9 mm de cette correction. Le candidat V4.6,
géométriquement STRONG, occupait une hypothèse spatialement distincte : les deux
placements étaient réellement soutenus, l'ambiguïté était réelle, et S1 la
levait sans preuve.

**Correctif.** Quand A_STAR s'abstient pour ambiguïté, que S1 publierait un
candidat, et qu'un candidat V4.6 géométriquement STRONG occupe une hypothèse
spatialement distincte, GCV1 rend `unresolved / ambiguity`. La garde ne choisit
pas : elle **préserve** l'ambiguïté. **Aucun repli automatique vers V4.6**,
aucun candidat, aucune décision VALIDATE/SKIP, aucune application — le Pilote
suit son chemin `DEFERRED_UNRESOLVED` habituel.

**Aucun seuil empirique n'est introduit.** Le motif vient de `motifOf`, la
qualification de `qualifyStrong`, la séparation spatiale de `spatialClusters` et
de `CONTRACT.alternativeSeparation` (20 mm), toutes trois préexistantes. La
science n'est pas touchée : `src/geometry.js`, `src/geometry-candidate-v1.js`,
la fonction de perte, `searchY`/`searchZ`, l'enveloppe LiDAR, le germe
secondaire, `src/engine.js`, l'adaptateur et la navigation gardent leurs
empreintes. Seule la couche de composition `src/gcv1-shadow.js` change.

**Ablation avant codage,** sur les 116 rails exploitables de tous les corpus
disponibles : la règle se déclenche **une seule fois**, sur 23/2857 droite. Elle
préserve les deux ratifications S1 utiles (23/2865 droite, 0,7 mm de V4.6, 3,2
mm de l'humain ; 9/4680 droite, 0,0 mm de V4.6, 4,1 mm de l'humain) et les cinq
autres occurrences `s1Changed`. Rejeu complet après correctif : **1 rail sur 116
change de décision**, 16 champs scientifiques comparés sur les 116 rails ne
montrent **aucune** divergence, les erreurs > 50 mm sur les 38 rails à oracle
humain passent de 7 à 6, les abstentions de 3 à 4, et **aucune erreur nouvelle**
n'apparaît. Reproduction versionnée : `tests/gcv1-s1-ambiguity.test.cjs`, sept
essais A–G, tous rouges avant correctif.

Dette conservée et documentée (KI-031) : sur un cas de ce type, GCV1 s'abstient
alors qu'une hypothèse était la bonne. Départager deux hypothèses soutenues
demanderait une observation supplémentaire, pas un arbitrage.

Procédure de collecte du Corpus V2 Natif : `CORPUS_V2_NATIF.md`. Vérification
faite, les primitives Natif existantes suffisent ; aucune collecte n'est codée.

## 4.7 — correctif ciblé : incident apply du cut 3560

Premier lot Pilote GCV1 réel sous Edge : 33 propositions, 29 appliquées et
validées, 3 différées par navigation sans décision, et **un refus d'apply** sur
la partie 9, cut 3560 — « Position proposée hors de la vue : left » — alors que
la proposition était applicable. La science n'est pas touchée : `src/engine.js`,
`src/geometry.js`, `src/geometry-candidate-v1.js`, `src/gcv1-shadow.js`,
`src/brain.js`, `src/geometry-brain.js` et `src/gcv1-export.js` gardent leurs
empreintes. Ni la politique `DEFERRED_UNRESOLVED`, ni les règles VALIDATE/SKIP
ne sont modifiées.

**Cause.** `select()` n'attendait qu'une caméra IMMOBILE, jamais le rail
DEMANDÉ revenu dans la vue. ESV recentre sa vue orthographique sur le rail
cliqué de façon asynchrone : « inchangée depuis trois lectures » se lit
exactement comme « pas encore partie », et comme « jamais partie ». La main
était donc rendue avec la caméra du rail précédent. Ce n'est pas rattrapable en
aval, parce que la vue relevée sur les 66 vues du lot fait 0,4 unité de scène
quand l'entraxe des rails en fait 1,50 — 3,75 fois plus : les deux rails ne
peuvent jamais coexister dans la vue, et le rail non sélectionné projette à
|ndc| ≈ 7,4. La capture finissant sur le rail droit et l'apply commençant par le
gauche, chaque apply exigeait cette migration ; 29 l'ont obtenue, et le seul cut
où ESV était dégradé (vue droite à 17,1 s, `partial-limit`, 80 points retenus
sur 504 270 inspectés) ne l'a pas obtenue.

**Correctif.** L'attente de sélection observe désormais le rail demandé
réellement revenu dans la vue, en plus de la stabilité. Le prédicat est la
condition dont dépend le clic — aucun seuil d'amplitude n'est introduit : le
rail sélectionné projette à ndc ≈ 0, l'autre à ≈ 7,4. Le garde d'émission de
`clickPosition()` est conservé : l'apply est un clic sur le canvas, une cible
non projetable enverrait un clic à une position d'écran arbitraire. Son refus
expose maintenant le repère, la source, la cible, le centre de vue, le NDC par
composante, les bornes retenues et la raison exacte, pour être explicable sans
rejeu. Reproduction versionnée : `tests/incident-3560.test.cjs`, cinq essais sur
les grandeurs terrain, dont trois échouent avant correctif.

Dette conservée et documentée (KI-030) : un refus sur le second rail laisse un
apply partiel à réconcilier. Hors périmètre de ce lot.

## 4.7 — correctif post red-team Astra (D1–D4)

Quatre défauts certains, reproduits par l'audit indépendant Astra sur le lot
« différer un unresolved GCV1 », et leurs reproductions versionnées. La science
GCV1 n'est pas touchée : `src/geometry.js` et `src/geometry-candidate-v1.js`
gardent leurs empreintes, et `src/gcv1-shadow.js`, `src/brain.js` et
`src/geometry-brain.js` sont identiques à la base.

**D1 — un STOP pouvait encore être suivi d'une navigation.** Le moteur
vérifiait que le lot tournait, puis laissait deux `await` — l'écriture du
marqueur d'émission possible et sa journalisation — avant d'appeler
l'adaptateur. Un STOP traité dans cette fenêtre marquait le lot `STOPPED` et la
navigation partait quand même. Côté page, `nextWithoutDecision` remettait à
faux le drapeau global `cancelled` : une requête arrivée après un `cancel`
effaçait l'annulation et cliquait.

L'autorisation est désormais portée par l'opération. `stop()` et `pause()` la
révoquent tant que rien n'a été transmis, et le dispatch la relit sans qu'aucun
`await` ne sépare le contrôle de l'appel. Dans la page, une annulation porte
l'identifiant de son opération et n'est jamais effacée par une autre requête ;
elle est relue une dernière fois juste avant le clic. Une opération déjà
invoquée ne peut pas l'être une seconde fois, ce qui ferme aussi le doublon de
message qu'Astra avait relevé comme dette.

Trois situations restent distinguées, et nommées : commande non transmise
(non-émission **prouvée**, `DEFER_NAVIGATION_NOT_DISPATCHED`), clic empêché par
une annulation connue de la page (non-émission prouvée par la page), commande en
transit ou déjà partie (émission **possible**, jamais renvoyée, jamais rejouée).

**Limite résiduelle, non refermée.** La page ne connaît pas instantanément un
STOP demandé dans le service worker. Entre le dispatch et la réception de
l'annulation, la commande peut déjà avoir agi. Aucun jeton ne rend cette
frontière atomique, et le correctif ne le prétend pas : il garantit qu'une
commande encore révocable ne part pas, et que ce qui a pu partir n'est ni nié,
ni renvoyé, ni rejoué.

**D2 — STOP et PAUSE écrasés par la clôture de borne.** Un cut différé à la
dernière borne finalisait correctement son résultat, puis la clôture normale
remplaçait `STOPPED` ou `PAUSED` par `FINISHED_WITH_UNCONFIRMED_ACTIONS`. La
borne ne clôt plus le lot que s'il tourne encore : le résultat deferred acquis
est conservé, la décision opérateur aussi, et la borne atteinte est consignée
(`boundaryReachedWhileHalted`). Une reprise explicite repasse par le contrôle
de borne en tête de boucle et clôture normalement.

**D3 — finalisation durable mais export non confirmé.** Un crash entre
l'écriture de l'état `FINALIZED` et celle de l'événement `defer-finalized`
laissait un deferred et son enregistrement durables, tandis que l'export, qui
ne lit que le journal, répondait `DEFER_NOT_CONFIRMED`. L'événement final porte
maintenant un identifiant **déterministe** dérivé de l'opération et un
horodatage figé sur la finalisation : réémis, il reste un seul événement
logique. Au redémarrage, un état finalisé sans son événement est réparé
localement, à partir de l'intention durable et de l'entrée deferred de la même
opération — aucune commande ESV, aucun second deferred, aucune provenance
reconstruite depuis une proposition ou une capture plus récente.

**D4 — deux opérations mélangées dans l'export.** `runtimeResult` prenait, pour
chaque type d'événement, le dernier du tableau. Or `store.all('events')` rend
les événements par clé — des UUID aléatoires — et non par chronologie : sur une
proposition ayant porté deux opérations, l'export pouvait annoncer
`operationId` = A avec l'evidence de B. Les faits sont désormais regroupés par
opération, une opération est choisie explicitement — finalisation durable
unique, sinon intention encore persistée, sinon opération unique — et seuls ses
événements sont agrégés. Aucun ordre de tableau, aucun ordre lexical d'UUID
n'entre dans ce choix. Quand les données ne permettent pas de trancher,
l'export publie `DEFER_AMBIGUOUS` avec le motif et les identifiants en présence,
plutôt que d'en choisir une. Les événements historiques sans `operationId` ne
rejoignent aucune opération : ils sont comptés et exposés, jamais rattachés
après coup.

## 4.7 — différer un unresolved GCV1 (lot de développement)

Lot de développement, sans bump de version produit : la 4.7.0 officielle
appartient au lot de release. Ni `src/geometry.js` ni `src/geometry-candidate-v1.js`
ne sont touchés — leurs empreintes SHA-256 sont inchangées, et A_STAR, S1, les
seuils, le pool, les clusters, la confiance, les règles d'abstention et la
sélection GCV1 non plus.

**Le problème.** En Pilote TEST, un rail que GCV1 n'a pas résolu met le lot en
pause (`PAUSED_UNRESOLVED_RAIL`) et l'opérateur doit intervenir avant que le
lot reprenne. Terrain : le cut 549 — gauche `candidate / A_STAR`, droite
`unresolved` — a arrêté le lot, pause conservée après redémarrage. Un seul cut
non résolu bloque tous les suivants.

**Ce qui change.** Le réglage « Lorsqu'un rail n'est pas résolu » offre
« Continuer et le différer » (défaut des nouveaux lots Pilote TEST) ou « Mettre
le lot en pause » (comportement historique, inchangé). En mode différé, le cut
est quitté par une **navigation sans décision** : aucune correction appliquée,
aucun VALIDATE, aucun SKIP. Si un seul rail est non résolu, le cut **entier**
est différé — le rail candidat n'est jamais appliqué d'abord. Le cut source est
enregistré une fois comme `DEFERRED_UNRESOLVED`, le lot repart sur la cible
réellement affichée, et le compteur « Différés : N » suit les seules
finalisations durables.

**Ce que ce lot ne revendique pas.** Aucun gain de résolution GCV1 : un rail
`unresolved` reste `unresolved`, et l'export le conserve séparément de l'issue
du pilote. Différer n'est ni une résolution, ni une validation humaine, ni un
nouveau label scientifique. Le gain est la continuité du traitement et
l'identification fiable des cas à revoir en GCV2.

**La commande de navigation, et l'équivalence Maj+Z — établie le 20/09/2026.**
La primitive utilise `O2N3DCutNextInvalid3DRail`, bouton ESV relevé dans les
sources V2–V2.4.2 (`audit-corpus.md`, A5) et déjà câblé depuis la V3.
L'inspection directe du JavaScript ESV chargé dans Edge, le 20 septembre 2026,
établit que ce bouton **et** le raccourci Maj+Z atteignent la même fonction
native :

```text
gestionnaire clavier : e.shiftKey && 90 == e.which ? t.buttonNextInvalidCut()
bouton               : $("#O2N3DCutNextInvalid3DRail").click(… t.buttonNextInvalidCut())
les deux             → buttonNextInvalidCut() → loadNextInvalidCut("positive")
```

Les chemins décisionnels sont séparés dans ce même code :
`buttonValidateRail()` et `buttonValidateRailAndNext()` passent par
`railPairUpdated(…, "valid", …)`, `buttonSkipRail()` par
`railPairUpdated(…, "skipped", …)`. Le chemin utilisé ici n'en touche aucun : le
contrat « navigation sans décision » est donc **observé**, plus supposé. La
preuve retournée porte `shortcutEquivalence.established: true` avec les deux
chemins et la date d'inspection.

**Ce que cette preuve ne rend pas garanti.** Elle vient de l'observation du code
chargé, pas d'une documentation du fournisseur. `buttonNextInvalidCut`,
`loadNextInvalidCut` et l'identifiant DOM restent des symboles internes non
publiés, susceptibles de changer à une mise à jour d'ESV : c'est une
intégration, pas un contrat public (KI-026). Aucun `KeyboardEvent` « Z » n'est
synthétisé pour autant — le défaut 6 d'`AUDIT_PILOTE.md` rappelle qu'un
événement dispatché ne prouve pas sa prise en compte, tandis que le bouton rend
un état vérifiable avant l'action. Aucun repli : si la commande est absente ou
désactivée, le lot retombe sur la pause historique avec ses quatre actions —
jamais sur VALIDATE, SKIP, ou une navigation vers un numéro de cut choisi.

**Protocole durable.** Il n'existe aucune transaction commune entre le stockage
Banane et l'effet ESV, et le lot ne prétend pas le contraire. Il conserve
explicitement la fenêtre où une commande a pu partir : intention persistée, puis
marqueur « émission possible » persisté **avant** l'appel, puis une action au
plus, puis observation, puis finalisation durable ; l'intention active n'est
effacée qu'ensuite. Au redémarrage : un état préparé n'a pu rien émettre et le
cut est réévalué ; un état « émission possible » sans progression acceptée donne
`PAUSED_DEFER_NAVIGATION_UNCERTAIN`, sans aucun renvoi de commande ; une
observation acceptée mais non finalisée complète ses seules écritures locales ;
un état finalisé ne rejoue rien. Un timeout ou un accusé absent ne prouvent pas
la non-émission.

**Acceptation.** Même page, même part, cut strictement supérieur, identités
source et cible utilisables, action identifiée et observation corrélée à
l'opération. Aucun delta de +1 n'est exigé et aucun cut intermédiaire n'est
inventé : 549 → 552 donne uniquement 549 différé, avec 552 comme cible
observée ; 550 et 551 n'entrent dans aucune collection. Les bornes s'appliquent
après validation de la transition : 600 différé avec 604 affiché termine
normalement le lot, sans capture ni décision sur 604. Les deux verdicts de
transition VALIDATE — `IMMEDIATE_SUCCESSOR_SAME_PAGE_AND_PART` et
`NEXT_NON_VALIDATED_CUT_SAME_PAGE_AND_PART` — sont inchangés : la navigation
sans décision a son propre contrat.

### Vérification terrain à faire dans Edge

L'équivalence Maj+Z ↔ `O2N3DCutNextInvalid3DRail` est établie par inspection du
code ESV (ci-dessus) ; ce qui reste à vérifier est le **déroulé complet du
report en session réelle**, qu'aucun test Node ne démontre. Sur un cas
unresolved confirmé — le cut 549 est le témoin historique, à revérifier tel quel
sans le modifier pour retrouver l'ancien résultat :

1. Lancer un lot Pilote TEST avec « Continuer et le différer », bornes couvrant
   le cut et au moins un cut résoluble après lui.
2. Au cut non résolu, vérifier dans le journal : `defer-intent` avec l'identité
   complète et le `proposalId` exact, puis `defer-command-possible`, puis
   `defer-navigation-accepted`, puis `defer-finalized`. Vérifier l'absence de
   `applied-verified`, `validation-intent` et `explicit-skip-intent` pour ce cut.
3. Comparer la cible enregistrée (`nextIdentity`) au cut réellement affiché par
   ESV, et vérifier que le compteur affiche « Différés : 1 ».
4. Vérifier que le lot poursuit et traite normalement le cut résoluble suivant.
5. Si la page le permet : recharger l'extension et vérifier qu'aucune commande
   n'est renvoyée et que le compteur ne bouge pas ; puis différer un cut dont la
   cible dépasse la borne et vérifier que le lot se termine sans toucher la cible.

Ce qui reste à établir par cet essai : que la chaîne complète — intention,
émission, observation, finalisation, reprise du lot — se comporte en session
ESV réelle comme au banc, et que la cible enregistrée est bien celle qu'ESV
affiche. L'identité de l'action, elle, n'est plus en question.

Il reste utile d'y vérifier au passage que le bouton est toujours présent et
actif : c'est un symbole interne ESV, qu'une mise à jour du fournisseur peut
déplacer ou renommer sans préavis (KI-026). Si cela arrivait, la primitive rend
`NAVIGATION_COMMAND_UNAVAILABLE` et le lot retombe sur la pause historique sans
rien commander — l'échec est visible, jamais silencieux.

## 4.6.0 — machine à états du pilote

Lot V4.6.0 : les défauts 4 et 9 d'`AUDIT_PILOTE.md`, les deux que l'audit avait
identifiés comme incorrigibles sans lever le gel de `src/engine.js`. Le gel est
levé pour eux seuls, sur décision explicite. Ni `src/geometry.js`, ni le
cerveau, ni les seuils ne sont touchés.

**Le contrat validation/navigation (défaut 4).** Le bouton de validation d'ESV
valide et navigue d'un seul geste : la relecture de l'état final échoue donc
systématiquement, et le lot s'arrêtait au premier cut — 12 lots sur 12 le 15/09.
`startBatch` exigeait déjà que l'opérateur déclare « la navigation observée me
suffit comme preuve » pour seulement démarrer, mais le refus sur relecture
manquée était levé **avant** la ligne qui lisait cette déclaration : politique
obligatoire, et inatteignable là où elle servait. Elle est maintenant consultée
au bon endroit.

Ce que cela ne change pas : un cut avancé de cette façon n'est jamais déclaré
validé. Son enregistrement garde `AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED`
et `usableForTraining: false`, porte `validationProof: 'navigation-only'`, et un
lot qui en contient ne peut plus finir sur `COMPLETED` — affiché « Terminé
confirmé » — mais sur `FINISHED_WITH_UNCONFIRMED_ACTIONS`.

**La navigation doit être celle qu'on attend.** Une navigation quelconque ne
vaut pas preuve : même onglet, même part, et le successeur immédiat du cut
commandé. Un saut, un retour en arrière ou un changement de part arrêtent le lot
comme avant. Sans ce contrôle, un saut ferait franchir en silence les cuts
sautés.

**`MANUAL_COMPLETION` (défaut 9).** « Reprise manuelle » était une impasse :
aucun chemin ne ramenait le lot en marche, si bien qu'un seul cut ambigu coupait
les 22 autres d'un lot de 23. L'opérateur corrige le cut dans ESV, ouvre le
suivant, puis déclare « Repris manuellement » : le lot repart. Banane n'a envoyé
aucune commande sur ce cut et ne prétend pas l'avoir validé —
`bananeValidated: false`, `commandSent: false`, `serverConfirmed: false`,
`usableForTraining: false`, provenance `operator-in-esv`. Le cut n'entre pas
dans `processed`, réservé aux validations conduites par Banane ; il est compté à
part et affiché « repris à la main ». Le lot ne peut jamais le redémarrer. Le
message du moteur ne renvoie plus vers « Mes corrections », retiré en 4.5.4.

**Conséquence du défaut 4, constatée :** un lot d'un seul cut se termine, au
lieu de rester bloqué (défaut 10, qui n'a pas demandé de correctif propre).

**Empreintes.** `audit/v4.4.0-frozen-engine-hashes.json` n'est pas modifié.
`src/geometry.js`, `vendor/capture-core.js` et `vendor/lidar.js` y restent
vérifiés octet pour octet. Le moteur est ré-épinglé sur
`audit/v4.6.0-engine-baseline.json`, contrôlé de la même façon : une dérive non
déclarée du moteur fait échouer le banc. Un test vérifie que cette baseline
recopie les empreintes historiques à l'identique, pour qu'elle ne puisse pas
servir à assouplir le gel par la bande.

**Version.** La version produit passe à **4.6.0** partout où elle est une
version runtime ou d'export : `src/core.js`, `manifest.json`, `panel.html`,
`src/bridge.js`, le repli du service worker. Les enregistrements V4.6 ne sont
plus estampillés 4.5.7.

### Corrections demandées par la revue Astra

**Récupération MV3 — un `validation-observation` ne vaut plus acceptation.** Cet
événement est journalisé *avant* les contrôles d'acceptation. `Engine.init()`
s'en servait pour recréditer `processed` après un redémarrage du service
worker : une navigation inattendue, que le moteur venait de refuser, pouvait
donc être comptée comme un cut traité. Le lot dispose maintenant d'un marqueur
durable distinct, `validation-accepted`, émis une fois **tous** les contrôles
passés — c'est le seul sur lequel `init()` crédite.

Et quand la commande est partie sans être acceptée, il n'y a pas deux issues
mais une seule : ni crédit, ni renvoi. La commande native est irréversible ; le
lot se pose en `PAUSED_AFTER_STATE_MISSING` avec le code
`VALIDATION_NOT_ACCEPTED_BEFORE_RESTART` et attend un contrôle dans ESV.

Au passage : `batch.interrupted`, la liste des interruptions, était écrasée par
un booléen à chaque redémarrage — le journal était perdu et `closureSummary`
lisait 0. Le drapeau a désormais son propre champ, `interruptedByRestart`.

**`MANUAL_TAKEOVER` est un lot actif.** Le cut est rendu à l'opérateur, mais le
lot garde son contexte et reprendra : rien ne doit le remplacer. Ni un nouveau
lot, ni le mode Natif, ni une analyse assistée — refus porté par le moteur et le
service worker, pas par l'interface, puisqu'un appel direct au service worker la
contourne. « Arrêter » redevient disponible pendant la reprise manuelle : c'est,
avec « Repris manuellement », la seule sortie de cet état.

**Banc exploitable depuis un clone propre.** Les deux tests qui exigent le
corpus Natif privé s'ignorent eux-mêmes lorsqu'il est absent, au lieu de faire
échouer le banc avant les contrôles d'empreintes. Un test ignoré n'est pas un
test réussi : `audit/verification.json` porte `benchMode`, `allTestsExecuted`,
`skippedForMissingCorpus` et `nativeCorpus`. `--full` (ou `BANANE_BANC=full`)
exige le corpus et refuse le moindre test ignoré. Le contrôle de l'archive
installable a été séparé de celui de l'archive source, de sorte qu'il s'exécute
aussi sans le corpus.

**Identité de tentative de validation.** Le correctif de récupération ci-dessus
appariait encore les événements par identité de cut. Or `s.events` survit d'un
lot à l'autre : une acceptation ancienne du **même** `pageId/part/cut`, venue
d'un lot antérieur, pouvait donc être prise pour celle de la tentative courante
et créditer un lot qui n'avait rien validé.

Chaque validation porte désormais un `validationAttemptId`, créé **avant** la
requête irréversible et persisté avec `applied` et l'intent, accompagné du
`batchId` et du `proposalId` auxquels il appartient. Les trois événements —
`validation-intent`, `validation-observation`, `validation-accepted` — le
transportent, et `init()` ne recrédite que sur une correspondance exacte des
trois. Une acceptation qui ne correspond pas à la tentative courante est
ignorée, quel que soit son cut.

**Migration depuis V4.5.7.** Un état écrit par une version antérieure ne porte
aucun identifiant de tentative. Le journal ne peut pas en tenir lieu : ses
événements survivent aux lots, si bien qu'un `validation-intent` V4.5.7 traînant
sur le même cut bloquait à tort un lot V4.6 neuf qui n'avait rien envoyé.

Seul un marqueur appartenant à l'**état courant** fait foi : `validationStarted`,
que `apply()` remet à faux avant chaque application. Il n'est vrai, dans cette
branche, que si la commande est partie **et** revenue — si elle était encore en
vol, `s.intent` serait posé et la réconciliation aurait déjà pris la main. Il
vaut seul, sans confirmation du journal, celui-ci étant plafonné à 150
événements dont l'intent peut avoir été chassé. Aucun événement antérieur au lot
courant ne peut donc bloquer ce lot.

**Formulation `MANUAL_COMPLETION`.** `operatorNavigationObserved: true` est
retiré : Banane n'observait pas l'opérateur naviguer et ne peut rien dire d'une
navigation. Ce qui est consigné correspond à ce qui est fait — une lecture de
l'identité affichée à la déclaration : `identityReadAtDeclaration`,
`identityDifferedFromTakenCut`, `identityIsExpectedSuccessor`,
`transitionAtDeclaration`, et `navigationObservedByBanane: false`.

**Banc.** 385 tests. Sur un clone sans `datasets/native/` : 383 verts, 0 rouge,
2 ignorés, et le banc va jusqu'au bout. Les tests couvrent : mono-cut,
multi-cut, navigation absente, navigation attendue sans état final, navigation
inattendue (saut, retour arrière, autre part, autre onglet), reprise manuelle,
redémarrage après acceptation, redémarrage après refus, conservation du journal
d'interruptions, lot actif en reprise manuelle (moteur et service worker),
détection du corpus, et les cinq cas d'identité de tentative — acceptation d'un
lot antérieur sur le même cut, intent d'un lot antérieur, crédit exactement une
fois malgré plusieurs redémarrages, refus courant non rattrapé par une
acceptation ancienne, intent V4.5.7 périmé n'entravant pas un lot neuf, et
les deux états d'interruption réellement persistés par 4.5.7. Chacun a été vérifié non
complaisant — ils échouent quand on retire le correctif qu'ils verrouillent.

## 4.5.0 — 15 septembre 2026

Première version officielle de la série V4.5. Le moteur de placement reste gelé
octet pour octet ; `tools/verify.cjs` continue de le contrôler.

**Collecte.** La dégradation du collecteur redevient réversible : auparavant un
seul échec d'envoi faisait basculer définitivement en `METADATA_ONLY`, où toute
capture LiDAR est refusée, et le reste de la session perdait sa géométrie. Les
refus légitimes de la session (cut changé, identifiant déjà utilisé, visite
inconnue) ne sont plus comptés comme des pannes de transport. La file d'envoi ne
se fige plus sur un élément fautif : réessais bornés, puis mise à l'écart avec
la cause. Profondeur de file portée de 128 à 512.

**Lecteur.** L'évaluation de couverture était quadratique précisément dans les
cas qui ne se qualifient jamais, mangeant le budget de lecture. Accumulateur
incrémental : 197 ms à 30 ms sur 32 000 points. Deux tampons conservant chaque
point retenu ont été supprimés.

**Export.** Le mur des 64 Mo est levé : plus aucune concaténation en une chaîne
unique, format compact sans perte (61 à 67 % de gain mesuré, équivalence moteur
démontrée au bit près), segmentation budgétée sur le poids réel du fichier, et
vidage automatique pendant la collecte pour que rien ne soit perdu si la session
s'interrompt. `tools/merge-segments.cjs` refusionne les segments.

**Interface.** Bloc « Santé de la collecte » en direct dans la fenêtre Natif, et
réglages de collecte consultables depuis l'interface.

**Réglages.** Tous les paramètres de collecte et d'export sont réunis dans
`src/settings.js`, avec leur unité, leur raison d'être et la mesure de terrain
qui les a fixés. Les seuils géométriques restent dans le moteur gelé.

- Régression confirmée par Mic : le bouton flottant de V4.4.2 ne disparaît pas dans ESV malgré l'ouverture de Banane ; succès simulé non assimilé à une validation terrain.
- Fenêtres enregistrées explicitement et pages connectées par un canal de présence vivant, renouvelé après reprise du service worker ; plus de déduction depuis la recherche d'onglets d'extension par URL.
- Bouton retiré du DOM pendant l'ouverture de Banane et remis après fermeture de la dernière fenêtre ; réponses de statut tardives ignorées. Libellé de version 4.4.3 visible pour faciliter le contrôle d'installation.
- Nouveaux tests couvrant le filtre URL vide, deux fenêtres, les réponses en retard et la reconnexion ; moteur de placement, pilote et collecte Natif géométrique inchangés.

# Banane V4 TEST 4.4.2 — 13 septembre 2026

- Audit reproductible de l'export réel V4.4.1 : 76 visites, 539 309 points dont 297 185 dans le clipping, 0 rail comparable prouvé ; les anciens exports ne sont pas promus.
- Checkpoint LiDAR par rail sauvegardé avant événement acquitté, avec acquisitions datées, pose/source/clipping vérifiés et révocation explicite en cas de contradiction.
- Le lecteur distingue chargement de nœuds Potree et changement de caméra ; le banc hors ligne ne transmet au moteur que les points effectivement visibles, sans référence finale en entrée.
- Bouton flottant Banane masqué lorsqu'une fenêtre Banane est ouverte, restauré après fermeture de toutes les fenêtres ; comportement testé aussi avec deux panneaux.
- Archive source avec tests reproductibles en plus du ZIP installable ; algorithme de placement et pilote figés. Résultat réel ESV V4.4.2 encore inconnu.

# Banane V4 TEST 4.4.1 — 13 septembre 2026

- Perte LiDAR reproduite sur trois exports V4.4 : 685 558 points lus, seulement 4 conservés ; les nœuds éloignés épuisaient le temps avant ceux des zones utiles.
- Nouveau lecteur Natif passif qui priorise les nœuds proches des rails sans changer de vue, borné et découpé en sauvegardes progressives ; causes d'absence de points explicites.
- Observations gauche/droite autonomes (repère, matrices, pose, instant et cut) ; interruption et changement de cible consignés sans fusionner les géométries.
- Qualification par rail et par paire sur couverture, densité, transformation et association à la référence ; labels candidats, jamais automatiquement entraînables.
- Chronologie `event_seq`, intentions multiples conservées, revisites et pauses distinctes, clôture récupérée sans inventer un état final.
- Banc hors ligne et superpositions SVG prêts pour un nouvel export ESV ; sur les trois anciens exports, zéro exemple qualifié et aucune amélioration de précision démontrable.
- 170 tests réussis ; moteur, pilote et lecteur LiDAR partagé inchangés. La fluidité ESV réelle et les preuves visuelles restent à vérifier avec Mic.

# Banane V4 TEST 4.4.0 — 11 septembre 2026

- Nouveau **Mode Natif** dans une fenêtre dédiée : Démarrer, Pause/Reprendre, Terminer et exporter.
- Observation clavier/souris passive dès `document_start`, sans blocage, retard volontaire ni réémission vers ESV.
- Aucune commande de caméra, sélection de rail, déplacement, validation, SKIP ou navigation accessible au collecteur Natif.
- Une visite distincte à chaque affichage, y compris les retours sur le même cut ; périodes séparées après Pause/Reprendre.
- Export `banane-native-session-v1` séparant état initial/final observé, intention, effet, commande Banane absente et confirmation serveur non observée.
- Provenance `native-passive-observation` séparée ; aucune visite n'est versée automatiquement à l'entraînement.
- Lecture limitée aux points déjà chargés dans la vue courante, découpée et bornée ; aucun LOD ni changement de vue demandé.
- File de collecte bornée avec niveaux `FULL`, `DEGRADED` et `METADATA_ONLY`, pertes comptées et panne durable visible une seule fois.
- Sauvegarde progressive des événements, visites et LiDAR ; reprise après interruption sans continuité inventée.
- Exclusion de collecte concurrente avec Mes corrections, l'assisté ou le pilote.
- Mesure de fluidité hors ESV ajoutée dans `audit/native-fluidity-v4.4.0.json`.
- 158 tests réussis. Géométrie, lecteur de géométrie et pilote inchangés par empreinte SHA-256.

# Banane V4 TEST 4.3.0 — 10 septembre 2026

- Séparation stricte des preuves `commandSent`, `afterObserved`, `serverConfirmed` et `navigationObserved`.
- Blocage explicite `AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED` lorsqu'une navigation précède la relecture après commande.
- Pause `PAUSED_UNRESOLVED_RAIL` sur rail non résolu, sans validation partielle ni avancement ; actions explicites de réessai, reprise manuelle, SKIP ou arrêt.
- SKIP automatique silencieux désactivé ; toute incertitude de rail/données privilégie Pause.
- Bouton Pause restauré dans Mes corrections, avec reprise sur le même cut sans décision native.
- Quatre labels humains explicites, dont `VALIDATE_NO_MOVEMENT` comme label positif.
- Identité étendue et événements de changement de cut ; préparation de `previousCutId`, `nextCutId`, `sequenceIndex` et geominfo, sans intégrer le voisinage au moteur.
- États de clôture non confirmés et listes exactes des cuts concernés.
- Banc hors ligne reproductible sur 110 corrections humaines, certificat d'ingestion des quatre exports et rapport de métriques par version et label.
- Géométrie et seuils de proposition inchangés.

# Banane V4 TEST 4.2.1 — 10 septembre 2026

- Seuil inférieur métier définitivement fixé à 1 410 mm.
- Moins de 1 410 mm : SKIP ; de 1 410 à moins de 1 430 mm : validation avec tolérance.
- Ancienne hypothèse de seuil inférieur supprimée du cadrage, de la structure vérifiable et des tests.
- Retour d'essai de Mic sur les interruptions fréquentes du pilote 4.1 enregistré comme problème connu.
- Aucun calcul géométrique, aucun assouplissement de garde-fou et aucun correctif du pilote automatique dans cette version.

# Banane V4 TEST 4.2.0 — 10 septembre 2026

- `Shift + Backspace` reconnu dans Mes corrections comme décision opérateur `SKIP`, distincte de `VALIDATE`.
- État avant, LiDAR disponible et état final des deux rails conservés avant l'envoi de la commande.
- SKIP exporté avec `usableForTraining: false` et sans motif d'écartement inventé.
- Relais unique du raccourci au gestionnaire clavier ESV ; aucune substitution par « prochain cut invalide ».
- Navigation observée avant préparation automatique du cut suivant ; absence de navigation signalée sans réémission.
- Scénario validation → SKIP → validation, trois captures, répétitions clavier et reprise après erreur couverts par les tests.
- Aucun nouveau bouton, aucun SKIP automatique et aucun changement fonctionnel du pilote automatique.
- Règle d'écartement ajoutée au cadrage ; ancien chevauchement de seuil consigné comme contradiction bloquant son automatisation.

# Banane V4 TEST 4.1.0 — 10 septembre 2026

- Placement du champignon fondé sur le recalage du gabarit U50 complet, avec plans de roulement et flanc interne obligatoires comme preuves de support.
- Détection de minima concurrents distants ; une ambiguïté géométrique ne reçoit plus une confiance artificiellement élevée.
- Refus d'un déplacement latéral supérieur à 60 mm lorsqu'il n'est pas soutenu par le second rail.
- Analyse reproductible des 47 corrections : erreur moyenne 7,59 → 4,12 mm sur les rails acceptés ; maximum 78,04 → 11,43 mm ; trois erreurs supérieures à 70 mm refusées.
- Couverture publiée avec la précision : 76 rails sur 94 et 29 cuts complets sur 47 restent proposables.
- Structure pure de lecture et classification d'écartement ajoutée, sans sélecteur ESV ni action SKIP supposés.
- Documents de gouvernance, datasets séparés, archive originale et répertoire de releases instaurés.

# Banane V4 TEST 4.0.0 — 9 septembre 2026

- Accueil sombre ; fenêtres séparées Pilotage automatique et Mes corrections ; essai assisté optionnel.
- Session de corrections avec Démarrer puis Terminer et télécharger. Plus de boutons avant/après par cut dans cette fenêtre.
- Préparation des deux vues LiDAR et retour au rail gauche ; état visible dans ESV.
- Interception active uniquement en session, installée au chargement de la page. Sauvegarde de l’après avant transmission unique de la validation native demandée par l’opérateur.
- Reconnaissance de Shift + Espace, du bouton natif et d’Entrée, annoncée dans le titre du bouton ESV exporté.
- Accusé de sauvegarde explicite, contrôle de cible, doublons empêchés, arrêt et reprise testés.
- Dernier cut modifié conservé à la fin ; cut préparé mais inutilisé écarté ; changements de part admis dans la même page.
- Export de session contenant références, LiDAR et événements. Provenance manuelle distincte des résultats automatiques.
- Relance des lectures LiDAR instables sans déplacement de rail ; trois tentatives par vue et budget global. Reprise du lot sans annulation manuelle de capture.
- Si le LiDAR reste indisponible pendant une session manuelle, conservation de la correction avec marqueur incomplet, puis poursuite du workflow opérateur.
- Refus de propositions sans deux surfaces suffisamment observées ou avec pente forcée. Calcul des autres positions conservé.
- Activités automatique, assistée et correction manuelle incompatibles empêchées de s’exécuter simultanément.
- Stockage V3 et sources originales conservés. Aucun entraînement automatique et aucune preuve serveur ajoutés.

# Correctif V3 TEST 3.0.1 — 9 septembre 2026

Incident de référence : part 24 / cut 7460, journal réel fourni par Mic.

- Refus d’un lancement exigeant une preuve serveur indisponible **avant toute écriture**.
- Conservation de la cause d’arrêt dans le lot ; une erreur d’actualisation apparaît
  séparément et ne remplace plus cette cause.
- Actualisation du panneau sans attente bloquante et sans accumulation de requêtes.
- Archivage d’une ancienne validation incertaine au lancement d’un autre cut ;
  conservation des références et absence de second envoi sur le cut en attente.
- Clôture répétée sans erreur trompeuse ; conservation d’une capture manuelle distincte.
- Navigation reconnue par le libellé du cut sans exiger les objets du prochain rail
  en fin de lot. Un lot plus long attend leur disponibilité ou se met en pause.
- Accusés de réception et étapes de commande dans le journal ; une expiration de
  lecture seule n’envoie plus de demande d’annulation à l’adaptateur.
- Vérification de la version de l’adaptateur à la connexion ; indication de reconnexion.
- Schéma de stockage inchangé. Algorithme géométrique et corpus initial inchangés.

Le journal réel sert de fixture de reprise. Aucun chargement Edge de ce correctif
ni nouvelle exécution ESV n’ont été réalisés ici.

# Changements V3 TEST 3.0.0 — 9 septembre 2026

Base : sources V2.4.2 disponibles. Le correctif historique de capture était déjà
présent ; les originaux sont préservés et ses 32 tests sont repris sans changement.

- Réutilisation exacte de `capture-core.js` et `lidar.js` dans `vendor/`.
- Fenêtre dédiée réouvrable par l’icône Edge et par un bouton dans ESV.
- Machines distinctes de collecte et de lot, persistance de l’état et des nuages.
- Identité fondée sur page, part, cut, U50 et repère ; correspondance gauche/droite
  indépendante de l’ordre des objets et de leurs translations.
- Lecture depuis deux vues puis fusion des points identiques, avec provenance.
- Première méthode géométrique sans ML : recalage au contour et estimation
  robuste de l’intersection des surfaces du champignon ; score explicite.
- Modes Observation, Assisté et Automatique TEST dans le même moteur.
- Application par commandes ESV issues des anciennes sources et clic canvas
  projeté, contrôlée par relecture ; restauration avant tentative de validation.
- Lot sans acceptation individuelle, périmètre explicite, choix pause/ignorance/
  tentative à faible confiance, pause et arrêt, prévention des doublons.
- Archivage avant commande de validation ; distinction explicite entre navigation
  observée et enregistrement serveur, qui reste non confirmé.
- Reprise interrompue avec réconciliation et clôture d’un résultat incertain.
- Exports des références, du journal et de tous les nuages acquis.
- Audit du corpus et évaluation reproductible sur des cuts séparés de ceux du réglage.

Les tests ont notamment conduit à verrouiller les doubles lancements de lot,
préserver l’étape après une application vérifiée, remettre les métadonnées des
captures V3 en cohérence avec leurs références et accepter les messages émis par
la fenêtre d’extension même lorsqu’elle possède un identifiant d’onglet.

Les essais dans Edge/ESV restent non exécutés. Aucun statut « production » ni
confirmation serveur n’est ajouté. Le paquet n’altère pas les sources V2.4.2.
# Banane V4.5 lot 1 — expérimentation hors ligne (14 septembre 2026)

- Source V4.4.3 copiée dans un chantier dédié ; extension installable, moteur, pilote et collecte inchangés.
- Banc de placement `tools/placement-lab.cjs` : admission de snapshots LiDAR persistés avant premier changement de rail observé, entrée sans finale humaine, contrat d'adaptateur pour variantes futures, résultats et superpositions par rail.
- Le témoin V4.4.3 retrouve 22 visites / 377 477 points ; cinq comparaisons strictes au lieu des sept historiques (captures droites des cuts 314 et 333 postérieures au premier changement observé).
- Sept tests du banc ajoutés : 195/195 tests locaux ; aucun entraînement ni essai ESV réel dans ce lot. Rapport et limites dans `audit/V45_LOT1_RAPPORT.md`.
# Banane V4.5 lot 1 — correctif de borne temporelle

- Attribution des transitions de rail gauche/droit depuis les états natifs exportés et leur `eventSeq`, y compris déplacement associé à changement de vue ; caméra seule exclue de la borne ; incertitude de côté ou repère exclue prudemment avec motif.
- Référence finale candidate vérifiée contre l'état avant `VALIDATE`, le même événement et une fraîcheur recalculée de 0 à 1 500 ms ; aucune finale n'entre dans l'entrée du moteur.
- Même témoin V4.4.3 : 314, 332 et 333 droits nouvellement admis ; 332 sans finale comparable ; 7 comparaisons candidates au total. 201/201 tests, moteur et collecte inchangés. Rapport : `audit/V45_LOT1_BORNE_TEMPORELLE.md`.
