# Consignes des chantiers parallèles 4.8

Rédigées le 23 septembre 2026 pour être confiées à des ingénieurs (humains ou
modèles) **en parallèle** du fil principal. Chaque consigne est autonome :
colle le **bloc commun**, puis le bloc du chantier. Tout part du même commit,
pour que les résultats se comparent.

| # | Chantier | Nature | Profil conseillé | Dépend de l'opérateur |
|---|---|---|---|---|
| 1 | Revenir à un cut : reprise des différés et navigation | conception + code + tests | développeur rigoureux | oui : inspection du JavaScript ESV (15 min) |
| 2 | Faux isolés du premier passage | étude hors ligne | analyste données | non |
| 3 | Relecture indépendante de la 4.7.8 | audit | Astra | non |
| 4 | Rapport d'acceptation automatique | outil + tests | développeur | non |
| 5 | Tests d'acceptation §14 et invariants §7 | tests + matrice | développeur | non |

Ce qui reste au fil principal : l'analyse des collectes F1 et F2, la décision
D2, l'intégration des branches après relecture.

---

## Bloc commun — à coller en tête de chaque consigne

```text
Tu travailles sur Banane, extension Chrome/Edge (Manifest V3) qui aide un
opérateur à poser les rails sur ESV LiDAR (outil web de validation de coupes
LiDAR ferroviaires). Un « cut » est une coupe transversale de la voie ; pour
chaque cut, l'opérateur place deux rails (gauche, droite) puis valide.
Banane observe (mode Natif), propose (Assisté) ou enchaîne un lot de cuts
(Pilote). Un moteur géométrique (GCV1) propose la position de chaque rail
ou s'abstient ; un cut que le moteur ne sait pas placer est « différé ».

DÉPÔTS
- Code : https://github.com/StoryNow30/banane
  Base OBLIGATOIRE : commit 5a204fa (branche claude/banane-48-cahier, 4.7.8).
  Crée ta propre branche depuis ce commit : chantier-48/<nom-du-chantier>.
- Données : https://github.com/StoryNow30/banane-data
  branche claude/banane-47-gate-audit-vaktr1, dossiers
  collections/2026-09-23_v4.7.6_ et collections/2026-09-23_v4.7.7_
  (archives 7z de sessions ; NOTES.md et manifest.json décrivent chacune).
  Les exports se fusionnent avec tools/merge-segments.cjs (dossier ou fichier).

À LIRE D'ABORD, dans cet ordre
LIRE_EN_PREMIER.md ; PLAN_4.8.md ; BANANE_4.8_CAHIER.md §5.5, §6, §7, §14 et
les amendements n°6 à n°9 ; DECISIONS.md D-036 à D-039 ; KNOWN_ISSUES.md
(KI-043 à KI-047). Le cahier est le contrat : en cas de doute, il l'emporte
sur cette consigne, et tu le signales.

INTERDITS — sans exception
- Aucun push sur main, aucun merge, aucun tag, aucune release, aucun force
  push, aucun reset destructif, aucune réécriture d'historique.
- Aucune modification des fichiers gelés : src/geometry.js,
  vendor/capture-core.js, vendor/lidar.js (empreintes 4.4.0), src/engine.js
  (baseline déclarée) ; ni du moteur src/gcv1-shadow.js,
  src/geometry-candidate-v1.js, src/placement-convention.js, sauf si ta
  consigne le demande expressément (aucune ne le fait).
- Écartement de voie : contrat [1405, 1470] mm en ADMISSIBILITÉ seulement.
  Jamais une cible : « le candidat le plus proche de 1435 » ne sera jamais
  implémenté, et l'écartement des cuts voisins n'est jamais une cible.
- Aucune application partielle (un seul rail), aucun VALIDATE ni SKIP
  automatique, aucune navigation présentée comme une décision.
- Aucune position humaine (correction de l'opérateur) dans l'entrée du
  moteur : la référence humaine ne sert qu'à JUGER, après coup.
- Cuts 9033 et 9241 exclus de toute mesure, à la demande de l'opérateur.

RÈGLES DE MESURE (D-038)
- Un cut est FAUX si l'erreur latérale OU verticale d'un rail dépasse 10 mm
  par rapport à la pose finale de l'opérateur.
- Couverture = cuts DISTINCTS du lot ; une revisite n'est pas un nouveau cut ;
  les cuts sans entrée, différés ou refusés restent au dénominateur.
- Toute exclusion est explicite, comptée et motivée.

MÉTHODE
- Sépare toujours VÉRIFIÉ (commande exécutée + sortie) et SUPPOSÉ. Un chiffre
  sans commande reproductible n'est pas un résultat.
- Style : celui du code existant (JavaScript compact, modules UMD dans src/,
  outils CommonJS dans tools/, commentaires en français). Pas de dépendance
  nouvelle.
- Tests : node --test. Le banc complet est `node tools/verify.cjs` ; il lance
  tous les fichiers de test en parallèle avec 10 s par fichier : découpe un
  test lourd en plusieurs fichiers plutôt que d'allonger le délai.
  Sans le corpus privé, 2 tests sont ignorés : c'est normal, dis-le.
- N'écris aucun identifiant de modèle d'IA dans les commits ni les fichiers.

LIVRABLE
- Ta branche poussée, commits clairs.
- Un rapport audit/chantiers/<nom-du-chantier>.md : ce qui est fait, ce qui
  est vérifié (commandes), ce qui est supposé, les questions pour la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.
```

