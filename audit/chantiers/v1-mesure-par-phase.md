# V1 — chronomètres par phase, reprise du 3 octobre 2026

Développement reconstitué depuis la base exacte 4.8.6. Les sept phases et les sous-fenêtres V4.6 sont instrumentées hors fichiers protégés ; les décisions et poses restent celles de la base. Livraison locale pour relecture, **aucune acceptation V1 ni mesure terrain**. Aucun essai ESV, navigateur ou ordinateur opérateur, aucun chantier suivant, aucune publication.

Branche réelle : `sol/49-v1-mesure-par-phase`. Base Git : `042aee649bc25b89c46a26def481f87f46d047ac` (étiquette v4.8.6 vérifiée). Commit final : le commit portant ce rapport ; son SHA complet sera dans `META.json` du ZIP, sans référence circulaire dans le rapport. Session : `c7981facc17e`. Cahier et consignes distincts : objet Git `18a355eb02a00b20b2adaeb1d84648854664972e`. Mission/avenants reçus le 3 octobre priment sur les instantanés historiques (`00_REPRISE.md:5-24`, mission V1:130-213).

## Reprise et preuve de départ

Le patch perdu, ses anciens 25 tests, la copie p11 altérée et ses preuves binaires sont introuvables. Le premier rapport original est identifié, mais sa récupération du 3 octobre échoue une fois avec HTTP 502 ; aucun téléchargement en boucle ni checkpoint remplacé. Le document joint `v1-reprise-2026-10-03/PREMIER-RAPPORT-RECONSTITUE-ET-INVENTAIRE.md:3-18` est une **reconstitution**, pas l'original. La reconstruction est explicitement autorisée (`00_REPRISE.md:13-16`). Aucun résultat historique non accessible réutilisé.

La base jointe contient 567 fichiers identiques octet pour octet aux objets Git retrouvés (`preuves/base-integrity.json`). Les 39 archives privées sont vérifiées par Git blob et SHA-256, puis extraites dans un nouveau dossier propre ; 133 entrées logiques contrôlées par SHA-256 avant le candidat, zéro différence (`preuves/inputs-source-manifest.json`, `preuves/inputs-before-candidate.json:2-4`). `banane-data` n'est pas modifié : clone sans checkout et lecture des objets au commit `32b11b7e845c5af8a2b5a6b6eec79b00ff1bfb10`. Sources originales et segments Écho préservés hors dépôt/livraison ; seule la recette locale de préparation relocalise les chemins et retire la purge Écho (`preuves/provenance.json:5-16`).

Nouvelle p11 : membre seg02 de 78 726 692 octets, JSON valide, copie et extraction indépendante identiques, SHA-256 `2df669a41140c9513cf499761355a87033379bb4bf760249c1bdc1db5e9cab8b` ; archive source `21cf6696cb9467cededc9f7cee1955d2b7fb27685c7217b02235fd38dff346eb` (`preuves/p11-integrity.json:2-10`). Aucun faux original altéré recréé.

Avant tout code V1, contrôle **complet J1** sur 4.8.6 non modifiée, dossier neuf `j1-reference-fresh`, sans `--reprendre` :

```text
node tools/portes-j1.cjs --entrees ENTREES-486.env
Code 042aee6, modifie=false, empreinte=9f9b43430dda69f8.
VERT 633 cuts : 0 décision changée ; parités 313/346,85/85,95/95,106/106.
VERT 8 jeux : seulement 707/711 refusés et 718 posé face à la référence historique 4.8.0 ; 0 juste perdu.
Exit code 0 ; 535,03080156 s.
```

Commandes/horodatages/sorties exactes : `preuves/j1-reference.json:2-13`, `preuves/j1-reference.stdout:1-4`, `preuves/j1-reference.stderr:1-12`. Le relevé contient 633 lignes de validation, huit jeux, 13 sessions et 1 398 lignes de jeux (`preuves/reference-counts.json:7-54`). p11 contient 96 lignes ; sa parité porte sur 95, ce ne sont pas des comptes contradictoires. Référence historique 4.8.0 conservée sans remplacement (`tools/portes-j1.cjs:28-61`).

