# Architecture du développement restant de la 5.0 (révisée le 23 octobre 2026)

Remplace la fiche du 22/10. Cadre le reste du chemin autour de `BANANE_5.0_CAHIER_V2.md` et des décisions D-239 à D-243. Lecture seule du code au moment de l'écriture : rien n'est lancé, rien n'est modifié dans le code. Tronc de code : `claude/50-test17` (test 18, 4.9.5.18) plus `claude/50-echo-ack` (test 19, 4.9.5.19, un seul commit : acquittement de l'export Écho). Cette fiche, le cahier v2 et D-239 à D-243 sont écrits sur `claude/execute-prompt-00-18ra5a` et doivent être reportés sur le tronc au premier chantier. Aucune donnée de partie, aucun code de projet, aucun identifiant de modèle.

Règle première partout : **ne rien perdre des résultats de la GCV2** (D-239), vitesse comprise (D-242). Aucun SKIP envoyé par Ariane (D-241).

---

## a. Système et modules à construire

### a.1 Ce qui existe (on construit dessus)

```
ESV (page Potree + jQuery)
   ▲ commandes DOM / lecture       │ événements, liste d'ESV, nuage
src/bridge.js (contenu)  ◄────────┘
   ▲
background.js (service worker, un seul onglet ESV : selectedTab, gardé dans banane3Tab)
   ├─ src/engine.js        GELÉ (épinglé, baseline contrôlée par verify) : chaîne de pose GCV1
   ├─ src/lot-decision.js  décision du lot      ├─ src/gcv2-l1.js  GCV2 « L1 » (différés, leviers v6)
   ├─ src/voie-recentree.js, regles-metier.js (zones), hauteur-apprise.js (ombre)
   ├─ passe différés (fin de lot, écrit sous gardes)   ├─ relecture (ombre / corriger, pause, attentes fixes)
   ├─ chrome.tabs.onUpdated → echoReprise (Écho seul) ; retablirApresRechargement (lot seul)
   └─ journal, export, relevés lecture seule
   ▲
panel.js + src/ui5*.js (panneau ; message « ESV n'est pas connecté » tiré de l'état OUVERT du volet)

Hors ligne (dépôt + archives hors dépôt)
   tools/banc-differes.cjs rejouer|predire|agreger      rejeu de la chaîne sur un lot archivé (profils base, L1, L1-se)
   tools/parite-l1se-sw.cjs [--passe]                  vrai service worker en vm contre ESV simulé (tests/helpers/perf-production.cjs)
   tools/parite-relecture-sw.cjs                       cinq relectures dans le vrai service worker (tests/helpers/relecture-lot.cjs)
   tools/relecture-banc.cjs                            extension réelle dans Chromium + maquette ESV (branche claude/esv-locale-audit, Playwright)
   tools/perf-lot.cjs, perf-phases.cjs, perf-v3.cjs    temps terrain lus dans les exports
   tools/jointure-echo-orbite.cjs                      Écho ↔ Orbite par cut
   tools/verify.cjs (+ verify-garde.cjs : verrou « rejeu lourd », priorité basse)
   juger.cjs, cv.cjs                                   HORS DÉPÔT (scratchpad) : à verser
   datasets/manifeste-parties.json                     apprentissage / examen / témoin
```

### a.2 Modules à construire et interfaces

