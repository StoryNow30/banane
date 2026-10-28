# Architecture du développement restant de la 5.0 (révisée le 23 octobre 2026)

Remplace la fiche du 22/10 ; corrigée le 23/10 par la relecture indépendante (D-246), puis par la troisième relecture indépendante (D-248, dernière section). Cadre le reste du chemin autour de `BANANE_5.0_CAHIER_V2.md` et des décisions D-239 à D-247. Lecture seule du code au moment de l'écriture : rien n'est lancé, rien n'est modifié dans le code. Tronc de code : `claude/50-test17` (test 18, 4.9.5.18) plus `claude/50-echo-ack` (test 19, 4.9.5.19, un seul commit : acquittement de l'export Écho ; à fusionner dans R). Cette fiche, le cahier v2 et D-239 à D-248 sont écrits sur `claude/execute-prompt-00-18ra5a` et doivent être reportés sur le tronc au premier chantier. Aucune donnée de partie, aucun code de projet, aucun identifiant de modèle.

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
   ├─ chrome.tabs.onUpdated → echoReprise (Écho seul, en pause avec page perdue) ; le lot n'est repris qu'au clic « Reprendre » (reprendreLot → retablirApresRechargement), pas par onUpdated
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
| R | Report sur le tronc | tronc | **séance à part, sans paquet terrain (ordre version 2)** ; cahier v2, cette fiche, D-239 à D-248 ; `DECISIONS.md` redevient un seul fichier (D-224 à D-238 sont sur deux branches) ; **fusion de `claude/50-echo-ack` (test 19, un commit)** faute de quoi T20a part du code que l'opérateur n'utilise plus ; **rapatriement de la maquette ESV** (`claude/esv-locale-audit`, non ancêtre du tronc, extraite hors dépôt par `relecture-banc.cjs`) sur le tronc ou en sous-dossier versionné |
| A | **Garde de non-régression GCV2** | `tools/garde-gcv2.cjs`, `tools/juger.cjs` (porté), `datasets/garde-gcv2/` | voir a.3 |
| B | **Tableau de bord** | `tools/tableau-bord.cjs` → `fiches/TABLEAU_BORD.md` + `datasets/tableau-bord/<version>.json` | voir a.4 ; livré en deux temps : B-min (famille sans Écho, comptage `passe-differes-ecriture-*`, temps par cut) dans T21a, B complet (avec Écho, autonomie) ensuite |
| V | **Vitesse** | V-a mesure (`perf-lot.cjs` existant, `datasets/vitesse/`) ; V-b relecture ; V-c lot | voir a.5 ; V-b et V-c changent `background.js` (attentes), jamais la décision |
| U | **Interface D-243 / D-245** : T20a (message, reconnexion, bouton, historique) puis T20b (refonte de l'accueil après maquette) | `panel.js`, `src/ui5*.js`, `background.js` (action `reconnect` → `equiperOnglet(selectedTab)`, `onUpdated` hors Écho, lot, passe, relecture, `repriseEnCours` et `retourCutEnCours`, équipements sérialisés par onglet ; **`connection.status` mis à jour à chaque `equiperOnglet` réussi (`ready`) et à chaque perte de page (`unavailable`)**, pas seulement par `pollCurrent` et `connect`) | aucune commande ESV (l'injection `equiperOnglet`, deux `executeScript`, compte comme 0 commande mais pas comme 0 effet sur la page, et respecte le contrôle « Une autre Ariane » sans effet de bord) ; deux états : « équipé » et « prêt » ; l'historique lit `banane3FichesDepart` (persistant) plus une fiche de fin de lot (posés, différés, écrits par la passe, durée, motif d'arrêt) dans une clé persistante à part, pas les événements du cache (vidables) ; panneau visé : le nouveau (D-247) ; panneau par défaut à la livraison : décision de l'opérateur (D-237) |
| SK | **Cuts à SKIP, ombre seule** | module non importé par la chaîne de décision tant que la garde n'est pas livrée (`src/regles-metier.js` ou voisin) ; événement `skip-ombre` ; `tools/skip-ombre.cjs` | entrée : nombre de points et scanners déjà lus pour le cut ; sortie : journal seulement ; l'outil hors ligne compare aux SKIP de l'opérateur dans les exports (précision, rappel) |
| C | Diagnostic « oracle » de la voie | `tools/voie-oracle.cjs` (hors ligne) | par bloc d'ADV : la bonne paire est-elle parmi les candidats à 5 / 10 / 20 mm ; parts « candidat manquant », « mal classé », « appui contaminé » |
| E | Provenance des appuis (M2) | `src/lot-decision.js`, `src/gcv2-l1.js` | classe par appui `{humain, chaine, l1, passe}` ; pose L1 et pose de la passe jamais appui ; verts de chaîne non contrôlés = appuis faibles en ADV |
| D | Décodage global de la voie | `src/voie-decodage.js` (pur, sans DOM), appelé par la passe (T24a) puis par le lot en ADV (T24b) | états = paires candidates, émissions = preuves du nuage, transitions = continuité ; **abstention** si la marge au second chemin est faible ; jamais de pose sans preuve des deux rails |
| G | Maquette ESV | G1 : ESV simulé en vm étendu en campagne de pannes, dans `verify` (rejeu court) ; G2 : maquette Playwright de `relecture-banc.cjs`, complète avant tout paquet qui écrit | pannes : worker arrêté en pleine capture / pose / validation / écriture de la passe, F5, 500 puis 204, 502, nuage vide, onglet caché, cible hors vue ; **scénario de changement de partie en deux variantes** (rechargement de la page ; changement sur place, hypothèses de la page d'ESV non établies, ch. P) ; **étape explicite entre T21a et T27a**, à partir du relevé du sélecteur fourni par l'opérateur |
| H | Preuve serveur (F4) | `background.js` autour de `applied-verified`, lecture seule d'abord | `serverConfirmed` faux sur le lot de la partie 4:2 : **67/68 sur les champs de validation** (68/68 sur `applied-verified`, constant à faux par construction), **écritures de validation 68/68 observées en 204** et retrouvées dans la liste d'ESV ; cause ÉTABLIE : instrumentation, la preuve d'écriture n'est jamais rattachée au cut dans le lot (`fiches/H_PREUVE_SERVEUR.md`, diagnostic en lecture seule fait) ; une écriture se prouve par l'écriture 2xx observée et/ou la liste d'ESV, jamais par `serverConfirmed` (outils de T21a : `tools/controle-passe.cjs`, `tools/tableau-bord.cjs`) ; correctif de l'extension (rattacher la preuve au cut) : étape suivante, avant T27a, donc avant que la passe soit contrôlée par la preuve serveur |
| F | Contre-expertise des verts de chaîne | déjà codée (leviers `contreChaine*`) ; câblage si l'opérateur l'allume | gain net (verts rendus justes − dégradés) sur la base et la 3:0 |
| I | Deuxième passe : cible hors de la vue | `engine.js` (ré-épinglage) ou contournement « déplacer la vue » hors moteur (**action ESV nouvelle : règle de la maquette puis de l'accord de l'opérateur**, comme pour la file) | poses écrites / poses décidées sur lots de terrain |
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
Retour  : 0 vert · 1 recul de qualité (critères 1 à 5 : colonne « sans passe » ; colonne « avec passe » : bloque aussi sur les critères de qualité, pose à plus de 20 mm, mauvaise voie, verts changés, pose sans preuve, cuts dégradés de plus de 2 mm, car la passe écrit en production ; seul le compte de cuts sans pose « avec passe », le majorant, est signalé sans bloquer) · 2 recul de vitesse banc seul (critère 6-i, > 10 %)
          3 garde non rendue (base non scellée, commit absent, lot manquant) · 4 erreur d'outil.
Règle   : tout écart entre le rapport de l'intégrateur et le recalcul est présenté à l'opérateur comme un recul avant de devenir la base.
          1 ou 2 → pas de paquet sans décision écrite de l'opérateur avec le compromis chiffré ; 3 → pas de paquet du tout.
          Un changement hors module de décision : « garde sans objet, parité 0 écart » écrit dans le paquet (cahier § 2, 3 bis).
```

Essai rouge d'abord : `tests/garde-gcv2.test.cjs` sur une fixture synthétique (un cut perdu → retour 1 ; un lot plus lent de 20 % → retour 2 ; base sans commit → retour 3 ; une pose « avec passe » à plus de 20 mm → retour 1).

### a.4 Schéma du tableau de bord (B), un fichier par version

```
{ version, commit, date, population: 'reglage' | 'examen' | 'terrain',
  exports: [{ sha256, partie, lotId, cuts }],                       // jamais de coordonnées ni de code de projet
  sansEcho: { sansPose: {n, N, p, wilson95}, differes: {...}, passeEcrits: {n, source},
              vitesseLot: {cycleMedMs, p90Ms, captureMedMs, analyseMedMs, poste},
              relecture: {mode, cutsRelus, dureeMs, msParCut, corriges, arrets},
              skipOmbre: {detectes, skipMic, precision, rappel} },
  avecEcho: { precision: {medMm, p5, p10, pires: [{cut, mm}]},
              budgets: {mauvaiseVoie: {n, N, wilson95}, plus50: {...}, sansPreuve: n},
              autonomie: {sansRetouche, N, p, wilson95, tempsNetEstimeMin} } }
```

`avecEcho` reste `null` tant qu'aucun Écho complet n'est joint à la partie ; le markdown le dit en clair. `population: 'terrain'` désigne la 4:2 (avec Écho) et les ~30 parties ; `sansPose` et `differes` retranchent les cuts écrits par la passe, comptés dans `passeEcrits` (l'état du lot les garde « différés », D-238) ; `source` dit si le compte vient du registre, des événements ou s'il manque.

### a.5 Schéma de la base de vitesse (V)

- `datasets/vitesse/base-banc-test19.json` : `{ commit, version, machine: {cpus, node}, lots: [{lotId, cuts, analyseMedMs, analyseP90Ms, decisionMedMs, passeMedMs}] }`, scellé. C'est la mesure qui entre dans la garde (critère 6-i).
- `datasets/vitesse/terrain.json` : une ligne par `{partie, poste, version, cuts, cycleMedMs, p90Ms, captureMedMs, relectureMode, relectureMsParCut}` ; comparaison seulement à partie et poste égaux ; sinon « non contrôlé ». Alimenté par V-a à chaque export reçu.

## b. Dépendances et ordre

```
R report ──► tout (une seule lignée de décisions)
U interface : indépendant de la décision ──► livrable en premier (parité vaut garde)
A garde ──► tout paquet qui touche la décision (E, D, F, I, J) ; la file de parties : garde minimale livrée (T21a) avant T27a (condition de l'opérateur, D-244, maintenue par l'ordre révisé, D-247), sans être un prérequis technique (le changement de partie ne touche aucun module de décision)
P file ◄── T20a, T21a (garde minimale, B-min, contrôle a posteriori de la passe, H en diagnostic), G (scénario de changement de partie), tableau des motifs d'arrêt validé, registre d'écritures, accord de principe de l'opérateur sur la nouvelle action (confirmé après relevé et maquette)
P (T27b) ◄── T22 livré ; mesure d'erreur ou règle sur les corrections de la relecture
V-a mesure ──► B (famille sansEcho) et base de vitesse ; V-b relecture (attentes) ──► V-c lot
B tableau ──► seuil d'autonomie (décision de l'opérateur) ; a besoin des Échos 3:1 et 4:2 pour avecEcho
SK ombre : indépendant, lecture seule, tôt
C oracle (hors ligne) ──► D seulement si « mal classé » > « candidat manquant »
E provenance ──► D (appuis typés = observations fortes/faibles du décodage)
G1 pannes dans verify ──► toute nouvelle écriture (D en écriture, F, I) ; G2 complète avant chaque paquet qui écrit
H preuve serveur : lecture seule, diagnostic dans T21a, avant T27a ──► lecture fiable des lots de terrain
J précision : indépendant, démarre quand l'opérateur repointe
K : à la fin
```

En parallèle sans risque : C, SK (outil hors ligne), B, V-a, H, G1 sont des outils hors ligne ou lecture seule ; ils avancent pendant que U puis A sont construits. Jamais deux rejeux lourds en même temps (disque 1,6 Go ; verrou `verify-garde`).

**Ordre initial de l'architecte** (gardé visible) : **R + U** → **A + V-a + SK** → **V-b + B** → **C ∥ G1 ∥ H** → **E** → **D** → **F ou I (sur décision)** → **V-c + J** → **K**, avec la file (T27) après T25.

**Ordre révisé du 23/10, version 2** (version 1 : proposition de la relecture indépendante, acceptée par l'opérateur, D-247 ; version 2 : corrigée par la troisième relecture, D-248, à faire confirmer par l'opérateur) : **(0) exports de l'opérateur** (fiches de départ, puis « Exporter tout », plus la partie à 95 différés) **avant toute installation** ; installer par-dessus, dans le même dossier ; en parallèle, maquette cliquable de l'accueil ; **(1) R seul** (fusion de la test 19, `DECISIONS.md` unique, maquette rapatriée), sans paquet terrain ; **(2) T20a** (message avec statut tenu à jour, reconnexion, bouton, historique, relevé du sélecteur), puis **T21a** (garde minimale bloquante aussi sur la qualité « avec passe », mesure par phase V-a, B-min, **contrôle a posteriori de la passe**, **H en diagnostic**), sans attendre le retour de terrain de T20a tant que T21a ne livre aucun code d'extension installé (sinon la règle du § 7 s'applique : retour analysé avant la version suivante) ; **(3) G** (scénario de changement de partie en deux variantes, à partir du relevé fourni par l'opérateur) ; **(4) T27a** (file, relecture éteinte, passe allumée), premier essai à 2 parties avec l'opérateur présent, **T22 en parallèle** (séances distinctes : jamais deux séances lourdes en même temps ; T22 précède T27b parce que T22 et T27b touchent tous deux la relecture) ; **(5) T27b**, seulement après la mesure ou la règle sur les corrections de la relecture ; **(6) T20b** (après maquette validée ; il peut passer avant T27a si elle est validée plus tôt, car il ne touche aucune décision), puis SK (T21b), tableau de bord complet, provenance des appuis (E), décodage de voie (D), F ou I, puis V-c + J et K. **T23 et T24 sont reportés tant que le tableau de bord ne montre pas un besoin chiffré.** Le contrôle a posteriori de ce que la passe a écrit (§ d.7), G et H précèdent T27a (et T25, T27b).

### Correspondance chantiers du cahier (1 à 12) / modules / versions

| Chantier du cahier § 6 | Module | Version |
|---|---|---|
| 1 Garde | A | T21a |
| 2 Tableau de bord | B | B-min en T21a, B complet ensuite |
| 3 SK | SK | T21b |
| 4 Voie | C, D | T24a, T24b |
| 5 Provenance, contre-expertise | E, F | T23, T25 |
| 6 Maquette, preuve serveur | G, H | G entre T21a et T27a ; H diagnostic en T21a |
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
| **R** (séance, pas une version de test) | fusion de la test 19, `DECISIONS.md` unique, maquette ESV rapatriée sur le tronc ou figée en sous-dossier versionné | `verify` 0 échec 0 annulé sur le tronc fusionné ; parités 0 écart ; numérotation de `DECISIONS.md` vérifiée, un seul fichier ; maquette lançable depuis le dépôt ; aucun paquet terrain |
| **T20a** | U sans refonte, **à partir du tronc que R a rendu propre (R est une séance à part, sans paquet terrain)** ; **exports de l'opérateur faits avant l'installation, installation par-dessus dans le même dossier** ; message fondé sur `connection.status` **mis à jour à chaque ré-équipement et à chaque perte de page**, reconnexion après F5, bouton « Reconnecter », historique (fiches de départ + fiche de fin de lot) ; relevé en lecture seule du sélecteur de parties (pour T27) | essai vm : après rechargement, « équipé » en < 2 s après `complete` et **0 commande ESV** ; « prêt » borné par `delaiMaxMs` (60 s), mesuré au terrain ; message seulement si `status === 'unavailable'`, statut tenu à jour (essai vm : F5 pendant Écho, puis reprise, le message disparaît) ; équipements sérialisés par onglet (essai : `complete` simultané d'Écho et du nouveau gestionnaire, une seule injection) ; historique complet après un vidage du cache ; `parite-l1se-sw --passe` et `parite-relecture-sw` 0 écart ; verify 0 échec 0 annulé ; terrain : 3 F5 de suite sans repasser par le menu |
| **T20b** | refonte de l'accueil, **après maquette cliquable validée par l'opérateur** | inventaire avant/après des données et exports atteignables ; test automatique « aucun bouton d'export perdu » ; nombre de clics des actions fréquentes (liste fixée avec l'opérateur) mesuré avant/après, jamais plus qu'avant ; parité 0 écart |
| **T21a** | A minimale : juge versé, base qualité recalculée et scellée **à deux colonnes (sans passe / avec passe)**, base vitesse banc (test 19) + V-a (mesure par phase ; comparaison appariée 4.9.0.8 contre 5.0 sur la maquette à latence réglée, après vérification que la 4.9.0.8 y tourne ; au terrain, seule la relecture en ombre d'une partie déjà validée est rejouable, SUPPOSÉ) + B-min + **contrôle a posteriori de la passe** + **H en diagnostic (lecture seule)** | `garde-gcv2` retour 0 sur le code T21a, bloquant sur « sans passe » **et sur les critères de qualité « avec passe »** ; contrôle de la passe : liste des cuts écrits par la passe, échantillon d'au moins 60 cuts revu par l'opérateur dans un Écho ciblé, seuil 0 mauvaise voie et 0 pose à plus de 20 mm (cahier § 6 ch. 7), ou « non fait » dit en clair ; H : cause de `serverConfirmed` faux écrite, ou « indéterminée » dite ; B-min produit ; base avec commit et SHA ; essai rouge vert ; écart de recalcul présenté à l'opérateur ; mesure par phase écrite |
| **T21b** | SK en ombre (module non importé par la chaîne de décision) ; H : diagnostic déjà fait en T21a | `skip-ombre` : précision et rappel chiffrés sur ≥ 3 parties avec SKIP de l'opérateur, 0 commande ESV (parité) |
| **G** (étape, pas une version installée) | G1 : pannes dans `verify` ; **scénario de changement de partie, deux variantes**, à partir du relevé du sélecteur fourni par l'opérateur (livré par T20a) ; G2 complète | G1 vert dans `verify` (20 s par essai, jamais allongé) ; scénario rejoué dans les deux variantes avec panne de page injectée au changement ; maquette conforme au relevé réel, ou écart dit |
| **T22** | V-b relecture, **seulement après V-a**, en parallèle de T27a (séances distinctes), **avant T27b** : attendre l'état de l'adaptateur au lieu des 6 essais fixes, **avec borne haute** et événement `relecture-adaptateur-bloque` (arrêt avec motif) ; autres attentes selon la mesure | `parite-relecture-sw` 0 écart de décision (durées neutralisées) ; `relecture-banc` : 0 arrêt `ADAPTER_BUSY` sur 7 refus simulés, et arrêt avec motif sur une action réellement bloquée ; terrain : relecture ombre ≤ 1,8 s par cut sur ≥ 100 cuts relus ; garde retour 0 |
| **T23** | E provenance des appuis (décision), reporté tant que le tableau de bord ne montre pas un besoin chiffré | garde 0 ; sur la 3:0 les 4 verts de chaîne faux ne se propagent plus (cuts listés) ; parité `--passe` 0 écart ; relecture indépendante |
| **T24a** | D décodage de voie appelé par la passe seulement, après C et G1 (reporté comme T23) | garde 0 ; mauvaise voie 0 sur la base ; cuts gagnés et abstentions listés ; G2 complète rejouée ; relecture indépendante |
| **T24b** | D appelé aussi par le lot en ADV | mêmes critères, rejoués sur le lot |
| **T25** | F **ou** I, sur décision de l'opérateur (jamais les deux) | F : gain net ≥ 0 vert, garde 0 ; I : poses écrites / décidées ≥ 0,9 sur un lot de terrain ; contrôle a posteriori fait avant (§ d.7) |
| **T26** | V-c lot, J si repointage fait | lot ≤ 2,44 s médiane sur ≥ 300 cuts ; au banc, pas plus lent (critère 6-i) ; au terrain, valeur au tableau de bord et écart écrit, à partie et poste égaux, sans garde (D-247) ; J : plafond de bruit écrit |
| **T27a** | P : file de parties, **relecture éteinte, passe allumée (D-247)**, après T21a, le contrôle a posteriori de la passe, G et H | prérequis faits ; maquette : file de 3 parties avec panne de page injectée au changement, arrêt propre et reprise, les deux variantes de changement de partie ; **lot arrêté sur une pose non validée (`reconcileRequired`) : la file s'arrête avec alerte, ni passe ni partie suivante démarrées** ; terrain : 2 parties enchaînées sans intervention, l'opérateur présent, bilan par partie et registre d'écritures remplis ; **0 commande ESV hors : lot, passe, relecture (si activée), changement de partie**, compteur par catégorie |
| **T27b** | P : relecture et correction dans la file | T22 livré ; **contrôle des corrections de la relecture fait (registre avant/après, échantillon revu par l'opérateur, seuil écrit) ou règle écrite par l'opérateur** ; couverture des cuts de la passe par la relecture établie ; mêmes critères, corrections inscrites au registre, première file de 2 parties avec l'opérateur présent |
| **5.0** | K | cahier v2 § 7 « 5.0 stable » |

Chaque version a sa fiche `fiches/PASSATION_T<nn>.md`, sa consigne terrain, et le retour de terrain analysé avant la suivante.

## d. Stratégie de tests et de preuves

1. **Essais rouges d'abord** : chaque module naît avec un essai qui échoue (fixture synthétique, jamais une partie), puis passe. `verify` : 0 échec, 0 annulé, délai 20 s jamais allongé.
2. **Maquette ESV à deux étages** : G1 (vm, dans `verify`) pour les pannes et la non-écriture (compteur de commandes à 0 pour U, SK, V) ; G2 (Playwright) avant tout paquet qui écrit. Aucune nouveauté qui écrit sans G1 vert.
3. **Parité extension / banc** à chaque changement du service worker : `parite-l1se-sw` (`--passe` si la passe est touchée), `parite-relecture-sw` si la relecture est touchée. 0 écart ou le paquet n'est pas livré.
4. **Garde A** pour tout ce qui touche la décision ; liste par cut jointe au paquet ; retour 1 ou 2 = décision écrite de l'opérateur.
5. **Relecture indépendante** (autre agent, le plus capable) de tout code qui touche la décision d'un cut ou l'écriture dans ESV ; sa fiche de relecture est jointe au paquet.
6. **Étanchéité réglage / examen** : tout réglage (leviers, seuils, attentes) se fait sur la population de réglage ; une partie d'examen s'ouvre une fois, modèle gelé avant (commit nommé), puis passe en apprentissage par décision écrite. Les mesures de vitesse se font sur des parties de réglage ou sur des exports de terrain, jamais en rouvrant une partie d'examen. **Vitesse (défaut D-247)** : « permanent » au banc seulement ; au terrain, tableau de bord sans garde. **Parcours de vitesse fixe** (option non retenue par défaut) : une partie de réglage courte rejouée à chaque version de test, 5 à 10 minutes, export joint ; **hypothèse cachée : une partie de réglage est déjà validée et un lot y trouverait `partie-sans-rouge` (SUPPOSÉ : ESV ne permet peut-être pas de la remettre à zéro) ; seule la relecture en ombre y est alors rejouable** ; la comparaison appariée se fait sur `relecture-banc` à latence réglée (G2), après vérification que la 4.9.0.8 y tourne. Tolérance au banc : 3 répétitions et plus petite valeur, ou rapport avec la base rejouée dans la même séance. Les ~30 parties de terrain des tests 18 et 19 sont « terrain hors réglage » (interdites au réglage, valables pour la famille sans Écho) ; la 4:2 : « terrain hors réglage », avec Écho, utilisable pour les deux familles, jamais pour régler ; ce n'est pas une partie d'examen (défaut D-247, à revoir si l'opérateur le demande).
7. **Contrôle a posteriori de la deuxième passe** (remplace le protocole de « première écriture réelle » : la passe était allumée pendant les ~30 parties des tests 18 et 19, l'opérateur l'a confirmé (D-247), et reste allumée dans la file ; elle a écrit en production sans problème signalé, mais sans mesure) : (1) liste des cuts écrits par la passe, tirée des exports (`passe-differes-ecriture-*`, relecture à 1 mm, preuve de validation par cut), nombre par partie ; (2) échantillon d'au moins 60 cuts (zéro erreur observée : borne haute de Wilson à 95 % d'environ 6 %, à recalculer par l'outil du tableau de bord) revu par l'opérateur dans un Écho ciblé ; (3) seuil : 0 mauvaise voie et 0 pose à plus de 20 mm, sinon décision écrite de l'opérateur ; (4) si les événements manquent (cache vidé) ou si moins de 60 cuts sont disponibles, le dire : jamais « contrôle fait » sans effectif ni preuve. Tant que ce n'est pas fait, le gain de la passe est un majorant du banc. **Fait avant T27a** (la file enchaîne la passe sur plusieurs parties), donc aussi avant T25 et T27b ; **le même contrôle, effectif et seuil à confirmer par l'opérateur, porte sur les corrections de la relecture avant T27b** (registre avant/après).

## e. Répartition par type d'agent

| Travail | Agent | Pourquoi |
|---|---|---|
| Code de l'extension, outils, essais, parités, rejeux (R, U, A, V, SK, E, D, G, H, K) | **Agent de code** par défaut, une branche par chantier depuis le tronc, fiche de passation | tâches cadrées, critère de sortie écrit |
| Relecture indépendante de tout ce qui touche la décision ou l'écriture (A, E, D, F, I, V-b) | **Relecteur indépendant**, séance courte, lit le diff et la liste par cut, ne code pas | second regard |
| Cadrage, portes de version, arbitrages | l'architecte, seulement aux portes | quota |
| **Agent externe**, **sur accord de l'opérateur**, périmètre réduit : `tools/repointage.cjs` (lecteur de repointage), fixtures synthétiques, documentation d'outils ; C, `skip-ombre.cjs` seulement après validation sur des données réelles chez nous ; `tableau-bord.cjs` **pas délégué** (chemin critique) | branche dédiée `ext/<outil>`, **jamais le tronc**, outils hors ligne seulement, **aucun export ni lot** transmis (fixtures synthétiques du dépôt), aucun accès à `background.js`, `src/`, `engine.js` ; revue par l'agent de code puis fusion par nous | zéro risque d'écriture dans ESV et zéro fuite de données ; les vrais rejeux sur archives restent chez nous |

Ce qui ne sort jamais vers un agent externe : le service worker, les modules de décision, les parités, la garde elle-même, tout fichier des archives.

**Réponse à l'opérateur sur la passation externe (est-ce que ça fait gagner du temps ?)** : gain réel seulement pour le lecteur de repointage et la documentation avec fixtures. Les autres outils ne se valident que sur des lots ou des exports réels (oracle de voie, tableau de bord, SK en ombre) et lisent les formats d'outils du dépôt : l'agent externe écrirait, nous validerions sur les vraies données, relirions et fusionnerions, pour un gain faible. Ne pas déléguer ce qui est sur le chemin critique (le tableau de bord sert V-a et T22 : B-min est livré dans T21a). Si on délègue : dépôt réduit (outils, fixtures synthétiques, schéma JSON), pas le dépôt complet, qui contient les décisions avec numéros de parties et mesures ; on ne lui dit pas quelle copie il voit sans l'avoir décidé.

## f. Risques et parades

| Risque | Parade |
|---|---|
| Pose fausse écrite sans relecture humaine | garde A, G1 puis G2 avant toute écriture nouvelle, une nouveauté qui écrit à la fois, contrôle a posteriori § d.7 avant T27a |
| Vitesse « gagnée » au banc mais perdue au terrain (le banc ne voit qu'un cinquième du cycle) | deux mesures distinctes (critère 6-i et 6-ii) ; comparaison terrain à partie et poste égaux ; `relecture-banc` avec latence réglée |
| Corriger le message (U-a) et croire la reconnexion réglée alors qu'un vrai défaut reste | critère de sortie T20a en vm (dont F5 pendant Écho, puis reprise) **et** 3 F5 de suite au terrain ; message fondé sur un statut tenu à jour à chaque ré-équipement, pas sur `pollCurrent` seul ; (b) construit si le défaut reste |
| Chiffres de réglage pris pour des preuves ; fuite réglage → examen | tableau de bord par population ; partie d'examen ouverte une fois ; partie neuve de réserve nommée avant |
| Base test 18 jamais recalculée ; juge hors dépôt | T21 recalcule, scelle, nomme le commit ; tout chiffre antérieur dit « non scellé » |
| Décodage global qui renforce une voie fausse par des appuis autocorrélés | E avant D ; marge au second chemin ; une information comptée une fois |
| SKIP en ombre sans vérité (l'opérateur n'a pas transmis d'exports) | SK livré en journal seul ; précision/rappel calculés quand des exports arrivent ; aucune conclusion avant |
| Disque 1,6 Go ; machine partagée | verrou `verify-garde`, un rejeu lourd à la fois, sorties au scratchpad, suppression après rejeu, `.jsonl` compressés |
| Quota hebdomadaire presque épuisé | § h ; arrêt d'une séance à 80 % de son budget avec fiche de passation ; aucun agent de recherche |
| Agent externe : fuite de données ou code non relu dans le tronc | branche `ext/`, fixtures seules, revue avant fusion ; jamais d'export |
| `engine.js` touché sans ré-épinglage | baseline contrôlée par `verify` ; I par contournement tant que l'opérateur n'a pas tranché |
| Deux `DECISIONS.md` divergents (D-224 à D-238) | R seul avant T20a, numérotation vérifiée, un seul fichier ensuite |
| La deuxième passe, allumée pendant ~30 parties (l'opérateur, D-247) et dans la file, a écrit en production sans contrôle chiffré | contrôle a posteriori (§ d.7) avant T27a, T25 et T27b ; base à deux colonnes ; garde bloquante aussi sur la qualité « avec passe » |
| File sans arrêt de prudence : une anomalie se répète sans que personne le sache | registre persistant des écritures par partie ; alerte visible non bloquante par partie ; tableau des motifs de fin validé par l'opérateur (écriture incertaine : arrêt) ; bilan qui sépare lot, passe, relecture ; premier essai à deux parties, l'opérateur présent |
| Corriger l'interface sur le mauvais panneau | le nouveau panneau est celui de l'opérateur (D-247) ; panneau par défaut à la livraison : décision de l'opérateur |
| Corrections de la relecture dans la file : écrivain non surveillé, sans mesure d'erreur | contrôle avant T27b (registre avant/après, échantillon, seuil écrit) ou règle de l'opérateur |
| Double injection d'équipement (Écho et nouveau gestionnaire sur le même `complete`) | équipements sérialisés par onglet ; essai |
| Perte du cache de l'opérateur à l'installation de T20a (manifeste sans `key` : identité liée au dossier) | exports avant l'installation ; par-dessus, dans le même dossier |
| La file écrit dans une partie déjà validée ou travaillée par un autre opérateur (SUPPOSÉ) | ne prendre que les parties avec des rouges ; confirmation de l'opérateur |

## g. Décisions attendues de l'opérateur, par ce qu'elles débloquent

Réponses déjà données (D-247), non reprises comme ouvertes : passe allumée pendant les ~30 parties, nouveau panneau, passe allumée dans la file, exports (accord), relevé du sélecteur et actions ESV nouvelles (accord de principe), ordre révisé et passation externe (accord). « Je ne sais pas » : statut de la 4:2 et parcours de vitesse fixe, dont les défauts de l'orchestrateur sont à confirmer ci-dessous.

| Débloque | Décision |
|---|---|
| **Avant l'installation de T20a (étape 0)** | 1. **Envoyer les exports** : fiches de départ (`banane3FichesDepart`), puis « Exporter tout » (tests 18 et 19), plus l'export de la partie à 95 différés (hypothèse « réglage de caméra désactivé », SUPPOSÉE : on y cherche les raisons de différé par cut et le réglage actif au départ ; si elle se confirme, vérification en lecture seule au démarrage du lot, avec avertissement). Installer T20a **par-dessus, dans le même dossier**. |
| **T20a** | 2. Liste des « petits détails d'interface ». 3. Panneau par défaut à la livraison (D-237 garde l'ancien ; l'opérateur utilise le nouveau). 4. Reconfirmer la livraison d'une version interface avant la garde, sous parité (cahier § 2, 3 bis ; acceptée avec l'ordre révisé). 5. Fournir le relevé du sélecteur de parties, après T20a (accord donné). |
| **T20b** | 6. Validation de la maquette cliquable de l'accueil ; liste des actions fréquentes dont on compte les clics. |
| **T21a / B-min / contrôle de la passe** | 7. **Accepter un Écho ciblé d'environ 60 cuts écrits par la passe**, seuil 0 mauvaise voie et 0 pose à plus de 20 mm, ou donner une autre règle. 8. Autoriser les rejeux longs sur le disque plein (ou libérer de la place). 9. Confirmer les défauts de l'orchestrateur (D-247) : 4:2 « terrain hors réglage, avec Écho, utilisable pour l'autonomie, jamais pour régler » ; vitesse permanente au banc seulement, parcours de vitesse fixe non retenu (ou une partie de réglage courte rejouée) ; méthode de la tolérance ; nommer une partie neuve d'examen en réserve. 10. La 3:1 était réservée, ni lue ni rejouée (D-237), et ses durées ont été lues dans son journal (cahier § 6 bis) : sans effet sur le réglage, à signaler. |
| **T22 / V** | 11. Quelle relecture compte (fin de lot en ombre, « corriger », ou l'Écho) et quel temps visé ; quelle partie sert de référence au lot. |
| **T27a** | 12. Valider le tableau des motifs de fin (module P), avec le défaut de D-247 et l'exception « écriture incertaine : la file s'arrête ». 13. Confirmer la formule « les N parties suivantes de la liste d'ESV, seulement celles qui ont des rouges ; une partie sans rouge compte comme faite ». 14. Confirmer l'action « changement de partie » après le relevé et la maquette ; valider ou modifier les seuils initiaux de l'alerte non bloquante. |
| **T27b** | 15. Accepter le contrôle des corrections de la relecture (registre, échantillon, seuil écrit) ou donner une règle. |
| **T23 à T25** | 16. Contre-expertise des verts de chaîne : allumer pour mesure ou laisser coupée. 17. Ré-épinglage de `engine.js` pour la cible hors vue, ou « déplacer la vue » (accord de principe, confirmation après maquette). 18. Projet de rattachement de la partie 2 (manifeste). |
| **J** | 19. Deux séances d'environ 1 h de repointage. |
| **Passation** | 20. Périmètre pour un agent externe (accord donné selon § e : gain réel seulement pour le repointage et la documentation ; dépôt réduit si on délègue). |
| **Ordre** | 21. Confirmer l'ordre révisé version 2 (§ b) ; T23 et T24 reportés. |
| **K** | 22. Seuil d'autonomie après la mesure de base ; fusion dans `main`, étiquette, publication. |

Les plus bloquantes : 1 (exports avant l'installation), 7 (contrôle de la passe, avant T27a), 11 (relecture visée), 12 et 13 (file), 15 (avant T27b).

## h. Budget de quota prudent

Unité : une séance = une session d'agent bornée ; « appels » = appels d'outils, plafond à ne pas dépasser (arrêt à 80 % avec passation). Cette semaine, quota presque épuisé : rien d'autre que la préparation de R puis de T20a si de la marge reste, sinon rien.

| Phase | Agent de code | Relecteur indépendant | Architecte |
|---|---|---|---|
| R (seul), puis T20a | 2 séances (R, puis T20a), ≤ 120 appels au total, plafond fixé avant que R ne grossisse (fusion de la test 19, `DECISIONS.md` unique, maquette rapatriée) : **à rechiffrer au cadrage de R, sans nouveau chiffre ici** | 1 courte, ≤ 25 | porte : ≤ 15 |
| T20b (refonte de l'accueil) | à chiffrer à la validation de la maquette | 1 courte, à chiffrer | porte, à chiffrer |
| T21a + T21b (A, bases, V-a, SK, H) | 3 séances, ≤ 200 au total (rejeux en arrière-plan, un à la fois) ; T21a d'abord, répartition fixée au cadrage | 1, ≤ 30 | ≤ 15 |
| T22 (V-b) | 2 à 3 séances, ≤ 180 | 1, ≤ 30 | ≤ 15 |
| C ∥ G1 ∥ H (G avant T27a, H en T21a : lignes à rechiffrer) | 2 séances, ≤ 120 | — | — |
| T23 (E) | 2 séances, ≤ 120 | 1, ≤ 40 | ≤ 15 |
| T24a + T24b (D) | 4 séances, ≤ 300 au total | 2, ≤ 80 | ≤ 20 |
| T25 (F ou I) | 2 séances, ≤ 120 | 1, ≤ 40 | ≤ 15 |
| T26 + K | 3 séances, ≤ 180 | 1, ≤ 30 | ≤ 20 |
| **T27a + T27b (file de parties)** | **≈ 3 à 4 séances, ≤ 300 appels** | **2, plafond à fixer** | porte, à chiffrer |
| **Total hors refonte de l'accueil** | **≈ 23 à 25 séances (T22 : 2 à 3 ; T27 : 3 à 4), ≤ 1 640 appels avant marge (1 340 + 300) ; avec 30 % de marge pour les reprises : ≈ 2 130** | **≈ 8 courtes, ≤ 275, plus les 2 de T27** | **≤ 115 sur les lignes chiffrées (l'affichage précédent de 130 était un arrondi trop large), plus les portes T20b et T27** |

Note de la troisième relecture : T21a grossit (B-min, contrôle de la passe, H en diagnostic) et G passe avant T27a ; les plafonds de T21a + T21b, de R + T20a et de C ∥ G1 ∥ H sont à rechiffrer au cadrage, sans nouveau chiffre inventé ici ; le total n'est pas recalculé (l'arithmétique actuelle est exacte : 1 340 + 300 = 1 640 ; × 1,3 = 2 132).

L'unité « appels d'outils » n'a pas de lien direct avec le quota réel (jetons) : elle ordonne les tâches, elle ne prédit pas la consommation. R (seul) est la première séance à lancer, après les exports de l'opérateur, dès que le quota le permet ; T20a suit.

Règles : jamais deux séances lourdes en parallèle ; pas d'agent de recherche, pas de recherche web ; une séance qui lit un export ne lit que les événements dont elle a besoin (jamais le fichier entier dans le contexte).

---

## Ajout du 23/10 : Orbite en file de parties (module P, versions T27a et T27b, D-244, D-245)

- **Objet** : bouton d'enchaînement des parties dans Orbite (éteint par défaut). L'opérateur renseigne le nombre N : **les N parties suivantes de la liste d'ESV, dans son ordre ; une partie sans rouge compte comme faite** (à confirmer par l'opérateur ; proposition de la troisième relecture : ne prendre en écriture que les parties qui ont des rouges, la liste d'ESV pouvant contenir des parties déjà validées ou travaillées par un autre opérateur, SUPPOSÉ). **La passe des différés reste allumée dans la file (l'opérateur, D-247).** Une partie finie → noter les données de départ de la suivante → poser → ainsi de suite.
- **Ce que la page d'ESV offre : SUPPOSÉ.** Lu dans une page enregistrée (aucune capture ni code d'ESV dans les dépôts) : un sélecteur de parties dont chaque entrée est un lien (`…&p=N`) et un événement `newPart` dont le gestionnaire appelle `loadCut` (sens des arguments supposé). On ne sait pas si changer de partie recharge la page (alors `chargementEsvPret` impose de 2,5 s à 60 s et la reconnexion de T20a est un prérequis ; **aucun mécanisme existant ne ré-équipe l'onglet pour le lot** : pendant le changement de partie, le module P appelle `equiperOnglet` puis démarre le lot, le nouveau gestionnaire de `onUpdated` étant exclu pendant cette phase, et le clic « Reprendre » n'intervient pas) ou se fait sur place (alors `pageId` ne change pas et l'adaptateur garderait un contexte périmé). **Un relevé en lecture seule du sélecteur de parties** (comme `releveOn('empreinte')`) est ajouté à T20a pour que l'opérateur le fournisse avant T27, et **la maquette modélise les deux variantes**.
- **Module P** (`src/file-parties.js`, pur, sans DOM : liste des parties, partie courante, tableau des motifs, bilan ; `background.js` : transition « partie suivante », action `file-parties-demarrer/arreter`, état persistant dans `chrome.storage.local`, reprise après redémarrage du service worker) ; panneau : bouton, liste des parties, bilan par partie. Données de départ par le chemin existant (`fichesDepart`, `batch-started`). **Registre persistant des écritures par partie** : numéros de cuts posés par le lot, écrits par la passe, corrigés par la relecture (avant/après en mm), validés ; quelques Ko, jamais vidé par « vider le cache », présent dans les exports (test « aucun bouton d'export perdu »), taille bornée (nombre de parties conservées à fixer) ; comme l'état du lot garde « différés » les cuts posés par la passe (D-238), le registre sert à les compter à part (fiche de fin de lot, historique, alerte, indicateur 1) ; affiché dans le bilan de file, qui sépare les trois origines (les trois écrivent ; les corrections de la relecture sont une écriture non surveillée). **Alerte visible non bloquante par partie** (bannière, pastille) quand un indicateur sort de sa zone (part de différés hors cuts écrits par la passe, part de cuts corrigés, nombre de refus) : elle n'arrête rien. **Valeurs initiales proposées par la troisième relecture (non décidées par l'opérateur, révisables)** : différés au-delà de 2 fois la médiane des fiches de départ, plus de 5 % de cuts corrigés, au moins 1 refus ; sans seuils écrits l'alerte n'est pas mesurable.
- **Diagramme d'états** (à figer avant tout code ; passe et relecture jamais ensemble, D-238) :

```
FILE_OFF --démarrer(N)--> LOT(partie k)
LOT --fin normale--> PASSE des différés (si allumée) --fin--> RELECTURE / CORRECTION (si activée) --fin--> CHANGEMENT DE PARTIE
(passe ou relecture éteinte : on passe à l'état suivant)
CHANGEMENT --partie suivante prête, borne 60 s--> LOT(partie k+1) ;  k = N --> FIN (bilan)
tout état --bouton Arrêter--> ARRÊT (bilan)
LOT / PASSE / RELECTURE --motif de fin--> selon le tableau ci-dessous : « continue » = état suivant ; « s'arrête » = ARRÊT avec motif
LOT / PASSE / RELECTURE --pose écrite non validée (intent, applied ou reconcileRequired présents ; page d'ESV rechargée pendant une pose)--> ARRÊT « écriture incertaine » : alerte « contrôle le cut dans ESV » ; ni passe, ni relecture, ni partie suivante démarrées ; reprise seulement après contrôle humain (D-237)
CHANGEMENT --pas abouti en 60 s, onglet fermé, ESV muet--> ARRÊT (impossible de continuer)
redémarrage du service worker : (file, k, N, phase) relus dans chrome.storage.local ; le registre est consulté avant toute reprise (à préciser avant le code)
```

- **Tableau des motifs de fin (à faire valider par l'opérateur ; D-245 reste la décision, ce tableau ne la change pas)**. **Défaut de D-247** (orchestrateur, à revoir au premier essai ; l'opérateur : « jamais arrivé ») : la file continue en notant le motif, **sauf impossibilité technique et sauf écriture incertaine** (D-237 : aucun départ automatique quand le lot s'arrête sur une pose d'Ariane non validée ; D-245 : continuer est impossible ; `retablirApresRechargement` refuse déjà la reprise si `intent`, `applied` ou `reconcileRequired` sont présents).

| Motif | File | Statut |
|---|---|---|
| Fin normale du lot | continue (passe, relecture si activées, puis changement de partie) | cas normal |
| Bouton « Arrêter » | s'arrête | décision de l'opérateur |
| Nombre de parties atteint | s'arrête (fin normale) | décision de l'opérateur |
| Changement de partie qui n'aboutit pas (borne 60 s), onglet fermé, ESV muet | s'arrête, alerte et bilan | D-245 (continuer impossible) |
| **Pose commandée non validée, `reconcileRequired`, écriture incertaine (lot, passe ou relecture, y compris page d'ESV rechargée pendant une pose)** | **s'arrête, alerte « contrôle le cut dans ESV » ; ni passe, ni relecture, ni partie suivante démarrées** | D-237, D-245 ; **exception au défaut D-247 (D-248)** ; à confirmer par l'opérateur |
| Refus ou anomalie propre au lot (la page refuse une commande) | s'arrête, alerte et bilan | D-245 (« lot qui s'arrête sur un refus ») ; le défaut D-247 ne s'y applique pas ; à confirmer par l'opérateur |
| `partie-sans-rouge` (lot) | la partie compte comme faite, la file continue | proposé, à valider par l'opérateur |
| `depart-sur-vert` (lot ; aucune pose écrite) | défaut D-247 : continue en notant le motif | défaut de l'orchestrateur, à valider par l'opérateur |
| Passe arrêtée (refus, anomalie) **sans écriture en suspens** | défaut D-247 : continue en notant le motif | défaut de l'orchestrateur, à valider par l'opérateur |
| Relecture arrêtée (plafond, `ADAPTER_BUSY`, `relecture-adaptateur-bloque`) **sans écriture en suspens** | défaut D-247 : continue en notant le motif | défaut de l'orchestrateur, à valider par l'opérateur |

  Réponse de l'opérateur (D-247) à la question « partie arrêtée sur sa propre garde » : jamais arrivé, pas de décision ; le tableau ci-dessus est à valider, y compris l'exception.
- **Dépendances** : T20a (reconnexion, équipement après rechargement, relevé du sélecteur), G avec scénario de changement de partie (deux variantes) et pannes, tableau des motifs validé, registre d'écritures, relecture indépendante, accord de principe de l'opérateur sur la nouvelle action ESV (D-247), confirmé après le relevé et la maquette, contrôle a posteriori de la passe et H avant T27a. **La garde minimale (T21a) est livrée avant T27a** : condition de l'opérateur (D-244, « garde verte »), maintenue par l'ordre révisé accepté (D-247) ; ce n'est pas un prérequis technique (le changement de partie ne touche aucun module de décision, la parité vaut garde) ; la garde reste exigée pour tout ce qui change la décision. T27a (relecture éteinte, passe allumée) puis T27b (relecture et correction dans la file, après T22 et après la mesure ou la règle sur les corrections de la relecture) ; premier essai de terrain à deux parties au plus, l'opérateur présent.
- **Règles d'arrêt (D-245)** : aucun arrêt de prudence, seulement le bouton d'arrêt ; s'arrêtent d'eux-mêmes les seuls cas où continuer est impossible (dont l'écriture incertaine : pose écrite non validée), avec alerte visible et bilan écrit (voir le tableau). **Jamais de SKIP ; jamais de validation d'un cut non résolu ; les validations de la passe et de la relecture suivent leurs gardes existantes (D-241).** La règle « arrêt à la première anomalie » de D-244 est remplacée par D-245.
- **Interface** : maquette cliquable de l'accueil validée par l'opérateur avant le code (T20b) : connexion, partie en cours, avancement « partie 2 sur 5 », bouton Enchaîner, bouton Arrêter, relecture et correction activables, historique des parties, alerte par partie.
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
| Chantier 10 : causes supposées, ordre (a, b, d, c), (a) et (d) probablement un seul défaut | `panel.js` ouvre le volet dès `status === 'unavailable'` ; `ui5.js` en tire le message ; `onUpdated` ne rétablit qu'Écho (le lot n'est repris qu'au clic « Reprendre » : correction D-248) | ordre : message d'abord, F5 rejoué, reconnexion seulement si le défaut reste ; critère de sortie écrit |
| « Vérifier si le refus `ADAPTER_BUSY` persiste » : le code répond déjà | `occupeAttentesMs` = 6 essais, 11,75 s ; la 3:0 a eu 7 demandes | écrit dans le chantier 9 : plafond identique, cause non revérifiée en test 18 (relecture indépendante, D-246) ; correction = attendre l'état de l'adaptateur, avec borne haute |
| Parité : `tools/parite-relecture-sw.cjs` ignoré | existe sur le tronc | ajouté au § 2, 3 bis, obligatoire si la relecture est touchée |
| « Maquette ESV dans `verify` » impossible telle quelle | la maquette est sous Playwright (`relecture-banc.cjs`) ; `verify` limite chaque essai à 20 s | deux étages : G1 vm dans `verify`, G2 Playwright avant paquet |
| Référence « D-1xx » non résolue dans § 6 bis | texte | note explicite « à retrouver lors de la fusion » |
| Chantiers 2 et 10 sans critère de sortie ; § 7 sans règle générale | texte | critères ajoutés ; règle : une version sans critère de sortie écrit n'est pas planifiée |
| § 8 oubliait les décisions nouvelles (exports, relecture visée, partie de réserve, agent externe) | texte | § 8 complété, renvoi au § g |

Point d'origine corrigé par la relecture indépendante (D-246) : l'auto-audit affirmait qu'aucune écriture n'avait eu lieu. C'est inexact : la deuxième passe était allumée pendant les ~30 parties (l'opérateur, D-247) ; elle a écrit en production sans problème signalé, mais sans mesure. Le protocole de première écriture est remplacé par un contrôle a posteriori (§ d.7), fait avant T27a.

## Relecture indépendante du 23/10 (D-246) : corrections appliquées

| Constats | Correction |
|---|---|
| F-01 à F-03 | passe allumée par défaut ; contrôle a posteriori ; base à deux colonnes, garde sur « sans passe » ; écart de recalcul présenté à l'opérateur comme un recul |
| F-04, F-05 | chantier 9 et T22 : diagnostic par la mesure par phase d'abord ; `attenteEcritureMs` plafond de boucle, `attenteVuMs` une fois, `pasMax` distance ; plafond ADAPTER_BUSY identique, cause non revérifiée, borne haute et arrêt avec motif |
| F-06 à F-08 | exigence de puissance ; ~30 parties « terrain hors réglage », 4:2 nommée ; parcours de vitesse fixe ; méthode de tolérance |
| F-09 | formule de D-241 reprise partout |
| F-10 à F-12, F-22 | historique depuis `fichesDepart` + fiche de fin de lot ; deux états ; T20a / T20b avec critères ; question du panneau ; export : fiches de départ d'abord |
| F-13 à F-20 | arrêt de prudence supprimé ; D-239 à D-245 (état de D-246) ; tableau des motifs ; changement de partie en hypothèse et deux variantes ; borne 60 s ; diagramme d'états ; registre ; alerte non bloquante ; critère T27 par catégorie ; N parties suivantes |
| F-21, F-23 | partie à 95 différés ; réponse sur la passation externe |
| F-24 à F-29 | correspondance chantier / module / version ; maquette rapatriée ; test 19 fusionnée ; T21, T24, T27 scindés ; « garde verte » retirée des prérequis de la file ; budget avec T27 et 30 % de marge |
| F-30, F-31 | hypothèses étiquetées SUPPOSÉES ; « déplacer la vue » soumis à la règle de la maquette et de l'accord de l'opérateur |
| Priorisation | ordre révisé du 23/10 (proposition que l'opérateur valide) à côté de l'ordre initial |

Aucune décision de l'opérateur (D-239 à D-247) n'est modifiée ; les questions ajoutées ont reçu leurs réponses (D-247) ou sont au § g.

Rappel de l'auto-audit du 22/10 (déjà dans le cahier) : base non recalculée → à sceller par le juge versé ; garde par cut ; parité à chaque changement du service worker ; définition calculable de l'autonomie ; partie d'examen ouverte une fois ; report sur le tronc et `DECISIONS.md` unique.

## Troisième relecture indépendante du 23/10 (D-248) : corrections appliquées

| Constats | Correction |
|---|---|
| N-15, F-01, F-12 | D-247 reporté partout : passe allumée (contrôle a posteriori), nouveau panneau, passe allumée dans la file, accords (relevé, actions ESV nouvelles de principe, ordre, passation) ; 4:2 « terrain hors réglage » en une seule formulation |
| N-01, N-02 | contrôle a posteriori défini (liste, échantillon d'au moins 60 cuts, seuil, cas « événements manquants ») et placé avant T27a ; G et H avant T27a |
| N-03 | garde bloquante aussi sur la qualité « avec passe » |
| N-04 | 4:2 « terrain hors réglage, avec Écho » ; une seule partie d'examen (3:1) ; population `terrain` au schéma |
| N-05, § 3b du rapport | statut de connexion mis à jour à chaque ré-équipement et à chaque perte de page ; `onUpdated` ne rétablit que l'Écho, le lot n'est repris qu'au clic « Reprendre » |
| N-06, F-14, F-17 | tableau des motifs : écriture incertaine, la file s'arrête (exception au défaut D-247) ; état d'arrêt ajouté au diagramme |
| N-07, F-22 | exports avant T20a, installation par-dessus dans le même dossier (étape 0) |
| N-08, F-07 | comparaison appariée sur la maquette ; vitesse permanente au banc seulement ; hypothèse cachée dite (SUPPOSÉ) |
| N-09, F-23, F-24 | B-min dans T21a ; G et H placés dans l'ordre ; incohérence sur le tableau de bord levée |
| N-10 | cuts écrits par la passe comptés à part (fiche de fin de lot, historique, alerte, indicateur 1) |
| N-11, F-27 | R seul ; équipements sérialisés par onglet |
| N-12, F-20 | formule des N parties et seuils d'alerte : propositions, à confirmer |
| N-13 | accord de principe ; confirmation après le relevé et la maquette |
| N-14 | T27b bloquée sans mesure d'erreur ou règle pour les corrections de la relecture |
| F-13, F-28, F-29, F-30 | références D-239 à D-247 ; garde minimale livrée avant T27a (D-244) ; budget (23 à 25 séances, R, T20a) ; fait de code sur `onUpdated` |

Ordre révisé du 23/10, version 2 (§ b). Aucune décision de l'opérateur (D-239 à D-247) n'est modifiée ; les points à décider sont au § g et au cahier § 8.
