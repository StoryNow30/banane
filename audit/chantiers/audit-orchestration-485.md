# Audit de l'orchestration de la suite d'Ariane (4.8.5, 4.9, au-delà)

> **Mise à jour (28/09, soir)** : étiquettes `v4.8.0`, `v4.7.21` et `v4.7.0` créées par la direction et vérifiées (D-060) ; qualité finale de la 4.8.0 validée par l'expertise de la direction, C4 de la partie 15 non mesuré. Contre-regard d'Astra et suites : `audit-orchestration-485-astra.md` ; plan à jour : `PLAN_SUITE.md`.

**28 septembre 2026.** Prompt : `consignes/chantier-9-auditeur.md`, appliqué à
l'orchestrateur à la demande de la direction. Base : `main` à `ba7282d`.
**Réserve d'indépendance** : l'auditeur est ici l'orchestrateur lui-même. Les
constats qui le mettent en cause sont écrits sans atténuation, mais ce
rapport ne remplace pas le contre-regard d'Astra, qui garde le même prompt.

## Synthèse

1. Le cycle 4.7 → 4.8 a livré, mais à un rythme que le terrain ne pouvait pas suivre : 22 versions en 7 jours, 10 le seul 24/09.
2. Le goulot n'est pas le calcul, c'est **le temps de l'opérateur** : toutes les tâches qui dépendent de lui en grosse session (inspection d'ESV, session mémoire, P2) sont en attente depuis 1 à 5 jours.
3. L'ordre des portes était faux : la 4.8.0 a été validée, puis reconstruite deux fois le même jour (audit P1, essai terrain).
4. La mesure a une dette : 4 lots sur 14 jamais relus ; la qualité finale de la 4.8.0 reste à mesurer sur une partie neuve (attendue le 29/09).
5. La livraison n'était pas pilotée : `main` resté à la 4.7.0 pendant 157 commits, aucune étiquette, et la session ne peut pas en créer.
6. La garde à 1 420 mm tient au recalcul indépendant (0 juste perdu), mais ne repose que sur **2 cas d'une seule partie** : c'est une assurance, pas encore un gain.
7. Proposition centrale : **une seule version de test à la fois sur le terrain**, cycle de 2 à 3 jours, portes go / no-go chiffrées, décisions groupées.
8. Remplacer les sessions d'inspection par de l'**instrumentation passive** (Ariane relève elle-même ce qu'on demandait à l'opérateur de chercher).
9. La 4.8.5 doit rester petite (garde, fin de partie, cohabitation, numérotation des builds) ; tout ce qui attend ESV part en 4.9.
10. L'audit indépendant rapporte le plus à deux moments : avant un paquet stable, et sur toute règle née d'un banc.

## 1. Diagnostic du cycle 4.7 → 4.8

### Ce qui a marché (VÉRIFIÉ)

- **Référence humaine et rotation** : relecture Écho, `tools/acceptance-report.cjs`, rotation réglage / validation (D-057). Les chiffres C1 à C5 se reproduisent (Astra, `audit/chantiers/qualite-480/sortie-reproduite.md`).
- **Moteur épinglé et rejeu** : 633 cuts rejoués, décisions identiques ligne à ligne entre la 4.7.21 et la 4.8.0 (`PASSATION_4.8.0.md`).
- **Retour terrain rapide** : un export reçu est analysé le jour même (parties 11 et 15 le 28/09 : KI-065 corrigé en une heure, KI-067 trouvé sur le premier lot complet).
- **Audit indépendant** : Astra a trouvé un P1 (KI-064, perte possible de données Écho) après sept revues de code de l'orchestrateur.

### Ce qui a coûté