| # | Module | Emplacement | Contrat (entrée → sortie) |
|---|---|---|---|
| R | Report sur le tronc | tronc | cahier v2, cette fiche, D-239 à D-243 ; `DECISIONS.md` redevient un seul fichier (D-224 à D-238 sont sur deux branches) |
| A | **Garde de non-régression GCV2** | `tools/garde-gcv2.cjs`, `tools/juger.cjs` (porté), `datasets/garde-gcv2/` | voir a.3 |
| B | **Tableau de bord** | `tools/tableau-bord.cjs` → `fiches/TABLEAU_BORD.md` + `datasets/tableau-bord/<version>.json` | voir a.4 |
| V | **Vitesse** | V-a mesure (`perf-lot.cjs` existant, `datasets/vitesse/`) ; V-b relecture ; V-c lot | voir a.5 ; V-b et V-c changent `background.js` (attentes), jamais la décision |
| U | **Interface D-243** | `panel.js`, `src/ui5*.js`, `background.js` (action `reconnect` → `equiperOnglet(selectedTab)`, `onUpdated` hors Écho et hors lot) | aucune commande ESV ; l'historique lit `batch-started` / `batch-stopped-at-end` |
| SK | **Cuts à SKIP, ombre seule** | `src/regles-metier.js` ou module voisin ; événement `skip-ombre` ; `tools/skip-ombre.cjs` | entrée : nombre de points et scanners déjà lus pour le cut ; sortie : journal seulement ; l'outil hors ligne compare aux SKIP de Mic dans les exports (précision, rappel) |
| C | Diagnostic « oracle » de la voie | `tools/voie-oracle.cjs` (hors ligne) | par bloc d'ADV : la bonne paire est-elle parmi les candidats à 5 / 10 / 20 mm ; parts « candidat manquant », « mal classé », « appui contaminé » |
| E | Provenance des appuis (M2) | `src/lot-decision.js`, `src/gcv2-l1.js` | classe par appui `{humain, chaine, l1, passe}` ; pose L1 et pose de la passe jamais appui ; verts de chaîne non contrôlés = appuis faibles en ADV |
| D | Décodage global de la voie | `src/voie-decodage.js` (pur, sans DOM), appelé par la passe puis par le lot en ADV | états = paires candidates, émissions = preuves du nuage, transitions = continuité ; **abstention** si la marge au second chemin est faible ; jamais de pose sans preuve des deux rails |
| G | Maquette ESV | G1 : ESV simulé en vm étendu en campagne de pannes, dans `verify` (rejeu court) ; G2 : maquette Playwright de `relecture-banc.cjs`, complète avant tout paquet qui écrit | pannes : worker arrêté en pleine capture / pose / validation / écriture de la passe, F5, 500 puis 204, 502, nuage vide, onglet caché, cible hors vue |
| H | Preuve serveur (F4) | `background.js` autour de `applied-verified`, lecture seule d'abord | pourquoi `serverConfirmed` est faux sur 68/68 poses du lot de la partie 4:2 |
| F | Contre-expertise des verts de chaîne | déjà codée (leviers `contreChaine*`) ; câblage si Mic l'allume | gain net (verts rendus justes − dégradés) sur la base et la 3:0 |
| I | Deuxième passe : cible hors de la vue | `engine.js` (ré-épinglage) ou contournement « déplacer la vue » hors moteur | poses écrites / poses décidées sur lots de terrain |
| J | Précision sous 5 mm | `tools/repointage.cjs` (hors ligne) ; 60 cuts repointés deux fois | plafond de bruit par axe ; décision d'activer la hauteur apprise |
| K | Livraison | fusion, cahier signé, Edge, ancien panneau, étiquette | cahier v2 § 7, « 5.0 stable » |

### a.3 Contrat de la garde (A)

```
node tools/garde-gcv2.cjs --base datasets/garde-gcv2/base-test18.json [--lots tous|ID,ID] [--vitesse] [--sortie DOSSIER]
Entrée  : base scellée (comptes, mm, numéros de cuts ; commit et version du code mesuré ; SHA256SUMS) ;
          lots archivés HORS dépôt (dossier donné par BANANE_LOTS) ; code du dépôt courant.
Sortie  : garde.md + garde.json : par groupe, critères 1 à 6 du cahier § 2 ; liste PAR CUT : perdus, dégradés > 2 mm,
          gagnés, nouvellement posés ; temps banc par lot (analyse + décision + passe : médiane, p90).
Retour  : 0 vert · 1 recul de qualité (critères 1 à 5) · 2 recul de vitesse banc seul (critère 6-i, > 10 %)
          3 garde non rendue (base non scellée, commit absent, lot manquant) · 4 erreur d'outil.
Règle   : 1 ou 2 → pas de paquet sans décision écrite de Mic avec le compromis chiffré ; 3 → pas de paquet du tout.
          Un changement hors module de décision : « garde sans objet, parité 0 écart » écrit dans le paquet (cahier § 2, 3 bis).
```

Essai rouge d'abord : `tests/garde-gcv2.test.cjs` sur une fixture synthétique (un cut perdu → retour 1 ; un lot plus lent de 20 % → retour 2 ; base sans commit → retour 3).

### a.4 Schéma du tableau de bord (B), un fichier par version

