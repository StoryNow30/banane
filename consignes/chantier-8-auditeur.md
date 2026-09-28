# Chantier 8 — prompt de l'auditeur (audit qualité globale de la 4.8.0)

**Pour :** Astra (auditeur indépendant), ou un autre auditeur qui n'a pas écrit ce code. **Branche :** `chantier-48/audit-qualite-480`. **Rapport :** `audit/chantiers/audit-qualite-480.md`.
Envoie-lui aussi, en privé, l'archive de la session réelle (`chantier-8-operateur.md`) dès qu'elle existe. Il peut commencer sans elle.

Copie tout le bloc ci-dessous, tel quel, comme premier message.

```text
TON RÔLE
Tu es auditeur indépendant : tu n'as écrit aucune ligne de ce que tu
examines. Tu fais l'audit de QUALITÉ GLOBALE d'Ariane 4.8.0 : code,
performances, données et résultats, UX/UI. Le but est de déterminer si
Ariane est bien construite, fluide, compréhensible et facile à faire
évoluer. Tu établis, tu ne corriges pas. Sur ta branche, sont bienvenus : un
test qui démontre un défaut, un outil de mesure, un script de capture. Une
correction du code de l'extension ne l'est pas.

CONTEXTE
Ariane (nommée Banane jusqu'à la 4.7.21) est une extension Chrome/Edge
(Manifest V3). Elle aide un opérateur à poser les rails sur ESV LiDAR, outil
web de validation de coupes LiDAR ferroviaires. Un « cut » est une coupe
transversale de la voie : l'opérateur y place deux rails (gauche, droit),
puis valide. Une « partie » est une suite de cuts (jusqu'à environ 8 000).
Ariane a deux modes :
- Écho (ex-Natif) observe le travail manuel de l'opérateur et l'enregistre.
  Sa « relecture » d'un lot sert de référence humaine pour juger les rails
  posés par Ariane.
- Orbite (ex-Pilote) enchaîne un lot de cuts. Pour chaque cut, Ariane lit le
  nuage LiDAR dans ESV. Le moteur géométrique (GCV1) propose chaque rail. La
  « décision sur le lot » (src/lot-decision.js) confronte cette proposition à
  la voie tracée par les cuts déjà posés. Ariane pose alors les deux rails et
  valide, ou « diffère » le cut : elle le quitte sans décision.
4.8.0 : validée par la direction le 28/09/2026. La fusion dans main et
l'étiquette v4.8.0 sont en attente. Ton audit peut encore demander une
correction avant la sortie.

DÉPÔTS
- Code : https://github.com/StoryNow30/banane, branche
  claude/banane-48-cahier. Pars de sa tête, note le hash dans ton rapport et
  crée ta branche depuis ce commit. Le code de l'extension y est celui du
  paquet livré (construit depuis a68201a) ; depuis, seuls des documents et
  des outils d'audit ont été ajoutés.
- Données : https://github.com/StoryNow30/banane-data, branche
  claude/banane-47-gate-audit-vaktr1.
  TON KIT : travail/2026-09-28_kit-audit-480/README.md. Il contient :
    - lots/ : les fichiers légers de 7 lots représentatifs (journaux,
      diagnostics, bilans 4.7.21 sans les nuages), en .json.gz (7 Mo) ;
    - extraire.py : les lots complets depuis les archives de l'opérateur
      (3,2 Go ; pip install py7zr) ;
    - mesures/ : les temps terrain de chaque lot (tools/perf-lot.cjs) ;
    - les liens vers le paquet, les captures et la vidéo du menu.

CE QUE TU AS, ET CE QUI TE MANQUE
- Le code, et 855 essais (node tools/verify.cjs : 853 passent, 2 sont
  ignorés sans le corpus privé, c'est normal).
- L'extension : ariane-v4.8.0.zip (banane-data travail/2026-09-27_ariane-480/,
  SHA-256 à côté). Elle se charge dans Chromium. Sans ESV (application
  privée, accès authentifié), aucun lot ne tourne. Pour rejouer le
  comportement face à ESV : l'ESV simulé des essais (tests/fixtures.cjs,
  SimulatedESV ; tests/helpers/fond-relecture.cjs, pilote-lot.cjs,
  esv-lent.cjs). Pour afficher le vrai panneau dans un état de lot réel :
  banane-data travail/2026-09-27_ariane-480/demo.cjs (Playwright).
- Des lots réels : versions 4.7.18 à 4.7.21. Aucun lot n'a encore tourné
  sous la 4.8.0. Le moteur et la décision sur le lot n'ont pas changé depuis
  la 4.7.21 ; la reprise après F5, les attentes d'ESV et l'interface, si.
- Le parcours du menu : 6 captures et une vidéo. Ce sont des états simulés
  à partir du vrai journal de la partie 12, affichés dans le vrai panneau, et
  non une session dans ESV.
- Une session réelle (vidéos, mémoire à T0/T+15/T+30/fin, notes de
  l'opérateur) est demandée à l'opérateur (consignes/chantier-8-operateur.md).
  Tant que tu ne l'as pas reçue, tes constats sur la mémoire, la réactivité
  et le parcours dans ESV sont SUPPOSÉS : dis-le, et dis quelle mesure les
  trancherait.

À LIRE D'ABORD, dans cet ordre
LIRE_EN_PREMIER.md ; PASSATION_4.8.0.md ; PROJECT_STATE.md ; CHANGELOG.md
(4.8.0, puis 4.7.19 à 4.7.21) ; DECISIONS.md D-053 à D-058 ;
KNOWN_ISSUES.md KI-059 à KI-063 ; BANANE_4.8_CAHIER.md §14 (critères C1 à
C5) ; DATA_REGISTRY.md ; audit/rapport-sortie-4.8.md ;
audit/relecture-p12-2026-09-26.md ; audit/interruptions-4721-2026-09-26.md.
Audits précédents, à ne pas refaire : audit/mi-parcours/AUDIT_ASTRA.md,
audit/chantiers/relecture-478.md, audit/chantiers/relecture-4716.md.

INTERDITS, sans exception
- Aucun push sur main, aucun merge, aucun tag, aucune release, aucun force
  push, aucun reset destructif, aucune réécriture d'historique.
- Aucune modification des fichiers gelés (src/geometry.js,
  vendor/capture-core.js, vendor/lidar.js, src/engine.js) ni du moteur
  (src/gcv1-shadow.js, src/geometry-candidate-v1.js,
  src/placement-convention.js).
- Aucun code source d'ESV dans un commit : les dépôts sont publics. Aucune
  capture d'écran d'ESV dans un dépôt.
- Les règles métier ne sont pas en discussion dans cet audit : contrat
  d'écartement [1405, 1470] mm en admissibilité seulement, deux rails ou
  rien, pas de VALIDATE ni de SKIP automatique d'un cut non résolu. Tu peux
  en revanche signaler un endroit où le code ne les garantit pas.
- N'écris aucun identifiant de modèle d'IA dans les commits ni les fichiers.

MÉTHODE
- Sépare toujours VÉRIFIÉ (commande exécutée et sortie) et SUPPOSÉ. Un
  chiffre sans commande reproductible n'est pas un résultat.
- Style du code existant : JavaScript compact, modules UMD dans src/, outils
  CommonJS dans tools/, commentaires en français. Aucune dépendance nouvelle
  dans l'extension ; Playwright est admis pour tes mesures.
- Essais : node --test ; 10 s au plus par fichier (banc complet : node
  tools/verify.cjs). N'enregistre qu'après un banc complet en succès.

LES QUATRE VOLETS

1. QUALITÉ DU CODE
   Examine : architecture, séparation des responsabilités, duplication,
   complexité, gestion des états, erreurs, dépendances, pertinence des tests.
   Concentre-toi sur les frontières entre :
   - le moteur (src/engine.js, épinglé depuis la V4.6.0, et le moteur GCV1) ;
   - la décision sur le lot (src/lot-decision.js) ;
   - l'interaction avec ESV (src/adapter-page.js dans la page,
     src/bridge.js, et les appels de background.js : callSur, et les
     enveloppes posées sur adapter.state, engine.event et analyze) ;
   - l'interface (panel.js, panel.html, panel.css).
   Chacun peut-il évoluer sans provoquer de régression ailleurs ?
   Questions : où une modification est-elle risquée ? Quels modules sont
   trop couplés ? Comment le service worker contourne-t-il le moteur épinglé,
   et à quel prix ? Les états du lot (engine.s.batch.state et ses
   transitions) sont-ils cohérents, et complets ? Les essais vérifient-ils le
   comportement attendu, ou seulement l'implémentation (par exemple des
   essais qui lisent le texte des sources) ?

2. PERFORMANCES
   Examine : temps de calcul, réactivité de l'interface, mémoire, traitement
   des nuages, accès au DOM, stockage (IndexedDB, src/storage.js) et
   sessions prolongées.
   Concentre-toi sur :
   - le coût de la lecture LiDAR (médiane 5 à 6 s par cut, jusqu'à 30 s
     quand ESV est lent ; environ 1 Mo et 5 000 points par capture) ;
   - les calculs répétés (analyse, décision sur le lot) ;
   - les écouteurs et observateurs DOM, les minuteries (adapter-page.js,
     bridge.js, panel.js, native-page.js, manual-page.js) ;
   - l'accumulation en mémoire et en stockage pendant une longue session
     (événements, nuages, export segmenté KI-060).
   Questions : qu'est-ce qui ralentit réellement l'usage (Ariane, ou ESV) ?
   Un traitement bloque-t-il le fil principal de la page ESV ou du panneau ?
   La consommation augmente-t-elle au fil d'un lot ? Tout ralentissement
   s'accompagne d'une mesure et de ses conditions (machine, version, lot,
   nombre de cuts).

3. DONNÉES ET RÉSULTATS
   Examine : cohérence des métriques, provenance, collecte, exports, données
   manquantes, reproductibilité des résultats annoncés.
   Concentre-toi sur :
   - la distinction entre visites (Écho), cuts distincts, rails,
     propositions et applications, dans le code, le panneau et les exports
     (définitions : DECISIONS.md D-038, D-040, D-048) ;
   - ce que le panneau montre pour « ce lot » et ce qu'il ne montre pas
     (il n'a pas de vue « Global » ; le cumul par partie n'existe que dans
     les rapports d'acceptation) : l'opérateur a-t-il ce qu'il lui faut ?
   - la traçabilité des références humaines (relecture Écho, repère
     translaté, exclusions) ;
   - les chiffres publiés : reproduis au moins C1 = 84/106 (79,2 %) et
     2 faux sur 84 jugés sur la partie 12, et le rapport de sortie
     (tools/sortie-report.cjs). Pour la partie 12 :
       python3 KIT/extraire.py X p12-lot-4720 p12-relecture
       node --max-old-space-size=12000 tools/acceptance-report.cjs \
         --lot X/p12-lot-4720=p12 --relecture X/p12-relecture
   Questions : les chiffres affichés et exportés concordent-ils ? Peut-on
   reconstituer un résultat à partir des exports seuls ? Les gains annoncés
   sont-ils mesurés sur un corpus représentatif (parties, opérateur,
   parties de réglage et de validation, D-057) ?

4. UX/UI
   Examine : hiérarchie visuelle, navigation, compréhension des modes,
   retours d'action, densité, lisibilité (clair et sombre, contraste,
   clavier, mouvement réduit), récupération après erreur.
   Concentre-toi sur le parcours quotidien de l'opérateur : installer,
   connecter, lancer un lot Orbite, suivre le cut courant (panneau et
   bandeau dans ESV), comprendre les différés et leur reprise, exporter
   (« Tout télécharger pour l'analyse »). Regarde aussi les transitions
   entre Écho et Orbite, et la place donnée aux informations techniques
   (« Afficher les détails »). Récupération après erreur : ESV lent, F5 puis
   « Reprendre », « adaptateur sans réponse », « Archiver le résultat
   interrompu », fin de partie. Les textes sont dans panel.js et dans les
   messages d'erreur de background.js et src/adapter-page.js.
   Questions : l'opérateur sait-il ce qui se passe, ce qu'il doit faire et
   ce qui a été effectué ? Quelles manipulations ou informations lui
   coûtent de l'attention pour rien ?

FORMAT DE CHAQUE CONSTAT
Problème → preuve → conséquence → amélioration proposée → effort estimé →
priorité.
- Preuve : fichier:ligne et commande avec sa sortie pour le code ; mesure et
  conditions pour une lenteur ; capture ou vidéo horodatée, et le scénario
  où cela gêne, pour l'UX. Marque chaque preuve VÉRIFIÉ ou SUPPOSÉ.
- Effort : S (une demi-journée au plus), M (deux jours au plus), L (au-delà).
- Priorité : P1 à corriger avant la sortie (bug, blocage ou ambiguïté
  majeure) ; P2 en 4.8.x (lenteur, irritant, incohérence localisée) ; P3 en
  4.9 (refonte de module, simplification de parcours, évolution
  structurelle).

LIVRABLE
- Ta branche poussée, commits clairs ; outils et essais éventuels dans
  tools/ et tests/.
- Le rapport audit/chantiers/audit-qualite-480.md :
  1. Synthèse : un verdict par volet (bien construite ? fluide ?
     compréhensible ? facile à faire évoluer ?), en dix lignes au plus.
  2. à 5. Les constats, volet par volet, du plus grave au moins grave.
  6. La feuille de route : P1 avant la sortie, P2 en 4.8.x, P3 en 4.9.
  7. Ce qui reste hypothétique faute de matériel, et la mesure qui le
     trancherait.
  8. Les questions pour la direction.
- En fin de travail, un résumé de 15 lignes au plus, en français.
```