**O1 — Rythme de versions supérieur à la capacité du terrain.**
- Preuve (VÉRIFIÉ) : `CHANGELOG.md`, 22 versions du 22/09 au 28/09, dont 4.7.9 à 4.7.18 le 24/09 ; 148 commits de `5928be4` à `fabd77e`, dont 66 le 24/09. Des 10 versions du 24/09, 6 ont eu un lot sur le terrain (4.7.9, 4.7.10, 4.7.11, 4.7.12, 4.7.14, 4.7.18).
- Conséquence : on analyse des lots de la version N-2 ou N-3 pendant que N est sortie ; une partie des versions n'est jamais observée ; la direction valide sur des mesures d'une version antérieure.
- Amélioration : une seule version de test sur le terrain à la fois ; pas de nouveau paquet sans retour du précédent, sauf panne bloquante.
- Effort S. Priorité **P1**.

**O2 — Portes dans le mauvais ordre : validation avant audit et avant essai terrain.**
- Preuve (VÉRIFIÉ) : 4.8.0 validée (D-058), puis trois paquets le 28/09 (`d3874290…` → `76e435e9…` → `38aa29a2…`, `PASSATION_4.8.0.md`), après le P1 d'Astra (D-059) puis KI-065 à l'essai terrain. Même jour : 4.8.1 annoncée puis retirée (« ça restera une 4.8.0 »).
- Conséquence : une validation qui ne porte plus sur le paquet final ; travail refait (paquet, documents, empreintes) ; confusion possible sur ce qui est installé.
- Amélioration : ordre fixe : code gelé → banc et essais → audit indépendant → essai terrain court (un lot) → **décision de la direction en dernier**. Tout rebuild prend un nouveau numéro de build (§3).
- Effort S. Priorité **P1**.

**O3 — Les tâches de l'opérateur en grosse session ne se font pas.**
- Preuve (VÉRIFIÉ) : inspection d'ESV demandée le 23/09 (`consignes/chantier-1-operateur.md`), non faite (`BANANE_4.9_CAHIER.md` §2) ; session de 50 min du chantier 8 non faite (`audit/chantiers/qualite-480/reponse.md`) ; mesure P2 (F2) non faite (KI-038). L'inspection bloque aujourd'hui trois chantiers (voisins validés D-054, « N on M treated », décentrage D-049).
- Conséquence : le plan d'orchestration du 28/09 repose de nouveau sur une « session d'inspection » ; le même goulot va se reproduire.
- Amélioration : (a) **instrumenter au lieu d'inspecter** : la version de test relève elle-même, sans rien commander, le texte « N on M treated » et l'état des cuts voisins lisibles dans la page, et le range dans le journal ; (b) ce qui reste manuel devient une tâche de 10 min au plus, avec un script à coller et un fichier à déposer, rattachée à un lot déjà prévu.
- Effort M. Priorité **P1**.

**O4 — Dette de mesure : des lots jamais jugés.**
- Preuve (VÉRIFIÉ) : `audit/rapport-sortie-4.8.md`, 14 lots : 7 relus en entier, 3 en partie, 4 jamais (33, 35, 6, 11 ; la partie 11 est relue à 54 % depuis le 28/09). Qualité de la 4.8.0 finale : partie 15 non relue ; chiffres promis le 29/09. Atténuation : la parité du rejeu transfère C4 des parties 9 et 12.
- Conséquence : des lots coûtent du temps à l'opérateur sans rien apprendre ; le taux de faux d'une version se lit avec retard.
- Amélioration : un lot n'est lancé que si sa relecture est planifiée ; la relecture porte d'abord sur les cuts **posés** (80 % suffisent pour C4) ; au rythme du 28/09 (299 visites en 17 min), environ 15 min pour 200 cuts.
- Effort S. Priorité **P1**.

**O5 — Livraison non pilotée.**
- Preuve (VÉRIFIÉ) : `main` à `5928be4` (4.7.0) jusqu'au 28/09, 157 commits derrière ; 0 étiquette sur le dépôt ; `git push` d'étiquette refusé à la session (HTTP 403), branches acceptées.
- Conséquence : le retour arrière pointait un hash, pas une étiquette ; « la version stable » n'avait pas d'identité dans le dépôt.
- Amélioration : la clôture d'une version stable est un jalon avec sa check-list (étiquette par la direction, `main`, publication avec le zip) ; l'étiquette est demandée le jour même.
- Effort S. Priorité **P1** (étiquettes 4.8.0 à créer).

