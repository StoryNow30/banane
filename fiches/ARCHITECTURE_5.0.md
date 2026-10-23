# Architecture du développement restant de la 5.0 (révisée le 23 octobre 2026)

Remplace la fiche du 22/10 ; corrigée le 23/10 par la relecture indépendante (D-246, dernière section). Cadre le reste du chemin autour de `BANANE_5.0_CAHIER_V2.md` et des décisions D-239 à D-245. Lecture seule du code au moment de l'écriture : rien n'est lancé, rien n'est modifié dans le code. Tronc de code : `claude/50-test17` (test 18, 4.9.5.18) plus `claude/50-echo-ack` (test 19, 4.9.5.19, un seul commit : acquittement de l'export Écho ; à fusionner dans R). Cette fiche, le cahier v2 et D-239 à D-245 sont écrits sur `claude/execute-prompt-00-18ra5a` et doivent être reportés sur le tronc au premier chantier. Aucune donnée de partie, aucun code de projet, aucun identifiant de modèle.

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
| R | Report sur le tronc | tronc | cahier v2, cette fiche, D-239 à D-245 ; `DECISIONS.md` redevient un seul fichier (D-224 à D-238 sont sur deux branches) ; **fusion de `claude/50-echo-ack` (test 19, un commit)** faute de quoi T20a part du code que Mic n'utilise plus ; **rapatriement de la maquette ESV** (`claude/esv-locale-audit`, non ancêtre du tronc, extraite hors dépôt par `relecture-banc.cjs`) sur le tronc ou en sous-dossier versionné |
| A | **Garde de non-régression GCV2** | `tools/garde-gcv2.cjs`, `tools/juger.cjs` (porté), `datasets/garde-gcv2/` | voir a.3 |
| B | **Tableau de bord** | `tools/tableau-bord.cjs` → `fiches/TABLEAU_BORD.md` + `datasets/tableau-bord/<version>.json` | voir a.4 |
| V | **Vitesse** | V-a mesure (`perf-lot.cjs` existant, `datasets/vitesse/`) ; V-b relecture ; V-c lot | voir a.5 ; V-b et V-c changent `background.js` (attentes), jamais la décision |
| U | **Interface D-243 / D-245** : T20a (message, reconnexion, bouton, historique) puis T20b (refonte de l'accueil après maquette) | `panel.js`, `src/ui5*.js`, `background.js` (action `reconnect` → `equiperOnglet(selectedTab)`, `onUpdated` hors Écho et hors lot) | aucune commande ESV (l'injection `equiperOnglet`, deux `executeScript`, compte comme 0 commande mais pas comme 0 effet sur la page, et respecte le contrôle « Une autre Ariane » sans effet de bord) ; deux états : « équipé » et « prêt » ; l'historique lit `banane3FichesDepart` (persistant) plus une fiche de fin de lot dans une clé persistante à part, pas les événements du cache (vidables) ; panneau visé : question à Mic |
| SK | **Cuts à SKIP, ombre seule** | module non importé par la chaîne de décision tant que la garde n'est pas livrée (`src/regles-metier.js` ou voisin) ; événement `skip-ombre` ; `tools/skip-ombre.cjs` | entrée : nombre de points et scanners déjà lus pour le cut ; sortie : journal seulement ; l'outil hors ligne compare aux SKIP de Mic dans les exports (précision, rappel) |
| C | Diagnostic « oracle » de la voie | `tools/voie-oracle.cjs` (hors ligne) | par bloc d'ADV : la bonne paire est-elle parmi les candidats à 5 / 10 / 20 mm ; parts « candidat manquant », « mal classé », « appui contaminé » |
| E | Provenance des appuis (M2) | `src/lot-decision.js`, `src/gcv2-l1.js` | classe par appui `{humain, chaine, l1, passe}` ; pose L1 et pose de la passe jamais appui ; verts de chaîne non contrôlés = appuis faibles en ADV |
| D | Décodage global de la voie | `src/voie-decodage.js` (pur, sans DOM), appelé par la passe (T24a) puis par le lot en ADV (T24b) | états = paires candidates, émissions = preuves du nuage, transitions = continuité ; **abstention** si la marge au second chemin est faible ; jamais de pose sans preuve des deux rails |
| G | Maquette ESV | G1 : ESV simulé en vm étendu en campagne de pannes, dans `verify` (rejeu court) ; G2 : maquette Playwright de `relecture-banc.cjs`, complète avant tout paquet qui écrit | pannes : worker arrêté en pleine capture / pose / validation / écriture de la passe, F5, 500 puis 204, 502, nuage vide, onglet caché, cible hors vue ; **scénario de changement de partie en deux variantes** (rechargement de la page ; changement sur place, hypothèses de la page d'ESV non établies, ch. P) |
| H | Preuve serveur (F4) | `background.js` autour de `applied-verified`, lecture seule d'abord | pourquoi `serverConfirmed` serait faux sur 68/68 poses du lot de la partie 4:2 (constat SUPPOSÉ, journal archivé non relu ; définition stricte `serverConfirmed === true` et pas de navigation observée ; une cause d'instrumentation est plausible, non démontrée) ; à traiter avant que la passe soit contrôlée par la preuve serveur |
| F | Contre-expertise des verts de chaîne | déjà codée (leviers `contreChaine*`) ; câblage si Mic l'allume | gain net (verts rendus justes − dégradés) sur la base et la 3:0 |
| I | Deuxième passe : cible hors de la vue | `engine.js` (ré-épinglage) ou contournement « déplacer la vue » hors moteur (**action ESV nouvelle : règle de la maquette puis de l'accord de Mic**, comme pour la file) | poses écrites / poses décidées sur lots de terrain |
| J | Précision sous 5 mm | `tools/repointage.cjs` (hors ligne) ; 60 cuts repointés deux fois | plafond de bruit par axe ; décision d'activer la hauteur apprise |
| P | **File de parties** (T27a, T27b) | `src/file-parties.js` (voir l'ajout du 23/10 ci-dessous), `background.js`, panneau | N parties suivantes de la liste d'ESV → bilan par partie, registre persistant des écritures |
| K | Livraison | fusion, cahier signé, Edge, ancien panneau, étiquette | cahier v2 § 7, « 5.0 stable » |

### a.3 Contrat de la garde (A)

```
node tools/garde-gcv2.cjs --base datasets/garde-gcv2/base-test18.json [--lots tous|ID,ID] [--vitesse] [--sortie DOSSIER]
Entrée  : base scellée à deux colonnes sans passe / avec passe (comptes, mm, numéros de cuts ; commit et version du code mesuré ; SHA256SUMS) ;
          lots archivés HORS dépôt (dossier donné par BANANE_LOTS) ; code du dépôt courant.
Sortie  : garde.md + garde.json : par groupe, critères 1 à 6 du cahier § 2 ; liste PAR CUT : perdus, dégradés > 2 mm,
          gagnés, nouvellement posés ; temps banc par lot (analyse + décision + passe : médiane, p90).
Retour  : 0 vert · 1 recul de qualité (critères 1 à 5, calculé sur la colonne « sans passe » ; la colonne « avec passe » est signalée sans bloquer) · 2 recul de vitesse banc seul (critère 6-i, > 10 %)
          3 garde non rendue (base non scellée, commit absent, lot manquant) · 4 erreur d'outil.
Règle   : tout écart entre le rapport de l'intégrateur et le recalcul est présenté à Mic comme un recul avant de devenir la base.
          1 ou 2 → pas de paquet sans décision écrite de Mic avec le compromis chiffré ; 3 → pas de paquet du tout.
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
A garde ──► tout paquet qui touche la décision (E, D, F, I, J) ; PAS la file de parties (le changement de partie ne touche aucun module de décision)
P file ◄── T20a, G (scénario de changement de partie), tableau des motifs d'arrêt validé, registre d'écritures, accord de Mic sur la nouvelle action
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

**Ordre initial de l'architecte** (gardé visible) : **R + U** → **A + V-a + SK** → **V-b + B** → **C ∥ G1 ∥ H** → **E** → **D** → **F ou I (sur décision)** → **V-c + J** → **K**, avec la file (T27) après T25.

**Ordre révisé du 23/10 (proposition de la relecture indépendante ; Mic valide)** : (1) **T20a** ; (2) **T21a** (garde minimale + mesure par phase V-a) ; (3) **T22** (vitesse de la relecture, seulement après V-a) ; (4) **T27a** puis **T27b** ; (5) **T20b** (avant ou après T27a selon la validation de la maquette) ; (6) ensuite SK (T21b), tableau de bord complet, provenance des appuis (E), décodage de voie (D), F ou I, puis V-c + J et K. **T23 et T24 sont reportés tant que le tableau de bord ne montre pas un besoin chiffré.** Le contrôle a posteriori de ce que la passe a écrit (§ d.7) précède T25 et T27b.

### Correspondance chantiers du cahier (1 à 12) / modules / versions

| Chantier du cahier § 6 | Module | Version |
|---|---|---|
| 1 Garde | A | T21a |
| 2 Tableau de bord | B | outil hors ligne, après T27b |
| 3 SK | SK | T21b |
| 4 Voie | C, D | T24a, T24b |
| 5 Provenance, contre-expertise | E, F | T23, T25 |
| 6 Maquette, preuve serveur | G, H | G1 avant toute nouvelle écriture ; H en T21b |
| 7 Passe hors vue | I | T25 |
| 8 Précision | J | T26 |
| 9 Vitesse | V | V-a T21a, V-b T22, V-c T26 |
| 10 Interface | U | T20a, T20b |
| 11 File | P | T27a, T27b |
| 12 Livraison | K | 5.0 |

Le § 6 du cahier n'est plus un ordre d'exécution ; l'ordre est celui ci-dessus.

## c. Versions de test livrables (une nouveauté qui écrit à la fois)

| Version | Contenu | Critère de sortie mesurable |
|---|---|---|
| **T20a** | R (report, fusion de la test 19, maquette rapatriée) + U sans refonte : message fondé sur `connection.status`, reconnexion après F5, bouton « Reconnecter », historique (fiches de départ + fiche de fin de lot) ; relevé en lecture seule du sélecteur de parties (pour T27) | essai vm : après rechargement, « équipé » en < 2 s après `complete` et **0 commande ESV** ; « prêt » borné par `delaiMaxMs` (60 s), mesuré au terrain ; message seulement si `status === 'unavailable'` ; historique complet après un vidage du cache ; `parite-l1se-sw --passe` et `parite-relecture-sw` 0 écart ; verify 0 échec 0 annulé ; terrain : 3 F5 de suite sans repasser par le menu |
| **T20b** | refonte de l'accueil, **après maquette cliquable validée par Mic** | inventaire avant/après des données et exports atteignables ; test automatique « aucun bouton d'export perdu » ; nombre de clics des actions fréquentes (liste fixée avec Mic) mesuré avant/après, jamais plus qu'avant ; parité 0 écart |
| **T21a** | A minimale : juge versé, base qualité recalculée et scellée **à deux colonnes (sans passe / avec passe)**, base vitesse banc (test 19) + V-a (mesure par phase, comparaison appariée 4.9.0.8 contre 5.0 sur une partie de réglage) | `garde-gcv2` retour 0 sur le code T21a, bloquant sur « sans passe » ; base avec commit et SHA ; essai rouge vert ; écart de recalcul présenté à Mic ; mesure par phase écrite |
| **T21b** | SK en ombre (module non importé par la chaîne de décision) + H lecture seule | `skip-ombre` : précision et rappel chiffrés sur ≥ 3 parties avec SKIP de Mic, 0 commande ESV (parité) |
| **T22** | V-b relecture, **seulement après V-a** : attendre l'état de l'adaptateur au lieu des 6 essais fixes, **avec borne haute** et événement `relecture-adaptateur-bloque` (arrêt avec motif) ; autres attentes selon la mesure | `parite-relecture-sw` 0 écart de décision (durées neutralisées) ; `relecture-banc` : 0 arrêt `ADAPTER_BUSY` sur 7 refus simulés, et arrêt avec motif sur une action réellement bloquée ; terrain : relecture ombre ≤ 1,8 s par cut sur ≥ 100 cuts relus ; garde retour 0 |
| **T23** | E provenance des appuis (décision), reporté tant que le tableau de bord ne montre pas un besoin chiffré | garde 0 ; sur la 3:0 les 4 verts de chaîne faux ne se propagent plus (cuts listés) ; parité `--passe` 0 écart ; relecture indépendante |
| **T24a** | D décodage de voie appelé par la passe seulement, après C et G1 (reporté comme T23) | garde 0 ; mauvaise voie 0 sur la base ; cuts gagnés et abstentions listés ; G2 complète rejouée ; relecture indépendante |
| **T24b** | D appelé aussi par le lot en ADV | mêmes critères, rejoués sur le lot |
| **T25** | F **ou** I, sur décision de Mic (jamais les deux) | F : gain net ≥ 0 vert, garde 0 ; I : poses écrites / décidées ≥ 0,9 sur un lot de terrain ; contrôle a posteriori fait avant (§ d.7) |
| **T26** | V-c lot, J si repointage fait | lot ≤ 2,44 s médiane sur ≥ 300 cuts et pas plus lent à partie égale ; J : plafond de bruit écrit |
| **T27a** | P : file de parties, **relecture éteinte** | maquette : file de 3 parties avec panne de page injectée au changement, arrêt propre et reprise, les deux variantes de changement de partie ; terrain : 2 parties enchaînées sans intervention, Mic présent, bilan par partie et registre d'écritures remplis ; **0 commande ESV hors : lot, passe, relecture (si activée), changement de partie**, compteur par catégorie |
| **T27b** | P : relecture et correction dans la file | mêmes critères, corrections inscrites au registre, première file de 2 parties avec Mic présent |
| **5.0** | K | cahier v2 § 7 « 5.0 stable » |

Chaque version a sa fiche `fiches/PASSATION_T<nn>.md`, sa consigne terrain, et le retour de terrain analysé avant la suivante.

## d. Stratégie de tests et de preuves

1. **Essais rouges d'abord** : chaque module naît avec un essai qui échoue (fixture synthétique, jamais une partie), puis passe. `verify` : 0 échec, 0 annulé, délai 20 s jamais allongé.
2. **Maquette ESV à deux étages** : G1 (vm, dans `verify`) pour les pannes et la non-écriture (compteur de commandes à 0 pour U, SK, V) ; G2 (Playwright) avant tout paquet qui écrit. Aucune nouveauté qui écrit sans G1 vert.
3. **Parité extension / banc** à chaque changement du service worker : `parite-l1se-sw` (`--passe` si la passe est touchée), `parite-relecture-sw` si la relecture est touchée. 0 écart ou le paquet n'est pas livré.
4. **Garde A** pour tout ce qui touche la décision ; liste par cut jointe au paquet ; retour 1 ou 2 = décision écrite de Mic.
5. **Relecture indépendante** (autre agent, le plus capable) de tout code qui touche la décision d'un cut ou l'écriture dans ESV ; sa fiche de relecture est jointe au paquet.
6. **Étanchéité réglage / examen** : tout réglage (leviers, seuils, attentes) se fait sur la population de réglage ; une partie d'examen s'ouvre une fois, modèle gelé avant (commit nommé), puis passe en apprentissage par décision écrite. Les mesures de vitesse se font sur des parties de réglage ou sur des exports de terrain, jamais en rouvrant une partie d'examen. **Parcours de vitesse fixe** : une partie de réglage courte (par exemple une centaine de cuts, choisie par Mic) rejouée à chaque version de test, 5 à 10 minutes, export joint ; ou `relecture-banc` à latence réglée obligatoire pour le temps de relecture ; sans l'un des deux, retirer « permanent » du critère 6. Tolérance au banc : 3 répétitions et plus petite valeur, ou rapport avec la base rejouée dans la même séance. Les ~30 parties de terrain des tests 18 et 19 sont « terrain hors réglage » (interdites au réglage, valables pour la famille sans Écho) ; la 4:2 : examen consommé ou réserve, à fixer par Mic.
7. **Contrôle a posteriori de la deuxième passe** (remplace le protocole de « première écriture réelle » : la passe est allumée par défaut depuis la test 18, D-237 et D-238, et Mic a joué une trentaine de parties ; elle a peut-être déjà écrit, sauf s'il l'a coupée, question à Mic) : les cuts écrits par la passe (`passe-differes-ecriture-*`, relecture à 1 mm, preuve de validation par cut) sont comptés par partie, puis confrontés à l'Écho de Mic sur ces cuts ; tant que ce n'est pas fait, le gain de la passe est un majorant du banc. Fait avant T25 et T27b.

## e. Répartition par type d'agent

| Travail | Agent | Pourquoi |
|---|---|---|
| Code de l'extension, outils, essais, parités, rejeux (R, U, A, V, SK, E, D, G, H, K) | **Agent de code** par défaut, une branche par chantier depuis le tronc, fiche de passation | tâches cadrées, critère de sortie écrit |
| Relecture indépendante de tout ce qui touche la décision ou l'écriture (A, E, D, F, I, V-b) | **Relecteur indépendant**, séance courte, lit le diff et la liste par cut, ne code pas | second regard |
| Cadrage, portes de version, arbitrages | l'architecte, seulement aux portes | quota |
| **Agent externe**, **sur accord de Mic**, périmètre réduit : `tools/repointage.cjs` (lecteur de repointage), fixtures synthétiques, documentation d'outils ; C, `skip-ombre.cjs` seulement après validation sur des données réelles chez nous ; `tableau-bord.cjs` **pas délégué** (chemin critique) | branche dédiée `ext/<outil>`, **jamais le tronc**, outils hors ligne seulement, **aucun export ni lot** transmis (fixtures synthétiques du dépôt), aucun accès à `background.js`, `src/`, `engine.js` ; revue par l'agent de code puis fusion par nous | zéro risque d'écriture dans ESV et zéro fuite de données ; les vrais rejeux sur archives restent chez nous |

Ce qui ne sort jamais vers un agent externe : le service worker, les modules de décision, les parités, la garde elle-même, tout fichier des archives.

**Réponse à Mic sur la passation externe (est-ce que ça fait gagner du temps ?)** : gain réel seulement pour le lecteur de repointage et la documentation avec fixtures. Les autres outils ne se valident que sur des lots ou des exports réels (oracle de voie, tableau de bord, SK en ombre) et lisent les formats d'outils du dépôt : l'agent externe écrirait, nous validerions sur les vraies données, relirions et fusionnerions, pour un gain faible. Ne pas déléguer ce qui est sur le chemin critique (le tableau de bord sert V-a et T22). Si on délègue : dépôt réduit (outils, fixtures synthétiques, schéma JSON), pas le dépôt complet, qui contient les décisions avec numéros de parties et mesures ; on ne lui dit pas quelle copie il voit sans l'avoir décidé.

## f. Risques et parades

| Risque | Parade |
|---|---|
| Pose fausse écrite sans relecture humaine | garde A, G1 puis G2 avant toute écriture nouvelle, une nouveauté qui écrit à la fois, contrôle a posteriori § d.7 |
| Vitesse « gagnée » au banc mais perdue au terrain (le banc ne voit qu'un cinquième du cycle) | deux mesures distinctes (critère 6-i et 6-ii) ; comparaison terrain à partie et poste égaux ; `relecture-banc` avec latence réglée |
| Corriger le message (U-a) et croire la reconnexion réglée alors qu'un vrai défaut reste | critère de sortie T20a en vm **et** 3 F5 de suite au terrain ; (b) construit si le défaut reste |
| Chiffres de réglage pris pour des preuves ; fuite réglage → examen | tableau de bord par population ; partie d'examen ouverte une fois ; partie neuve de réserve nommée avant |
| Base test 18 jamais recalculée ; juge hors dépôt | T21 recalcule, scelle, nomme le commit ; tout chiffre antérieur dit « non scellé » |
| Décodage global qui renforce une voie fausse par des appuis autocorrélés | E avant D ; marge au second chemin ; une information comptée une fois |
| SKIP en ombre sans vérité (Mic n'a pas transmis d'exports) | SK livré en journal seul ; précision/rappel calculés quand des exports arrivent ; aucune conclusion avant |
| Disque 1,6 Go ; machine partagée | verrou `verify-garde`, un rejeu lourd à la fois, sorties au scratchpad, suppression après rejeu, `.jsonl` compressés |
| Quota hebdomadaire presque épuisé | § h ; arrêt d'une séance à 80 % de son budget avec fiche de passation ; aucun agent de recherche |
| Agent externe : fuite de données ou code non relu dans le tronc | branche `ext/`, fixtures seules, revue avant fusion ; jamais d'export |
| `engine.js` touché sans ré-épinglage | baseline contrôlée par `verify` ; I par contournement tant que Mic n'a pas tranché |
| Deux `DECISIONS.md` divergents (D-224 à D-238) | R en T20a, numérotation vérifiée, un seul fichier ensuite |
| La deuxième passe, allumée par défaut depuis la test 18, a peut-être déjà écrit pendant ~30 parties | question à Mic ; contrôle a posteriori (§ d.7) avant T25 et T27b ; base à deux colonnes |
| File sans arrêt de prudence : une anomalie se répète sans que personne le sache | registre persistant des écritures par partie ; alerte visible non bloquante par partie ; tableau des motifs de fin validé par Mic ; bilan qui sépare lot, passe, relecture ; premier essai à deux parties, Mic présent |
| Corriger l'interface sur le mauvais panneau (ancien ou nouveau) | question à Mic avant T20a |

## g. Décisions attendues de Mic, par ce qu'elles débloquent

| Débloque | Décision |
|---|---|
| **T20a** (tout de suite) | 1. Accord pour livrer une version interface avant la garde, sous parité (cahier § 2, 3 bis). 2. Liste des « petits détails d'interface ». 3. **Quel panneau utilises-tu, l'ancien ou le nouveau ?** 4. **La deuxième passe était-elle allumée pendant les ~30 parties des tests 18 et 19 ?** |
| **T20b** | 5. Validation de la maquette cliquable de l'accueil ; liste des actions fréquentes dont on compte les clics. |
| **T21a / B** | 6. Transmettre d'abord les fiches de départ (`banane3FichesDepart`), puis « Exporter tout » (tests 18 et 19) ; sans eux, pas de base terrain ni de mesure SKIP ; **et l'export de la partie à 95 différés** (hypothèse « réglage de caméra désactivé », SUPPOSÉE : on y cherche les raisons de différé par cut et le réglage actif au départ ; si elle se confirme, vérification en lecture seule au démarrage du lot, avec avertissement). 7. Autoriser les rejeux longs sur le disque plein (ou libérer de la place). 8. Statut de la 4:2 (examen consommé ou réserve), nommer une partie neuve d'examen en réserve, accepter le classement « terrain hors réglage » des ~30 parties. 9. Parcours de vitesse fixe (partie de réglage courte rejouée à chaque version) ou retrait du mot « permanent » ; méthode de la tolérance. |
| **T22 / V** | 10. Quelle relecture compte (fin de lot en ombre, « corriger », ou l'Écho) et quel temps visé ; quelle partie sert de référence au lot. |
| **T27a / T27b** | 11. **Si une partie s'arrête sur sa propre garde, on passe à la suivante en notant l'échec, ou on arrête tout ?** (validation du tableau des motifs de fin, module P). 12. Formule « les N parties suivantes de la liste d'ESV, dans son ordre ; une partie sans rouge compte comme faite » ; la passe des différés reste-t-elle allumée dans la file, ou seulement la relecture en ombre au début ? 13. Fournir le relevé en lecture seule du sélecteur de parties ; accepter, après la maquette, l'action « changement de partie ». |
| **T23 à T25** | 14. Contre-expertise des verts de chaîne : allumer pour mesure ou laisser coupée. 15. Ré-épinglage de `engine.js` pour la cible hors vue, ou contournement « déplacer la vue » (action ESV nouvelle : maquette puis accord). 16. Projet de rattachement de la partie 2 (manifeste). |
| **J** | 17. Deux séances d'environ 1 h de repointage. |
| **Passation** | 18. Accord et périmètre pour un agent externe (voir § e : gain réel seulement pour le repointage et la documentation ; dépôt réduit si on délègue). |
| **Ordre** | 19. Valider l'ordre révisé du 23/10 (§ b) ; T23 et T24 reportés. |
| **K** | 20. Seuil d'autonomie après la mesure de base ; fusion dans `main`, étiquette, publication. |


Les plus bloquantes : 1 (version interface sous parité), 3 (panneau visé), 4 (deuxième passe allumée ?), 6 (exports), 10 (définition de la relecture visée) ; pour la file, 11.

## h. Budget de quota prudent

Unité : une séance = une session d'agent bornée ; « appels » = appels d'outils, plafond à ne pas dépasser (arrêt à 80 % avec passation). Cette semaine, quota presque épuisé : rien d'autre que la préparation de T20 si de la marge reste, sinon rien.

| Phase | Agent de code | Relecteur indépendant | Architecte |
|---|---|---|---|
| R + T20a | 2 séances, ≤ 120 appels (R comprend maintenant la fusion de la test 19 et le rapatriement de la maquette) | 1 courte, ≤ 25 | porte : ≤ 15 |
| T20b (refonte de l'accueil) | à chiffrer à la validation de la maquette | 1 courte, à chiffrer | porte, à chiffrer |
| T21a + T21b (A, bases, V-a, SK, H) | 3 séances, ≤ 200 au total (rejeux en arrière-plan, un à la fois) ; T21a d'abord, répartition fixée au cadrage | 1, ≤ 30 | ≤ 15 |
| T22 (V-b) | 2 à 3 séances, ≤ 180 | 1, ≤ 30 | ≤ 15 |
| C ∥ G1 ∥ H | 2 séances, ≤ 120 | — | — |
| T23 (E) | 2 séances, ≤ 120 | 1, ≤ 40 | ≤ 15 |
| T24a + T24b (D) | 4 séances, ≤ 300 au total | 2, ≤ 80 | ≤ 20 |
| T25 (F ou I) | 2 séances, ≤ 120 | 1, ≤ 40 | ≤ 15 |
| T26 + K | 3 séances, ≤ 180 | 1, ≤ 30 | ≤ 20 |
| **T27a + T27b (file de parties)** | **≈ 3 à 4 séances, ≤ 300 appels** | **2, plafond à fixer** | porte, à chiffrer |
| **Total hors refonte de l'accueil** | **≈ 23 à 24 séances, ≤ 1 640 appels avant marge (1 340 + 300) ; avec 30 % de marge pour les reprises : ≈ 2 130** | **≈ 8 courtes, ≤ 275, plus les 2 de T27** | **≤ 115 sur les lignes chiffrées (l'affichage précédent de 130 était un arrondi trop large), plus les portes T20b et T27** |

L'unité « appels d'outils » n'a pas de lien direct avec le quota réel (jetons) : elle ordonne les tâches, elle ne prédit pas la consommation. T20a est la première séance à lancer dès que le quota le permet.

Règles : jamais deux séances lourdes en parallèle ; pas d'agent de recherche, pas de recherche web ; une séance qui lit un export ne lit que les événements dont elle a besoin (jamais le fichier entier dans le contexte).

---

## Ajout du 23/10 : Orbite en file de parties (module P, versions T27a et T27b, D-244, D-245)

- **Objet** : bouton d'enchaînement des parties dans Orbite (éteint par défaut). Mic renseigne le nombre N : **les N parties suivantes de la liste d'ESV, dans son ordre ; une partie sans rouge compte comme faite** (à confirmer par Mic). Une partie finie → noter les données de départ de la suivante → poser → ainsi de suite.
- **Ce que la page d'ESV offre : SUPPOSÉ.** Lu dans une page enregistrée (aucune capture ni code d'ESV dans les dépôts) : un sélecteur de parties dont chaque entrée est un lien (`…&p=N`) et un événement `newPart` dont le gestionnaire appelle `loadCut` (sens des arguments supposé). On ne sait pas si changer de partie recharge la page (alors `chargementEsvPret` impose de 2,5 s à 60 s et la reconnexion de T20a est un prérequis) ou se fait sur place (alors `pageId` ne change pas et l'adaptateur garderait un contexte périmé). **Un relevé en lecture seule du sélecteur de parties** (comme `releveOn('empreinte')`) est ajouté à T20a pour que Mic le fournisse avant T27, et **la maquette modélise les deux variantes**.
- **Module P** (`src/file-parties.js`, pur, sans DOM : liste des parties, partie courante, tableau des motifs, bilan ; `background.js` : transition « partie suivante », action `file-parties-demarrer/arreter`, état persistant dans `chrome.storage.local`, reprise après redémarrage du service worker) ; panneau : bouton, liste des parties, bilan par partie. Données de départ par le chemin existant (`fichesDepart`, `batch-started`). **Registre persistant des écritures par partie** : numéros de cuts posés par le lot, écrits par la passe, corrigés par la relecture (avant/après en mm), validés ; quelques Ko, jamais vidé par « vider le cache » ; affiché dans le bilan de file, qui sépare les trois origines (les trois écrivent ; les corrections de la relecture sont une écriture non surveillée). **Alerte visible non bloquante par partie** (bannière, pastille) quand un indicateur sort de sa zone (part de différés, part de cuts corrigés, nombre de refus) : elle n'arrête rien.
- **Diagramme d'états** (à figer avant tout code ; passe et relecture jamais ensemble, D-238) :

```
FILE_OFF --démarrer(N)--> LOT(partie k)
LOT --fin normale--> PASSE des différés (si allumée) --fin--> RELECTURE / CORRECTION (si activée) --fin--> CHANGEMENT DE PARTIE
(passe ou relecture éteinte : on passe à l'état suivant)
CHANGEMENT --partie suivante prête, borne 60 s--> LOT(partie k+1) ;  k = N --> FIN (bilan)
tout état --bouton Arrêter--> ARRÊT (bilan)
LOT / PASSE / RELECTURE --motif de fin--> selon le tableau ci-dessous : « continue » = état suivant ; « s'arrête » = ARRÊT avec motif
CHANGEMENT --pas abouti en 60 s, onglet fermé, ESV muet--> ARRÊT (impossible de continuer)
redémarrage du service worker : (file, k, N, phase) relus dans chrome.storage.local ; le registre est consulté avant toute reprise (à préciser avant le code)
```

- **Tableau des motifs de fin (à faire valider par Mic ; D-245 reste la décision, ce tableau ne la change pas)** :

| Motif | File | Statut |
|---|---|---|
| Fin normale du lot | continue (passe, relecture si activées, puis changement de partie) | cas normal |
| Bouton « Arrêter » | s'arrête | décision de Mic |
| Nombre de parties atteint | s'arrête (fin normale) | décision de Mic |
| Changement de partie qui n'aboutit pas (borne 60 s), onglet fermé, ESV muet | s'arrête, alerte et bilan | D-245 (continuer impossible) |
| `partie-sans-rouge` (lot) | proposé : la partie compte comme faite, la file continue | **à valider par Mic** |
| `depart-sur-vert` (lot) | à décider | **Mic** |
| Refus ou anomalie propre au lot | à décider | **Mic** (D-245 cite « lot qui s'arrête sur un refus » parmi les cas impossibles) |
| Passe arrêtée (premier refus, première anomalie) | à décider | **Mic** |
| Relecture arrêtée (plafond, `relecture-adaptateur-bloque`) | à décider | **Mic** |

  Question : si une partie s'arrête sur sa propre garde, on passe à la suivante en notant l'échec, ou on arrête tout ?
- **Dépendances** : T20a (reconnexion, équipement après rechargement, relevé du sélecteur), G avec scénario de changement de partie (deux variantes) et pannes, tableau des motifs validé, registre d'écritures, relecture indépendante, décision de Mic sur la nouvelle action ESV. **La garde A n'est pas un prérequis** (le changement de partie ne touche aucun module de décision, la parité vaut garde) ; elle reste exigée pour tout ce qui change la décision. T27a (relecture éteinte) puis T27b (relecture et correction dans la file) ; premier essai de terrain à deux parties au plus, Mic présent.
- **Règles d'arrêt (D-245)** : aucun arrêt de prudence, seulement le bouton d'arrêt ; s'arrêtent d'eux-mêmes les seuls cas où continuer est impossible, avec alerte visible et bilan écrit (voir le tableau). **Jamais de SKIP ; jamais de validation d'un cut non résolu ; les validations de la passe et de la relecture suivent leurs gardes existantes (D-241).** La règle « arrêt à la première anomalie » de D-244 est remplacée par D-245.
- **Interface** : maquette cliquable de l'accueil validée par Mic avant le code (T20b) : connexion, partie en cours, avancement « partie 2 sur 5 », bouton Enchaîner, bouton Arrêter, relecture et correction activables, historique des parties, alerte par partie.
- **Critère de sortie T27** : voir les lignes T27a et T27b du § c ; **0 commande ESV hors : lot, passe, relecture (si activée), changement de partie**, compteur par catégorie.
- **Effort** : M à L (service worker, maquette, panneau). Risque principal : une erreur répétée sur plusieurs parties sans personne ; parades : registre persistant, alerte visible non bloquante, bilan par origine d'écriture, tableau des motifs validé, bouton d'arrêt (aucune n'arrête la file d'elle-même).


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
| « Vérifier si le refus `ADAPTER_BUSY` persiste » : le code répond déjà | `occupeAttentesMs` = 6 essais, 11,75 s ; la 3:0 a eu 7 demandes | écrit dans le chantier 9 : plafond identique, cause non revérifiée en test 18 (relecture indépendante, D-246) ; correction = attendre l'état de l'adaptateur, avec borne haute |
| Parité : `tools/parite-relecture-sw.cjs` ignoré | existe sur le tronc | ajouté au § 2, 3 bis, obligatoire si la relecture est touchée |
| « Maquette ESV dans `verify` » impossible telle quelle | la maquette est sous Playwright (`relecture-banc.cjs`) ; `verify` limite chaque essai à 20 s | deux étages : G1 vm dans `verify`, G2 Playwright avant paquet |
| Référence « D-1xx » non résolue dans § 6 bis | texte | note explicite « à retrouver lors de la fusion » |
| Chantiers 2 et 10 sans critère de sortie ; § 7 sans règle générale | texte | critères ajoutés ; règle : une version sans critère de sortie écrit n'est pas planifiée |
| § 8 oubliait les décisions nouvelles (exports, relecture visée, partie de réserve, agent externe) | texte | § 8 complété, renvoi au § g |

Point d'origine corrigé par la relecture indépendante (D-246) : l'auto-audit affirmait qu'aucune écriture n'avait eu lieu. C'est inexact : la deuxième passe est allumée par défaut depuis la test 18 (D-237, D-238) et Mic a joué une trentaine de parties ; elle a peut-être déjà écrit. Le protocole de première écriture est remplacé par un contrôle a posteriori (§ d.7) ; question à Mic : était-elle allumée pendant ces parties ?

## Relecture indépendante du 23/10 (D-246) : corrections appliquées

| Constats | Correction |
|---|---|
| F-01 à F-03 | passe allumée par défaut ; contrôle a posteriori ; base à deux colonnes, garde sur « sans passe » ; écart de recalcul présenté à Mic comme un recul |
| F-04, F-05 | chantier 9 et T22 : diagnostic par la mesure par phase d'abord ; `attenteEcritureMs` plafond de boucle, `attenteVuMs` une fois, `pasMax` distance ; plafond ADAPTER_BUSY identique, cause non revérifiée, borne haute et arrêt avec motif |
| F-06 à F-08 | exigence de puissance ; ~30 parties « terrain hors réglage », 4:2 nommée ; parcours de vitesse fixe ; méthode de tolérance |
| F-09 | formule de D-241 reprise partout |
| F-10 à F-12, F-22 | historique depuis `fichesDepart` + fiche de fin de lot ; deux états ; T20a / T20b avec critères ; question du panneau ; export : fiches de départ d'abord |
| F-13 à F-20 | arrêt de prudence supprimé ; D-239 à D-245 ; tableau des motifs ; changement de partie en hypothèse et deux variantes ; borne 60 s ; diagramme d'états ; registre ; alerte non bloquante ; critère T27 par catégorie ; N parties suivantes |
| F-21, F-23 | partie à 95 différés ; réponse sur la passation externe |
| F-24 à F-29 | correspondance chantier / module / version ; maquette rapatriée ; test 19 fusionnée ; T21, T24, T27 scindés ; « garde verte » retirée des prérequis de la file ; budget avec T27 et 30 % de marge |
| F-30, F-31 | hypothèses étiquetées SUPPOSÉES ; « déplacer la vue » soumis à la règle de la maquette et de l'accord de Mic |
| Priorisation | ordre révisé du 23/10 (proposition que Mic valide) à côté de l'ordre initial |

Aucune décision de Mic (D-239 à D-245) n'est modifiée ; les questions ajoutées sont au § g.

Rappel de l'auto-audit du 22/10 (déjà dans le cahier) : base non recalculée → à sceller par le juge versé ; garde par cut ; parité à chaque changement du service worker ; définition calculable de l'autonomie ; partie d'examen ouverte une fois ; report sur le tronc et `DECISIONS.md` unique.