`node tools/verify.cjs` sur cette même base : 1 024 tests, 1 022 réussis, 0 échec, 2 sautés, mode **partial**, exit 0, 38,07234 s (`preuves/verification-reference.json:2-16`, `preuves/verify-reference.json`). Les trois exports natifs listés dans `preuves/provenance.json:14-18` sont absents ; tests natifs et package concernés sautés, **non réussis**. Aucun verify complet annoncé. La mesure RSS de ce premier runner est un maximum des enfants cumulés ; le chiffre du verify de référence ne mesure pas son RSS individuel. Les exécutions suivantes utilisent wait4 par enfant (`reproduction/run-check-reference.py`, `reproduction/run-check.py`).

## Cause et cartographie établies avant code

L'ancien D5 ne décompose que les chaînes complètes validées et les joint par numéro de coupe (`tools/perf-lot.cjs:125-164`, base). Cela omet revisites, différés et extrémités, mélange potentiellement les portées et ne certifie pas 100 %. Une capture après pose est ici une lecture `state`, pas du LiDAR (`src/engine.js:151-161`). La réponse combinée peut constater la cible suivante avant l'acceptation durable : les deux étapes chevauchent.

Cartographie préliminaire sauvegardée **avant** reconstruction : `v1-reprise-2026-10-03/CARTOGRAPHIE-AVANT-CODE.md:5-23` (bornes stable `src/engine.js:118-172,248-257,750-811`, `background.js:66-78,549-603`, science `src/gcv1-shadow.js:406,486,570`, arrêts `src/engine.js:935-989`). Le réducteur vide events (`tools/reducteur-exports-core.js:63-64`) : un export réduit n'est pas une entrée de mesure. Aucun V2 lancé.

Essai pertinent rouge exécuté sur la base, avant le code : `node --test red-before-code.cjs` ; sortie intégrale jointe `v1-reprise-2026-10-03/ESSAI-ROUGE-AVANT-CODE.txt` et `preuves/red-before-code.tap` :

```text
V1 doit signaler explicitement la couverture non mesurable du journal historique
tests 1 ; pass 0 ; fail 1 ; skipped 0
AssertionError : ancien D5 ne fournit pas un relevé V1 de couverture et de lacunes
actual undefined ; expected false
```

L'essai équivalent est vert dans `tests/perf-phases.test.cjs:62-65`. Le test adverse des spans inversés a également échoué (0 au lieu de non mesuré, 11 pass/1 fail, `preuves/invalid-span-red.tap`) puis l'analyseur a été corrigé pour publier invalidCalls/invalid et null (`tools/perf-phases.cjs:9,38-46,95`, test:66-70). Un test supplémentaire a montré que gauge-contract-violation puis ERROR était classé protection (11 réussis/1 échec, `preuves/guard-attribution-red.tap:97-104`). La cause explicite de garde est désormais conservée jusqu’au batch-state, sans toucher au moteur (`src/perf-phase.js:125,133-135`, test recorder:81-86). Le premier J1 vert est conservé, puis J1 a été relancé entièrement en nouveau dossier après cette correction. Deux échecs intermédiaires de tests provenaient de leurs assertions : dernier événement après prise manuelle supposé control alors qu'un point suit ; compte de visites oubliant l'ouverture de fixture avant install. Sorties conservées, assertions corrigées, aucun essai sauté pour passer au vert (`preuves/targeted-current.tap`, `preuves/targeted-stop-resume-first.tap`).

## Mise en œuvre hors gel

| Fichier du candidat | Changement / source |
|---|---|
| `src/perf-phase.js` nouveau | Recorder SW monotone, événements bornés, visites/commandes, contrôles et enveloppes de dépendances publiques (:9-105,108-185) |
| `background.js` | Import après bootstrap (:13), réception capture/state et trace de commande (:73-80), sélecteur (:560), installation et observe/command (:609-613), flush export (:921), progrès corrélés (:969) |
| `src/bridge.js` | traceId borné dans diagnostic, jamais dans la commande postée à ESV (:19,74-88) ; arguments/actions inchangés |
| `tools/perf-phases.cjs` nouveau | Sept phases, corrélation, lacunes/NA/chevauchements, santé, silences/arrêts, V4.6 et médianes (:14-98) |
| `tools/perf-lot.cjs` | Ancienne API/calcul D5 conservés ; annexe `.v1` et Markdown distincts (:39,65,155) |
| Six fichiers `tests/perf-*.test.cjs`, deux helpers | 30 essais ciblés significatifs ; imports et chemins scientifiques réels sous VM, MemoryStore/SimulatedESV uniquement |
| Rapport et annexes, `audit/verification.json/.txt` | Documents et preuves finales versionnés selon cahier §2.3 ; aucune donnée brute privée |