```
{ version, commit, date, population: 'reglage' | 'examen',
  exports: [{ sha256, partie, lotId, cuts }],                       // jamais de coordonnées ni de code de projet
  sansEcho: { sansPose: {n, N, p, wilson95}, differes: {...},
              vitesseLot: {cycleMedMs, p90Ms, captureMedMs, analyseMedMs, poste},
              relecture: {mode, cutsRelus, dureeMs, msParCut, corriges, arrets},
              skipOmbre: {detectes, skipMic, precision, rappel} },
  avecEcho: { precision: {medMm, p5, p10, pires: [{cut, mm}]},
              budgets: {mauvaiseVoie: {n, N, wilson95}, plus50: {...}, sansPreuve: n},
              autonomie: {sansRetouche, N, p, wilson95, tempsNetEstimeMin} } }
```

`avecEcho` reste `null` tant qu'aucun Écho complet n'est joint à la partie ; le markdown le dit en clair.

### a.5 Schéma de la base de vitesse (V)

- `datasets/vitesse/base-banc-test19.json` : `{ commit, version, machine: {cpus, node}, lots: [{lotId, cuts, analyseMedMs, analyseP90Ms, decisionMedMs, passeMedMs}] }`, scellé. C'est la mesure qui entre dans la garde (critère 6-i).
- `datasets/vitesse/terrain.json` : une ligne par `{partie, poste, version, cuts, cycleMedMs, p90Ms, captureMedMs, relectureMode, relectureMsParCut}` ; comparaison seulement à partie et poste égaux ; sinon « non contrôlé ». Alimenté par V-a à chaque export reçu.

## b. Dépendances et ordre

```
R report ──► tout (une seule lignée de décisions)
U interface : indépendant de la décision ──► livrable en premier (parité vaut garde)
A garde ──► tout paquet qui touche la décision (E, D, F, I, J)
V-a mesure ──► B (famille sansEcho) et base de vitesse ; V-b relecture (attentes) ──► V-c lot
B tableau ──► seuil d'autonomie (décision de Mic) ; a besoin des Échos 3:1 et 4:2 pour avecEcho
SK ombre : indépendant, lecture seule, tôt
C oracle (hors ligne) ──► D seulement si « mal classé » > « candidat manquant »
E provenance ──► D (appuis typés = observations fortes/faibles du décodage)
G1 pannes dans verify ──► toute nouvelle écriture (D en écriture, F, I) ; G2 complète avant chaque paquet qui écrit
H preuve serveur : lecture seule, n'importe quand ──► lecture fiable des lots de terrain
J précision : indépendant, démarre quand Mic repointe
K : à la fin
```

En parallèle sans risque : C, SK (outil hors ligne), B, V-a, H, G1 sont des outils hors ligne ou lecture seule ; ils avancent pendant que U puis A sont construits. Jamais deux rejeux lourds en même temps (disque 1,6 Go ; verrou `verify-garde`).

Ordre retenu : **R + U** → **A + V-a + SK** → **V-b + B** → **C ∥ G1 ∥ H** → **E** → **D** → **F ou I (sur décision)** → **V-c + J** → **K**.

## c. Versions de test livrables (une nouveauté qui écrit à la fois)

| Version | Contenu | Critère de sortie mesurable |
|---|---|---|
| **T20** | R + U : message fondé sur `connection.status`, reconnexion après F5, bouton « Reconnecter », historique d'accueil | essai vm : après rechargement de l'onglet, état « connecté » en < 2 s et **0 commande ESV** ; message affiché seulement si `status === 'unavailable'` ; historique = lots du cache avec comptes ; `parite-l1se-sw --passe` et `parite-relecture-sw` 0 écart ; verify 0 échec 0 annulé ; terrain : 3 F5 de suite sans repasser par le menu |
| **T21** | A versée + base test 18 recalculée et scellée + base vitesse banc (test 19) + SK en ombre + H lecture seule | `garde-gcv2` retour 0 sur le code T21 ; base avec commit et SHA ; essai rouge de la garde vert ; `skip-ombre` : précision et rappel chiffrés sur ≥ 3 parties avec SKIP de Mic, 0 commande ESV (parité) |
| **T22** | V-b relecture : attente sur l'état de l'adaptateur au lieu des 6 essais fixes, attentes revues ; B v1 | `parite-relecture-sw` 0 écart de décision (durées neutralisées) ; `relecture-banc` : 0 arrêt `ADAPTER_BUSY` sur 7 refus simulés ; terrain : relecture ombre ≤ 1,8 s par cut sur ≥ 100 cuts relus ; garde retour 0 ; `TABLEAU_BORD.md` produit |
| **T23** | E provenance des appuis (décision) | garde 0 ; sur la 3:0 les 4 verts de chaîne faux ne se propagent plus (cuts listés) ; parité `--passe` 0 écart ; relecture indépendante |
| **T24** | D décodage de voie, après C et G1 | garde 0 ; mauvaise voie 0 sur la base ; cuts gagnés et abstentions listés ; G2 complète rejouée ; relecture indépendante |
| **T25** | F **ou** I, sur décision de Mic (jamais les deux) | F : gain net ≥ 0 vert, garde 0 ; I : poses écrites / décidées ≥ 0,9 sur un lot de terrain ; protocole de première écriture réelle (§ d) |
| **T26** | V-c lot, J si repointage fait | lot ≤ 2,44 s médiane sur ≥ 300 cuts et pas plus lent à partie égale ; J : plafond de bruit écrit |
| **5.0** | K | cahier v2 § 7 « 5.0 stable » |

