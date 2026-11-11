# Passation de session : démarrer ou reprendre une session Claude de zéro

Pour toute nouvelle session Claude Code (cloud ou local) qui rejoint le projet Ariane. Elle remplace le résumé d'une session précédente : tout ce qu'il faut est dans le dépôt. Écrit le 27/10/2026, état mis à jour le 10/11/2026 (« Vision 13 ») ; mets-le à jour à chaque fin de version.

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

## 3. Où en est le projet (10/11/2026)
- **Base : « Vision 11 »** (build `30bb2cd`, tronc `claude/50-test17`), version sans nouveauté (D-317) : préchauffage à 4 chargements à la fois, plafond de 256 Mo par opération, corrections de la relecture CH-092 et de la maquette CH-095. La deuxième passe **écrit** dans le réglage livré (`passeDifferesDefaut` : `ecriture:true`, `ecritureMax:10`, D-259). État détaillé : `LIRE_EN_PREMIER.md` (section du haut) et `CHANGELOG.md`.
- **« Vision 13 »** (10/11, dernier paquet fabriqué ; le fichier `BUILD` du paquet porte le commit) = Vision 12 plus CH-096 (quatre défauts du moteur et de l'adaptateur, D-319), CH-097 (neuf défauts du service worker et du panneau), le bouton « SKIP explicite » masqué (D-320) et les outils de CH-098 (mémoire de la page : aucune correction, relevé de console à faire coller par l'opérateur au début et à la fin d'un lot). Détail : `CHANGELOG.md`.
- **Étude « coupes non résolues » (10/11, D-321, D-322)** : CH-099 (recherche large rejouée hors ligne) et CH-100 (trois mesures, juge des posés faux `tools/juge-poses-faux.cjs`, manifeste) sont INTÉGRÉS ; leurs sorties par cut sont dans `banane-data` (`outils/analyse-lots/CH-099/` et `CH-100/`). Rien n'est allumé dans l'extension. Prochain examen : la séance Écho tirée au sort de la partie 9 du lot du 10/11, critères figés dans `chantiers/CH-099/criteres-prochain-jugement.md`. À reprendre dans un chantier d'outils : le bloc B1-écart de `tools/juger-lot.cjs` sur les cuts écrits par la deuxième passe, l'ordre des événements dans la jointure (journal non rangé dans le temps), un instantané de la liste d'ESV au départ de chaque partie. Erratum : `chantiers/CH-056/ERRATUM_2026-11-10.md`.
- **Interface du panneau (D-323 à D-327)** : quatre essais de maquettes les 10 et 11/11, aucun retenu par l'opérateur : trois tours dessinés en HTML (CH-101 : métaphore ferroviaire ; finition de l'existant ; refonte « chiffre, étapes, anneau ») et un tour construit avec Exact (CH-102, arrêté par l'opérateur, D-327 : sur l'hôte web, Exact ne donne pas l'allure native d'Apple). Les deux chantiers sont clos, leurs branches `chantier/CH-101` et `chantier/CH-102` restent comme références. Le panneau en place n'est pas modifié. **Ne pas lancer de nouveau tour sans une référence choisie par l'opérateur** (captures d'interfaces qu'il trouve belles). Ce qu'il a dit de constant : style « sobre et net » et « système », pas de dessin de voie ni de rail, pas d'écran chargé, l'état et l'avancement du lot au premier plan, rien ne le gêne à l'usage. Les filles n'ont pas le droit d'écrire dans `banane-data` : leurs sorties par cut vivent sous `chantiers/CH-NNN/sorties/` sur leur branche et l'intégrateur les déplace.
- **Organisation** : l'intégrateur est une session Claude (D-303) ; tous les exécutants sont des sessions Claude filles (D-306), une par ticket `chantiers/CH-NNN.md`, sur une branche `chantier/CH-NNN`. Elles livrent les changements des fichiers protégés sous forme de `.patch` dans `chantiers/CH-NNN/` ; l'intégrateur les applique, refait les preuves (essais ciblés, garde de pose, parité de la relecture), puis lance une fois par version le verify et la maquette.
- **Chantiers** : intégrés depuis le 08/11 : CH-077 à CH-092, CH-094, CH-095 (« Vision 12 » = Vision 11 plus les deux patchs du moteur de CH-091 et CH-094, accord écrit D-318). PRÊT sur sa branche, non intégré : CH-093 (préchauffage au passage à la relecture ; bilan de temps nul ou négatif en maquette, décision de l'opérateur avant de l'allumer).
- **Leçon des 08 au 10/11** : cinq versions du préchauffage ont été corrigées par le lot de terrain suivant. Depuis CH-095 la maquette joue deux pannes réelles de Potree ; un défaut du préchauffage se cherche d'abord là (`tests/esv-maquette/ch095-*.test.cjs`). La suite de la maquette tourne à deux fichiers à la fois (charge).
- **Analyses de lots** : exports et bilans dans `banane-data` (`collections/`, `outils/analyse-lots/`), par `node tools/bilan-lot.cjs`.
- **Limite d'usage** : plusieurs sessions sur le modèle le plus fort épuisent la fenêtre de 5 heures en un peu plus d'une heure (mesuré le 10/11 : cinq filles et trois relecteurs). Garder le modèle économique pour les balayages, le plus fort pour concevoir ou relire.

## 4. Ce qui est en attente
- **De l'opérateur** : installer « Vision 13 » ; le relevé de console mémoire de CH-098 (deux collages, début et fin d'un lot) et dire si F12 reste ouvert pendant ses lots ; une séance Écho sur la liste tirée au sort de la partie 9 (`banane-data`, collection `2026-11-10_v5_vision12-essai`, `derive/liste-echo-partie9.txt`) ; son choix d'interface (CH-101) ; un coup d'œil sur les cuts 8996 à 9003 de la partie 16 du lot du 06/11 (deux alignements, la deuxième passe a écrit 9002 : « bonne voie » ou « mauvaise voie ») ; les deux choix laissés par CH-097 (lot en ERREUR : vidage du cache des exports, séance de l'observateur) ; sa revue de la liste de `fiches/AUDIT_PROJET_2026-11-10.md` (points non corrigés d'office : fichiers protégés, suppressions, règles de `CLAUDE.md` périmées).
- **De l'intégrateur** : intégrer CH-101 après le choix de l'opérateur ; juger la séance Écho tirée au sort (`tools/juge-poses-faux.cjs --tirage`) ; décider avec l'opérateur du seuil `tasMaxMo` une fois le relevé mémoire reçu ; après la revue de l'opérateur, les chantiers de `fiches/AUDIT_PROJET_2026-11-10.md` § 8 ; CH-093 selon sa décision ; analyser le lot « Vision 11 » (le préchauffage tient-il jusqu'au bout, attente des coupes voisines) ; tenir `DECISIONS.md`.

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