---

## Chantier 1 — Revenir à un cut : reprise des différés et navigation

```text
CHANTIER 1 — REVENIR À UN CUT : REPRISE DES DIFFÉRÉS ET NAVIGATION
Branche : chantier-48/navigation

POURQUOI
Le Pilote n'avance aujourd'hui que vers l'avant : « valider et suivant » et
« suivant sans décision » (src/adapter-page.js, nextWithoutDecision, bouton
#O2N3DCutNextInvalid3DRail, équivalent de Maj+Z qui appelle
loadNextInvalidCut("positive") selon une inspection du JavaScript ESV du
20/09). La décision sur le lot (amendement n°9, src/lot-decision.js) place
un cut différé depuis la droite de ses voisins déjà placés. Hors ligne, elle
fait mieux quand les voisins des DEUX côtés sont connus (56,0 % de cuts
appliqués contre 53,3 % en un seul passage, 722 cuts) : il faut pouvoir
REVENIR sur un cut différé en fin de lot (« lot de reprise », PLAN_4.8.md
phase 2), voire consulter un cut voisin.

CE QUE L'ON SAIT
Observé dans 12 sessions Natif des 22 et 23/09 (1 146 gestes de l'opérateur
dont on connaît le cut ouvert juste après, sans autre geste entre les deux) —
relevé : audit/navigation-esv-2026-09-23.json. C'est une corrélation, pas une
causalité prouvée (un geste non enregistré peut s'intercaler) :
  geste (code physique)     gestes   cut ouvert ensuite
  Z  (KeyW, clavier AZERTY)   173    +1 : 172
  S  (KeyS)                    38    −1 : 36
  D  (KeyD)                   165    +1 : 161   (rôle exact à établir)
  Maj+Espace (valider)        591    +1 : 582, sauts avant : 8
  clic dans la vue 3D/carte   125    +1 : 98, sauts lointains : 25
Dit par l'opérateur : Z et S correspondent à de vrais BOUTONS de
l'interface ESV ; dézoomer puis sélectionner un rail sur la carte est une
fonction de l'interface, qui mène à un cut précis ; un cut déjà validé ne
peut PAS être remis dans sa pose d'origine.
Supposé, à établir : le bouton DOM derrière Z et S et la fonction qu'il
appelle ; l'existence de loadNextInvalidCut("negative") (différé précédent) ;
la fonction « aller au cut N » appelée par la sélection sur la carte et son
argument (identifiant de rail, de cut ?) ; un champ de saisie du numéro de
cut ; un paramètre d'adresse. L'opérateur estime qu'on trouvera dans le code
d'ESV d'autres moyens de revenir à un cut précis : cherche-les.

RÈGLE DU CAHIER (§5.5) : on passe par les BOUTONS DOM, vérifiés avant
d'agir (présence, disabled) ; un KeyboardEvent synthétique ne prouve pas
qu'il a été pris en compte. Une touche n'est acceptable que si aucun bouton
n'existe, et seulement après décision de la direction. Appeler directement
une fonction interne d'ESV (par exemple celle de la carte) est un chemin
nouveau : décris-le, mesure ses risques (symboles non documentés, KI-026),
et laisse la direction trancher avant tout code qui l'emploie.

À FAIRE
1. Protocole d'inspection pour l'opérateur (tu n'as pas accès à ESV, qui est
   derrière une authentification). Rédige
   audit/chantiers/navigation-inspection.md : pas à pas dans les outils de
   développement d'Edge (onglet Sources, recherche globale Ctrl+Maj+F de
   loadNextInvalidCut, de "which", des codes 90 et 83, de "negative", des
   gestionnaires de clic de la carte ; getEventListeners sur les boutons),
   et un extrait JavaScript À COLLER DANS LA CONSOLE, STRICTEMENT EN LECTURE :
   il liste les boutons du panneau de cut (id, title, texte, disabled), les
   fonctions globales dont le nom contient cut/Cut/rail/Rail/load, et leur
   code source (Function.prototype.toString) — il n'appelle AUCUNE fonction
   ESV, ne clique rien, ne modifie rien. L'opérateur te rendra la sortie.
2. Inventaire des chemins de navigation ESV, chacun classé vérifié/supposé :
   suivant, précédent, suivant différé, précédent différé, aller au cut N.
   Pour chacun : bouton DOM, fonction appelée, ce qui change dans la page
   (libellé #O2N3DCutDescription, identité part/cut/frameId), et comment
   savoir si le cut atteint est déjà validé (indice visuel ou DOM).
3. Primitives d'adaptateur dans src/adapter-page.js, sur le modèle exact de
   nextWithoutDecision (preuve, refus rendus et non levés, aucun repli) :
   previousWithoutDecision et, si un chemin DOM existe, goToCut(identité).
   Chacune : contrôle d'identité et de cible AVANT la commande (invariant 6),
   une seule émission physique (invariant 5), puis identité observée après ;
   identité inattendue ou absente => incertitude (reconcileRequired), jamais
   une confirmation (invariant 7). Jamais de VALIDATE, jamais de SKIP.
4. Garde de reprise : Banane ne propose et n'applique JAMAIS sur un cut qui
   n'est pas dans sa propre liste de différés du lot, ni sur un cut que la
   page montre comme déjà validé. Une revisite d'un voisin validé est en
   LECTURE seule.
5. Tests avec le simulateur (tests/fixtures.cjs, SimulatedESV — étends-le) :
   précédent nominal, bouton absent, bouton désactivé, cut atteint différent
   de la cible, cut déjà validé, double appel (une seule émission), annulation.
6. Conception du « lot de reprise » (document seulement, pas de branchement
   dans le Pilote) : après le lot, retour sur chaque différé du plus récent au
   plus ancien ou dans l'ordre, ancres des deux côtés, compteur « Différés : N »
   toujours fidèle, arrêt propre. Chiffre le nombre de navigations et le
   temps attendus sur un lot de 100 cuts avec 40 % de différés.

HORS PÉRIMÈTRE : brancher la reprise dans le Pilote (ce sera la 4.7.9 après
décision D2) ; les raccourcis clavier comme chemin de commande (4.9).
LIVRABLE en plus du bloc commun : navigation-inspection.md prêt à donner à
l'opérateur, primitives + tests verts, conception du lot de reprise.
```