**O6 — Décisions nombreuses, souvent demandées en cours de route, parfois inversées.**
- Preuve (VÉRIFIÉ) : 25 décisions (D-036 à D-060) en 7 jours. Revirements : D-051 « aucune garde sur le premier passage sans appui » → D-060 garde à 1 420 mm ; 4.8.1 → 4.8.0 ; D-043 (pas de chantier en 4.8) repris par D-049 (4.9).
- Conséquence : charge de décision élevée pour la direction ; certaines décisions tombent après que le travail est fait.
- Amélioration : **fiche de décision** groupée, une par cycle : cinq points au plus, chacun avec recommandation, option prudente par défaut et échéance ; consignée D-xxx le jour même. Une inversion de décision cite celle qu'elle remplace.
- Effort S. Priorité **P2**.

**O7 — Outillage de l'orchestrateur fragile.**
- Preuve (VÉRIFIÉ) : le 28/09, `tools/verify.cjs` a échoué sous la charge (fichier d'essais à 9 s pour une limite de 10 s, coupé en deux, `91902e9`) ; le contrôle de sécurité du shell de la session a été indisponible pendant plusieurs tours ; un clone partiel a faussé un premier calcul de divergence avec `main` (corrigé en dépliant l'historique).
- Conséquence : une porte « banc vert » qui peut échouer sans défaut ; un orchestrateur parfois à l'arrêt.
- Amélioration : marge sur les essais (7 s au plus par fichier, alerte au-delà) ; toute vérification d'historique sur un clone complet ; l'état du dépôt se relit au début de chaque session.
- Effort S. Priorité **P2**.

**O8 — Documents d'état périmés.**
- Preuve (VÉRIFIÉ) : `NEXT_TASKS.md` s'arrête à la 4.7.0 ; `PLAN_4.8.md` dépassé ; une trentaine d'entrées de `KNOWN_ISSUES.md` au statut V4.4 à 4.6 ; une passation par version.
- Conséquence : un nouveau venu (Astra, une nouvelle session) lit un état faux.
- Amélioration : un seul document d'état vivant (`LIRE_EN_PREMIER.md`) ; tri des problèmes connus à chaque clôture de version.
- Effort S. Priorité **P2**.

**O9 — Exports lourds pour l'opérateur et pour le dépôt de données.**
- Preuve (VÉRIFIÉ) : lot de la partie 15, 251 cuts : 518 Mo, bilan et corpus portant le même LiDAR (263 + 241 Mo) ; banane-data : 1,7 Go d'historique.
- Conséquence : temps de transfert et d'archivage à chaque cycle.
- Amélioration : export de lot sans doublon du LiDAR (4.9) ; archives brutes hors historique git (publications ou LFS).
- Effort M. Priorité **P3**.

### Contre-calcul de la garde à 1 420 mm (elle décide d'un jalon)

`audit/chantiers/orchestration-485/garde_1420.py` (Python, sans le code
JavaScript), sur les sorties du banc (`garde_1420.txt`) :

- 736 lignes de premier passage ; le drapeau « faux » suit exactement la définition > 10 mm (0 incohérence) ;
- 242 premiers passages sans appui appliqués : 168 jugés justes, 3 faux (707 à 1 405,0 mm, 711 à 1 414,5 mm, 7523 à 1 437,2 mm) ;
- sous 1 420 mm : 707 et 711 seulement ; juste le plus serré à 1 426,1 mm ; marge de 6,1 mm au-dessus et 5,5 mm en dessous ;
- bilans de l'outil recalculés : identiques (faux 10 → 9, 0 juste perdu).

