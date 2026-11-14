# Passation de session : démarrer ou reprendre une session Claude de zéro

Pour toute nouvelle session Claude Code (cloud ou local) qui rejoint le projet Ariane. Elle remplace le résumé d'une session précédente : tout ce qu'il faut est dans le dépôt. Écrit le 27/10/2026, état mis à jour le 14/11/2026 à 10 h 45 UTC (« Vision 17 » livrée, « Vision 18 » en préparation) ; mets-le à jour à chaque fin de version. **Commence par le § 0 : c'est l'état du jour.**

## 0. État au 14/11/2026 (10 h 45 UTC) : à lire d'abord
Tout ce qui suit est poussé. Tronc `claude/50-test17` à `823b5e7` ; `banane-data` à `1375cd9`. Rien n'est en cours de fusion.

### 0.1 Ce qui est livré, ce qui se prépare
- **Dernier paquet remis à l'opérateur : « Vision 17 »** (12/11). Le paquet se refabrique à tout moment : `python3 tools/package.py --output vision17.zip` depuis le tronc.
- **« Vision 18 » (pas encore fabriquée)** doit contenir, par décision de l'opérateur :
  1. **Le levier de voie N allumé d'office** (D-355), une fois sa parité rendue. Chantier CH-124.
  2. **L'ajustement de hauteur « aj5 » éteint par défaut, avec un réglage pour l'essayer** (D-355). Chantier CH-121.
  3. **Le panneau épuré (D-353) avec les deux palettes Glacier et Sarcelle et une bascule** (D-354 ; Glacier par défaut). Chantier CH-115.

### 0.2 Programme « GCV2.1 » (D-351, D-352) : où lire
- Carnet, règles, verdicts : `chantiers/PROGRAMME_GCV21.md`. Audits et règles R1 à R9 : `chantiers/AUDIT_GCV21.md` (six audits). **À lire avant de lancer ou de juger quoi que ce soit.**
- Banc : `chantiers/CH-116/outils/banc.cjs` (`rejouer`, `juger`, `croise`, `fidelite`, `garde`). Réglages de jugement par défaut : `BANC_ZONES=journal`, `BANC_PASSE_PLAFOND=10`.
- Examens vierges (tenus par CH-116 seul, jamais lus en conception) : `1211v` (12/11, parties 3 et 4) et `1312v` (12/11 au soir, parties 6 à 18, Écho du 13/11 sur les segments 1 à 10 ; **la jointure est à refaire quand l'export final de l'Écho du 13/11 arrivera**). Détail réservé : `banane-data/outils/analyse-lots/CH-116/examen-vierge-*-RESERVE/`.