---

## Chantier 2 — Faux isolés du premier passage

```text
CHANTIER 2 — FAUX ISOLÉS DU PREMIER PASSAGE
Branche : chantier-48/faux-isoles

POURQUOI
La décision sur le lot a fait, hors ligne sur 392 cuts jugés, 4 cuts faux
(amendement n°9 §9.2 ; audit/lot-choice-2026-09-23.json) :
- 241, 409, 983 : appliqués dès le premier passage par le moteur depuis la
  pose ESV, sur des cuts « isolés » que la garde de continuité (30 mm contre
  la droite des voisins) ne peut pas contredire (pas d'ancre à moins de 3
  numéros, ou écart sous le seuil) ;
- 407 : second passage, fenêtre déplacée, 144 mm.
Ce que l'on sait déjà : 241 a un rail posé 40 mm trop bas, publié par S1
(repêchage des ambiguïtés), sur un calage jugé hors domaine (KI-043) ; 983 a
un rail à 14–15 mm. Tous sont dans la session Natif longue de la partie 20
(collections/2026-09-23_v4.7.6_/session nativ).
L'objectif 4.8 est 0 faux (D-038). Il faut un signal, lisible par le moteur
SANS position humaine, qui arrête ces cuts en les différant.

À FAIRE
1. Reproduis d'abord les 4 faux avec tools/lot-choice-study.cjs (voir son
   en-tête pour les options ; variante B, chaînage gardé) sur les cinq
   sessions de l'étude, et donne la commande exacte.
2. Pour CHAQUE cut appliqué (justes et faux, toutes sessions), extrais par
   rail les signaux disponibles au moteur : chemin de publication (A_STAR
   direct, S1, flanc partiel), rapport de perte meilleur/second minimum,
   points de dessus et de flanc sous le gabarit, statut du calage (appliqué,
   hors domaine), densité et visibilité des points, déplacement depuis la
   pose ESV (latéral, vertical), écartement de paire, écart à la droite des
   voisins quand elle existe. Tout est dans le résultat de
   Shadow.scientificProposeBoth et dans src/lot-decision.js (candidatesOf).
3. Cherche des règles de GARDE (le cut est différé, jamais déplacé) et donne
   pour chacune : faux arrêtés / justes perdus, session par session.
   Préfère une règle qui a une raison physique (« S1 sur calage hors domaine
   => différer ») à un seuil ajusté sur 4 cas.
4. Généralisation : règle construite sur la partie 20 longue uniquement,
   puis appliquée TELLE QUELLE aux parties 24, 19, 22 et 20 courte ; rapporte
   les deux séparément. Avec 4 cas positifs, dis honnêtement ce que la mesure
   peut et ne peut pas soutenir.
5. Pour 407 (second passage), dis si la même règle l'arrête, sinon ce qui le
   distingue.

HORS PÉRIMÈTRE : modifier le moteur ou src/lot-decision.js. La règle retenue
sera proposée comme amendement ; c'est la direction qui décide.
LIVRABLE en plus du bloc commun : tools/isolated-wrong-study.cjs (+ tests
rapides), audit/chantiers/faux-isoles.md et le relevé JSON, un tableau
« règle / faux arrêtés / justes perdus / par session ».
```