Lecture : le calcul tient. En revanche, la preuve ne repose que sur **deux
faux, tous deux de l'Écho de la partie 11** (zone où la pose d'ESV est à
20 cm). Et 7523, faux vertical, reste hors de portée de l'écartement. Il faut
donc traiter la garde comme une **assurance peu coûteuse** contre les erreurs
grossières (145 et 301 mm), et non comme un gain de qualité démontré. Sur la
partie neuve, compter ses refus : 0 à 2 attendus. Au-delà, elle se trompe de
cible. (Non recalculés ici : le rejeu de la décision et la géométrie des
erreurs, qui restent ceux de l'outil.)

## 2. Feuille de route orchestrée

| Jalon | Contenu | Opérateur | Orchestrateur | Astra | Porte go / no-go (mesurable) |
|---|---|---|---|---|---|
| **J0 — clôture 4.8.0** (29/09) | étiquettes, qualité finale | étiquettes `v4.8.0`, `v4.7.21`, `v4.7.0` ; chiffres des relectures p15 et p11 | rapport de sortie complété ; tri des problèmes connus | — | C4 évaluable sur la partie 15 (≥ 80 % des posés jugés), chaque faux nommé et typé |
| **J1 — 4.8.5 test 1** (code gelé) | garde 1 420 ; KI-066 ; KI-067 ; cohabitation (nom TEST, refus si une autre Ariane est active) ; numéro de build ; instrumentation passive (« N on M », voisins lisibles) | — | code, essais rouges sans correctif, rejeu des 633 cuts et des 8 jeux, essai Chromium de cohabitation | relecture du diff et recalcul des portes (48 h au plus) | `verify` à 0 ; rejeu des 633 cuts de validation : 0 décision changée ; 8 jeux : seuls 707, 711 (refusés) et 718 (ricochet) changent, 0 juste perdu |
| **J2 — terrain 4.8.5** | un lot sur une partie neuve, puis sa relecture | lot (≈ 45 min, surveillance légère) ; relecture Écho des posés (≈ 15 min) ; « Tout télécharger » | mesure avant tout réglage ; lecture de l'instrumentation | — | C1 ≥ 79 % ; C3 : 0 hors contrat ; C4 évaluable, faux ≤ 2 pour 100 jugés et chacun typé ; 0 interruption non reprenable ; refus de la garde : 0 à 2 |
| **J3 — 4.8.5 stable** | étiquette, `main`, publication | étiquette | clôture (check-list) | avis sur la clôture | toutes les portes J2 ; la 4.8.0 reste installée en secours |
| **J4 — 4.9 a : vitesse et exports** | capture (4,5 s sur 9,5 s par cut) ; comparaison V4.6 à la demande (P03) ; export sans doublon | un lot de mesure | instrumentation par phase, optimisations | revue de la mesure | cycle médian −25 % sans perte de C1 ni hausse de C4 ; export −40 % |
| **J5 — 4.9 b : atteindre les cuts difficiles** | voisins validés en ligne (D-054) ; décentrage de la vue (D-049) | 10 min de relevé si l'instrumentation ne suffit pas | conception depuis les données instrumentées | audit de conception avant code | parties 2, 11 et 33 (zones décalées) : cuts aujourd'hui différés posés, 0 faux ajouté |
| **Après la 4.9** | P2 mesuré ; régresseur appris ; 5.0 multi-session | deux relectures d'une même partie (P2) | — | — | selon le cahier 4.9 signé |

**Chemin critique** : J0 → J1 → J2 → J3. J2 dépend d'une partie neuve choisie
par l'opérateur et d'un créneau d'environ 1 h 15. J4 peut démarrer pendant J2
(mesures déjà disponibles) ; J5 attend les données instrumentées de J2.

**À couper ou repousser** : garde de voie à 20 mm (B), sauf si le rejeu après la
garde à 1 420 mm ne perd plus aucun juste ; choix à un appui (7738, 7026) :
banc seulement ; biais vertical des passages à niveau : 4.9 ; raccourcis
clavier, résumé de partie (U04) : 4.9 b au plus tôt ; coordinateur de lot
(C01) : seulement quand le décentrage l'exige ; régresseur appris : après la
4.9.

## 3. Système de pilotage

**La boucle, un cycle de 2 à 3 jours, une seule version de test sur le terrain.**

| Jour | Qui | Quoi |
|---|---|---|
| J | orchestrateur | paquet de test N (nouveau numéro de build), note de 10 lignes : ce qui change, ce qu'il faut regarder |
| J+1 | opérateur | un lot, « Tout télécharger », relecture des posés, dépôt (≈ 1 h 15, dont environ 20 min d'attention) |
| J+1 soir | orchestrateur | mesure, portes, **fiche de décision** (5 points au plus) |
| J+2 | direction | décisions (5 min), consignées D-xxx le jour même |

**Test contre stable.**
- Stable = une étiquette `vX.Y.Z`, jamais reconstruite.
- Test = `version` du manifeste `4.8.5.N` (N = build), `version_name` « 4.8.5 test N » ; un rebuild prend N+1, jamais le même numéro.
- Une seule Ariane active à la fois (D-060) ; la stable reste installée.
- Promotion d'un test en stable : aux portes de J3.

**Décisions.**
- Une fiche par cycle ; option prudente par défaut si pas de réponse sous 48 h.
- Les décisions de règles (gardes, seuils) passent par le banc **et** par une partie neuve ; les décisions de produit (noms, interface) ne bloquent pas un paquet.

**Tableau de bord (8 indicateurs, un par ligne, à chaque cycle).**

| Indicateur | Source | Cible |
|---|---|---|
| C1 couverture, par partie | rapport d'acceptation | ≥ 79 % |
| C4 faux / jugés, et part jugée | idem | ≤ 2 / 100, part ≥ 80 % |
| C3 hors contrat appliqués | idem | 0 |
| Interruptions par heure de lot (pauses non reprenables, erreurs) | journal, `tools/perf-lot.cjs` | 0 |
| Cadence (cuts/h) et capture médiane | `tools/perf-lot.cjs` | 345 cuts/h puis mieux (4.9) |
| Temps opérateur par cycle | déclaré par l'opérateur | ≤ 1 h 15, attention ≤ 30 min |
| Dette de mesure : lots non relus, posés non jugés | rapport de sortie | 0 lot non relu |
| Banc : justes perdus par changement de règle | banc | 0, sauf décision nommée |

**Charge de l'opérateur, minimisée.**
- Une seule tâche par cycle : un lot, suivi de sa relecture.
- Tout le reste passe par l'instrumentation passive ou par une tâche de 10 min rattachée à ce lot.
- Pas de relecture des cuts différés : elle ne sert pas C4.

## 4. Place de l'audit indépendant dans la boucle

| Moment | Ce qu'Astra fait | Forme | Pourquoi là |
|---|---|---|---|
| Avant un paquet **stable** (J1 et J3) | relit le diff, recalcule les portes | liste de constats, P1 bloquant ; commandes de reproduction | le P1 KI-064 est passé à travers sept revues internes |
| Sur toute **règle née d'un banc** | recalcul indépendant (son langage), test de sur-apprentissage | une page : même chiffre ou écart expliqué | une règle réglée sur la partie qui l'a inspirée (garde à 1 420 mm) |
| Une fois par version mineure | audit du pilotage (ce prompt) | rapport court | les dérives de rythme ne se voient pas de l'intérieur |
| Pas à chaque build de test | — | — | 48 h de délai par build ralentiraient la boucle sans gain |

## Questions pour la direction

1. **Cadence** : une seule version de test sur le terrain à la fois, un cycle de 2 à 3 jours — d'accord ?
2. **Ton temps** : quel créneau fixe par cycle (proposé : 1 h 15, dont 20 à 30 min d'attention) ?
3. **Instrumenter au lieu d'inspecter** : autorises-tu la version de test à relever passivement des textes et états d'ESV (sans commande, sans code d'ESV dans les dépôts) pour remplacer la session d'inspection ?
4. **Portes de la 4.8.5 stable** : faux ≤ 2 pour 100 jugés, C1 ≥ 79 %, 0 interruption non reprenable — à garder ou à ajuster ?
5. **Étiquettes** : les crées-tu à chaque clôture, ou veux-tu ouvrir ce droit à la session ?