Aucun changement de `src/engine.js`, `src/geometry.js`, `src/geometry-brain.js`, `src/gcv1-shadow.js`, `src/lot-decision.js`, paramètres/seuils, baselines, cerveau ni panneau. Les wrappers de méthodes accessibles renvoient l'objet/Promise original et réémettent l'exception originale ; ils n'appellent pas une seconde fois le calcul, ne réessaient aucune action et n'attendent pas le stockage des mesures. L'enveloppe de façade retourne le résultat exact produit par la dépendance originale, avec son receiver original (`src/perf-phase.js:14-25,155-162,177-185` ; essais recorder:7-22).

Chaque événement phase-timing/schema1 contient session, lot, clockId propre au démarrage SW, seq/batchSeq, visite et identité (page/partie/coupe/profil/repère/projet). Projet absent reste null ; la couverture complète est refusée. Trace/capture/analyse/entrée/proposition corrélées lorsque disponibles. Les réponses/progrès tardifs conservent leur visite émettrice, jamais la coupe actuellement affichée. Horloge page seulement diagnostique, aucune soustraction entre contextes (`src/perf-phase.js:28-41,82-105`). Les fenêtres initiales/seeded réellement prouvées sont distinguées ; autres appels publics non attribués (`:176-185`).

Événement au plus 4 096 octets UTF-8 ; au plus 512 écritures, 128 requêtes et 32 lots en mémoire de mesure. Dépassement/erreur : perte publiée ; aucune modification de l'action ESV. Les compteurs seuls ne prouvent pas zéro perte : santé finale, séquences, visites attendues et journaux complets doivent concorder (`src/perf-phase.js:37-63,141-143`, `tools/perf-phases.cjs:63-74`). La limite Chrome de 64 Mio reste celle du bridge ; V1 n'assure pas qu'un export complet de lot long tient dans un message.

## Méthode des sept phases

Voir fiche analyste `v1-reprise-2026-10-03/FICHE-CALCUL-V1.md` et analyseur `tools/perf-phases.cjs:14-46`. Mesures : cible observée→capture reçue ; capture→proposition durable ; proposition→décision durable ; décision→pose relue ; entrée finish→retour de sa lecture state ; après relu→acceptation locale durable ; acceptation→cible suivante observée. Aucune intention seule interprétée comme validation serveur.

Les phases attendues absentes restent manquantes, jamais zéro. Première coupe déjà visible/recapture : navigation NA. Différé sans pose ou prise manuelle sans pose automatique : suites NA. Dernière coupe posée laissée non validée : suites NA. Validation en place : suivant NA. Navigation combinée avant acceptation : chevauchement positif, durée phase non mesurée. Ces NA ne comblent pas une lacune antérieure. Pause/reprise et nouvelle capture gardent toutes les visites ; un arrêt répété reste une intervention sans nouveau comptage. STOPPED repris et horloge redémarrée restent visibles ; plusieurs bornes de fin ou horloges ne donnent pas un total artificiel (`src/perf-phase.js:123-144,168-175`).

Les cycles complets navigation→suivant >60 000 ms sont exclus entièrement, nombre et somme publiés ; silences strictement >60 s entre jalons utiles (santé export tardive exclue). Total du lot : début/fin uniques sur une même horloge, attentes/pauses comprises. Arrêts/100 = 100×arrêts/coupes distinctes sous identité complète ; opérateur, protection, adaptateur, ESV muet, garde, définitif séparés, manuel/reprise visibles. Quantiles : `floor(p*(n-1)+0.5)`. Même cohorte de sept phases mesurées : somme des médianes, médiane des sommes, cycle médian et résidu publiés séparément ; cohorte vide non mesurée (`tools/perf-phases.cjs:10-11,61-98`).

V4.6 paire complète (cerveau compris) et mono-rails utiles sont comptés distinctement. Union des spans imbriqués dans/hors fenêtre analyse, sans ajout au cycle ; absence ou span invalide = non mesuré. Façade/observe/command sont des fenêtres incluant IO ; IO interne et stockage asynchrone réel non isolés. Réponse détaillée aux demandes et réserves V4 : `v1-reprise-2026-10-03/REPONSE-DEMANDES-V4.md:5-20`.

## Essais, transparence et coût local