---

## Chantier 3 — Relecture indépendante de la 4.7.8

```text
CHANTIER 3 — RELECTURE INDÉPENDANTE DE LA 4.7.8 (DÉCISION SUR LE LOT)
Branche : chantier-48/relecture-478
Tu es relecteur : tu ne corriges pas, tu établis. Un test qui démontre un
défaut est bienvenu sur ta branche ; une correction du code, non.

PÉRIMÈTRE
- src/lot-decision.js (decideCut et ses étapes first-pass / window /
  choice / deferred) ;
- background.js : observeLot et son branchement (la décision est calculée et
  consignée, JAMAIS appliquée) ; src/gcv1-export.js (lotObservation dans
  l'export diagnostic) ;
- tools/lot-choice-study.cjs et tools/cut-matrix.cjs ;
- l'amendement n°9 et D-039, le tableau §9.2, KI-047.

QUESTIONS À TRANCHER, chacune avec une commande de reproduction
1. Le module ne peut-il VRAIMENT rien commander ? Cherche tout chemin par
   lequel une position de lotObservation atteindrait apply, restore ou une
   navigation.
2. Parité : le code embarqué et l'étude donnent-ils les mêmes décisions ?
   L'équipe annonce 312/312 (partie 20 longue) et 176/176 (partie 24).
   Rejoue-les.
3. Les chiffres du §9.2 (45,2 % → 56,0 % ; 7 → 4 faux ; 48 cuts choisis dont
   30 jugés, 0 faux) se reproduisent-ils ? Le jugement est-il propre :
   références strictes (tools/placement-lab.cjs, referenceFor), doublons,
   fuite de la position humaine dans l'entrée, ordre des cuts ?
4. Le choix par la voie contourne-t-il une règle du cahier : écartement
   utilisé comme cible, application d'un seul rail, ancre issue d'un cut
   choisi (le chaînage n'accepte que ≤ 10 mm), seuils non documentés ?
5. KI-047 (ancres fausses d'un décalage commun entraînant le choix) : quel
   est le risque réel sur les données, et quelle garde manque ?
6. Le temps de calcul par cut dans le service worker (KI-046) reste-t-il
   acceptable avec la décision sur le lot en plus ?
7. Que faudrait-il établir sur les collectes F1 et F2 pour que la décision
   D2 (activer dans le Pilote) soit fondée ? Liste les mesures et leurs
   seuils.

LIVRABLE en plus du bloc commun : audit/chantiers/relecture-478.md, constats
classés BLOQUANT / IMPORTANT / MINEUR, chacun avec fichier:ligne, commande de
reproduction et sortie observée ; puis la liste des conditions de D2.
```

---

## Chantier 4 — Rapport d'acceptation automatique