### 0.3 Verdicts (ÉTABLIS, mesurés)
| Chantier | Levier | Verdict | Suite |
|---|---|---|---|
| CH-124 | **N : refus par l'ancre** (l'axe de la voie relevée, déduit de la trajectoire du véhicule ; seuil 75 mm fixé d'avance ; une pose dont le milieu des deux rails est à plus de 75 mm de l'axe est différée) | Garde d'octobre jugée contre la vérité : 2 362 cuts, 13 refus, 13 vraies corrections, 0 faute. Corpus, première passe : mauvaises voies 29 → 0, justes 496 → 496, différés 591 → 623. Examens vierges : 3 refus, 3 vraies corrections, rien d'autre ne change ; éteint = livré | **Reste : le rejeu du corpus en zones du journal et passe fidèle, et la PARITÉ avec le service worker (12/11, partie 23).** Puis intégration, allumé d'office |
| CH-124 | N+ : après un refus, rechoisir parmi les paires centrées sur l'axe | Figé (`ancre-reprise.patch`), pas jugé | **Non couvert par D-355** : à juger puis à proposer à part |
| CH-121 | **aj5** : hauteur seule, poses de la chaîne seulement | Validation croisée 95,3 % (livré 93,2 %), 11 gagnés, 0 perdu, 0 décision changée. Garde : aucune faute, 53 poses bougées en hauteur seule. Examens : 14 → 16 justes sur `1211v`, identique sur `1312v`. Parité 06/11 p15 : 161 sur 161 | Parité 12/11 p23 : 15 lignes diffèrent, les 15 mêmes à l'éteint (écart banc / service worker d'avant, en ADV) : aj5 hors de cause. R6 sur octobre (CH-116) : 31 poses jugées contre la vérité, 22 rapprochées, 5 éloignées, 4 égales, médiane 9,7 → 4,8 mm ; **un juste passe au-delà de 10 mm** (2-20 cut 275, 0,3 → 10,6). **Entre éteint dans la Vision 18, avec une case d'essai au panneau** ; recalé sur N dans la branche locale de l'intégrateur ; reste une parité N + aj5 allumés ensemble |
| CH-123 | v4BS-sd : faire entrer la bonne paire hors du pool | +7 justes sur les lots vus, 0 faute nouvelle, chaîne intacte, gardes vertes. **Examen vierge (14/11, 10 h 35) : un seul cut posé en plus, à 3,2 mm de la pose de l'opérateur ; rien d'autre ne change** | Patchs éteints sur dossier. **Allumage : décision de l'opérateur à demander** (gain réel mais petit) ; parité à faire sur une partie où le levier agit |
| CH-125 | Calcul de pose à la source | Hauteur seule plafonnée vers 95 à 96 %. Latéral : le rail est ramené à l'écartement de la liste (7,7 mm de l'opérateur en médiane). Contrôle statique : 18 rapprochés, 0 éloigné | **Niveau 1 écarté le 14/11** (garde d'octobre rouge : la mesure est bonne, sa propagation casse octobre). En cours : le travers (réglage figé `reglages/travers.json`), puis passation et arrêt |
| CH-117 | C2 + C5 | Refusé à l'examen | Clos |
| CH-121 | aj3, aj4 | Garde d'octobre rouge | Écartés |
| CH-119 | D, E : choix de voie global | D : garde « rouge » sur 7 fausses alertes (audit 5 : poses de la chaîne à 125-247 mm de la vérité). E figé (29 → 14), garde non finie | **À rejuger contre la vérité d'octobre (R6)**, puis l'ancre dans la vraie extension |
| CH-120 | Génération du pool en ADV | gT nul ; gTE, gTEn, gTEnF écartés. Rappel du pool : 619 sur 747 (82,9 %) | Génération autour de l'axe (gA), à peine commencée |
| CH-122 | Puce apprise | B v1, v2B, v3, B' écartés | Patch B-ancre préparé, non figé |

### 0.4 Sessions filles (tête de branche poussée, état au 14/11 10 h 45)
| Ticket | Session | Branche à | État |
|---|---|---|---|
| CH-115 | `session_01Td4bNnngUKZg9khyFWU96w` | `04b1142` | En attente de l'ordre d'intégrer l'épure et les deux palettes (envoi programmé à 11 h 34 UTC) |
| CH-116 | `session_01Td4bNmvUkN3hwKrz6V1kzy` | `0016c8e` | A rendu l'examen de CH-123 et le jugement R6 d'aj5 (`0016c8e`). Au repos. Seule à lire les examens vierges |
| CH-121 | `session_01Td4bNk2uQhtkP6QNyX6Vtt` | `fdba60b` | Finie : verdict de parité rendu, rapport poussé (`fdba60b`) |
| CH-123 | `session_01Td4bNo7jTEd4NswYNMJfUC` | `dbbeb7e` | Au repos, rapport rendu |
| CH-124 | `session_01Td4bNpSQ9399cdW28RY9eX` | `f9fee1c` | Coupée par la limite pendant la parité de N. Relancée le 14/11 à 10 h 50 UTC (parité d'abord, puis passation et arrêt) |
| CH-125 | `session_01Td4bNjx4xDBqL4deDLhkUV` | `90d671a` | En cours : garde du travers ; puis passation et arrêt (contexte proche de 500 000 jetons) |
| CH-119, 120, 122 | archivées | `c68f75a`, `08e3a50`, `5b8965b` | Passation dans `chantiers/CH-NNN/passation.md` sur chaque branche ; à relancer en session neuve, recentrées sur l'ancre |

Règles de lancement (audit 6, D-356) : **une seule session au modèle le plus fort à la fois**, plus le banc et au plus une session légère ; pas d'effort maximal sans raison écrite ; une session au-delà de 500 000 jetons de contexte finit sa tâche, pousse une passation et est remplacée. La limite d'usage de 5 heures a coupé toutes les sessions trois fois (13/11 vers 12 h et 18 h UTC, 14/11 à 10 h 23 UTC) : après une coupure, relancer par `send_later` à l'heure de levée, dans l'ordre CH-124, CH-116, CH-121.

Tâches programmées dans la session principale (elles meurent avec elle) : 11 h 32 UTC, contrôle des sessions relancées (CH-124, CH-121) ; 11 h 34 UTC, ordre d'intégration à CH-115.

### 0.5 Intégrer le levier N dans le tronc (dès que la parité est bonne)
**Fait le 14/11, hors du tronc** : branche `integration/vision18-n` (d2560e1, poussée) = tronc + les deux patchs de CH-124 + `LEVIERS_V7={ancre:true}` + module déclaré ; 692 essais verts sur 693 (1 sauté) dans 218 fichiers. CH-124 fait sa parité longue sur cet arbre. Il n'y a PAS d'interrupteur pour éteindre N (retour en arrière : réinstaller la Vision 17). Reste avant le tronc : parité, garde (`tools/garde-gcv2.cjs` : les refus de N comptent comme « cuts sans pose » en plus, à expliquer ligne à ligne, puis base à resceller), verify complet, maquette. Ce qui suit décrit le détail.
1. Sur le tronc : `git apply` de `chantiers/CH-124/ancre.patch` (sha256 `55c63f31…`) puis de `chantiers/CH-124/sw-ancre.patch` (sha256 `5c7c1fef…`), pris sur `origin/chantier/CH-124`. Vérifié le 14/11 : les deux s'appliquent sur `823b5e7`.
2. Allumer : la clé `ancre` vaut `null` dans le patch. Le service worker ne lit pas ce levier dans les réglages, il prend `LEVIERS_LIVRES` de `src/gcv2-l1.js` (ligne 585 environ). Ajouter `ancre:true` aux leviers livrés et un réglage pour l'éteindre.
3. Déclarer `src/ancre-trajectoire.js` dans la liste des fichiers nouveaux de `tests/pose-lot-inchanges-4959.test.cjs` ; mettre à jour les essais touchés (cap5, listes du manifeste et du paquet).
4. Preuves : essais ciblés, `node tools/garde-gcv2.cjs`, parités, puis une fois `CHROMIUM=/opt/pw-browsers/chromium node tools/verify.cjs` et la maquette ESV.
5. `CHANGELOG.md`, `LIRE_EN_PREMIER.md`, cette fiche ; paquet `python3 tools/package.py --output vision18.zip`.
- **aj5 ensuite** : `chantiers/CH-121/ajustement-fin.patch` et `sw-ajustement-fin.patch` s'appliquent seuls sur le tronc mais **plus après les patchs de l'ancre** (mêmes lignes : `src/gcv2-l1.js` vers 565, `tests/gcv2-l1-cap5.test.cjs` vers 43, `background.js` vers 1782). Les recaler sur le tronc qui contient N, puis reprouver qu'éteint rien ne change. Réglage : `chantiers/CH-121/reglages/grille-v5.json` (`aj5-final`).
- L'ancre est **muette sur une partie sans liste d'ESV exportée** (mesuré sur une partie du 12/11 au soir) : alors rien n'est refusé, le comportement est celui du livré.

### 0.6 Maquettes et pages du panneau : où elles sont
Toutes les sources sont dans le dépôt ; chaque page est un seul fichier HTML qui s'ouvre d'un double-clic, sans réseau.
| Quoi | Où | Statut |
|---|---|---|
| **Épure de la Constellation, avant et après, en Glacier et en Sarcelle** (D-353, D-354) | branche `chantier/CH-115`, `chantiers/CH-115/comparaison-epure.html` | **Validée par l'opérateur le 14/11** : c'est la cible de la Vision 18 |
| Direction B, deuxième tour : trois palettes (Glacier, Sarcelle, Moka), trois fonds, mouvement | même branche, `chantiers/CH-115/comparaison-b.html` ; feuilles `directions/b2-*.css`, `motion.js` | Glacier et Sarcelle retenues, fond Moyen |
| Trois directions A, B, C sur le vrai panneau | même branche, `chantiers/CH-115/comparaison.html` | B choisie (D-350) |
| Feuille de l'épure et script de la maquette | même branche, `chantiers/CH-115/directions/epure2.css`, `maquette.js` | À porter dans le vrai panneau |
| Fabriquer une page de comparaison | même branche, `chantiers/CH-115/outils/page.cjs` (modèle `page-modele.html`, pages `pages/tour*.json`) ; comptage `outils/compter.cjs`, `inventaire.md` | Outil |
| Panneau « Graphite » (Vision 14), bento de composants | tronc, `maquettes/bento/` | Construit, livré |
| Caractère « Épure » (Vision 15) | tronc, `maquettes/caractere/direction-d.css` | Construit, livré |
| Anciens tours non retenus | tronc, `maquettes/ui-5.0/` ; branches `chantier/CH-101`, `CH-102`, `CH-103` | Références |
Les pages publiées pour l'opérateur (liens privés de son compte) ne sont pas dans le dépôt et peuvent disparaître avec le compte : les fichiers ci-dessus les remplacent. Ce que l'opérateur a dit de constant sur l'interface : sobre et net, pas d'écran chargé (D-353 : la Constellation était « horrible », trop d'informations), l'état et l'avancement du lot au premier plan ; le détail (bilan par partie, départs d'ESV) derrière un geste ; rien n'est retiré du journal ni des exports.

### 0.7 Si l'abonnement s'arrête
- **Ce qui est sûr** : tout ce qui est dans les deux dépôts GitHub (`banane` : code, décisions, tickets, patchs, maquettes ; `banane-data` : exports, sorties par cut, examens). Les branches `chantier/CH-115` à `CH-125` sont poussées.
- **Ce qui est perdu avec la session** : le dossier de travail (copies des paquets : ils se refabriquent), les tâches programmées, la mémoire des conversations. Ce qui reste accessible des sessions et des pages publiées après la fin de l'abonnement n'est pas connu : ne pas compter dessus.
- **Télécommande iPhone** : le relais est en ligne chez Cloudflare, indépendant de l'abonnement. Son adresse n'est écrite nulle part dans le dépôt (elle porte un nom) ; l'appairage se refait par `telecommande/INSTALLATION.md`. Le jeton Cloudflare qui a servi au déploiement peut être supprimé.
- **Pour reprendre plus tard** : ouvrir une session sur `banane` (branche `claude/50-test17`) avec `banane-data` en écriture, mode « auto », et coller « lis `fiches/PASSATION_SESSION.md` puis reprends le rôle d'intégrateur » (§ 7). Première chose à faire : la parité de N, puis le § 0.5.
- **Sans rien reprendre** : la « Vision 17 » livrée reste l'état de référence ; elle ne contient ni N, ni aj5, ni l'épure.

### 0.8 En attente de l'opérateur
- L'export **final** de la séance Écho du 13/11 (les segments 1 à 10 seulement sont versés).
- Un Écho sur un lot neuf **riche en aiguillages** : les examens actuels n'ont que 2 ou 3 mauvaises voies, ils jugent mal un levier de voie.
- Sa décision sur CH-123 (v4BS-sd), puis sur N+ quand il sera jugé.
- Son choix final entre Glacier et Sarcelle, après essai de la bascule.
- L'appairage de la télécommande avec son iPhone.

## 1. Lire, dans cet ordre (15 minutes)
1. `CLAUDE.md` (règles non négociables), `AGENTS.md`.
2. `fiches/RESEAU_IA.md` (rôles, circuit d'un chantier, budget) puis `hub/PROTOCOLE.md` (le hub : messagerie des agents).
3. `LIRE_EN_PREMIER.md` (section du haut seulement : l'état courant), puis `DECISIONS.md` de D-299 à la fin (décisions récentes de l'opérateur : ne jamais les réécrire). `BANANE_5.0_CAHIER_V2.md` § 1, 5, 6 pour le but d'ensemble.
4. Les trois entrées les plus hautes de `CHANGELOG.md`, puis `chantiers/CH-090/etude.md` et `chantiers/CH-092/rapport.md` (où part le temps ; ce qui a cassé et pourquoi).

## 2. S'abonner au hub avant de répondre à quiconque
- Canal général : la PR « Hub : canal général » (branche `hub/journal`, numéro 7). L'opérateur y écrit par Telegram, sans préfixe.
- Un chantier = sa PR (`chantier/CH-NNN`). Abonne-toi (`subscribe_pr_activity`) à chaque PR ouverte, lis ses derniers messages (`node tools/hub.cjs lire --chantier CH-NNN`), et réponds uniquement par `node tools/hub.cjs dire …`.
- Émetteurs : `integrateur` (la session principale), `chercheur`, `relecteur` (revue froide), `actions`, `operateur`, `agent`. Depuis D-306, `cursor` et `glm` ne sont plus utilisés (tous les exécutants sont des sessions Claude). Entre sessions Claude, le canal de travail est `send_message` (voir `CLAUDE.md`, § Hub) ; le hub reste le journal public. **Une seule session tient le rôle « intégrateur »** : c'est elle qui fusionne dans le tronc, fabrique les paquets et tient `DECISIONS.md`. Une session qui en rejoint une autre prend un autre rôle (`chercheur`, `relecteur`) et le dit à l'opérateur sur le canal général.
- Le relais Telegram est décrit dans `hub/telegram/INSTALLATION.md` (déjà installé).

## 3. Où en est le projet (historique jusqu'au 12/11/2026 ; l'état du jour est au § 0)
- **Base : « Vision 11 »** (build `30bb2cd`, tronc `claude/50-test17`), version sans nouveauté (D-317) : préchauffage à 4 chargements à la fois, plafond de 256 Mo par opération, corrections de la relecture CH-092 et de la maquette CH-095. La deuxième passe **écrit** dans le réglage livré (`passeDifferesDefaut` : `ecriture:true`, `ecritureMax:10`, D-259). État détaillé : `LIRE_EN_PREMIER.md` (section du haut) et `CHANGELOG.md`.
- **« Vision 13 »** (10/11) = Vision 12 plus CH-096 (quatre défauts du moteur et de l'adaptateur, D-319), CH-097 (neuf défauts du service worker et du panneau), le bouton « SKIP explicite » masqué (D-320) et les outils de CH-098 (mémoire de la page : aucune correction, relevé de console à faire coller par l'opérateur au début et à la fin d'un lot). Détail : `CHANGELOG.md`.
- **« Vision 14 »** (11/11) = Vision 13 plus le panneau refait en « Graphite » : CH-104 (rendu, feuille de style, mouvement, police Inter), CH-105 (molette du nombre de parties, 1 à 20, D-335), CH-106 (relecture critique : cinq défauts corrigés avant livraison, un défaut d'avant corrigé, l'accès à « Relecture en pause »). Trois sessions filles en parallèle sur ordre de l'opérateur (D-336). Outils gardés : `chantiers/CH-104/outils/` (photos du vrai panneau, huit contrôles, page de comparaison), `chantiers/CH-106/outils/etats-hors.cjs` (états rares). Une page publiée fait tourner le vrai panneau avec de faux lots (API Chrome simulée) : elle sert à montrer un changement d'interface à l'opérateur avant de livrer ; ses sources ne sont pas au dépôt. Détail : `CHANGELOG.md`.
- **« Vision 15 »** (11/11) = Vision 14 plus CH-107 (pause et rechargement après 3 cuts vides en relecture), CH-108 (panneau « Épure », D-339), CH-109 (pause et reprise de la relecture allumées et reprise seule après F5, D-341 ; changement de partie qui attend ESV ; remise sans objet), CH-110 (place de chargement rendue à Potree, D-343) et D-344 (caméra changée relue). Exports du 11/11 dans `banane-data` : `collections/2026-11-11_v14_constellation-15-17/` et `-18-20/`.
- **« Vision 17 »** (12/11, dernier paquet fabriqué ; le fichier `BUILD` du paquet porte le commit) = Vision 15 plus la télécommande iPhone (CH-111, Vision 16), la règle « voie des cuts sûrs » en ombre (CH-112, CH-114 ; examens vierges du 12/11 dans `banane-data/collections/2026-11-12_v15_echo-partie23` et `…partie0`) et la forme 3 de l'empreinte du contrat d'ESV (D-348). En cours : CH-115 (panneau, direction B « Brume » à retravailler, D-350 ; maquettes d'abord). Échos du 12/11 : parties 15, 16, 17 (contre le lot du 11/11), 23, 0, 1 (contre les lots « Vision 15 » du 12/11) ; apprentissage CH-113 : cible non atteinte.
- **Étude « coupes non résolues » (10/11, D-321, D-322)** : CH-099 (recherche large rejouée hors ligne) et CH-100 (trois mesures, juge des posés faux `tools/juge-poses-faux.cjs`, manifeste) sont INTÉGRÉS ; leurs sorties par cut sont dans `banane-data` (`outils/analyse-lots/CH-099/` et `CH-100/`). Rien n'est allumé dans l'extension. Prochain examen : la séance Écho tirée au sort de la partie 9 du lot du 10/11, critères figés dans `chantiers/CH-099/criteres-prochain-jugement.md`. À reprendre dans un chantier d'outils : le bloc B1-écart de `tools/juger-lot.cjs` sur les cuts écrits par la deuxième passe, l'ordre des événements dans la jointure (journal non rangé dans le temps), un instantané de la liste d'ESV au départ de chaque partie. Erratum : `chantiers/CH-056/ERRATUM_2026-11-10.md`.
- **Interface du panneau (D-323 à D-327)** : quatre essais de maquettes les 10 et 11/11, aucun retenu par l'opérateur : trois tours dessinés en HTML (CH-101 : métaphore ferroviaire ; finition de l'existant ; refonte « chiffre, étapes, anneau ») et un tour construit avec Exact (CH-102, arrêté par l'opérateur, D-327 : sur l'hôte web, Exact ne donne pas l'allure native d'Apple). Les deux chantiers sont clos, leurs branches `chantier/CH-101` et `chantier/CH-102` restent comme références. Le panneau en place n'est pas modifié. Référence donnée par l'opérateur le 11/11 (D-328) : Linear et Cursor, pour une proposition unique de designer produit ; chantier CH-103 (`chantiers/CH-103.md` : étude sourcée, petit système, deux écrans finis en HTML vivant, puis arrêt pour sa réaction). Cette proposition (CH-103) n'est pas retenue non plus (« ressemble encore à l'actuel »). **Méthode qui a marché (D-329, D-330)** : ne plus redessiner les écrans du panneau ; faire un bento de composants en plusieurs styles, le laisser choisir (il a choisi Graphite), puis plus de composants, micro-interactions, entrée et sortie en boucle ; l'intégrateur le fait lui-même et publie (sources : `maquettes/bento/`). Maquette du vrai panneau en Graphite validée le 11/11 (« Nickel tu peux construire », D-333 ; `maquettes/bento/panneau-graphite.html` : Orbite et Constellation). CH-104 l'a intégrée dans l'extension (`chantiers/CH-104.md`, « Vision 14 »). Ce qu'il a dit de constant : style « sobre et net » et « système », pas de dessin de voie ni de rail, pas d'écran chargé, l'état et l'avancement du lot au premier plan, rien ne le gêne à l'usage. Les filles n'ont pas le droit d'écrire dans `banane-data` : leurs sorties par cut vivent sous `chantiers/CH-NNN/sorties/` sur leur branche et l'intégrateur les déplace.
- **Organisation** : l'intégrateur est une session Claude (D-303) ; tous les exécutants sont des sessions Claude filles (D-306), une par ticket `chantiers/CH-NNN.md`, sur une branche `chantier/CH-NNN`. Elles livrent les changements des fichiers protégés sous forme de `.patch` dans `chantiers/CH-NNN/` ; l'intégrateur les applique, refait les preuves (essais ciblés, garde de pose, parité de la relecture), puis lance une fois par version le verify et la maquette.
- **Chantiers** : intégrés depuis le 08/11 : CH-077 à CH-092, CH-094, CH-095 (« Vision 12 » = Vision 11 plus les deux patchs du moteur de CH-091 et CH-094, accord écrit D-318). PRÊT sur sa branche, non intégré : CH-093 (préchauffage au passage à la relecture ; bilan de temps nul ou négatif en maquette, décision de l'opérateur avant de l'allumer).
- **Leçon des 08 au 10/11** : cinq versions du préchauffage ont été corrigées par le lot de terrain suivant. Depuis CH-095 la maquette joue deux pannes réelles de Potree ; un défaut du préchauffage se cherche d'abord là (`tests/esv-maquette/ch095-*.test.cjs`). La suite de la maquette tourne à deux fichiers à la fois (charge).
- **Analyses de lots** : exports et bilans dans `banane-data` (`collections/`, `outils/analyse-lots/`), par `node tools/bilan-lot.cjs`.
- **Limite d'usage** : plusieurs sessions sur le modèle le plus fort épuisent la fenêtre de 5 heures en un peu plus d'une heure (mesuré le 10/11 : cinq filles et trois relecteurs). Garder le modèle économique pour les balayages, le plus fort pour concevoir ou relire.

## 4. Ce qui est en attente (liste du 12/11 ; les attentes du jour sont au § 0.8)
- **De l'opérateur** : installer « Vision 15 » et dire ce qu'il pense du panneau « Épure » en vrai lot (fluidité à côté d'ESV, thème clair jamais vu) ; son avis sur trois points laissés (alerte de la Constellation absente de son onglet pendant une partie, anneau en pourcentage ou « N sur M », ligne « Ce qui reste » absente au repos) ; le relevé de console mémoire de CH-098 (deux collages, début et fin d'un lot) et dire si F12 reste ouvert pendant ses lots ; une séance Écho sur la liste tirée au sort de la partie 9 (`banane-data`, collection `2026-11-10_v5_vision12-essai`, `derive/liste-echo-partie9.txt`) ; son choix d'interface (CH-101) ; un coup d'œil sur les cuts 8996 à 9003 de la partie 16 du lot du 06/11 (deux alignements, la deuxième passe a écrit 9002 : « bonne voie » ou « mauvaise voie ») ; les deux choix laissés par CH-097 (lot en ERREUR : vidage du cache des exports, séance de l'observateur) ; sa revue de la liste de `fiches/AUDIT_PROJET_2026-11-10.md` (points non corrigés d'office : fichiers protégés, suppressions, règles de `CLAUDE.md` périmées).
- **De l'intégrateur** : lire le prochain export de « Vision 15 » : événements `potree-place-rendue` (la réparation de CH-110 n'est prouvée que sur la maquette ; qu'ESV redemande le bloc est SUPPOSÉ), cuts sans point après un 502, reprises seules de la relecture (`relecture-esv-revenue`), `remise-sans-objet`, relectures de caméra (D-344). Reste ouvert : un lot de file en pause reprenable attend un « Reprendre » (et le cas du refus de CH-043, rapport de CH-109) ; étude de la vitesse objective (D-340).

## 5. Règles de session
- Modèle économique par défaut ; le plus fort seulement pour concevoir ou relire, en le disant.
- Pas d'agent pour lire un journal : un script. Un rapport fait une page.
- Jamais de nom d'opérateur, de code projet ESV, d'UUID ni de capture dans le dépôt de code ; les exports restent dans `banane-data`, lus par les seules sessions Claude du projet ; depuis D-306, aucun service externe.
- Pas de réécriture d'historique, pas de SKIP ; aucun fichier protégé, réglage de pose ou de validation, ni écriture dans ESV ne change sans accord écrit de l'opérateur (la passe écrit, plafonnée à 10 cuts par lot : lever ce plafond demande sa décision).
- Les dossiers de travail d'une session précédente (`scratchpad`, `wt/`) n'existent pas : tout ce qui compte est dans le dépôt.

## 6. Lancer une nouvelle session principale : quand, comment, avec quoi
L'opérateur a demandé que l'intégrateur en place déclenche lui-même cette bascule au bon moment. Une seule session tient le rôle `integrateur` à la fois.

**Le bon moment** (le premier critère atteint suffit) :
- les chantiers ouverts sont fusionnés ou mis en attente, le tronc est vert et stable, aucune décision de l'opérateur n'est en suspens ;
- juste avant une phase longue qui chargera beaucoup de contexte (chantier des différés : recherche GCV2, rejeu des lots, garde) ;
- la session en place est lourde (résumés répétés) : mieux vaut une session neuve qui lit cette fiche que de continuer sur un résumé.
Jamais au milieu d'une fusion, d'un paquet en fabrication ou d'une question posée à l'opérateur et sans réponse.

**Comment** :
1. L'intégrateur sortant met cette fiche à jour (§ 3 état, § 4 attente), pousse sur le tronc en avance simple, puis crée la session neuve (outil `create_session` : dépôt `banane`, branche du tronc, invite = « lis `fiches/PASSATION_SESSION.md` puis reprends le rôle d'intégrateur »). Le dépôt `banane-data` s'y ajoute avec `add_repo` (accès en écriture, branche de documents).
2. Il annonce la bascule sur le canal général (`node tools/hub.cjs dire --chantier hub --de integrateur --type info "…"`) : qui est la session entrante, ce qui est en cours, ce qui attend.
3. La session entrante répond sur le même canal qu'elle prend le rôle, s'abonne aux PR ouvertes (§ 2), relit le dernier état de chaque chantier. La session sortante se désabonne (`unsubscribe_pr_activity`) et ne pousse plus rien : pas deux intégrateurs.
4. L'opérateur n'a rien à faire, sauf si l'outil de création de session lui demande une confirmation.

**Ce qu'on lui transmet** :
- *Dans le dépôt* (déjà fait) : `CLAUDE.md`, `AGENTS.md`, cette fiche, `fiches/RESEAU_IA.md`, `hub/PROTOCOLE.md`, les tickets `chantiers/`.
- *Connecteurs* : l'accès GitHub des deux dépôts (`banane`, `banane-data`) ; le serveur de sessions (abonnement aux PR, `send_later`, `create_session`) ; `gh` pour `tools/hub.cjs` ; le relais Telegram et Cursor n'ont rien à transmettre (ils vivent côté Cloudflare et côté GitHub). Le secret `ARIANE_MOTIFS_INTERDITS` n'est jamais écrit dans un fichier : s'il manque dans l'environnement de la session, `hub.cjs` n'applique que les motifs publics, et il faut le dire à l'opérateur.
- *Skills utiles* : conception avant code (`brainstorming`), essai rouge puis vert (`test-driven-development`), diagnostic (`systematic-debugging`), preuve avant d'affirmer (`verification-before-completion`), relecture d'un diff (`code-review`), pages privées pour l'opérateur (`artifact-design`, outil Artifact : maquettes). Les autres extensions installées (finance, boutique, etc.) ne servent pas ici : ne pas les charger.
- *Règles de dépense* : modèles économiques par défaut, le niveau maximal seulement pour une tâche difficile, en disant pourquoi ; budget de 30 % du quota hebdomadaire pour tout le projet.
- **Autonomie (ordre de l'opérateur du 28/10/2026)** : ne plus lui demander d'autorisation pour avancer. L'intégrateur décide, agit, puis rend compte. Restent des arrêts nets, parce qu'ils sont irréversibles ou écrits comme tels : réécriture d'historique, SKIP, passe en écriture, fusion dans `main` et publication, envoi d'un secret hors du dépôt. Pour tout le reste, on choisit la recommandation et on la dit.

## 7. Démarrer la session principale suivante (à faire par l'opérateur, une seule fois)
Les sessions filles ne peuvent pas être plus permissives que leur parent : une session principale en mode « par défaut » enverra à l'opérateur une demande de validation par appel d'outil. Il faut donc **créer la nouvelle session en mode « auto »** (réglage du mode de la session, dans l'application, à la création), avec :
- **Dépôts** : `banane` (branche de travail `claude/50-test17`) et `banane-data` (branche `claude/execute-prompt-00-18ra5a`), accès en écriture sur les deux.
- **Connecteurs** : GitHub (les deux dépôts), **Figma** (équipe de l'opérateur), et les outils de sessions (abonnement aux PR, rappels, création de sessions filles).
- **Skills** : conception avant code, essai rouge puis vert, diagnostic, preuve avant d'affirmer, relecture de diff, les skills Figma (`figma-use`, `figma-generate-design`, `figma-generate-library`), `artifact-design` pour les pages privées.
- **Premier message à coller** : « lis `fiches/PASSATION_SESSION.md` puis reprends le rôle d'intégrateur ». (`fiches/DEMARRAGE_SESSION_PRINCIPALE.md` date du 28/10 : il cite des fichiers disparus et un chantier de design arrêté par D-257 ; ne plus le coller.)
- L'ancienne session principale se désabonne des PR et ne pousse plus rien dès que la nouvelle a annoncé qu'elle prend le rôle.


## 8. Message de démarrage type d'une session fille (D-255)
Créer la fille en mode `auto` (la mère l'est), `create_session`, dépôt `banane`, branche `chantier/<ticket>`. Premier message : lire `CLAUDE.md`, `AGENTS.md`, `chantiers/<ticket>.md` ; **parler à la mère par `send_message` à `@parent` (priorité `next`), pas par le texte de fin de tour ni par le hub seul** ; un `send_message` à chaque jalon et à chaque question ; rapport final sur le hub ET par `send_message`. Côté mère : message à la fille en priorité `next` (jamais `now` sauf pour l'arrêter), puis `ScheduleWakeup` de 10 minutes pour lire son dernier texte de fin de tour (`list_events`, kinds `assistant`) si elle se tait. Mesuré le 28/10 : accusés de test reçus en moins de 2 minutes par ce circuit, aucun par le hub.