Chaque version a sa fiche `fiches/PASSATION_T<nn>.md`, sa consigne terrain, et le retour de terrain analysé avant la suivante.

## d. Stratégie de tests et de preuves

1. **Essais rouges d'abord** : chaque module naît avec un essai qui échoue (fixture synthétique, jamais une partie), puis passe. `verify` : 0 échec, 0 annulé, délai 20 s jamais allongé.
2. **Maquette ESV à deux étages** : G1 (vm, dans `verify`) pour les pannes et la non-écriture (compteur de commandes à 0 pour U, SK, V) ; G2 (Playwright) avant tout paquet qui écrit. Aucune nouveauté qui écrit sans G1 vert.
3. **Parité extension / banc** à chaque changement du service worker : `parite-l1se-sw` (`--passe` si la passe est touchée), `parite-relecture-sw` si la relecture est touchée. 0 écart ou le paquet n'est pas livré.
4. **Garde A** pour tout ce qui touche la décision ; liste par cut jointe au paquet ; retour 1 ou 2 = décision écrite de Mic.
5. **Relecture indépendante** (autre agent, le plus capable) de tout code qui touche la décision d'un cut ou l'écriture dans ESV ; sa fiche de relecture est jointe au paquet.
6. **Étanchéité réglage / examen** : tout réglage (leviers, seuils, attentes) se fait sur la population de réglage ; une partie d'examen s'ouvre une fois, modèle gelé avant (commit nommé), puis passe en apprentissage par décision écrite. Les mesures de vitesse se font sur des parties de réglage ou sur des exports de terrain, jamais en rouvrant une partie d'examen.
7. **Première écriture réelle de la deuxième passe** (inchangé) : un lot d'apprentissage avec ≥ 3 différés attendus, Mic présent, export immédiat ; journal `passe-differes-ecriture-*` avec relecture à 1 mm et preuve de validation par cut ; Écho des seuls cuts écrits le jour même ; tant que ce n'est pas fait, le gain de la passe est un majorant du banc.

## e. Répartition par type d'agent

| Travail | Agent | Pourquoi |
|---|---|---|
| Code de l'extension, outils, essais, parités, rejeux (R, U, A, V, SK, E, D, G, H, K) | **Agent de code** par défaut, une branche par chantier depuis le tronc, fiche de passation | tâches cadrées, critère de sortie écrit |
| Relecture indépendante de tout ce qui touche la décision ou l'écriture (A, E, D, F, I, V-b) | **Relecteur indépendant**, séance courte, lit le diff et la liste par cut, ne code pas | second regard |
| Cadrage, portes de version, arbitrages | l'architecte, seulement aux portes | quota |
| **Agent externe**, **sur accord de Mic** : C oracle, `tools/tableau-bord.cjs`, `tools/skip-ombre.cjs`, `tools/repointage.cjs`, fixtures synthétiques, documentation d'outils | branche dédiée `ext/<outil>`, **jamais le tronc**, outils hors ligne seulement, **aucun export ni lot** transmis (fixtures synthétiques du dépôt), aucun accès à `background.js`, `src/`, `engine.js` ; revue par l'agent de code puis fusion par nous | zéro risque d'écriture dans ESV et zéro fuite de données ; les vrais rejeux sur archives restent chez nous |