```text
node --test --test-concurrency=1 --test-reporter=tap tests/perf-phases.test.cjs tests/perf-phase-recorder.test.cjs tests/perf-production.test.cjs tests/perf-resume-production.test.cjs tests/perf-science-production.test.cjs tests/perf-bridge.test.cjs
Premier passage groupé : 29 tests ; 29 pass ; 0 fail ; 0 skipped.
Contrôle final : python3 reproduction/run-targeted-7s.py
Six commandes node --test --test-reporter=tap --test-timeout=7000 tests/perf-*.test.cjs
30 tests au total ; 30 pass ; 0 fail ; 0 skipped ; six fichiers sous 7 secondes.
```

Sortie du premier groupe `preuves/targeted-final.tap` ; sorties finales par fichier `preuves/perf-*-7s.tap` et comptes/durées/commandes `preuves/targeted-7s-files.json`. Chronologie connue, sept phases/résidu, marqueurs absents, duplications/conflits, mauvais contexte, autre lot/Écho, horloge reprise, export tronqué, séquences/santé/pertes, différé, extrémités, recapture, chevauchement, silences/causes, stockage en panne, identité des wrappers, timeout/cancel du bridge et mode hors lot. Production VM charge **l'ordre exact des imports**, substitue uniquement stockage/Chrome/ESV simulés ; comparaison avec module de mesure absent (`tests/helpers/perf-production.cjs:5-24`). Lot posé, différé et pause/reprise : mêmes commandes, ordre, arguments et positions. Le vrai chemin decideCut seeded confirme entrée nouvelle, deux mono-rails, aucune paire ni commande adaptateur ajoutée (`tests/perf-science-production.test.cjs:5-24`). Ceci ne prouve pas Edge, IndexedDB réel ni tous les chemins terrain.

Relevé explicite reproductible `node measure-local.cjs` (script joint) : **21 commandes avec et sans V1**, ordre/arguments identiques (seul capturedAt wall clock neutralisé), positions finales identiques ; deux paires, quatre mono-rails initiaux, deux visites, zéro phase attendue manquante mais un chevauchement et projet absent : couverture complète **non** (`preuves/production-transparency-and-weight.json:2-48,58-96`).

Même lot synthétique du candidat final : 53 événements V1, 41401 octets JSON UTF-8, max 1041 octets/événement, fenêtre locale emit 2,884614 ms ; journal complet 1948919 octets <67 108 864. Ces chiffres valent pour cette fixture seulement (`preuves/production-transparency-and-weight.json:104-111,242-250`). Deux passages successifs non appariés ne mesurent pas un surcoût causal ; aucune accélération déduite.

Microbanc Node du candidat final avec écriture mémoire immédiate : 10000 points, 10005 événements, 5549168 octets, max 600 octets, pic 66 pending, zéro perte ; fenêtre synchrone emit 36,736482 ms, boucle/flush 43,381366 ms (`preuves/instrumentation-microbench.json:2-15`). Ce compteur mesure la construction/envoi synchrone des événements, avec l'entrée MemoryStore.putEvent ; pas le coût complet des wrappers, de l'IndexedDB réel, de la page ou d'Edge. Surcoût terrain ajouté **non mesuré**, seuil acceptable à décider ; aucune promesse de taille/rétention d'un lot long.

La règle 7 s est contrôlée sur les six nouveaux fichiers, démarrage inclus : maximum frais 4,720326 s (`preuves/targeted-7s-files.json`). Les durées du verify antérieur sont également jointes ; cela ne certifie pas que chaque ancien fichier respecte 7 s. Le runner stable reste à 20 s (`tools/verify.cjs:29`), sans relèvement. Aucun essai existant modifié, aucun nouveau test sauté.

## Rejeu candidat et vérification finale

Le **candidat final** a été rejoué entièrement, sans `--reprendre`, dans le dossier neuf `j1-candidate-final-fresh` avec `ENTREES-V1-final.env`. Les quatre chemins d’entrée sont les mêmes que la référence ; SHA-256 des 133 entrées de nouveau identiques, zéro différence avant et après (`preuves/inputs-before-final-candidate.json`, `preuves/inputs-after-final-candidate.json`). Aucun résultat du premier candidat vert n’est réutilisé.

