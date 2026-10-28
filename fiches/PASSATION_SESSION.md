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

## 3. Où en est le projet (27/10/2026)
- **Version de test en terrain : 4.9.5.23** (paquet livré à l'opérateur, tronc `claude/50-test17`). La deuxième passe reste **en ombre**. Les décisions de la période : D-250 (priorités), D-251 (passe en ombre), D-252 (garde A et pertes acceptées).
- **Fait côté réseau d'IA** : hub opérationnel, CH-001 (scan des motifs interdits) fusionné. Cursor agit dans le cloud par la mention `@cursor` sur une PR.
- **Objectifs retenus** (`fiches/RESEAU_IA.md` § 6), dans l'ordre : (1) différés sous 5 % puis 3 % ; (2) interface (palette à repenser, mouvement jugé pauvre ; simplicité et code couleur de Signal intouchables) ; (3) vitesse de la relecture ; (4) écriture de la passe : zéro développement, réouverture par l'opérateur à 125 « poserait » jugés sans faute (27 au 27/10).
- **Budget** : 30 % du quota hebdomadaire pour tout le projet.
- **Analyses de lots** : tous les exports sont archivés dans le dépôt de données (`banane-data`, `collections/`), les scripts d'analyse sont dans `banane-data/outils/analyse-lots/` (rapports `RAPPORT.md` par analyse). Les lots des parties 0 et 1 (test 22 et 23) sont archivés, **non analysés** hors les différés (analyse faite).

## 4. Ce qui est en attente
- **De l'opérateur** : réponses sur l'interface (palette, mouvement, rythme) ; décision sur le remplacement de son prénom dans la documentation (1 567 lignes de 155 fichiers, hors historique git, que personne ne réécrit sans son ordre) ; remplacement de la valeur provisoire du secret du webhook GitHub (côté Cloudflare et GitHub) ; secret `ARIANE_MOTIFS_INTERDITS` dans les réglages du dépôt ; essai Edge du déplacement de la vue.
- **Tickets à écrire** (un par chantier, `chantiers/MODELE.md`) : scan sensible à la casse (CH-004), remplacement du prénom (CH-005), interface palette puis mouvement (CH-002), profil de la vitesse de la relecture (CH-003), chantier des différés (chercheur GCV2).

## 5. Règles de session
- Modèle économique par défaut ; le plus fort seulement pour concevoir ou relire, en le disant.
- Pas d'agent pour lire un journal : un script. Un rapport fait une page.
- Jamais de nom d'opérateur, de code projet ESV, d'UUID ni de capture dans le dépôt de code ; les exports restent dans `banane-data` et ne sortent jamais vers un service externe.
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
- *Règles de dépense* : agents Sonnet et Haiku, le niveau maximal seulement pour une tâche difficile, en disant pourquoi ; budget de 30 % du quota hebdomadaire pour tout le projet.
