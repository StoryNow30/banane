# ARIANE 4.9 — CAHIER DES CHARGES

**Version du cahier : v0.2, non signé, brouillon pour l'audit d'orchestration d'Astra puis la signature de la direction.**
Rédigé le 30 septembre 2026, documents seuls : aucun code, aucun outil modifié. Remplace le brouillon 0.1 du
24 septembre (dernier état : `b0b2b1b`, dans l'historique git).
**Révision de l'orchestrateur du 30/09** (même version 0.2) : le développeur de la 4.9 est une **session Sol**, pas une session
Claude ; le cahier est donc rendu autonome (§ 2.3 protocole avec un exécutant externe, § 14 carte du code) et les modèles
proposés par chantier sont remplacés par un profil d'exécutant.

Sources : `consignes/besoins-4.9-2026-09-30.md` (besoins de la direction, source principale, notée « besoins »),
`PASSATION_4.8.0.md`, `PLAN_SUITE.md`, `DECISIONS.md` (D-054, D-057 à D-064), `KNOWN_ISSUES.md`, les audits de mesure
et `consignes/analyse-locale.md`. Chaque chiffre porte sa source (fichier:ligne) ; **un chiffre sans source est écrit
« à mesurer »**. Les calculs faits ici à partir de chiffres sourcés sont marqués « (calcul) ». Aucun chiffre du présent
cahier n'est une décision : les critères ouverts sont dans le § 11.

## 1. Statut, versions, périmètre

| Élément | Contenu |
|---|---|
| **4.9.0** | vitesse d'Orbite, exports, suivi : P2, V1, V2 (avec KI-068), V4, V3, U1, U2, U3, V5 (conditionnel). Jalon J4 (`PLAN_SUITE.md:16`). |
| **4.9.5** | cuts difficiles : B1, B2, B3 (conditionnel). Jalon J5 (`PLAN_SUITE.md:17`). |
| **Après la 4.9** | apprentissage d'un nouveau moteur (régresseur appris, données qualifiées par la rotation) : besoins:101, `PLAN_SUITE.md:142`. |
| **5.0** | fonctionnement sur plusieurs sessions, onglets et parties (besoins:101). Un suivi mobile en lecture seule est évoqué pour une 5.5 éventuelle (D-057, `DECISIONS.md:254`) : hors périmètre. |
| **Exécutant** | une **session Sol** (décision de la direction, 30/09), avec accès au dépôt `banane` et à l'exécution (Node, `tools/verify.cjs`, bancs) : § 2.3. Orchestration : l'orchestrateur ; audit d'orchestration : Astra ; relecture indépendante de chaque diff : Claude ou Grok. |
| **Base de code** | **à trancher avant tout chantier** (§ 9) : 4.8.5 stable (`v4.8.5`, `323356c`) ou 4.8.6. |
| **Numérotation** | version stable = étiquette `vX.Y.Z` jamais reconstruite ; version de test = manifeste `X.Y.Z.N` (D-061, `DECISIONS.md:105-107`). Pour la 4.9, `4.9.0.N` est **SUPPOSÉ** (convention non écrite pour la 4.9). |
| **Étapes réservées à la direction** | merge, étiquette, publication : jamais sans accord explicite (besoins:113, `PASSATION_4.8.0.md:36`). |

**Définition de « fini »** de chaque chantier : `PLAN_SUITE.md` § 1, inchangée (un commit par chantier préfixé `[Vn]`,
essai rouge avant correctif, `node tools/verify.cjs` à 0, banc des 633 cuts et des 8 jeux, revue de code, documents à
jour, pas de paquet tant qu'un chantier du paquet n'est pas fini). Une seule version de test sur le terrain à la fois,
cycle de 2 à 3 jours, un créneau d'environ 1 h 15 de l'opérateur par cycle (D-061, `DECISIONS.md:75-81`). Jamais deux
chantiers sur `background.js` en même temps (`PLAN_SUITE.md:154`).

## 2. Décisions de la direction et règles non négociables

### 2.1 Décisions citées telles quelles

- **Option B, chemin normal** (30/09, `consignes/demarrage-session-49.md:8-13`) : « La porte de la 4.9.0 reste **cycle
  médian −25 %** (donc V3), avec C1 et C4 non dégradés. "Je veux le chemin normal, le plus naturel, afin d'en faire la
  meilleure version, je ne suis pas pressé." Aucun raccourci de périmètre ni de procédure : la durée suit le quota, pas
  l'inverse. » Le périmètre du plan reste entier (U1 à U3, V5, B1 à B3 compris) ; l'ordre et les portes décident ce qui
  se fait quand, pas le budget.
- **Minimum de sortie** (besoins:13) : « Réduction d'au moins **25 % du temps médian par cut**, sans baisse de la
  proportion de cuts posés automatiquement (C1), sans pose hors des limites d'écartement (C3 = 0), avec la qualité des
  poses dans le seuil prévu (C4). »
- **Objectif** (besoins:14) : « Viser **40 % de réduction**, avec les mêmes exigences de qualité. Cet objectif ne
  remplace pas le minimum de sortie et ne bloque pas à lui seul la sortie. »
- **Exploration** (besoins:15) : « Rechercher des gains supérieurs, y compris 50 % si une piste sûre le permet. Atteindre
  25 % ne justifie pas d'abandonner une piste sûre identifiée. Aucun gain supérieur n'est promis avant mesure. »
- **Condition sur toute optimisation** (besoins:17) : « Les optimisations doivent conserver les vérifications avant pose et
  validation. Une amélioration ne peut pas gagner du temps en différant davantage de cuts ou en laissant plus de travail
  manuel à l'opérateur. »
- **Critère d'arrêt du préchargement** (besoins:19) : « **aucune pose ni validation si l'identité du cut ou l'appartenance
  de ses données est incertaine** ». Reprise, pause et arrêt du lot préservés.
- **La validation par expertise de la 4.8.5 ne remplace pas la mesure C4 pour la 4.9** (besoins:37).

### 2.2 Règles non négociables (`PASSATION_4.8.0.md:34-43`, besoins:111)

Moteur `src/engine.js` épinglé ; **deux rails ou rien** ; **aucune validation ni aucun SKIP automatique d'un cut non
résolu** ; écartement **[1405, 1470] mm en admissibilité seulement**, jamais une cible ; **cuts 9033 et 9241 exclus** ;
parties de validation jamais utilisées pour régler (rotation, D-057) ; pas de reset destructif, force push, merge,
étiquette ni publication sans autorisation explicite ; `node tools/verify.cjs` à 0 avant chaque commit (commandes
chaînées avec `&&`) ; commits portant le trailer de session de l'exécutant (forme à confirmer, § 11 n° 22 ; les commits
des sessions Claude gardent `Co-Authored-By` et `Claude-Session`) ; aucun identifiant de modèle, aucune capture
d'écran ni code d'ESV dans les dépôts ; essais courts (7 s par fichier, `PLAN_SUITE.md:23`, plus strict que les 10 s de
`PASSATION_4.8.0.md:42`). Les protections existantes de la 4.8.5 (garde d'écartement 1 420 mm, D-060/D2 ; fin de partie
D-062) restent en vigueur.

### 2.3 Protocole avec un exécutant externe (session Sol)

**Décision de la direction (30/09)** : le développeur de la 4.9 est une session Sol qui a accès au dépôt `banane` et peut
exécuter du code. Cette session n'a ni notre historique ni notre conversation : **ce cahier, les documents cités et la carte
du code du § 14 sont sa seule mémoire**. Si un point manque pour agir, elle le pose comme question à la direction dans son
rapport, elle ne l'invente pas.

**Rôles.** L'exécutant écrit le code et ses essais. L'orchestrateur tient le cahier, relit chaque diff, prépare les paquets de
test et dépose les données ; Claude ou Grok font la relecture indépendante des diffs ; Astra audite l'orchestration ; la
direction décide, signe, fusionne, étiquette et publie. L'exécutant ne relit jamais son propre diff comme relecture
indépendante.

**Profils d'exécutant** (utilisés par chantier au § 6) : **bornée** = périmètre étroit, spécification complète dans le cahier,
aucune décision d'architecture ; **conception** = décisions d'architecture, risque de perte de données ou de lecture d'un
autre cut ; la relecture indépendante du diff est alors obligatoire avant acceptation.

**Livraison.**
- Une branche par chantier, issue de la base de code tranchée (§ 9), au nom préfixé par le chantier (par exemple
  `sol/49-v1-mesure-par-phase` : **proposition**, à confirmer par la direction). Jamais `main`.
- Un commit final par chantier, préfixé `[Vn]` ; des commits intermédiaires sont permis, la branche reste lisible.
- **Rapport de fin de chantier** dans `audit/chantiers/` (un fichier par chantier) avec : ce qui est fait ; commit(s) ; fichiers
  touchés ; essais ajoutés, dont **la sortie de l'essai rouge avant le correctif** ; **la sortie de `node tools/verify.cjs`
  collée** (comptes `tests`, `pass`, `fail`, `skipped`, mode du banc) ; mesures avec leur origine (§ 6, règle transversale) ;
  écarts au cahier ; questions pour la direction ; ce qui n'est pas fait.