```text
node tools/portes-j1.cjs --entrees ENTREES-V1-final.env
Relevé : code 042aee6 (modifié, non commité).
VERT  633 cuts de validation : 0 décision changée ; parité p9-4.7.18 313/346, parité p9-4.7.19 85/85, parité p11-4.7.20 95/95, parité p12-4.7.20 106/106
VERT  8 jeux : natif-p11:707 refusé ; natif-p11:711 refusé ; natif-p11:718 posé ; 0 juste perdu
J1 (banc) : toutes les portes sont vertes.
Exit code 0 ; 545,440695 s.
```

Comparaison dédiée : `python3 compare-j1.py`, exit 0. Toutes les propriétés `validation` et `jeux` du relevé, listes dans leur ordre, sont identiques : **633 lignes, huit jeux, 13 sessions, 1 398 lignes** ; zéro différence. Seuls `code`/`faitLe` de provenance sont exclus du relevé. Les douze JSON secondaires sont en plus comparés intégralement, aucune exclusion, aucun changement (`preuves/comparison-j1.json:2-105`, `preuves/compare-final-candidate.stdout`, script `reproduction/compare-j1.py`). La référence 4.8.0 et les 16 fichiers protégés/liés sont identiques octet pour octet à la base ; source candidate inchangée depuis le début du dernier J1 ; relevé précommit (base 042aee6 + modifications), relié au commit final par le manifeste SHA-256 des fichiers (`preuves/protected-integrity.json`).

Verify du candidat final :

```text
node tools/verify.cjs
{"tests":1054,"suites":0,"pass":1052,"fail":0,"cancelled":0,"skipped":2,"todo":0}
Syntax: 38 runtime files. Geometry unchanged: true. Engine matches V4.6.0 baseline: true.
Bench mode: partial. Native corpus: absent (3 files). Skipped: 2 — skipped is not passed.
```

Soit **1054 tests, 1052 réussis, 0 échec, 2 sautés**, mode **partial**, exit 0. Les deux tests sautés ne sont jamais comptés comme réussis. Source intégrale finale `audit/verification.txt`, résultats `audit/verification.json:2-16` et copie `preuves/verification-final.json/.txt`. Avant l’unique commit `[V1]`, verify est relancé et chaîné à l’ajout et au commit par `&&` ; aucun commit préalable. Gels et baseline moteur vérifiés sans modification. Le SHA local final, message et trailer Session figurent dans META.json et la preuve de commit. Les motifs navigateur historiques codés en dur dans le runner (`tools/verify.cjs:71`) ne proviennent pas d’une tentative actuelle : aucun navigateur lancé dans cette reprise. Aucun push/merge/étiquette.


La comparaison dédiée 4.8.6→candidat ne remplace pas le contrôle portes-j1 historique 4.8.0. J1 consomme la science initiale enregistrée (`relecture-v4/RAPPORT.md:18-22`, source stable `tools/acceptance-report.cjs:318`) : aucune prétention qu'il recalcule toutes les branches scientifiques sur 633 coupes. La transparence des enveloppes et imports réels est vérifiée séparément ; un futur V4 doit exiger sa propre science fraîche avant retrait de calcul.

## Limites et questions avant mesure terrain

Mesures de plusieurs lots, référence de vitesse 4.8.6+V1, dérive/lot long, coût Edge/IndexedDB, KI-069 posé et acceptation restent **non mesurés/non établis**. Le comportement KI-069 est conservé, sans correctif. Les résultats synthétiques ne franchissent pas la porte 100 % du cahier : première/dernière, chevauchement du suivant et projet parfois absent restent publiés. Faire confirmer la lecture de la porte incluant NA/chevauchements, jamais la réduire aux seuls cycles faciles.

À cadrer dans la mission terrain après les deux relectures : projets/parties et nombre de lots (rotation/exclusions 9033/9241, aucun choix/réglage sur validation), conditions machine/Edge/fenêtre/zoom/extensions, captures/segments/manifeste complets, conservation avant purge, lot long et budget/coût tolérable. Le flush metadata ne rend pas atomiques les lectures IndexedDB parallèles du panneau existant ; un export pendant l'action reste susceptible de lacunes, détectées par santé/séquence. Aucun changement d'export U1/V2 ni promesse de fichier unique/poids fixe.

L'accès historique à la demande proposé par V4 requiert paramètres du cerveau/appuis/entrée seeded d'origine et une disponibilité conservée : V1 ne reconstruit pas ces informations absentes. Étendre une interface ou toucher un gel demande une proposition bornée approuvée. Remise du ZIP unique, puis **arrêt pour relecture par l'orchestrateur et indépendante** ; aucune suite lancée.
