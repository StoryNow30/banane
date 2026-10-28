# Passation de session : démarrer ou reprendre une session Claude de zéro

Pour toute nouvelle session Claude Code (cloud ou local) qui rejoint le projet Ariane. Elle remplace le résumé d'une session précédente : tout ce qu'il faut est dans le dépôt. Écrit le 27/10/2026 ; mets-le à jour à chaque fin de version.

## 1. Lire, dans cet ordre (15 minutes)
1. `CLAUDE.md` (règles non négociables), `AGENTS.md`.
2. `fiches/RESEAU_IA.md` (rôles, circuit d'un chantier, budget) puis `hub/PROTOCOLE.md` (le hub : messagerie des agents).
3. `LIRE_EN_PREMIER.md`, puis `BANANE_5.0_CAHIER_V2.md` § 1, 5, 6 (le but et les chantiers), puis `DECISIONS.md` de D-250 à la fin (décisions récentes de l'opérateur : ne jamais les réécrire).
4. Le dernier `CHANGELOG.md` (entrée la plus haute) et `consignes/seance-terrain-test-23-2026-10-26.md`.

## 2. S'abonner au hub avant de répondre à quiconque
- Canal général : la PR « Hub : canal général » (branche `hub/journal`, numéro 7). L'opérateur y écrit par Telegram, sans préfixe.
- Un chantier = sa PR (`chantier/CH-NNN`). Abonne-toi (`subscribe_pr_activity`) à chaque PR ouverte, lis ses derniers messages (`node tools/hub.cjs lire --chantier CH-NNN`), et réponds uniquement par `node tools/hub.cjs dire …`.
- Émetteurs : `integrateur` (la session principale), `chercheur` (session dédiée à la GCV2), `relecteur` (revue froide), `cursor`, `glm`, `actions`, `operateur`, `agent`. **Une seule session tient le rôle « intégrateur »** : c'est elle qui fusionne dans le tronc, fabrique les paquets et tient `DECISIONS.md`. Une session qui en rejoint une autre prend un autre rôle (`chercheur`, `relecteur`) et le dit à l'opérateur sur le canal général.
- Le relais Telegram est décrit dans `hub/telegram/INSTALLATION.md` (déjà installé).

## 3. Où en est le projet (28/10/2026, fin de journée)
- **Version de test en terrain : 4.9.5.23** (tronc `claude/50-test17`). La deuxième passe reste **en ombre** (`passeDifferesDefaut.ecriture:false`). Décisions récentes : D-250 à D-252, **D-253** (Cursor reçoit la même confiance que Claude, données comprises).
- **Réseau d'IA** : hub opérationnel (canal général : PR n° 7, branche `hub/journal`). Chantiers de Cursor **fusionnés** : CH-001, CH-003 (vitesse de relecture : la lecture du nuage porte 81 % du temps, aucun gain sans changer une décision), CH-004, CH-005, CH-006, CH-007 (différés : 79 sur 1 344 cibles, 5,9 % ; 28 « poserait » de la passe ramèneraient à 3,8 %), CH-008 (les trois tas restants : aucun levier dans le budget D-223), CH-009 (précision de la v6 : 9 poses du lot jugées contre l'Écho seulement, 6 sur 9 à 10 mm ou moins). **Cursor a atteint sa limite d'usage** : ses chantiers sont suspendus jusqu'au renouvellement.
- **Chantiers ouverts** : **CH-002** (interface de Signal, PR n° 8) : audit et maquette HTML livrés, **maquette Figma en cours** (fichier de clé `ZrK16dO2MGOQp9lufe7lwF` : Fondations, Composants, 22 écrans sombre et clair déjà dessinés ; manquent la correction « Fil d'Ariane » et le prototype de mouvement) ; **CH-010** (PR n° 16) : recherche UX/UI et trois directions de maquettes dans Figma, ticket à jour pour une **session Claude dédiée** (la première, `session_01Td4bNoirpbBaTgb8wNkB7i`, a été interrompue au démarrage faute de pouvoir fonctionner sans demande d'autorisation : à relancer depuis une session en mode « auto »).
- **Objectifs** (`fiches/RESEAU_IA.md` § 6) : (1) différés sous 5 % puis 3 % ; (2) interface ; (3) vitesse de la relecture ; (4) écriture de la deuxième passe : aucun développement, réouverture par l'opérateur à 125 « poserait » jugés (27 au 27/10). **Budget** : 30 % du quota hebdomadaire.
- **Analyses de lots** : tous les exports et les détails par cut sont dans `banane-data` (`collections/`, `outils/analyse-lots/`, y compris `cursor-CH-003` et `cursor-CH-009`).

## 3 bis. Reprise du 28/10 (session principale n° 2)
- Rôle d'intégrateur pris (annonce sur le canal général), abonnée aux PR 7, 8, 16. Sessions filles en mode auto : CH-010 (`session_01Td4bNpScYTtA2v5YNNUUje`) et CH-002 phase 1c (`session_01Td4bNkMBVxeJsb1y4DjCRh`).
- Consigne de séance Écho des cuts posés : `consignes/seance-terrain-echo-cuts-poses-2026-10-28.md`.
- Retrait du prénom de l'opérateur : abandonné par l'opérateur (D-254), plus rien à faire.

## 4. Ce qui est en attente
- **De l'opérateur** : (a) choisir le bouton plein après un arrêt au milieu d'un lot (recommandation de l'intégrateur : « Continuer ce lot ») et le caractère de mouvement (Sobre, Vivant, Signature) avant la phase 2 de CH-002 (le code de Signal) ; (b) décider de la **deuxième passe** : c'est le seul levier connu vers 5 % (28 « poserait », 25 à 20 mm ou moins, aucun à plus de 50 mm), mais son écriture est coupée tant que 125 « poserait » ne sont pas jugés ; (c) vouloir ou non le repointage de 60 cuts (`fiches/PROTOCOLE_REPOINTAGE.md`, étape B ; l'étape A est faite : base de la v6 à 5 et 10 mm, d'un échantillon trop petit) ; (d) installer l'application GitHub de Cursor avec écriture sur `banane-data` (facultatif : l'intégrateur dépose les données lui-même) ; (e) poser les secrets `ARIANE_MOTIFS_INTERDITS` et `ARIANE_MOTIFS_INTERDITS_CASSE` (réglages du dépôt et du relais), remplacer la valeur provisoire du secret du webhook, donner une échéance au jeton d'accès ; (f) essai Edge du glisser de la molette (`chantiers/CH-007/propositions/deplacement-vue.patch`, non appliqué).
- **De l'intégrateur** : relancer la session UX/UI de CH-010 (ou reprendre CH-002 phase 1c) depuis une session en mode « auto » ; rédiger la consigne de séance qui demande une observation Écho des **cuts posés par le lot** (le goulet de la mesure de précision) ; tenir `DECISIONS.md` à jour (D-256 en cas de cible de précision chiffrée).

## 5. Règles de session
- Modèle économique par défaut ; le plus fort seulement pour concevoir ou relire, en le disant.
- Pas d'agent pour lire un journal : un script. Un rapport fait une page.
- Jamais de nom d'opérateur, de code projet ESV, d'UUID ni de capture dans le dépôt de code ; les exports restent dans `banane-data` ; Cursor peut les lire et les analyser (D-253), aucun autre service externe.
- Pas de réécriture d'historique, pas de SKIP, pas de passe en écriture sans décision écrite de l'opérateur.
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
- **Premier message à coller** : le contenu de `fiches/DEMARRAGE_SESSION_PRINCIPALE.md` (sous la ligne de séparation), tel quel.
- L'ancienne session principale se désabonne des PR et ne pousse plus rien dès que la nouvelle a annoncé qu'elle prend le rôle.


## 8. Message de démarrage type d'une session fille (D-255)
Créer la fille en mode `auto` (la mère l'est), `create_session`, dépôt `banane`, branche `chantier/<ticket>`. Premier message : lire `CLAUDE.md`, `AGENTS.md`, `chantiers/<ticket>.md` ; **parler à la mère par `send_message` à `@parent` (priorité `next`), pas par le texte de fin de tour ni par le hub seul** ; un `send_message` à chaque jalon et à chaque question ; rapport final sur le hub ET par `send_message`. Côté mère : message à la fille en priorité `next` (jamais `now` sauf pour l'arrêter), puis `ScheduleWakeup` de 10 minutes pour lire son dernier texte de fin de tour (`list_events`, kinds `assistant`) si elle se tait. Mesuré le 28/10 : accusés de test reçus en moins de 2 minutes par ce circuit, aucun par le hub.
