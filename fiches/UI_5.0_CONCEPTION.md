# Conception de l'interface 5.0 d'Ariane (19 octobre 2026)

Demande de Mic : « une toute nouvelle conception pour la 5.0, radicalement opposée à tout ce qu'on a fait […] le fonctionnement aussi simple que prévu, pas dix mille cases à cocher, et cocher toujours les mêmes alors qu'il est mieux de les laisser par défaut. » (D-218.)

Cette fiche suit `fiches/UI_INVENTAIRE.md` (l'état des lieux, élément par élément). Les maquettes sont dans `maquettes/ui-5.0/` : ouvrir `index.html` dans un navigateur.

**Statut (19 octobre, soir) : brouillon rejeté par Mic.** Les directions A à E de cette fiche (et la recommandation A, les profils, « Envoyer ») sont rejetées (D-219). Les maquettes retenues pour l'essai sont F, G et H (`maquettes/ui-5.0/`), construites dans les versions 4.9.5 test 10, 11 et 12 (`CHANGELOG.md`). Le modèle commun du § 3 n'est pas repris ; l'inventaire (`fiches/UI_INVENTAIRE.md`) reste valable.

**Point du 20 octobre.** Le panneau unique V2 (J) et V3 (K), puis les trois directions sur un seul écran (L : Atelier, Instrument, Bande), sont des **essais écartés** comme base visuelle. On en garde les acquis fonctionnels : des états fiables, des compteurs définis (`fiches/UI_ETATS_COMPTEURS.md`), la séparation entre la fin du lot et le travail restant, la liste des cuts à examiner et l'incident corrigé d'après le code. Méthode changée : on fixe d'abord des références visuelles précises (surfaces, navigation, proportions, typographie, transitions), puis on dessine l'**écran principal d'Ariane** (entrer, retrouver sa partie, choisir Orbite ou Écho, examiner son travail). « Lot en cours » et la bande compacte n'en seront que des déclinaisons. Les règles « chaque chiffre une seule fois », « une seule action » et « tout compact » ne sont plus des règles absolues : chaque choix se justifie.

## 1. Ce que la séance de Mic nous apprend

Penser depuis la séance, pas depuis les fonctions. Une séance type (consignes 5 à 9) :

1. Mic ouvre ESV sur un cut rouge, ouvre Ariane.
2. **Orbite** : il lance un lot jusqu'à la fin de la partie. Il attend, il regarde de temps en temps. Si tout va bien il n'a rien à faire. Après le lot, la relecture part seule et il ne doit rien toucher dans ESV.
3. Il **exporte** (« Tout télécharger »), attend, calcule les empreintes SHA-256 des volumes avec PowerShell, note les heures, écrit son message, envoie.
4. **Écho** : il travaille dans ESV ; Ariane regarde. Il n'ouvre presque jamais le panneau. À la fin : « Terminer et télécharger », empreintes, message.

Trois constats qui commandent tout le reste :

- **Il ne réfléchit jamais à ce que fait Ariane, il veut savoir s'il doit agir.** La bonne question du panneau est « que dois-je faire maintenant ? ». La réponse est presque toujours « rien » (lot qui tourne, Écho qui observe) ou « un seul geste ».
- **Il règle toujours pareil.** « Corriger » avant chaque lot (tests 7 et 8), « Noter ma raison » avant chaque Écho (test 9). Ce qu'on lui fait cocher à chaque fois n'est pas un choix, c'est un défaut mal rangé.
- **La moitié de l'effort est hors du panneau** : calculer les empreintes, noter les heures, ne pas exporter avant la fin de la relecture, attendre cinq secondes. Le panneau peut le faire ou l'empêcher.

## 2. Les principes, rendus vérifiables

| Principe demandé | Règle de conception | Comment on le vérifie |
|---|---|---|
| Zéro réglage à cocher en séance | Aucune case, aucun bouton radio, aucune liste sur l'écran de séance. Les choix vivent dans des **profils nommés** (écran « Réglages »). | Un essai compte les éléments `input` et `select` de l'écran de séance : 0. |
| Une seule action principale à chaque instant | Un seul bouton plein. Le reste (rare) est replié sous « Autres options ». | Un essai parcourt chaque état de lot et d'Écho : exactement un bouton principal. |
| L'état en une phrase | Une phrase en français simple, la même dans le panneau et dans le bandeau d'ESV. | Une table état → phrase testée sur tous les états. |
| Exports automatiques, un seul geste « envoyer » | « Envoyer » produit tous les volumes, attend la confirmation du navigateur, calcule les SHA-256 et prépare le message. Les quatre boutons d'export à part disparaissent de l'écran. | Les volumes sont identiques octet pour octet à ceux de « Tout télécharger » (essai). |
| Compteur GCV2 et avancement de la partie sans clic | Un pied de page fixe : « Partie : 31 / 120 invalides traités » et « GCV2 : 2 684 cuts appris + 61 ». | Visible sur tous les écrans de séance. |
| Les modes de test deviennent des profils ou des défauts | Cinq profils (§ 4). Aucune grille de cases. | Les choix gardés (relecture, clic, grappe, raison) sont ceux de l'ancien panneau, même clés, même actions. |
| Rien n'est retiré du journal ni des exports | Les contrôles quittent l'écran, pas l'enregistrement. L'analyse hors ligne lit les mêmes fichiers. | Essais d'octets identiques (§ 8). |

## 3. Le modèle commun aux trois directions

Ce qui ne change pas d'une direction à l'autre, et qui est le vrai travail.

### 3.1 Trois écrans seulement

- **Séance** : ce que Mic voit en travaillant (la forme change selon la direction).
- **Réglages** : le profil de séance, l'affichage (thème, bandeau dans ESV), « après confirmation de réception » (vider le cache des exports), « abandonner la séance ». Rarement ouvert. La liste des 37 valeurs techniques y reste lisible.
- **Détails** : la page de lecture pour l'analyse, jamais nécessaire en séance (santé de la collecte, qualité de capture, voie du lot, départs des parties, résumé de la partie, journal du lot, dernière commande, politique effective, liste « À contrôler »).

Le choix Orbite ou Écho reste le seul vrai choix, fait une fois, au repos. Une séance lancée le verrouille.

### 3.2 Table état → phrase → action principale

Une fonction pure, testable sans navigateur, qui remplace les branches de `render` (`panel.js:573` et `:603`). Les états viennent du service worker, inchangés.

| État | Phrase (exemple) | Action principale | Sous « Autres options » |
|---|---|---|---|
| Prêt (Orbite) | « ESV est sur le cut 4790, partie 13. Le lot ira jusqu'à la fin de la partie. » | Démarrer le lot | |
| En cours | « Lot en cours · pose des rails · cut 4812 » | Pause | Arrêter le lot |
| En pause | « Lot en pause au cut 4812. » | Reprendre | Arrêter le lot |
| ESV ne répond plus | « ESV ne répond plus au cut 4812. Recharge la page (F5), puis reprends. » | Reprendre | Reprise manuelle, SKIP explicite, Arrêter |
| Rail non résolu (politique « pause » seulement) | « Rail non résolu au cut 4812. » | Réessayer ce cut | Reprise manuelle, SKIP explicite, Arrêter |
| Reprise manuelle | « Ce cut t'est rendu. Corrige-le dans ESV, ouvre le suivant. » | Repris manuellement | Arrêter |
| Résultat à contrôler (navigation incertaine, état final manquant, erreur) | « Résultat à contrôler au cut 4812. Contrôle-le dans ESV. » | Archiver le résultat interrompu (état final manquant : Arrêter le lot) | |
| Fin de partie probable | « ESV a quitté la page après le différé du cut 4812 : fin de partie probable. » | Reprendre | |
| Relecture en préparation ou en cours | « Relecture : 12 sur 85, 3 corrigés. Ne touche à rien dans ESV. » | Arrêter la relecture | |
| Correction de relecture interrompue | « Une correction a été interrompue au cut 4903. Contrôle-le dans ESV. » | J'ai contrôlé le cut 4903 | |
| Lot borné, relecture à lancer | « Lot fini. La relecture n'est pas partie : valide le dernier cut. » | Lancer la relecture | Envoyer sans relecture |
| Lot et relecture finis (ou relecture coupée) | « 27 posés, 4 différés, 9 à contrôler. » | Envoyer | Nouveau lot, voir les cuts à contrôler |
| Envoi prêt | « 3 volumes enregistrés, confirmés complets. Joins-les et colle le message. » | Copier le message | Ouvrir le dossier, Nouveau lot |
| Prêt (Écho) | « Écho regarde ton travail et ne touche à rien. Ouvre ton premier cut. » | Démarrer Écho | |
| Écho en cours | « Écho observe : 148 cuts vus, 61 corrigés. » | Terminer et envoyer | Pause |
| Écho en pause (ou ESV sans réponse) | « Écho est en pause. » | Reprendre | Terminer et envoyer |
| Un lot est actif, ou Écho est actif | « Un lot est actif : termine-le avant de démarrer Écho. » | (aucune ; Arrêter le lot en second) | |
| Export incomplet | « Export incomplet : 1 volume sur 3 n'est pas confirmé. » | Envoyer à nouveau | |

**Règle de sécurité tenue partout :** l'action principale n'est jamais « SKIP » ni « Arrêter » (elles ne se défont pas) ; SKIP garde sa confirmation.

### 3.3 Les profils (le remplaçant des cases)

Un profil est une liste de choix déjà connus du service worker. Il n'ajoute **aucune** action nouvelle : au moment de « Démarrer », le panneau envoie les mêmes appels que l'ancien panneau envoie quand Mic coche les mêmes cases (`relecture-choix`, `choix-lot`, `raison-choix`). Le lot fige alors ces valeurs dans son scope, comme aujourd'hui.

| Profil | Relecture après le lot | Clic du mode rapide | Règle « grappe » | Raison de la correction (Écho) | Pour qui |
|---|---|---|---|---|---|
| **Terrain** (défaut proposé) | corriger | comme avant | coupée | coupée | la séance ordinaire de Mic |
| Terrain + raisons | corriger | comme avant | coupée | chiffres du haut | quand l'étape 0 de la test 9 est faite |
| Observation | ombre | comme avant | coupée | coupée | regarder sans rien modifier |
| Comparer le clic | corriger | rail gauche recentré | coupée | coupée | un essai de comparaison, une fois |
| Comme la test 8 | coupée | comme avant | coupée | coupée | retour arrière, pour comparer |

Chaque profil se lit en une phrase sous le bouton « Démarrer » (« profil Terrain : relecture automatique après le lot »). Le **réglage fin** (relecture, clic, grappe, raison, un par un, en listes déroulantes) est replié dans Réglages : il ne sert qu'à composer un cas que les cinq profils ne couvrent pas. Un seul endroit, jamais en séance.

### 3.4 « Envoyer » : ce qu'il fait, et ce qu'il ne peut pas faire

Ariane n'envoie rien sur internet : l'extension n'a aucune permission pour cela (`manifest.json` ne donne que le stockage, les téléchargements et la page ESV). **« Envoyer » prépare tout ; Mic joint les fichiers.** Concrètement :

1. **Attend** que le lot soit clos et que la relecture soit finie ou arrêtée (aujourd'hui Mic le surveille à l'œil et attend « cinq secondes »).
2. **Lance l'export existant** sans y toucher : « Tout télécharger » (`exportToutZip`) en Orbite, « Terminer et télécharger » (`exportComplet`) en Écho. Les volumes sont donc les mêmes, octet pour octet.
3. **Calcule le SHA-256 de chaque volume** à partir des octets enregistrés (à la place de PowerShell).
4. **Compose un message à coller** : version, partie, heures de début et de fin du lot et de la relecture, nom et empreinte de chaque volume, chiffres du lot. Ce n'est **pas** un fichier de l'export : les exports ne changent pas. Il s'affiche dans le panneau, avec « Copier le message ».
5. Dit **« Envoi prêt »** seulement quand le navigateur a confirmé tous les volumes complets ; sinon « Export incomplet » et « Envoyer à nouveau ».

Le vidage du cache des exports reste réservé à Réglages, « après confirmation de réception » : c'est l'orchestrateur qui confirme (consigne : « vide le cache seulement après ma confirmation »). Il n'est jamais automatique (`export.viderApresExport` reste `false`).

### 3.5 Le pied de page toujours visible

- **Avancement de la partie** : en Orbite, `cuts traités / invalides au départ du lot` (la mesure de la tuile du lot actuelle, 4.9.0.17). En Écho, « Partie P · cut N » sans pourcentage : on ne devine pas une fin qu'ESV n'a pas donnée.
- **Compteur GCV2** : `total du dernier archivage + cette séance`. Le total est un petit fichier de données (`datasets/compteur-gcv2.json`, à mettre à jour à chaque archivage, valeur d'aujourd'hui : 2 684 cuts corrigés) ; la part de la séance est lue en direct (les visites d'Écho corrigées). **Limite dite à l'écran** : le total n'est pas en direct, il porte sa date.

### 3.6 Le bandeau dans ESV

Il existe déjà (une ligne noire, en bas de la page ESV, qui ne capte aucun clic). Il devient **allumé par défaut** et répète la phrase d'état du panneau. C'est l'endroit que Mic regarde quand il travaille dans ESV. Pas de bouton dedans : un bouton dans la page gênerait les clics du lot (`src/bridge.js`).

### 3.7 Ce qui n'est pas retiré

Tout le journal, tous les exports, les départs des parties, le résumé de la partie, la santé et la qualité de capture, le vidage automatique d'Écho, la reprise des différés (en Réglages, « Lot borné »), les bornes (en Réglages), la liste « À contrôler » (dans Détails, et jointe à l'export). Les quatre boutons « Télécharger le journal / le bilan / le diagnostic / le corpus » ne sont plus à l'écran : « Envoyer » les contient (§ 3.4). Un morceau raté se relance avec « Envoyer à nouveau ».

## 4. Les trois directions

Toutes trois utilisent le modèle du § 3. Elles ne diffèrent que par ce que Mic voit en séance.

### A · « Le grand bouton » (`maquettes/ui-5.0/A-le-grand-bouton.html`, 9 écrans)

Un seul écran. Une phrase, un grand bouton plein, deux chiffres en bas. Au repos, un petit sélecteur Orbite / Écho. Pendant le lot, le grand numéro du cut, une barre, deux pastilles (posés, différés). Rien d'autre : ni carte, ni graphique, ni case. Le plus radical par rapport à l'actuel, et la plus petite à construire.

### B · « Le fil de la séance » (`B-le-fil-de-la-seance.html`)

Les étapes de la séance en colonne (départ → lot → relecture → envoi). Les étapes faites tiennent en une ligne avec leur résultat, l'étape en cours est ouverte avec son geste, les suivantes sont grisées. Mic voit où il en est et ce qui reste. Elle montre plus de texte que A, et l'Écho (une seule étape) y paraît presque vide.

### C · « La télécommande » (`C-la-telecommande.html`)

Une petite fenêtre (environ 380 × 190) laissée à côté d'ESV : une phrase, un bouton, une barre. Tout le reste est une seconde page « Détails » en lecture seule. La plus économe en pixels, mais la voie du lot et les verts à contrôler demandent un clic de plus, les cibles sont petites, et la fenêtre actuelle est créée en 560 × 820 (`background.js:1721`) : la changer est un chantier propre à cette direction.

## 5. Comparaison avec la séance type

Séance type : **un lot Orbite complet (avec relecture et envoi), puis une Écho complète avec envoi.** Comptes faits en relisant les consignes de séance et le panneau (pas mesurés au chronomètre).

| | Panneau actuel (test 9) | A | B | C |
|---|---|---|---|---|
| **Clics dans Ariane** | **9** : ouvrir (1), Orbite (1), cocher « Corriger » (1), Démarrer (1), Tout télécharger (1) ; onglet Écho (1), cocher « raison » (1), Démarrer (1), Terminer (1) | **6** : ouvrir, Démarrer, Envoyer ; Écho, Démarrer, Terminer et envoyer | **6**, comme A | **6**, plus 1 clic « Détails » pour voir la voie |
| **Choix à faire ou à vérifier** | 4 choix (relecture, clic, grappe, raison) sur 10 cases ou boutons radio ; 5 contrôles de défauts (clic = « comme avant », grappe vide, relecture cochée, raison cochée, touches lues) | 0 | 0 | 0 |
| **Gestes hors du panneau** | 3 par envoi : calculer chaque SHA-256 (PowerShell), noter les heures, composer le message | 0 (joindre les fichiers) | 0 | 0 |
| **Attentes à surveiller** | 2 : la fin de la relecture avant d'exporter, les « cinq secondes » | 0 (« Envoyer » attend) | 0 | 0 |
| **Texte à lire à l'écran** | 43 boutons, 8 volets, 67 paragraphes de texte dans `panel.html` | une phrase, un bouton, deux chiffres | un fil de 4 étapes | une phrase, un bouton |
| **Risques d'erreur d'opérateur** | **6** : oublier « Corriger » (lot en « Coupée », la séance est perdue) ; oublier « raison » ; laisser « Variante » après un essai ; exporter avant la fin de la relecture ; exporter avant les cinq secondes ; recopier une empreinte fausse | **1** : profil mal choisi (dit sous le bouton « Démarrer ») | **1**, comme A | **2** : profil mal choisi ; ouvrir « Autres options » par erreur sur une cible petite |
| **Voir où on en est sans clic** | oui mais noyé dans les cartes | oui : phrase, barre, deux chiffres | oui : la séance entière | oui (une phrase) ; la voie demande un clic |
| **Chantier de développement** | | petit : une table d'états, un écran, un écran de réglages | moyen : en plus, l'état de chaque étape | plus gros : nouvelle taille de fenêtre, deux pages |

Remarque honnête : si le navigateur refuse la copie automatique du message, il faut un clic de plus par envoi (8 clics au lieu de 6 pour A et B). A et B ont le même nombre de gestes. La différence est la quantité d'information à lire, et B répond à la question « où j'en suis dans la séance » alors que A répond seulement à « que dois-je faire ».

## 6. Recommandation : la direction A

**Je recommande A, « Le grand bouton ».** Raisons :

1. C'est la plus opposée à l'actuel (aucune carte, aucune case, aucun graphique), ce qu'a demandé Mic.
2. Elle atteint les 6 gestes et les 0 choix de B et C avec le moins d'écran et le moins de code : une table d'états et un seul écran.
3. Elle ne dépend d'aucun changement de la fenêtre (C) ni d'un fil à tenir à jour (B).
4. Elle garde ce que Mic apprécie du panneau actuel : le grand numéro du cut et la barre qui se remplit (retours de Mic sur les tests 13 et 16).

Ce que A emprunte aux autres : de B, **la phrase finale du lot** (« 27 posés, 4 différés, 9 à contrôler. Relecture : 85 relus, 41 corrigés ») qui joue le rôle du fil ; de C, **la lecture seule de « Détails »**, ouverte à la demande.

Ce que A ne fait pas : elle ne montre plus la voie du lot (le graphique cut par cut) sur l'écran de séance. Elle est dans « Détails ». Si Mic y tient en séance, c'est la première chose à remettre (une ligne, sous la barre).

## 7. Appui sur le skill de patrons de conception

J'ai lu `claude/skills/design-patterns/` (SKILL.md, catalog.md, ariane-map.md) et m'en suis servi seulement là où un symptôme réel du code du panneau le justifie. Il est copié dans cette branche, avec ses corrections.

**Symptômes confirmés par le code, et le patron retenu :**

| Symptôme (fichier:ligne) | Patron | Forme retenue |
|---|---|---|
| `render` de 292 lignes qui commence par `if(which==='native')` puis `else if(which==='automatic')` (`panel.js:561`, `:573`, `:603`), avec 13 états de lot qui décident chacun d'un jeu de boutons | **State** | Une table `état → phrase / action principale / autres` et une fonction pure `ecranDe(s)`. Pas de classes : le skill lui-même dit qu'une table remplace presque toujours le patron en JavaScript. |
| Quatre cartes de choix qui refont le même cycle (valeur gardée, lue au démarrage, figée dans le lot, « Dernier lot / Prochain lot ») : `majChoixLot`, `changerChoixLot`, `changerChoixRaison`, `src/carte-relecture.js` | **Command** (en table) | Un profil est une liste d'appels `api(action, args)` existants. |
| Les exports vivent dans la fermeture de `panel.js` et le nouveau panneau doit les appeler | **Facade** | Deux fonctions exposées à la fin de `panel.js` (`exportTout`, `exportEcho`), sans changer leur corps. |

**Ce que le skill avait de faux ou d'incomplet (corrigé dans `claude/skills/design-patterns/ariane-map.md`) :**

- Il annonçait « ~50 lignes de comparaison » dans `background.js` : il y a **70** tests `if(action===…)` dans `dispatch` (`background.js:2513` à `:2735`), plus 17 `kind===`, dans un fichier de 2 735 lignes. Il ne distinguait pas la liste blanche de `src/bridge.js` (commandes vers la page ESV) de ce répartiteur (actions du panneau).
- Il proposait un **Builder** pour les exports. Non confirmé : `exportToutZip` (`panel.js:1558`) est une suite linéaire de quatre exports, sans étape optionnelle à huit paramètres. Règle du skill : « moins de 3 variantes, garder le `if` ». Piste écartée.
- Il disait `src/engine.js` « gelé ». Depuis D-217 (même jour), le gel est levé pour le chemin du lot sur les portions de test, sous banc.
- Il n'avait **pas lu le panneau du tout** (seulement `core`, `brain`, `storage`, `bridge`) : j'ai ajouté une section « Panneau ».

**Est-il utile ? Oui, mais pour freiner autant que pour guider.** Les entrées utiles ici : « un patron répond à un symptôme, jamais à l'envie d'en placer un » (il a écarté le Builder), « en JavaScript, une table remplace le patron » (State et Command en tables), et la règle « un refactor ne change aucune sortie » (qui impose les essais d'octets identiques du § 8). Les entrées sans effet ici : les 15 autres patrons du catalogue ; la carte `ariane-map.md` d'origine, trop partielle pour guider un travail sur l'interface avant correction. Mon avis : à garder, avec la carte corrigée, et à utiliser comme liste de contrôle avant un refactor, pas comme source d'idées.

**Le skill « better-ui »** (déjà dans `claude/skills/`) servira seulement à la finition du développement (zones de clic, appui, mouvements réduits), pas à la conception.

## 8. Plan de développement (après la réponse de Mic)

**Architecture : un habillage, pas une réécriture.** `panel.js` reste le moteur de la page : il garde la connexion à ESV, la lecture de `view` toutes les deux secondes et, point essentiel, **le vidage automatique d'Écho** (`autoExportIfAdvised`, `panel.js:1702`, qui ne tourne que si la page du panneau est chargée). Une seconde page oublierait ce vidage. Le nouveau panneau est donc un module de plus dans la même page :

- `src/panel-etat.js` : la table du § 3.2 et `ecranDe(s)`, pur, testé sous Node.
- `src/panel-profils.js` : les profils du § 3.3 et `appliquerProfil` (liste d'appels).
- `src/panel-envoi.js` : composition du message et SHA-256, pur.
- `src/panel-5.js` : le dessin de l'écran de séance, de Réglages et de Détails (DOM seulement).
- `panel.js` : environ 15 lignes ajoutées en fin de fichier pour exposer `ArianePanel` (l'état, `api`, `exportTout`, `exportEcho`) et lire la clé de bascule. **Aucune autre ligne ne change.**
- `panel.html`, `panel.css` : un conteneur `#v5` et ses règles ; l'ancien panneau est masqué, pas supprimé.
- `background.js`, `src/engine.js`, `src/geometry*.js`, `src/lot-decision.js` : **aucune modification.**

**Bascule.** Clé `banane50Interface` (`ancienne` ou `nouvelle`) dans `chrome.storage.local`. Défaut : `ancienne` tant que Mic n'a pas validé. Un lien discret « Essayer le nouveau panneau » dans l'ancien, « Revenir à l'ancien panneau » dans les Réglages du nouveau. Aucun redémarrage.

**Essais** (`tests/panel5-*.test.cjs`, repris du modèle de `tests/choix-lot-panel.test.cjs` et `tests/t16-export-volumes.test.cjs`) :

1. **Table d'états** : chaque état du service worker a une phrase et exactement une action principale ; un état nouveau non couvert fait échouer l'essai (comparé à `NOMS_ETAT`).
2. **Zéro case en séance** : l'écran de séance ne contient aucun `input` ni `select`.
3. **Profils** : pour chaque profil, la liste d'appels `api(...)` envoyée à « Démarrer » est égale, appel par appel, à celle que l'ancien panneau envoie avec les mêmes cases cochées. Le service worker ne reçoit rien de nouveau.
4. **Octets identiques** : le même lot simulé, exporté par le chemin de l'ancien bouton et par « Envoyer », donne des volumes dont les SHA-256 sont égaux ; idem pour l'Écho. L'essai `tests/pose-lot-inchanges-4959.test.cjs` (les mêmes commandes vers ESV) continue de passer.
5. **« Envoyer » attend** : tant que la relecture est active, l'action principale est « Arrêter la relecture » et l'export ne part pas.
6. **Message** : une référence figée (golden) pour la composition du message et la mise en forme des empreintes.
7. `node tools/verify.cjs` à 0 échec ; empreintes de `src/engine.js`, `src/geometry.js`, `src/geometry-candidate-v1.js` inchangées.

**Version.** `4.9.5.10`, intitulée « 4.9.5 test 10-ui ». Raison : le numéro suit la base (test 9, 4.9.5.9) ; le suffixe « -ui » dit que c'est le panneau seul, séparé de la « test 10 » du cap différés (D-217), qui n'est pas encore construite. Si l'orchestrateur construit sa test 10 avant, on prend `4.9.5.11` (le manifeste ne tolère pas un cinquième nombre). Paquet par `tools/package.py`, SHA-256 donné, consigne d'une page dans `consignes/`.

## 9. Ce que Mic décide

1. **La direction** : A recommandée. (Ou B si voir tout le fil compte plus que la sobriété ; C seulement si une petite fenêtre à côté d'ESV est une vraie envie.)
2. **Le profil par défaut** : « Terrain » avec relecture « Corriger » d'office (c'est ce que Mic coche à chaque lot), ou « Comme la test 8 » (relecture coupée) tant qu'il n'a pas relu le bilan de la test 8. Je recommande « Terrain » : le premier bilan de terrain est bon (D-211) et la case est déjà son geste habituel. C'est une décision de pose (la relecture écrit dans ESV), donc elle est à lui.
3. **La raison de la correction** : coupée tant que l'étape 0 de la test 9 (ESV ne réagit pas aux chiffres) n'est pas faite, puis un profil « Terrain + raisons » par défaut s'il la garde.
4. **Le nom du bouton** : « Envoyer » (ce que Mic a demandé) alors qu'Ariane ne peut rien envoyer toute seule : le bouton prépare les fichiers et le message. Le nom « Préparer l'envoi » serait exact mais plus lourd. Je recommande « Envoyer » avec la phrase d'explication sous le bouton.
5. **Le bandeau dans ESV allumé par défaut.**

## 10. Ce qui n'est pas vérifié

- Les maquettes n'ont été vues que dans un navigateur de test, en thème clair ; pas dans le panneau réel, ni sous Edge.
- Les comptes de gestes viennent de la lecture des consignes et du code ; aucun chronomètre.
- Le calcul des SHA-256 sur des volumes de 17 Mo : coût à mesurer (il se fait volume par volume, hors de la page ESV).
- Copier dans le presse-papiers depuis une page d'extension après une longue attente peut être refusé par le navigateur : le bouton « Copier le message » est le repli (un clic de plus), sans nouvelle permission.
- Le compteur GCV2 total n'est pas en direct ; il porte la date du dernier archivage.