Ce qui ne sort jamais vers un agent externe : le service worker, les modules de décision, les parités, la garde elle-même, tout fichier des archives.

## f. Risques et parades

| Risque | Parade |
|---|---|
| Pose fausse écrite sans relecture humaine | garde A, G1 puis G2 avant toute écriture nouvelle, une nouveauté qui écrit à la fois, protocole § d.7 |
| Vitesse « gagnée » au banc mais perdue au terrain (le banc ne voit qu'un cinquième du cycle) | deux mesures distinctes (critère 6-i et 6-ii) ; comparaison terrain à partie et poste égaux ; `relecture-banc` avec latence réglée |
| Corriger le message (U-a) et croire la reconnexion réglée alors qu'un vrai défaut reste | critère de sortie T20 en vm **et** 3 F5 de suite au terrain ; (b) construit si le défaut reste |
| Chiffres de réglage pris pour des preuves ; fuite réglage → examen | tableau de bord par population ; partie d'examen ouverte une fois ; partie neuve de réserve nommée avant |
| Base test 18 jamais recalculée ; juge hors dépôt | T21 recalcule, scelle, nomme le commit ; tout chiffre antérieur dit « non scellé » |
| Décodage global qui renforce une voie fausse par des appuis autocorrélés | E avant D ; marge au second chemin ; une information comptée une fois |
| SKIP en ombre sans vérité (Mic n'a pas transmis d'exports) | SK livré en journal seul ; précision/rappel calculés quand des exports arrivent ; aucune conclusion avant |
| Disque 1,6 Go ; machine partagée | verrou `verify-garde`, un rejeu lourd à la fois, sorties au scratchpad, suppression après rejeu, `.jsonl` compressés |
| Quota hebdomadaire presque épuisé | § h ; arrêt d'une séance à 80 % de son budget avec fiche de passation ; aucun agent de recherche |
| Agent externe : fuite de données ou code non relu dans le tronc | branche `ext/`, fixtures seules, revue avant fusion ; jamais d'export |
| `engine.js` touché sans ré-épinglage | baseline contrôlée par `verify` ; I par contournement tant que Mic n'a pas tranché |
| Deux `DECISIONS.md` divergents (D-224 à D-238) | R en T20, numérotation vérifiée, un seul fichier ensuite |

## g. Décisions attendues de Mic, par ce qu'elles débloquent

| Débloque | Décision |
|---|---|
| **T20** (tout de suite) | 1. Accord pour livrer une version interface avant la garde, sous parité (règle ajoutée au cahier § 2, 3 bis). 2. Liste des « petits détails d'interface ». |
| **T21 / B** | 3. Transmettre les exports (ou le cache de l'extension) des tests 18 et 19 ; sans eux, pas de base terrain ni de mesure SKIP. 4. Autoriser les rejeux longs sur le disque plein (ou libérer de la place). 5. Nommer une partie neuve d'examen en réserve. |
| **T22 / V** | 6. Quelle relecture compte (fin de lot en ombre, « corriger », ou l'Écho) et quel temps visé ; quelle partie sert de référence au lot. |
| **T23 à T25** | 7. Contre-expertise des verts de chaîne : allumer pour mesure ou laisser coupée. 8. Ré-épinglage de `engine.js` pour la cible hors vue, ou contournement. 9. Projet de rattachement de la partie 2 (manifeste). |
| **J** | 10. Deux séances d'environ 1 h de repointage. |
| **Passation** | 11. Accord et périmètre pour un agent externe (outils hors ligne, fixtures synthétiques, branche `ext/`). |
| **K** | 12. Seuil d'autonomie après la mesure de base ; fusion dans `main`, étiquette, publication. |

Les trois plus bloquantes : 3 (exports), 1 (version interface sous parité), 6 (définition de la relecture visée).

## h. Budget de quota prudent

Unité : une séance = une session d'agent bornée ; « appels » = appels d'outils, plafond à ne pas dépasser (arrêt à 80 % avec passation). Cette semaine, quota presque épuisé : rien d'autre que la préparation de T20 si de la marge reste, sinon rien.

| Phase | Agent de code | Relecteur indépendant | Architecte |
|---|---|---|---|
| R + T20 | 2 séances, ≤ 120 appels | 1 courte, ≤ 25 | porte : ≤ 15 |
| T21 (A, bases, SK, H) | 3 séances, ≤ 200 (rejeux en arrière-plan, un à la fois) | 1, ≤ 30 | ≤ 15 |
| T22 (V-b, B) | 2 à 3 séances, ≤ 180 | 1, ≤ 30 | ≤ 15 |
| C ∥ G1 ∥ H | 2 séances, ≤ 120 (ou agent externe pour C) | — | — |
| T23 (E) | 2 séances, ≤ 120 | 1, ≤ 40 | ≤ 15 |
| T24 (D) | 4 séances, ≤ 300 | 2, ≤ 80 | ≤ 20 |
| T25 (F ou I) | 2 séances, ≤ 120 | 1, ≤ 40 | ≤ 15 |
| T26 + K | 3 séances, ≤ 180 | 1, ≤ 30 | ≤ 20 |
| **Total** | **≈ 20 séances, ≤ 1 350 appels** | **≈ 8 courtes, ≤ 275** | **≤ 130** |

Règles : jamais deux séances lourdes en parallèle ; pas d'agent de recherche, pas de recherche web ; une séance qui lit un export ne lit que les événements dont elle a besoin (jamais le fichier entier dans le contexte).

---

## Ajout du 23/10 : Orbite en file de parties (module P, version T27, D-244)

- **Objet** : bouton d'enchaînement des parties dans Orbite (éteint par défaut). Une partie finie → noter les données de départ de la suivante → poser → ainsi de suite sur les parties programmées.
- **Ce que la page d'ESV offre (lu dans une page enregistrée, pas encore sur la maquette)** : un sélecteur de parties (`partsSelectorList`) dont chaque entrée est un lien vers la partie (`…&p=N`), un compteur « Part 5 / 12 » et les compteurs Validated / Invalid / Skipped. Passer à la partie suivante = cliquer le lien, comme un humain ; la page se recharge (événement `newPart`), donc **la reconnexion après rechargement (T20) est un prérequis**.
- **Module P** (`src/file-parties.js`, pur, sans DOM : liste des parties, partie courante, règles d'arrêt, bilan ; `background.js` : transition de lot « partie suivante », action `file-parties-demarrer/arreter`, état persistant dans `chrome.storage.local`, reprise après redémarrage du service worker) ; panneau : bouton, liste des parties programmées, bilan par partie. Les données de départ passent par le chemin existant (`fichesDepart`, `batch-started`).
- **Dépendances** : T20 (reconnexion), G maquette avec scénario « changement de partie » et pannes, garde A verte, relecture indépendante, décision de Mic sur la nouvelle action ESV. Placé **après T25** et avant la livraison ; ne se livre qu'avec une file de deux parties au plus pour le premier essai de terrain, Mic présent.
- **Règles d'arrêt (décision de Mic, D-245)** : **aucun arrêt de prudence**, seulement le bouton d'arrêt. S'arrêtent d'eux-mêmes les seuls cas impossibles à poursuivre : changement de partie qui n'aboutit pas (10 s), onglet fermé, ESV muet, nombre de parties atteint ; alerte visible, bilan écrit. **Entrée** : le nombre de parties ; **après chaque partie** : relecture et correction (bouton), pas d'export automatique. Pas de SKIP ni de VALIDATE hors du lot (D-241). Les gardes du lot lui-même (refus, anomalie) continuent d'arrêter le lot en cours : la file ne les contourne pas ; si un lot s'arrête ainsi, la file s'arrête avec le motif (c'est impossible de poursuivre sans le lot).
- **Interface** : maquette cliquable de l'accueil validée par Mic avant le code (connexion, partie en cours, avancement « partie 2 sur 5 », bouton Enchaîner, bouton Arrêter, relecture et correction activables, historique des parties) ; principes de clarté et de simplicité de D-245, sans perte de donnée.
- **Critère de sortie T27** : sur la maquette, file de 3 parties avec une panne de page injectée au changement : arrêt propre et reprise ; sur le terrain, 2 parties enchaînées sans intervention, bilan par partie écrit, 0 commande ESV hors du lot et du changement de partie.
- **Effort** : M à L (service worker, maquette, panneau). Risque principal : une erreur répétée sur plusieurs parties sans personne ; parade : arrêt à la première anomalie et plafond.

## Auto-audit du 23/10 (corrigé dans le cahier le même jour)

| Problème | Preuve | Correction |
|---|---|---|
| La 3:5 restait partie d'examen (§ 2.1) et source d'autonomie (§ 4) | D-240 : 3:5 retirée le 22/10 ; § 6.2 du cahier le disait déjà, contradiction interne | § 2.1 et § 4 : 3:1 seule, Écho 4:2 ajouté, partie neuve de réserve à nommer |
| Critère « nombre **et** proportion à 10 mm » pouvait bloquer un gain légitime | un cut nouvellement posé à 15 mm fait baisser la proportion sans rien perdre | comparaison appariée par cut ; cuts nouvellement posés jugés à part par les budgets |
| Critère 6 : la garde rejoue au banc sans page ESV, le temps terrain n'y est pas mesurable | `perf-lot` sur la 4:2 : l'attente d'ESV fait 63 % du cycle, l'analyse un cinquième | deux mesures : 6-i banc (dans la garde, ± 10 %), 6-ii terrain (tableau de bord, à partie et poste égaux) |
| Métrique de vitesse non définie (outil, statistique, mode, population) | § 6 bis mélangeait cycle `perf-v3`, `perf-lot` et `relecture-fin` ; « partie difficile » sans définition | définitions écrites : `perf-lot` cycle médian + p90 sur ≥ 300 cuts ; `relecture-fin.dureeMs / cuts relus` par mode, ≥ 100 cuts, pauses exclues |
| Deux bases (qualité test 18, vitesse test 19) sans commit nommé | § 2.5 et § 3 ne nommaient aucun commit | chaque fichier de base nomme commit et version ; sans commit, retour 3 de la garde |
| Porte circulaire : la garde est exigée pour toute version alors qu'elle est le chantier 1 | § 7 v. précédente | parité 0 écart vaut garde pour un changement hors décision ; avant le chantier 1, seule une telle version peut sortir |
| Chantier 2 : hypothèse non vérifiée (exports ou cache disponibles) ; autonomie impossible sans Écho | D-240 : aucun export transmis ; l'autonomie se calcule par jointure Écho-Orbite | deux familles d'indicateurs (sans / avec Écho) ; plan si le cache est vide ; critère de sortie du chantier 2 |
| Chantier 10 : causes supposées, ordre (a, b, d, c), (a) et (d) probablement un seul défaut | `panel.js` ouvre le volet dès `status === 'unavailable'` ; `ui5.js` en tire le message ; `onUpdated` ne rétablit qu'Écho et lot | ordre : message d'abord, F5 rejoué, reconnexion seulement si le défaut reste ; critère de sortie écrit |
| « Vérifier si le refus `ADAPTER_BUSY` persiste » : le code répond déjà | `occupeAttentesMs` = 6 essais, 11,75 s ; la 3:0 a eu 7 demandes | écrit dans le chantier 9 : le défaut persiste par construction ; correction = attendre l'état de l'adaptateur |
| Parité : `tools/parite-relecture-sw.cjs` ignoré | existe sur le tronc | ajouté au § 2, 3 bis, obligatoire si la relecture est touchée |
| « Maquette ESV dans `verify` » impossible telle quelle | la maquette est sous Playwright (`relecture-banc.cjs`) ; `verify` limite chaque essai à 20 s | deux étages : G1 vm dans `verify`, G2 Playwright avant paquet |
| Référence « D-1xx » non résolue dans § 6 bis | texte | note explicite « à retrouver lors de la fusion » |
| Chantiers 2 et 10 sans critère de sortie ; § 7 sans règle générale | texte | critères ajoutés ; règle : une version sans critère de sortie écrit n'est pas planifiée |
| § 8 oubliait les décisions nouvelles (exports, relecture visée, partie de réserve, agent externe) | texte | § 8 complété, renvoi au § g |

Non corrigé, à décider par Mic : le cahier garde « deuxième passe allumée en écriture » (D-237) alors qu'aucune écriture réelle n'a eu lieu ; le protocole § d.7 encadre la première écriture au lieu d'un retour en arrière.

Rappel de l'auto-audit du 22/10 (déjà dans le cahier) : base non recalculée → à sceller par le juge versé ; garde par cut ; parité à chaque changement du service worker ; définition calculable de l'autonomie ; partie d'examen ouverte une fois ; report sur le tronc et `DECISIONS.md` unique.