- Rien n'est déclaré « fini » sans ce rapport. Le chantier est **accepté** quand l'orchestrateur et la relecture indépendante
  ont lu le diff et que la direction l'a dit. Le chantier suivant ne commence pas avant.

**Vérification.** `node tools/verify.cjs` doit finir à 0 échec. Sans le corpus natif privé (absent d'un clone propre), il tourne
en mode « partiel » : les 2 tests qui en dépendent sont **sautés, non réussis** — à écrire tel quel. Le mode complet
(`--full`) n'est possible que sur le poste qui a le corpus. Relevé de départ, pris sur la branche de ce cahier le 30/09 :
**986 réussis, 0 échec, 2 sautés**. Le banc réécrit `audit/verification.txt` et `audit/verification.json` (versionnés) : les
inclure dans le commit du chantier quand ils reflètent le résultat final (précédents : `00a07cc`, `e7256ef`), sinon les
restaurer.

**Méthode, écrite comme règles du cahier** (aucun plugin ni outil propre à un assistant n'est supposé) :
1. **Essai rouge d'abord** : l'essai qui prouve le défaut ou le comportement attendu échoue avant le code, la sortie est
   collée dans le rapport ; les essais respectent la règle des 7 s par fichier.
2. **Cause racine avant correctif** : la cause est écrite dans le rapport avant le correctif. « Instable » ou « flake » n'est
   pas une cause ; un essai n'est jamais sauté, désactivé ni mis en quarantaine pour passer au vert.
3. **Preuve avant de déclarer fini** : chaque affirmation du rapport renvoie à une sortie de commande ou à fichier:ligne ; ce
   qui n'est pas mesuré s'écrit « non mesuré », jamais zéro ; aucun chiffre n'est inventé (« à mesurer »).
4. **Un correctif = ce que le défaut demande** : pas de refactorisation ni d'amélioration voisine dans le même commit.
5. **Relecture adverse de son propre diff** avant de pousser : « qu'est-ce qui ferait rejeter ceci ? », y compris les règles
   du § 2.2 (aucune validation ni SKIP automatique d'un cut non résolu ; aucune pose partielle).
6. **Fichiers gelés** : `src/engine.js` est épinglé sur `audit/v4.6.0-engine-baseline.json`, et le placement, les
   transformations de coordonnées et le lecteur LiDAR sur `audit/v4.4.0-frozen-engine-hashes.json` : le banc échoue à la
   moindre dérive. Toute instrumentation ou tout changement de comportement passe **hors** de ces fichiers (`background.js`,
   `src/adapter-page.js`, `src/bridge.js`, `panel.js`) ; changer la baseline exige une décision écrite de la direction.
7. **Ne jamais** (`PASSATION_4.8.0.md:34-43`) : merge, étiquette, publication, force push, reset destructif, sans autorisation
   explicite de la direction ; déposer des exports d'opérateur, des captures d'écran ou du code d'ESV dans un dépôt ;
   modifier un critère, une porte ou un seuil du cahier ; toucher au dépôt `banane-data`.

**Une chose à la fois.** Une seule session exécutante, un chantier à la fois, pas de travail parallèle (besoins:105-109) : U1 à
U3 se font donc **en série** (proposition, § 11 n° 17). Jamais deux chantiers sur `background.js` en même temps.

## 3. Mesures de départ

| Mesure | Valeur | Source |
|---|---|---|
| Cycle médian hors silences, 4.8.0, parties 20 / 21 / 22 / 23 (lot 1) / 23 (reprise) / 24 | 6,0 / 9,7 / 12,0 / 14,5 / 12,8 / 13,9 s | `audit/lots-20-24-33-2026-09-29.md:12-17` |
| Cycle médian hors silences, 4.8.5.1, partie 25 / partie 33 | 6,7 s (p90 8,2 s, max 11,8 s ; 516 cuts/h) / 8,7 s | `audit/lots-20-24-33-2026-09-29.md:18-19` ; `audit/lot-485-p25-2026-09-29.md:16` |
| Cycle médian, 4.8.0, partie 15 (191 cuts validés) | 9,5 s (345 cuts/h hors silences) | `audit/orchestration-480-485-490-2026-09-28.md:125` |
| Étape « navigation → capture reçue » | partie 15 (4.8.0) : **4,54 s, 48 %** du cycle ; lot 25 (4.8.5.1) : **4,3 s, 63 %** de 6,7 s. **Deux lots seulement : à confirmer par V1** | `orchestration-480-485-490…:118` ; `lot-485-p25…:21` |
| Autres phases, partie 15 | analyse GCV1 1,43 s (15 %) ; décision 0,24 s (3 %) ; décision → pose relue 1,44 s (15 %) ; capture après pose 0,43 s (5 %) ; validation 0,95 s (10 %) ; validation → cut suivant 0,43 s (5 %) | `orchestration-480-485-490…:119-124` |
| Autres phases, lot 25 | analyse GCV1 0,52 s ; pose 1,0 s (les autres phases : non publiées, à mesurer) | `lot-485-p25…:21` |
| C1 groupé | 4.8.0, parties 20 à 24 : 432/527 = 82,0 % ; 4.8.5.1, parties 25 et 33 : 153/181 = 84,5 % ; C1 par lot de 66,7 % à 85,2 % | `lots-20-24-33…:23-24` et tableau 12-19 |
| C3 (posés hors contrat) | 0 sur les huit lots | `lots-20-24-33…:21` |
| C4 mesuré | 4.8.0, parties 21 à 24 : 1 faux sur 353 jugés (0,28 %, borne haute de Clopper–Pearson ≈ 1,6 %) ; 4.8.5.1, partie 25 : 2 faux sur 62 jugés (validé sur l'expertise de la direction, D-063) ; partie 33 : pas de relecture | `lots-20-24-33…:23-25` ; `lot-485-p25…:17,70` ; `DECISIONS.md:17-23` |
| Poids des exports | environ **1,2 Mo par cut visité** (lot Orbite ; relecture Écho : autant par visite) ; lot 25 : 3,5 Mo (exporté avant relectures) ; **lot 33 : 1,03 Go** pour 100 cuts (786 Mo de visites, 245 Mo d'événements, 56 070 des 60 798 événements venant d'Écho) ; filtré : 7,8 Mo | `consignes/analyse-locale.md:15` ; `KNOWN_ISSUES.md:42` ; `lots-20-24-33…:44-46` |
| Autres tailles | partie 15 : bilan 263 Mo + corpus 241 Mo pour 251 cuts (soit 2,0 Mo par cut, calcul) ; relecture de la partie 25 : 242 Mo → 9 Mo allégée ; un lot de 200 Mo → 0,6 Mo ; 990 Mo de relecture → environ 1 Mo (page du réducteur) | `orchestration-480-485-490…:140` ; `lot-485-p25…:66` ; `analyse-locale.md:9-11` |
| Partie 25 | 81 cuts distincts, 69 posés, 12 différés (7 par le moteur + 5 refus d'écartement) ; déjà validée à 99 % avant le lot (80 cuts non validés) | `lot-485-p25…:11-13,23-30` |
| Lots de la 4.8.5.1 | garde 1 420 mm jamais déclenchée ; lot 33 : 100 cuts en 16 min (375 cuts/h) | `lots-20-24-33…:34-35` |

**Ce que ces chiffres permettent (calcul, non promesse).** −25 % du cycle de la partie 15 (9,5 s) donne 7,1 s ; −40 %
donne 5,7 s. La variation entre lots (6,0 à 14,5 s) dépasse le gain visé : **des cycles absolus de parties différentes ne
se comparent pas ; le protocole du § 4 est indispensable**. Si la seule étape « navigation → capture » devait porter tout
le gain, il faudrait la réduire d'environ 52 % (−25 %) ou 83 % (−40 %) sur la base de la partie 15, d'environ 40 % ou 63 %
sur la base du lot 25. À l'inverse, −30 % sur la capture n'ôte qu'environ 14 % du cycle (`PLAN_SUITE.md:137`) : **V3 seul
ne suffit pas**, d'où V4 avant V3 et le rôle de V1 (répartition réelle des phases). **La 4.9 n'hérite d'aucune de ces
proportions comme constante** (besoins:35).

## 4. Protocole de comparaison des vitesses (à écrire dans le détail avant V3)

### 4.1 Cadre (besoins:21-33)

- **Référence** : la 4.8.5 stable **équipée de V1 (mesure par phase), sans accélération et sans changement des règles de
  décision**. Ce n'est donc pas l'étiquette `v4.8.5` telle quelle mais une construction dérivée : le rapport donne son
  commit exact, et le banc (633 cuts, 8 jeux) prouve que ses décisions sont identiques à celles de `v4.8.5`. La version
  accélérée est mesurée avec la même instrumentation.
- **Mêmes conditions** : même machine, même poste, mêmes réglages d'affichage, **fenêtre ESV d'au moins 600 pixels de
  large**, mêmes cuts ou même partie. Noter dans chaque rapport : taille de fenêtre, zoom, extensions actives, heure.
- **Partie de mesure** : neuve pour la porte (rotation D-057) et avec assez de cuts non validés pour les deux mesures
  (~200 au moins, `PLAN_SUITE.md:110-112` ; la partie 25 n'en avait que 80, `lot-485-p25…:23-30`).
- **Méthode** : elle doit tenir compte des validations déjà présentes dans ESV (ESV ne navigue que vers le « cut non
  validé suivant », D-054, `DECISIONS.md:319`) : un cut déjà posé ne se repasse pas tel quel. Elle ne doit pas
  utiliser la relecture d'un cut pour régler sa propre décision (besoins:25).

### 4.2 Options de méthode (à trancher avant V3)

| Option | Principe | Avantage | Limite |
|---|---|---|---|
| **M1 — blocs alternés** | sur une même partie et une même séance, alterner des blocs de cuts consécutifs (référence, accélérée, référence…) ; aucun bloc ne repasse un cut | neutralise la variation entre parties et entre heures | il faut changer d'extension entre deux blocs (une seule Ariane active, D-060 ; F5 puis « Reprendre ») : le coût de bascule est hors mesure, à définir |
| **M2 — lots successifs, ordre contrebalancé** | deux lots sur la même partie (plages de cuts distinctes), l'ordre référence/accélérée inversé d'une partie à l'autre | simple pour l'opérateur | l'écart de profil entre plages (cuts plus ou moins difficiles) reste ; il faut plusieurs parties |
| **M3 — A/A d'abord** | deux blocs de la **référence seule** avant tout essai : mesure le bruit propre au protocole | donne une base empirique pour fixer les tolérances du § 4.4, sans inventer de chiffre | coûte un lot de l'opérateur |

Proposition : **M3 puis M1**, M2 en repli. C'est une proposition, pas une décision.

### 4.3 Trois mesures publiées ensemble (besoins:27-31)

1. **Temps médian par cut hors silences.** Définition fixe : les silences exclus sont ceux de `tools/perf-lot.cjs` — écart
   de plus de 60 s entre deux événements du journal (`SILENCE_MS = 60000`, `tools/perf-lot.cjs:27,39`) ; un cycle de plus
   de 60 s est écarté. **Proposition : conserver cette définition telle quelle** ; la direction la confirme avant V3. Le
   nombre et la durée totale des silences écartés sont publiés à côté. Publier aussi p90 et max.
2. **Durée totale du lot**, attentes et pauses comprises, avec les **interventions manuelles identifiées** (source : le
   journal du lot ; la liste des types d'événements qui les marquent est **SUPPOSÉE**, à établir par V1).
3. **Nombre d'arrêts pour 100 cuts**, pauses et causes **séparées** (pause de l'opérateur, pause automatique avec sa
   cause — adaptateur sans réponse, ESV muet, garde, arrêt de protection — et arrêt définitif).

### 4.4 Règle de comparaison des deux contrôles complémentaires

Besoins:33 : une réduction du temps par cut ne suffit pas si le traitement total se rallonge ou si les interruptions
augmentent ; la règle doit être précisée **sans inventer de tolérance**. **Tolérance chiffrée : à fixer par la direction
avant V3.** Options :

- **T1 — sans dégradation** : durée totale et arrêts/100 de la version accélérée ne dépassent pas ceux de la référence.
  Stricte ; la durée totale contient des pauses de l'opérateur (bruit).
- **T2 — bande de tolérance** : dégradation admise jusqu'à un seuil **X %** (valeur à fixer, non proposée ici), pour la
  durée totale et pour les arrêts.
- **T3 — bruit mesuré** : le seuil est l'écart observé entre deux blocs de la référence (A/A, M3) ; la direction le valide
  après avoir vu la mesure.
- Dans tous les cas, une dégradation de l'un des deux contrôles est expliquée par cause dans le rapport.

**Nombre de cuts minimal et intervalle** : le cahier ne fixe pas de taille d'échantillon (« à fixer avant V3 » ; la
variance vient de l'A/A). Publier au moins un intervalle sur la médiane (méthode à choisir, par exemple ré-échantillonnage).

## 5. Qualité : règle C4 et contrôle de non-dégradation

### 5.1 Règle C4, recopiée de `PLAN_SUITE.md:14` (jalon J2)

> C1 ≥ 79 % ; C3 = 0 ; C4 : **au moins 100 posés jugés** et ≥ 80 % des posés, pris dans l'ordre du lot sans choix,
> ≤ 2 faux / 100 jugés, chacun typé, les posés non jugés listés, borne haute de Clopper–Pearson publiée (information) ;
> 0 interruption non reprenable ; **chaque refus de la garde examiné** à la relecture : aucun refus d'une pose qui aurait
> été juste, sauf décision nommée

Précisions sourcées : un « faux » est un écart de plus de 10 mm, latéral ou vertical (`lot-485-p25…:17,72` ; D-038) ;
« ≥ 80 % des posés » est la part des posés qui sont jugés (partie 25 : 62 sur 69, 89,9 %, seuil 80 %, `lot-485-p25…:70`).
Publication de la borne : 2 faux sur 100 jugés donnent 7,0 % ; démontrer un taux sous 2 % demande 183 jugés sans faux,
277 avec un, 359 avec deux — objectif cumulé sur plusieurs parties, pas une porte de version (D-061,
`DECISIONS.md:93-100`). **Pour la 4.9, la lettre est exigée** (besoins:37) : ≥ 100 posés jugés, donc une partie neuve avec
au moins environ 120 cuts non validés pour la porte (**calcul** : 100 jugés à 80 % de posés jugés sur une part de posés
d'environ 85 %, à confirmer) et une relecture Écho complète.

### 5.2 Non-dégradation : respect du seuil ≠ démonstration statistique

Le seuil C4 se **vérifie** (compter, appliquer la règle). Une **non-dégradation** par rapport à la référence ne se
**démontre pas** avec 100 jugés : à 2 faux sur 100, la borne haute est 7,0 %, alors que la référence 4.8.0 mesure 0,28 %
(1/353, borne ≈ 1,6 %) et la partie 25 3,2 % (2/62). Un lot conforme au seuil peut donc être moins bon que la référence
sans que la mesure le voie. Le cahier distingue trois niveaux ; le rapport dit lequel est atteint :

1. **Seuil respecté** (règle du § 5.1) : c'est ce que la porte exige. Écrit comme tel : « seuil respecté, non-dégradation
   non démontrée statistiquement ».
2. **Décisions identiques** pour un chantier qui ne doit pas changer les décisions (V1, V2, V4, U1 à U3) : rejeu ligne à
   ligne du banc (633 cuts, 8 jeux ; précédent D-058, `DECISIONS.md:215-219`). Non-dégradation **par construction**, sans
   statistique.
3. **Comparaison appariée pour V3** (la capture peut changer ce que le moteur lit) : mêmes cuts, deux versions, chaque
   cut dont la décision ou la pose diffère de la référence est listé et examiné ; « zéro écart non expliqué » est le
   critère. **La faisabilité d'une capture appariée sur un même cut est SUPPOSÉE** (à établir par le développement avant
   V3, sans réutiliser la relecture pour régler). Les faux s'accumulent aussi d'une partie à l'autre (objectif cumulé,
   D-061).

**Tolérance sur C1 (« sans baisse ») : à fixer par la direction avant V3.** C1 varie de 66,7 % à 85,2 % selon les lots
(`lots-20-24-33…:12-19`) : une baisse d'un lot à l'autre peut être du bruit de partie. Options : C1 ≥ 79 % (porte
existante) ; C1 non inférieur à la référence mesurée sur le même protocole (A/A) ; les deux. C1 pris sur le même protocole
et la même partie, pas comparé aux lots passés.

## 6. Chantiers de la 4.9.0, dans l'ordre

Ordre (besoins:103-109 ; `PLAN_SUITE.md:135`) : **1. P2 et V1 → 2. V2 avec KI-068 → 3. V4 puis V3 → 4. U1, U2, U3 →
V5 si conditionnel**, puis **4.9.5 : B1, B2, B3**. Une chose à la fois : pas de travail en parallèle (besoins:105-109 ;
voir § 12, question 6).

**Règle transversale « origine des mesures »** (besoins:97) : chaque rapport de mesure identifie la version exacte (commit
et version du manifeste), les fichiers d'entrée (nom et SHA-256, comme pour `lot-485-p25…:3`) et les commandes de calcul.
Une partie de validation neuve est gardée avant tout réglage (D-057). C'est la reprise du chantier D04 de l'audit
qualité 4.8 (provenance du rapport de sortie).

### P2 — Précision humaine (KI-038)

- **Objectif** : mesurer la variabilité de la référence humaine avant toute conclusion sur la précision : 30 cuts reposés
  en aveugle, une fois (besoins:92 ; `KNOWN_ISSUES.md:65`).
- **Porte.** *MINIMUM DE SORTIE* : 30 cuts reposés en aveugle, écarts publiés (médiane, p90, latéral et vertical), sans
  modification automatique des seuils de qualité. *OBJECTIF* : aucun chiffre fixé (mesure d'information). *POINTS À
  VÉRIFIER PAR LE DÉVELOPPEMENT* : le mode « aveugle » (l'opérateur ne voit pas ses poses précédentes) et le choix des 30
  cuts sans sélection (**SUPPOSÉ**, à confirmer sur l'outil) ; comparaison avec la borne actuelle du moteur calé à l'humain
  (≈ 1,6 mm latéral, 1,1 mm vertical en médiane, `KNOWN_ISSUES.md:65`).
- **Mesure** : `tools/p2-plancher.cjs` (prêt depuis la 4.7.20, `KNOWN_ISSUES.md:65`) ; entrées : export de la séance de
  reposes ; méthode : écarts entre première et seconde pose du même cut. Temps opérateur : 15 min (`PLAN_SUITE.md:149`).
- **Dépendances** : aucune ; **au premier cycle**, avant toute conclusion sur la précision (`PLAN_SUITE.md:135`).
- **Risques** : 30 cuts donnent une estimation large ; usage abusif du résultat pour régler les seuils (interdit :
  besoins:92).
- **Effort** : S. **Profil** : bornée.

### V1 — Mesure par phase dans l'extension

- **Objectif** : horodater chaque phase du cycle dans le journal, afficher le tableau de bord (`perf-lot`), fixer la
  référence de comparaison (§ 4) et **confirmer ou infirmer** la part de « navigation → capture reçue » (4,54 s / 48 %,
  4,3 s / 63 %) sur plusieurs lots.
- **Porte.** *MINIMUM DE SORTIE* : toutes les phases du § 3 présentes dans le journal pour 100 % des cuts d'un lot ; une
  table de répartition du cycle sur **plusieurs lots** ; **décisions identiques** à `v4.8.5` (banc 633 cuts, 8 jeux) ;
  aucune commande ni écriture ajoutée dans ESV (D-061, instrumentation passive). *OBJECTIF* : aucun chiffre fixé.
  *POINTS À VÉRIFIER PAR LE DÉVELOPPEMENT* : écart entre la somme des phases et le cycle mesuré, publié (aucun seuil
  fixé par le dépôt) ; coût propre de l'instrumentation (il est dans les deux mesures, mais à publier) ; nombre de lots
  pour « plusieurs » (proposition non tranchée : au moins trois lots de parties différentes) ; la part réelle du calcul V4.6
  dans la phase d'analyse (à mesurer : elle décide de l'apport de V4).
- **Mesure** : `tools/perf-lot.cjs` étendu ; entrées : journaux (exports allégés) des lots, dont un lot long pour V5 ;
  méthode : écarts médians entre événements, silences selon § 4.3.
- **Dépendances** : base de code tranchée (§ 9) ; aucune autre. **Risques** : touche `background.js` et
  `src/adapter-page.js` (fichiers partagés) ; dérive du journal (taille : KI-059 — un message `chrome.runtime` ≤ 64 Mio).
- **Effort** : S. **Profil** : bornée.

### V2 — Exports allégés : « Sauvegarder tout » et « Préparer pour analyse » (avec KI-068)

Voir § 8, qui décrit les exigences complètes.

- **Objectif** : réduire le poids, supprimer les copies inutiles, limiter l'export au lot ou à la session, produire deux
  fichiers clairs, nommés lisiblement, sans perte de données ni sans lecture des anciens formats.
- **Porte.** *MINIMUM DE SORTIE* : (1) « Préparer pour analyse » : **zéro différence** avec la sauvegarde complète du même
  lot ou de la même session (C1 à C4 quand calculables, écarts de pose, temps, états non évaluables ; un résultat non
  mesuré ne devient pas nul) ; (2) export limité au lot ou à la session : **0 visite et 0 événement étrangers** (KI-068) ;
  (3) taille : **−40 %** (`PLAN_SUITE.md:123`) sur la base définie ci-dessous, rapports identiques ; (4) lecture des
  anciens exports conservée ; (5) fiabilité de l'enregistrement (§ 8.5) ; (6) faisabilité du fichier unique démontrée
  **ou** impossibilité remontée à la direction avec un remplacement concret. *OBJECTIF* : pas d'objectif chiffré au-delà
  de −40 %. *POINTS À VÉRIFIER PAR LE DÉVELOPPEMENT* : construction en flux sans réunir plusieurs Go en mémoire ;
  écriture progressive sur le poste réel de l'opérateur (restrictions) ; contraintes KI-059 et KI-060 ; noms uniques ;
  sessions multi-parties (§ 8.4).
- **Base du −40 %** (le cahier la fixe, besoins:58 ; **valeur de la base à valider par la direction**) : deux comparaisons
  distinctes, publiées séparément — **(a)** gain dû à la suppression des données étrangères (KI-068 : lot 33, 1,03 Go →
  7,8 Mo sur le journal seul, `lots-20-24-33…:5,46`) ; **(b)** gain sur les **seules données utiles** (dédoublonnage,
  compression), mesuré sur un lot sans contamination (type lot 25). Proposition : le **−40 % s'applique à (b)**, avec
  comme référence l'export actuel « Tout télécharger pour l'analyse » du même lot, mêmes cuts. Écho : **aucun pourcentage
  présumé**, à mesurer.
- **Mesure** : `tools/acceptance-report.cjs` et `tools/analyse-locale.cjs` (mode complet et léger ; l'égalité de ce mode
  est déjà testée : `tests/analyse-locale.test.cjs`, `consignes/analyse-locale.md:27-30`) ; comparaison JSON des rapports,
  différence attendue : nulle ; poids par composant (journal, corpus, bilan, visites, événements) au démarrage du chantier
  (les 1,2 Mo par cut et 2,0 Mo par cut du § 3 n'ont pas le même périmètre).
- **Dépendances** : V1 ; décision de base (§ 9) ; KI-068. **Risques** : perte de données à l'export (KI-064) ; ZIP non
  réalisable en flux ; segments (KI-060, corrigé en 4.7.20 avec réparation à la lecture) ; message de 64 Mio (KI-059).
- **Effort** : **L** (le plan dit M ; l'écriture en flux et le poste restreint justifient L, estimation de la rédaction).
  **Profil** : **conception** pour l'export en flux et le format ; bornée pour le petit fichier et les noms une fois le format figé.

### V4 — Comparaison V4.6 à la demande (P03), avant V3

- **Objectif** : retirer le calcul secondaire V4.6 du traitement automatique du lot, en le laissant accessible à la
  demande (besoins:107). Seul GCV1 commande Orbite (`BANANE_4.9_CAHIER.md` 0.1, ligne 112).
- **Porte.** *MINIMUM DE SORTIE* : **décisions identiques** (banc 633 cuts, 8 jeux ; rejeu ligne à ligne) ; durée d'analyse
  **mesurée avant et après** et publiée ; la comparaison V4.6 reste accessible à la demande, et un essai le prouve.
  *OBJECTIF* : aucun chiffre du dépôt (la part de V4.6 n'est pas mesurée). *POINTS À VÉRIFIER PAR LE DÉVELOPPEMENT* :
  aucun autre consommateur de V4.6 dans le chemin du lot ; journal et rapports d'acceptation inchangés en contenu utile
  (la relecture de lots anciens continue à marcher).
- **Mesure** : V1 (phase d'analyse) ; banc de rejeu ; `tools/portes-j1.cjs` (portes du banc). **Dépendances** : V1.
  **Risques** : dérive de périmètre (une « accélération » qui retire une vérification interdite : non, V4.6 n'est pas une
  vérification avant pose, à confirmer par l'analyse du chemin de décision). **Effort** : S–M. **Profil** : bornée.

### V3 — Capture plus rapide (une expérience par cycle)

- **Objectif** : rapprocher la vitesse du minimum de sortie (−25 % du cycle médian) et de l'objectif (−40 %), sans dégrader
  la qualité. Réglages à essayer, **un seul par version de test** (`PLAN_SUITE.md:124`) : attente de stabilité, lectures par
  vue, préchargement du cut suivant (piste à tester, pas une solution acquise, besoins:19).
- **Porte.** *MINIMUM DE SORTIE* : par expérience — **0 capture perdue** ; C1 et C4 non dégradés (§ 5) ; C3 = 0 ; pas plus de
  cuts différés ; pas plus de travail manuel ; vérifications avant pose et validation conservées ; **aucune pose ni
  validation si l'identité du cut ou l'appartenance des données est incertaine** ; reprise, pause et arrêt préservés ;
  capture médiane **−30 %** (porte de chantier, `PLAN_SUITE.md:124`). Pour la **version 4.9.0** : cycle médian **−25 %**
  (V3 et V4 et le reste ensemble, § 7). *OBJECTIF* : −40 % du cycle (exploration jusqu'à −50 % si une piste sûre existe).
  *POINTS À VÉRIFIER PAR LE DÉVELOPPEMENT* : comportement d'ESV quand le cut suivant est préchargé (**SUPPOSÉ**, jamais
  observé dans le dépôt) ; comment l'identité du cut est lue à la capture (`cutLabel` lit un identifiant, `PLAN_SUITE.md:59`) ;
  appartenance des points au bon cut ; F5, « Reprendre » et reprise après page absente (D-058, D-059) avec préchargement ;
  message de 64 Mio avec captures multiples (KI-059) ; renvoi de commandes inchangé en fin de partie (KI-067, D-062) ; effet
  sur la garde d'écartement et les refus.
- **Mesure** : protocole du § 4 (trois mesures ensemble, A/A, mêmes conditions) ; qualité selon § 5 ; outil
  `tools/perf-lot.cjs` ; entrées : journaux du lot de référence et du lot accéléré sur la partie de mesure.
- **Dépendances** : V1 (référence), V4 (retirer d'abord le coût de l'analyse), § 4.4 et § 5.2 fixés par la direction **avant
  V3**. **Risques** : le plus élevé de la 4.9.0 ; toucher à l'ordre des lectures d'ESV peut introduire une lecture d'un
  autre cut ; le gain sur une partie peut n'être que le bruit du § 3. Un cycle de terrain par expérience, de 2 à 3 jours.
- **Effort** : M–L. **Profil** : **conception** (préchargement, lecture de l'identité du cut, relecture avant étiquette) ; bornée pour
  les réglages simples une fois l'expérience spécifiée.

### U1 — Résumé de partie (U04)

- **Objectif** : afficher les lots, les cuts distincts traités, les différés restants et ce qui reste inconnu, sans compter
  deux fois une reprise (besoins:89). Prévu en 4.9.0.
- **Porte.** *MINIMUM* : les comptes sont **identiques à ceux de l'outil d'analyse** sur des lots de référence (lot 25 :
  81 cuts distincts, 69 posés, 12 différés, `lot-485-p25…:11-13` ; partie 23 : lot 1 de 47 cuts et reprise de 6 sans double
  compte, `lots-20-24-33…:15-16`). *OBJECTIF* : aucun. *À VÉRIFIER* : règle « une reprise ne se compte pas deux fois »
  (D-057 : compté par partie, `DECISIONS.md:236-238`) ; les inconnus sont écrits comme inconnus, pas comme zéro.
- **Mesure** : comparaison avec `tools/analyse-locale.cjs` sur les lots du dépôt de données ; **dépendances** : aucune.
  **Risques** : compter un cut différé puis posé deux fois. **Effort** : M. **Profil** : bornée.

### U2 — Essais du vrai panneau (C02)

- **Objectif** : contrôler le panneau réel : clavier, passage du focus entre commandes, affichage agrandi à 200 %, animations
  réduites (besoins:90).
- **Porte.** *MINIMUM* : la liste d'essais ci-dessus passe dans Chromium réel, avant livraison (besoins:108) ; les essais
  rouges sans correctif. *OBJECTIF* : aucun. *À VÉRIFIER* : contrastes WCAG déjà corrigés en 4.8.0 (D-059) non régressés.
- **Mesure** : essais navigateur sur le modèle de `tools/navigateur-telechargements.cjs` (Chromium réel, hors banc).
  **Dépendances** : aucune. **Risques** : essais trop longs (règle de 7 s). **Effort** : M. **Profil** : bornée.

### U3 — Raccourcis `D` et `Maj + Espace`

- **Objectif** : préciser les actions de `D` et de `Maj + Espace`, **sans détourner ni doubler une action d'ESV**
  (besoins:91).
- **Porte.** *MINIMUM* : aucune action d'ESV doublée ou détournée (essai) ; l'action de chaque raccourci est écrite.
  *OBJECTIF* : aucun. *À VÉRIFIER* : « `Maj + Espace` valide déjà dans ESV » (dit dans les échanges, **SUPPOSÉ**, non
  vérifiable dans le dépôt) ; **l'action de `D` n'est pas définie dans les fichiers lus** (à fixer avant U3).
- **Mesure** : essai de clavier dans le panneau réel (avec U2) ; confirmation de l'opérateur (tâche de 10 min).
  **Dépendances** : U2 (même banc). **Risques** : conflit avec une touche d'ESV. **Effort** : S. **Profil** : bornée.

### V5 — Stockage incrémental (P01) — conditionnel

- **Objectif** : ne se faire que si un long lot montre une dérive de mémoire ou de temps (besoins:93). La faisabilité de
  l'export unique reste à vérifier dans tous les cas (V2).
- **Porte de déclenchement** : la mesure de V1 sur un long lot montre une dérive. **Le seuil de « dérive » et la longueur du
  « long lot » ne sont pas dans le dépôt : à fixer par la direction** avant la décision. *MINIMUM DE SORTIE (si lancé)* :
  pas de perte de données (KI-064), lecture des anciens formats, décisions identiques. *OBJECTIF* : aucun. *À VÉRIFIER* :
  point de départ : vitesse par cut selon le rang du cut, taille du stockage, mémoire (mesure de la mémoire du navigateur
  **SUPPOSÉE** possible).
- **Mesure** : V1 ; un lot long fourni par l'opérateur (les lots connus : 47 à 213 cuts en 4.8.0, `lots-20-24-33…:12-17`,
  donc probablement trop courts). **Dépendances** : V1 et cette mesure. **Risques** : chantier de stockage = risque de perte
  de données. **Effort** : L. **Profil** : **conception** si lancé (le risque est de la même classe que KI-064).

## 7. Porte de version 4.9.0

Cycle médian **−25 %** (V3, V4 et le reste ensemble), mesuré selon le § 4 sur une partie neuve ; C1 et C4 non dégradés
selon le § 5 ; C3 = 0 ; les trois mesures publiées ensemble ; 0 capture perdue ; exports conformes au § 8 (petit fichier :
zéro différence) ; U1 à U3 livrés ; V5 selon le résultat des longues sessions ; **audit d'Astra du diff avant toute version
stable**, décision de la direction en dernier (D-061, `DECISIONS.md:102-104`). La capture seule ne suffit pas (§ 3). Objectif
−40 % : non bloquant.

## 8. Exports : « Sauvegarder tout » et « Préparer pour analyse »

### 8.1 Deux actions (besoins:39-58)

| Action | Résultat |
|---|---|
| **Sauvegarder tout** | un fichier complet par lot Orbite ou par session Écho : tout le nécessaire pour conserver, vérifier et réanalyser le travail (points LiDAR et autres informations utiles conservés). **ZIP unique proposé, sous réserve de faisabilité.** Il contient aussi la partie préparée pour l'analyse. |
| **Préparer pour analyse** | un petit fichier à transmettre à la main, sans tri ni regroupement de morceaux ; il ne transmet rien à un tiers ; récupérable sans ouvrir la sauvegarde complète ; **limité au lot ou à la session** ; **complément, pas un remplacement**. |

### 8.2 Faisabilité du fichier unique (première étape de V2, avant toute promesse)

Le développement doit démontrer, dans l'ordre : (a) une **construction en flux** qui ne réunit pas plusieurs Go en mémoire
(les lots connus : 200 Mo à 1,03 Go ; 990 Mo de relecture, `consignes/analyse-locale.md:9-11`) ; (b) compatibilité avec la
limite de **64 Mio par message** entre parties de l'extension (KI-059 : le panneau lit déjà IndexedDB directement,
`KNOWN_ISSUES.md:51`) ; (c) compatibilité avec le format en **segments** et son dictionnaire (KI-060 : premier nuage des
segments 2 et suivants ; lecture des segments d'avant 4.7.20, `KNOWN_ISSUES.md:50`) ; (d) **écriture progressive vers le
disque sur le poste réel de l'opérateur**. Ce poste est décrit comme restreint : `consignes/analyse-locale.md:5` (« poste
de travail restreint », une page à ouvrir dans Edge, rien à installer) ; les restrictions réelles (boîtes de dialogue,
politique d'Edge) sont **SUPPOSÉES**, à vérifier (**SUPPOSÉ aussi** : l'API d'écriture progressive et les formats de
compression utilisables dans Edge). ZIP : un ZIP de plus de 4 Go exigerait une extension du format, **SUPPOSÉ** à vérifier.
**Si une de ces conditions échoue** : remonter à la direction avec une solution de remplacement concrète (par exemple
plusieurs volumes regroupés automatiquement sous un nom commun, ou écriture dans un dossier choisi) ; **ne pas
réintroduire silencieusement le tri de dizaines de fichiers** (besoins:54).

### 8.3 « Préparer pour analyse » : essai obligatoire avant livraison

- **Zéro différence** entre l'analyse du petit fichier et celle de la sauvegarde complète du même lot ou de la même
  session : C1 à C4 quand calculables, écarts de pose, temps, états non évaluables (besoins:62).
- **Limité au lot ou à la session** (KI-068) : visites et événements étrangers exclus, références nécessaires conservées.
  Précédents du dépôt : `tools/filtrer-journal.cjs` (1,03 Go → 7,8 Mo sur le lot 33), `tools/reducteur-exports-core.js` et
  la page `tools/navigateur/reducteur-exports.html` (rapports identiques, `consignes/analyse-locale.md:9-11`, `lot-485-p25…:65-66`).
- **Méthode d'essai** : sur au moins un lot Orbite et une session Écho, générer les deux fichiers, lancer le même calcul
  (`tools/analyse-locale.cjs`) sur chacun, comparer les rapports (comparaison automatique de tous les champs, pas
  seulement les C). Sur un lot long représentatif au moins une fois.

### 8.4 Noms lisibles (besoins:75-83)

Format proposé : `Ariane_2026-09-30_1345_Partie-36_Orbite_v4.9.0.zip` (date, heure, partie, mode Orbite ou Écho, version) ;
le petit fichier ajoute `Analyse` ; la version est **aussi enregistrée dans le contenu**. Aujourd'hui les noms commencent
par `ariane-…` (D-058). Deux exports à la même heure ne doivent pas s'écraser : le développement choisit une distinction
simple (par exemple un compteur ou les secondes). **Sessions couvrant plusieurs parties : à préciser avant livraison** (options :
un fichier par partie ; ou un nom `Parties-36-37` ; ou `Multi-parties` avec la liste dans le contenu).

### 8.5 Fiabilité de l'enregistrement (KI-064)

Le fichier est déclaré complet **seulement** si son contenu attendu est présent et son enregistrement confirmé ; en cas
d'échec ou d'interruption les données sources restent et l'opérateur peut réessayer ; **aucun effacement automatique ne se
fonde uniquement sur le lancement du téléchargement** (besoins:66-73 ; `KNOWN_ISSUES.md:46` : `chrome.downloads`, état final
lu). Essais : enregistrement refusé, interrompu, fichier incomplet, nouvel essai, longue session représentative. Outils
existants : `tests/audit-qualite-480.test.cjs`, `tests/budget-liberation.test.cjs`, `tools/navigateur-telechargements.cjs`.

### 8.6 Anciens exports

Lecture conservée pour les formats existants (champs `format` inchangés, D-058, `DECISIONS.md:192-193`), y compris les
segments d'avant 4.7.20 (KI-060) et le journal alourdi (KI-068).

## 9. Base de code (KI-069, 4.8.6)

Le correctif de fin de partie **KI-069** (le dernier cut à valider d'une partie fait quitter la partie à ESV, terrain du 30/09,
partie 36, `KNOWN_ISSUES.md:41`) est **en essai en 4.8.6** sur la branche `claude/banane-486-ki069` (tête au moment de la
rédaction : `654209d`) ; **D-065 n'est pas dans `main`**. **Il n'est pas intégré ici.**

**Il faut trancher, avant les chantiers, quelle base de code (4.8.5 ou 4.8.6) sert de référence de mesure.** Options :
(A) référence = `v4.8.5` + V1 seul (conforme aux besoins:23), la 4.8.6 rejoint la 4.9 après sa propre validation ; (B) référence
= 4.8.6 + V1, si la direction valide la 4.8.6 **avant V1**. Effets : le chemin de fin de partie touche `background.js`,
comme V1 (jamais deux chantiers ensemble, `PLAN_SUITE.md:154`) ; la référence de vitesse ne doit pas changer en cours de
route (besoins:99 : « sans changer silencieusement la référence de mesure 4.8.5 »).

## 10. 4.9.5 : cuts difficiles

Ordre : **B1 dès que les données de D4 le permettent, puis B2 après sa tâche de 10 min, puis B3 si besoin** (`PLAN_SUITE.md:139-140`).

### B1 — Voisins validés en ligne (D-054)

- **Objectif** : utiliser des voisins validés comme appuis, **en dernier recours**, si leur **identité, leur validation, leurs
  coordonnées et leur fraîcheur** sont confirmées (besoins:94 ; Astra, constat 6, `PLAN_SUITE.md:71-72`). La règle D-054
  existe (garde de cohérence : ±5 cuts, 8 mm, au moins trois voisins cohérents ; jamais une cible d'écartement).
- **Porte.** *MINIMUM* : sur une partie neuve, **C1 en hausse** et **0 faux ajouté sur les cas évalués** (besoins:94,
  `PLAN_SUITE.md:130`) ; deux rails ou rien. *OBJECTIF* : aucun chiffre. *À VÉRIFIER* : les données de D4 (nombre de cuts
  voisins dont la page garde les rails) suffisent-elles ? ; la source de lecture d'un voisin validé (D-054 : « pas encore
  de source sur le terrain ») ; sur la partie 9, la garde a retiré 6 décisions justes au passage à niveau (D-054, suite).
- **Mesure** : banc puis lot sur une partie neuve, relecture Écho, C1 et C4 selon § 5 ; outils : `tools/validated-anchors-study.cjs`,
  `tools/analyse-locale.cjs`. **Dépendances** : D4 (livré en 4.8.5), 4.9.0 stable. **Risques** : appuis faux propagés
  (partie 9, voisin à 31-34 mm) ; interaction avec la dérive en chaîne observée sur la partie 25 (cuts 108 à 114, `lot-485-p25…:77-84`,
  non démontrée). **Effort** : M. **Profil** : bornée, avec relecture indépendante renforcée du diff.

### B2 — Décentrer la vue d'ESV (D-049)

- **Objectif** : rendre accessibles les rails hors écran, après vérification terrain de la commande possible (besoins:95).
  Cas mesurés du brouillon 0.1 : partie 33 (cuts 8090–8099), partie 2 (114, 117–121), partie 9 (8504–8506) ; la partie 11 :
  69 cuts sur 117 hors de la fenêtre (`orchestration-480-485-490…:132`).
- **Porte.** *MINIMUM* : sur les zones décalées des parties 2, 11 et 33 posées (`PLAN_SUITE.md:131`) : **0 faux ajouté**,
  deux rails ou aucun, **contrôle de la pose avant validation**, **temps supplémentaire mesuré et publié**. *OBJECTIF* :
  aucun chiffre. *À VÉRIFIER* : la tâche de 10 min : ESV permet-il de déplacer la vue par programme ? (sinon : variante en
  deux temps, brouillon 0.1 § 1.3, point 7) ; repli en cas d'échec = différer, jamais de pose partielle ni de VALIDATE.
- **Mesure** : prototype en version de test ; entrées : lots sur les zones décalées + une partie neuve ; temps par cut décentré
  via V1. **Dépendances** : tâche de 10 min de l'opérateur ; 4.9.0. **Risques** : dépendance à des symboles internes d'ESV
  (KI-026) ; caméra qui bouge pendant la capture ; les parties 2, 11 et 33 servent au réglage : la validation exige une partie neuve.
  **Effort** : L. **Profil** : **conception** (risque comparable à V3).

### B3 — Organisation des transitions du lot (C01), conditionnel

- **Objectif** : seulement si le déplacement de la vue l'exige (besoins:96) : coordinateur et transitions nommées autour du
  moteur épinglé (enveloppes de `background.js`).
- **Porte.** *MINIMUM* : décisions inchangées (banc) ; reprise, pause, arrêt, F5 : essais existants inchangés. *OBJECTIF* :
  aucun. *À VÉRIFIER* : la nécessité même (décidée après B2). **Dépendances** : B2. **Risques** : conflit avec toute autre
  modification de `background.js`. **Effort** : L. **Profil** : conception.

## 11. Critères ouverts

| # | Critère | Pourquoi il est ouvert | Qui tranche | Comment (mesure prévue) | Avant |
|---|---|---|---|---|---|
| 1 | Base de code de référence (4.8.5 ou 4.8.6) | KI-069 en essai, D-065 absent de `main` | direction | essai de la 4.8.6 sur le terrain ; comparaison des diffs avec `v4.8.5` | V1 |
| 2 | Définition des silences exclus | les besoins veulent une définition fixe ; l'outil utilise 60 s | direction | V1 publie la distribution des écarts entre événements pour confirmer 60 s | fin de V1 |
| 3 | Part réelle de « navigation → capture » | deux lots seulement (48 %, 63 %) | V1 | V1 sur plusieurs lots (nombre à fixer, proposition : ≥ 3, parties différentes) | conception de V3 |
| 4 | Part du calcul V4.6 dans le cycle | non mesurée | V1 | mesure de la phase d'analyse avant/après V4 | porte de V4 |
| 5 | Méthode de comparaison (M1, M2, M3) | mêmes cuts impossibles après validation | direction | essai à blanc A/A sur la partie de mesure | V3 |
| 6 | Tolérance sur durée totale et arrêts/100 | non donnée par la direction | direction | écart A/A publié, options T1 à T3 | V3 |
| 7 | Taille d'échantillon et intervalle de la médiane | variance des cycles (6,0 à 14,5 s selon les lots) | direction avec l'audit d'Astra | variance mesurée par l'A/A | V3 |
| 8 | Tolérance « sans baisse de C1 » | C1 varie de 66,7 % à 85,2 % selon les lots | direction | C1 A/A sur la même partie ; comparaison sur le même protocole | V3 |
| 9 | Non-dégradation de C4 (§ 5.2) | 100 jugés ne démontrent rien contre 0,28 % | direction | niveaux 1 à 3 du § 5.2 ; faisabilité d'une capture appariée à établir | V3 |
| 10 | Partie neuve de validation de la 4.9.0 | ≥ 100 posés jugés, ~200 cuts non validés | direction (choix de l'opérateur) | registre `audit/rotation-parties.md` (D9) : nombre de cuts non validés lu par le compteur passif | mesure finale de V3 |
| 11 | Périmètre et base du −40 % de V2 | données étrangères et données utiles mêlées | direction | ventilation du poids par composant au démarrage de V2 (§ 6, V2) | V2 |
| 12 | Faisabilité du ZIP unique en flux | mémoire du navigateur, 64 Mio, segments, poste restreint | développement, puis direction si impossible | essai de faisabilité sur le poste de l'opérateur (§ 8.2) | promesse de V2 |
| 13 | Nom des sessions multi-parties ; collisions de noms | non précisés | direction / développement | essai de nommage sur une session réelle | livraison de V2 |
| 14 | Gain de taille pour Écho | aucune mesure | V2 | poids par composant d'une session Écho avant/après | porte de V2 |
| 15 | Seuil de « dérive » et longueur du « long lot » (V5) | rien dans le dépôt | direction | V1 : vitesse par rang de cut et taille de stockage sur le lot le plus long | décision V5 |
| 16 | Action de `D` ; comportement de `Maj + Espace` dans ESV | non définie / dite dans les échanges | direction ; l'opérateur confirme (10 min) | essai clavier dans le panneau réel | U3 |
| 17 | Séquencement U1 à U3 : en série ou en parallèle | `PLAN_SUITE.md:135` et le démarrage 4.9 disent « en parallèle » ; les besoins disent « une chose à la fois » | direction | — (décision de cadence) ; **proposition : en série**, il n'y a qu'un exécutant (§ 2.3) | U1 |
| 18 | Ce que « C1 en hausse » veut dire pour B1 | aucun seuil | direction | C1 sur une partie neuve vs référence même protocole | B1 |
| 19 | Faisabilité du déplacement de la vue | jamais inspecté | opérateur | tâche de 10 min | B2 |
| 20 | Nécessité de B3 | dépend de B2 | orchestrateur, direction | revue de B2 | B3 |
| 21 | Usage du résultat P2 | interdit de régler les seuils automatiquement | direction | lecture du rapport P2 | conclusion sur la précision |
| 22 | Trailer de commit et nom des branches de l'exécutant Sol | les règles du dépôt visent les sessions Claude (`Co-Authored-By`, `Claude-Session`) ; aucun nom de branche n'est fixé pour Sol | direction | proposition : trailer `Session:` avec le lien ou l'identifiant de la session, sans nom de modèle ; branches `sol/49-<chantier>` | premier commit |
| 23 | Autonomie du cahier pour un exécutant sans historique | le cahier est la seule mémoire de la session Sol (§ 2.3) | Astra (question 9), puis la direction | lecture de l'audit d'Astra ; premier rapport de chantier (les questions posées montrent ce qui manquait) | signature |

## 12. Questions pour l'audit d'Astra

1. **Ordre** : V4 avant V3 est justifié par le calcul du § 3 (V3 seul insuffisant) : l'ordre P2, V1, V2, V4, V3 est-il le bon,
   ou V2 (long, risqué) doit-il passer après V3 pour ne pas retarder la porte de 4.9.0 ?
2. **Référence** : « 4.8.5 + V1 » n'est pas l'étiquette `v4.8.5` : la preuve « décisions identiques » suffit-elle ? La question
   4.8.5/4.8.6 (§ 9) bloque-t-elle V1 ?
3. **Portes de V3** : la porte de chantier (capture −30 %) et la porte de version (cycle −25 %) sont-elles cohérentes ?
   Le critère « 0 capture perdue » est-il mesurable sans capture appariée ?
4. **Non-dégradation C4** : les niveaux du § 5.2 sont-ils acceptables ? La capture appariée est-elle réalisable sans réutiliser
   la relecture pour régler ?
5. **Faisabilité de V2** : le fichier unique est-il tenable ? Le plan a raison de mettre l'essai de faisabilité en premier,
   mais V2 dépend de la décision « remplacement » de la direction ; V2 doit-il être scindé (petit fichier d'abord) ?
6. **Séquencement** : les besoins imposent une chose à la fois ; le plan et le démarrage 4.9 autorisent U1 à U3 en parallèle ;
   `background.js` est commun à plusieurs chantiers.
7. **Dérive de périmètre** : « Origine des mesures » est ajoutée comme règle transversale (pas un chantier) ; B2 exige des
   parties de réglage puis une partie de validation neuve ; le nombre de cycles opérateur (V3 : au moins trois expériences, soit
   plusieurs créneaux de 1 h 15) est-il compatible avec la cadence D-061 ?
8. **Portes chiffrées manquantes** : V4 et V1 n'ont pas d'objectif chiffré (aucune mesure de départ) ; est-ce acceptable ?
9. **Autonomie** : le développeur est une session externe qui n'a pas notre historique (§ 2.3). Le cahier, le protocole de
   livraison et la carte du code (§ 14) sont-ils assez autonomes ? Que manque-t-il pour que la première question de
   l'exécutant ne soit pas « où est-ce » ?
10. **Séparation des rôles** : l'exécutant code, Claude ou Grok relisent, l'orchestrateur accepte, la direction décide
    (§ 2.3). Est-ce une séparation suffisante pour V3, V2 et B2 (profil « conception »), ou faut-il une relecture d'Astra ?

## 13. Journal de vérification

**Vérifié dans le dépôt** (fichier et ligne) : la ligne 118 (4,54 s, 48 %) et la ligne 125 (9,5 s) de
`audit/orchestration-480-485-490-2026-09-28.md` ; la ligne 21 (4,3 s, 63 %) et la ligne 16 (6,7 s) de
`audit/lot-485-p25-2026-09-29.md` ; le tableau des cycles (`lots-20-24-33…:12-19`) ; le poids du lot 33 (`KNOWN_ISSUES.md:42`) ;
la règle C4 (`PLAN_SUITE.md:14`) ; les définitions de silences dans `tools/perf-lot.cjs:27,39,87` ; la branche
`claude/banane-486-ki069` (`git ls-remote`, tête `654209d`) et l'absence de D-065 dans `DECISIONS.md` de cette branche ; l'étiquette
`v4.8.5` sur `323356c` (`git ls-remote --tags`) ; le manifeste en 4.8.5 ; la présence des outils cités (`perf-lot.cjs`,
`p2-plancher.cjs`, `filtrer-journal.cjs`, `analyse-locale.cjs`, `portes-j1.cjs`, `validated-anchors-study.cjs`,
`reducteur-exports-core.js`, `navigateur-telechargements.cjs`).

**Laissé « SUPPOSÉ »** (non vérifié) : la faisabilité de l'écriture progressive et du ZIP unique sur le poste réel ; les
restrictions de ce poste ; les APIs de compression et d'écriture disponibles dans Edge ; le comportement d'ESV avec un cut
préchargé ; le fait que `Maj + Espace` valide dans ESV ; l'action de `D` ; la possibilité d'une capture appariée ; les types
d'événements qui marquent les interventions manuelles ; la convention `4.9.0.N` ; la mesure de mémoire du navigateur pour V5 ;
le mode « aveugle » de `p2-plancher.cjs` ; le fait que V4.6 ne soit pas une vérification avant pose ; la part de posés (environ
85 %) utilisée pour le calcul de la taille de partie du § 5.1. Non relu, hors de la liste : `D-054` en entier (seul le début a
été lu), `KI-038` au-delà de la première partie.

**Incohérences trouvées entre les besoins et le dépôt** (aucune décision de la direction n'est changée) :

1. **Analyse GCV1** : les besoins parlent d'environ 1,8 s puis 0,5 s ; le dépôt donne **1,43 s** (partie 15, `orchestration…:119`)
   et **0,52 s** (lot 25, `lot-485-p25…:21`). Le chiffre 1,8 s n'a pas de source.
2. **63 %** : 4,3 s / 6,7 s = 64 % (calcul) ; les médianes de phases ne s'additionnent pas ; l'écart est un arrondi.
3. **Partie 15** : « ≈ 10 s » (`lot-485-p25…:19`) contre 9,5 s (`orchestration…:125`).
4. **Ordre d'écriture** : `PLAN_SUITE.md:116-117` place le cahier v0.2 après l'audit d'Astra ; le démarrage 4.9 et le présent
   flux le placent avant. Cette rédaction suit le second.
5. **Référence** : « 4.8.5 stable avec V1 » n'est pas l'étiquette ; c'est une construction dérivée (§ 4.1).
6. **Cadence** : U1 à U3 « en parallèle » (`PLAN_SUITE.md:135`, `demarrage-session-49.md:203`) contre « une chose à la fois »
   (besoins:105) et contre la règle « jamais deux chantiers sur `background.js` ».
7. **Poids par cut** : 1,2 Mo (`analyse-locale.md:15`) ; 2,0 Mo par cut sur la partie 15 (calcul, `orchestration…:140`) ; journal
   seul de 65 Ko par cut (KI-059) et 3,5 Mo pour 81 cuts (KI-068) : périmètres différents, à ventiler par V2.
8. **Essais courts** : 7 s (`PLAN_SUITE.md:23`) contre 10 s (`PASSATION_4.8.0.md:42`) ; le plus strict est retenu.
9. **Éléments du brouillon 0.1 non repris par les besoins** : « revenir à un cut, aller au cut précédent » (inspection d'ESV non
   faite), faux sans appui 398 et 402 de la partie 20, régresseur de position (renvoyé après la 4.9). À confirmer par la direction
   comme hors périmètre.
10. **Provenance (D04)** : reprise comme règle transversale (§ 6), pas comme chantier.
11. **Porte de V3** : capture −30 % (plan) contre cycle −25 % (direction) : cohérentes seulement avec V4 (§ 3).
12. **Modèle** : le cahier 0.2 initial proposait des modèles par chantier (Opus, Sonnet). Le développeur étant une session
    Sol (décision de la direction, 30/09), ils sont remplacés par un **profil d'exécutant** (§ 2.3) : *bornée* ou *conception*.

**Révision de l'orchestrateur (30/09, après le rapport de rédaction).** Contrôle par sondage dans le dépôt, tous exacts : les
cycles et le C1 des huit lots (`lots-20-24-33…:12-24`), les phases de la partie 15 (`orchestration…:118-125`), les 6,7 s / 4,3 s
du lot 25 (`lot-485-p25…:16,21`), `SILENCE_MS = 60000` (`tools/perf-lot.cjs:27,39`), les lignes citées de `KNOWN_ISSUES.md` et de
`PLAN_SUITE.md`. Le « ≈ 1,8 s » de l'analyse GCV1 vient de mon propre document de besoins (« d'après ce retour ») ; il n'a pas
de source, le dépôt donne 1,43 s. Ajouts : § 1 (ligne exécutant), § 2.3, § 14, profils d'exécutant, questions 9 et 10 pour Astra,
critères 22 et 23.

## 14. Annexe A — Carte du code par chantier (pour un exécutant sans l'historique)

Chemins relatifs à la racine du dépôt `banane`, **vérifiés présents au 30/09** ; les numéros de ligne sont ceux de cette
branche et peuvent bouger. « Premier pas » = ce que l'exécutant fait avant d'écrire du code. Le point d'entrée d'un chantier
est indicatif : **la cartographie exacte est le premier livrable de l'exécutant** (à écrire dans son rapport).

**Architecture, en cinq lignes.** `background.js` (service worker, racine, 916 lignes) charge les modules `src/*.js` et pilote
le lot ; `src/adapter-page.js` est injecté dans la page d'ESV (monde MAIN) et exécute les commandes (navigation, capture,
pose, validation) ; `src/bridge.js` relie la page et le service worker ; `panel.js` et `panel.html` sont le panneau (tous les
exports y sont écrits) ; `src/engine.js` (épinglé) tient l'état du lot et consigne les événements dans le journal.

| Chantier | Fichiers à lire ou modifier | Essais existants proches | Premier pas et vérification |
|---|---|---|---|
| **P2** | `tools/p2-plancher.cjs` (`mesurer`, `toMarkdown`, `run`) ; `KNOWN_ISSUES.md` KI-038 | `tests/p2-plancher.test.cjs` | Lire KI-038 ; vérifier le mode « aveugle » et le tirage de 30 cuts sans choix. `node --test tests/p2-plancher.test.cjs` |
| **V1** | `tools/perf-lot.cjs` (`SILENCE_MS`, décomposition D5) ; événements du cycle : `cut-target-changed` (`src/engine.js:123`), `before-captured` (`:150`), `proposed` (`:172`), `gcv1-shadow-observed` (`background.js:537`), résultats des commandes d'ESV avec durée (`adapter-result`, à partir de `background.js:76` et `src/bridge.js`) ; relevé passif `esv-releve` (`background.js:79-86,897`) | `tests/perf-lot.test.cjs`, `tests/audit-qualite-480.test.cjs`, `tests/acceptance-provenance*.test.cjs` | Lister les phases déjà horodatées et celles qui manquent ; **`src/engine.js` est épinglé** : l'instrumentation se place hors moteur. `node tools/perf-lot.cjs EXPORT.json` sur un journal allégé ; banc `node tools/verify.cjs` ; décisions identiques à `v4.8.5` |
| **V2 + KI-068** | `panel.js` : `writeSegments` (`:631`), `autoExportIfAdvised` (`:851`), `exportComplet` (`:879`), « Tout télécharger » (`:928`), `exporterDiagnostic`/`exporterCorpus`/`exporterJournal` (`:952-968`) ; `src/native-export.js` ; `src/gcv1-export.js` ; `background.js:700` (`exportState`) ; outils de référence : `tools/filtrer-journal.cjs`, `tools/reducteur-exports-core.js`, `tools/merge-segments.cjs`, `tools/analyse-locale.cjs` | `tests/export-manifeste.test.cjs`, `tests/audit-qualite-480.test.cjs`, `tests/budget-liberation.test.cjs`, `tests/analyse-locale.test.cjs`, `tests/reducteur-exports.test.cjs` ; navigateur réel : `tools/navigateur-telechargements.cjs` | Faisabilité du fichier unique (§ 8.2) **avant tout code de format** ; ventiler le poids par composant (`KNOWN_ISSUES.md` KI-059, 060, 064, 068). Comparaison JSON de `analyse-locale` sur petit fichier et sur sauvegarde complète : zéro différence |
| **V4** | `src/gcv1-shadow-bootstrap.js:6` (`BananeGeometryRuntimeV46`), `src/gcv1-shadow.js:8-11` (façade qui garde V4.6 par défaut), `src/lot-decision.js`, `background.js:3-8,22,494,829` | `tests/engine-v46*.test.cjs`, `tests/gcv1-*.test.cjs` ; `tools/portes-j1.cjs` | Cartographier qui appelle V4.6 pendant un lot et ce qu'il produit avant de rien retirer (le cahier suppose que V4.6 n'est pas une vérification avant pose : **à démontrer**). Décisions identiques au banc (633 cuts, 8 jeux) |
| **V3** | réglages `pilote` de `src/settings.js` (valeurs de repli dans `src/adapter-page.js:22-23` : `tentativesParVue` 3, `stabiliteMs` 800, `budgetCaptureMs` 60 000, `sondageMs` 80, `lecturesStables` 3, `attenteMs` 12 000, `recentrages` 3, `attenteNavigationMs` 15 000, `attenteClicMs` 5 000) ; lecture après sélection de vue, `src/adapter-page.js:256-258` ; caméra et viewport `:294-329` | `tests/capture-retry.test.cjs`, `tests/adapter.test.cjs`, `tests/esv-*-4800.test.cjs`, `tests/background-lot*.test.cjs` | Un seul réglage par version de test ; protocole du § 4 ; comparaison appariée du § 5.2 niveau 3. Version de test = manifeste `4.9.0.N` |
| **U1** | `panel.js`, `panel.html`, `panel.css` ; vérité de comparaison : `tools/analyse-locale.cjs` (`analyserLot`, `resume`) | `tests/panel-*.test.cjs` | Comptes identiques à l'outil d'analyse sur les lots de référence du § 6 |
| **U2** | `panel.js`, `panel.html`, `panel.css`, `tests/browser/` (banc Chromium réel : `harness.js`, `panel.html`) | `tests/panel-4800.test.cjs`, `tests/panel-h.test.cjs` | Liste d'essais du chantier passée dans Chromium réel |
| **U3** | `src/early-input.js:5-17` (touches d'ESV surveillées : `d`, `a`, `q`, `s`, `g` et flèches pour l'édition ; Maj+Espace, Maj+Retour arrière et Entrée comme décisions) ; `panel.js` | `tests/early-input.test.cjs` | Décision de la direction sur l'action de `D` **avant** le code (§ 11 n° 16) ; essai : aucune action d'ESV doublée |
| **V5** | `src/storage.js` (`BananeStorage3`, 28 lignes), stockage IndexedDB via `background.js` ; `KNOWN_ISSUES.md` KI-064 | `tests/budget-liberation.test.cjs`, `tests/echo-vidage-audit-480.test.cjs` | Seulement si V1 montre une dérive (seuil à fixer, § 11 n° 15) |
| **B1** | `tools/validated-anchors-study.cjs` ; `src/lot-decision.js`, `src/continuity-observer.js` ; relevé passif `esv-releve` (D4) ; `DECISIONS.md` D-054 | `tests/continuity-*.test.cjs` | Lire D-054 en entier (le cahier n'en a lu que le début) ; sur une partie neuve, C1 en hausse et 0 faux ajouté |
| **B2** | `src/adapter-page.js:256-258,294-329` (caméra, recentrage, viewport) ; `KNOWN_ISSUES.md` KI-026 ; `audit/cas-decalage-esv-p2-2026-09-24.md` | `tests/adapter.test.cjs` | Tâche de 10 min de l'opérateur d'abord : ESV permet-il de déplacer la vue par programme ? |
| **B3** | enveloppes de commandes de `background.js` | `tests/background*.test.cjs` | Seulement si B2 l'exige ; décisions inchangées au banc |

**Commande unique de contrôle** : `node tools/verify.cjs` (2 à 3 min ; § 2.3). **Documents à lire avant le premier chantier**, dans
cet ordre : `PASSATION_4.8.0.md` (règles), `DECISIONS.md` (D-054, D-057 à la dernière), `PLAN_SUITE.md` § 3, `KNOWN_ISSUES.md`
(KI-059, 060, 064, 066 à 069), `consignes/besoins-4.9-2026-09-30.md`, `audit/lots-20-24-33-2026-09-29.md`,
`consignes/analyse-locale.md`.