```text
CHANTIER 4 — RAPPORT D'ACCEPTATION AUTOMATIQUE
Branche : chantier-48/rapport-acceptation

POURQUOI
Chaque collecte terrain (F1 à F4, PLAN_4.8.md) doit donner les critères C1
à C5 (cahier §6, D-038) de la même façon, sans script jetable. Aujourd'hui
ces chiffres sont calculés à la main. Il faut un outil unique.

ENTRÉES
- Lot Pilote : export diagnostic GCV1 (observations par cut, dont
  lotObservation depuis la 4.7.8), export corpus GCV1 + LiDAR, et le journal
  du lot (décision par cut : appliqué, DEFERRED_UNRESOLVED…).
- Relecture Natif du même lot : l'opérateur repasse chaque cut et valide. La
  pose AVANT d'une visite est celle laissée par le Pilote ; la pose finale
  validée est la référence humaine (règles strictes de
  tools/placement-lab.cjs, referenceFor). Jointure par identité
  (partie, cut, frameId) ; plusieurs visites d'un même cut : la dernière
  validée fait foi, et le rapport le dit.
- Facultatif : fichier de configuration listant les parties ayant servi à
  régler quoi que ce soit (les autres sont « tenues à l'écart ») et un
  relevé P2 (plancher de reproductibilité humaine) s'il existe.
Exemples de fichiers : collections/2026-09-23_v4.7.6_/pilote + corr (lot
Pilote 4.7.6 de la partie 19 et sa relecture, voir NOTES.md).

SORTIES (JSON + Markdown), PARTIE PAR PARTIE puis total
- C1 : cuts distincts du lot ; appliqués / différés / refusés par l'écartement
  / sans entrée ; couverture en % des cuts distincts.
- C4 : cuts faux (latéral OU vertical > 10 mm) parmi les cuts jugés ; liste.
- C2 : médiane et p90 de l'erreur latérale et verticale des cuts appliqués,
  avec, à côté, le plancher P2 ou la mention « P2 non mesuré » (§14 G).
- C3 : paires hors contrat refusées pendant le lot.
- Ce qu'aurait donné la décision sur le lot (lotObservation) : couverture et
  faux, jugés de la même façon.
- Cuts non jugeables (pas de relecture, référence non stricte) : comptés,
  avec leur raison. Cuts 9033 et 9241 exclus et comptés à part.
- Le rapport refuse de présenter C1 seul (§14 G) : C1 à C4 sortent ensemble.

À FAIRE
tools/acceptance-report.cjs (réutilise tools/merge-segments.cjs,
tools/placement-lab.cjs, src/gauge.js ; ne duplique pas leur logique), tests
sur des données synthétiques construites dans le test (pas de données
privées), et un essai sur la collecte 4.7.6 de la partie 19 dont tu
rapportes la sortie.
```

---

## Chantier 5 — Tests d'acceptation §14 et invariants §7

```text
CHANTIER 5 — TESTS D'ACCEPTATION §14 ET INVARIANTS §7
Branche : chantier-48/acceptation

POURQUOI
Le cahier exige que chacun des dix invariants du §7 et chacun des tests A à
I du §14 ait son essai. Beaucoup existent déjà dans tests/ (plus de 640), mais
personne ne sait lesquels couvrent quoi.

À FAIRE
1. tests/ACCEPTANCE_MATRIX.md : une ligne par exigence (§7.1 à §7.10, §14 A
   à I, et les règles conservées du §5.4 : politique effective affichée,
   « Différés : N » fidèle, incertitude de navigation visible avec son cut,
   aucun bouton présenté comme réussi sur un simple accusé). Pour chacune :
   le ou les tests (fichier + nom exact), statut COUVERT / PARTIEL / MANQUANT,
   et une phrase qui dit ce que le test prouve réellement.
2. Écris les tests MANQUANTS. Si un test révèle un défaut, ne corrige pas le
   code de production : marque le test en todo avec la référence d'un
   nouveau KI proposé dans ton rapport.
3. tools/acceptance-matrix-check.cjs : échoue si une ligne de la matrice
   désigne un fichier ou un nom de test qui n'existe pas. Ajoute un test qui
   l'exécute, pour que le banc (tools/verify.cjs) le fasse à chaque fois.
4. Attention au §14 C (curseurs traçables jusqu'à leur bilan) et I
   (provenance : aucune position humaine dans l'entrée moteur) : ce sont les
   plus faciles à déclarer couverts à tort.

LIVRABLE en plus du bloc commun : la matrice, les tests ajoutés (banc vert,
10 s par fichier), l'outil de contrôle, et la liste des exigences qui restent
sans preuve.
```
