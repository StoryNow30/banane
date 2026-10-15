# Organisation du développement 5.0 : comment Claude Code travaille sans gaspiller

Version 1 du 15 octobre 2026, à relire par Mic. Complète `BANANE_5.0_CAHIER.md` § 8. But : livrer les chantiers du cahier **sans gaspiller de jetons** et **sans être freiné par la fenêtre de 5 heures** du forfait de Mic. Tout est pensé comme un seul système : qui fait quoi, avec quel niveau de modèle, à quel effort, à quel moment.

Par règle du dépôt (aucun identifiant de modèle), les modèles sont désignés par **niveaux de coût**, mesurés sur le prix public de la sortie, le plus petit valant 1 :

| Niveau | Coût relatif (sortie) | Ce qu'il fait bien | Ce qu'il ne doit pas faire |
|---|---|---|---|
| **Éclair** | 1 | tâches mécaniques et bornées : renommer, monter une version, lancer verify, packager, découper des exports, extraire des chiffres d'un journal, relire un format | concevoir, juger une pose, toucher le cerveau |
| **Rapide** | 20 | développer un chantier bien spécifié dans un worktree, écrire des essais, des outils hors ligne, des consignes ; fusions ; recherche ciblée dans le code | décider seul d'un changement de règle de pose ; relire le code gelé |
| **Fort** | 40 | relecture adversariale d'un diff, juge d'idées, conception d'un chantier, diagnostic d'un défaut difficile, analyse d'un export inattendu | travail mécanique long |
| **Le plus fort** | 100 | l'orchestrateur : décisions, arbitrages, briefs, synthèses pour Mic, cas où une erreur coûterait une séance de terrain | tout ce qu'un niveau inférieur fait aussi bien |

Un même niveau se règle aussi par l'**effort** (bas, moyen, haut, très haut, maximal) : l'effort bas consomme moins et répond plus court. Règle : **effort bas pour l'éclair et les tâches mécaniques, moyen pour le développement rapide, haut pour la relecture et la conception, maximal jamais sauf décision de Mic.**

---

## 1. Les rôles

**Orchestrateur** (cette session ; niveau le plus fort ou fort, effort haut). Lit les exports par scripts, décide, écrit les briefs, relit les rapports, consigne dans `DECISIONS.md`, parle à Mic. **Ne développe pas lui-même** au-delà de quelques lignes ; **ne lit jamais un gros fichier en entier** (il demande des extraits ou un résumé chiffré). C'est le poste le plus cher : chaque minute qu'il passe à faire du mécanique est perdue.

**Développeur** (sous-agent ou session distante ; niveau rapide, effort moyen, haut pour un chantier qui touche la pose). Reçoit un brief complet (but, fichiers, règles, porte de sortie, format du rapport), travaille dans son worktree et sa branche, lance verify, commite, pousse, rend un rapport de dix lignes avec des chiffres. Un chantier = un développeur = une branche.

**Relecteur** (niveau fort, effort haut, lecture seule). Seulement pour : un diff qui touche la pose, le cerveau, le moteur gelé, une fusion dans une branche de livraison, ou un défaut que le développeur n'explique pas. Jamais systématique (D-081, D-083 : relectures proportionnées).

**Mesureur** (niveau rapide ou éclair, effort bas). Écrit et lance les scripts hors ligne sur les exports (perf-v3, jointure Écho ↔ Orbite, cohérence voisins, diff-liste). Rend des tables, pas de prose.

**Juges** (niveau fort, trois lentilles) : seulement dans un atelier d'idées ou avant une décision d'architecture, sur demande de Mic.

---

## 2. Quel niveau pour quelle tâche du cahier

| Tâche | Niveau | Effort | Forme |
|---|---|---|---|
| Montée de version, fusion sans logique nouvelle, paquet, SHA, consigne à partir d'un modèle | éclair ou rapide | bas | sous-agent en arrière-plan |
| Relevés en lecture seule (S6), outils hors ligne (S3, E1 étape 1, M6, E5), scripts de mesure (P0) | rapide | moyen | sous-agent, worktree |
| Chantiers qui posent ou décident (P1 à P3, M3, M4, G1) | rapide pour écrire, **fort pour relire le diff** | moyen puis haut | développeur + relecteur |
| Conception (G0, M3 méthodes, spécification d'une porte) | fort | haut | un agent, fiche en sortie, relue par l'orchestrateur |
| Analyse d'un export de terrain | scripts par un mesureur, puis orchestrateur sur la table | bas puis haut | jamais de lecture de JSON par un modèle |
| Diagnostic d'un défaut terrain inexpliqué | fort | haut | un agent, reproduction au banc d'abord |
| Campagne de pannes, rejeux du banc | éclair | bas | commandes, résultats en fichiers |
| Atelier d'idées, audit large | rapide (chercheurs) + fort (juges) | moyen / haut | workflow, **seulement sur « go » de Mic** |

---

## 3. L'outil « advisor » et ce qu'on en retient

L'article que Mic a transmis décrit l'outil **advisor** de l'API Claude : un modèle **exécuteur** rapide et peu cher fait le travail, et consulte en cours de route un modèle **conseiller** plus fort, qui lit toute la conversation et rend un plan ou une correction (400 à 700 mots), sans produire lui-même la réponse. Résultat mesuré par Anthropic : un exécuteur rapide à effort moyen avec un conseiller fort atteint à peu près la qualité de l'exécuteur à effort par défaut, pour moins cher ; sur un petit modèle, le gain est de plusieurs points. Le conseiller est facturé à son tarif, 1 400 à 1 800 jetons par appel ; plafond de sortie conseillé 2 048 ; rentable dès trois appels par conversation. Recommandation de l'article : consulter **avant tout travail substantiel, au point de blocage, et avant de déclarer la tâche finie.**

**Ce que ça change pour nous.** L'outil advisor est une fonction de l'API, pour les applications qu'on programme soi-même ; il n'existe pas tel quel dans une session Claude Code. Mais son principe est exactement la façon dont on travaille déjà, et on la rend systématique :

- l'**exécuteur** est le développeur de niveau rapide ;
- le **conseiller** est l'orchestrateur, consulté aux trois mêmes moments : **le brief** (avant tout travail), **le point de blocage** (le développeur écrit à l'orchestrateur au lieu d'improviser), **la fin** (le rapport est relu avant d'être accepté) ;
- entre ces trois moments, l'orchestrateur ne regarde pas : c'est là que l'économie se fait.

Si un jour on construit un traitement par l'API (par exemple l'étiquetage automatique des corrections pour GCV2), l'advisor s'applique directement : exécuteur rapide, conseiller fort, plafond 2 048, cache du conseiller si ≥ 3 appels.

---

## 4. Règles d'économie de jetons

1. **Un brief complet d'emblée.** Les modèles récents travaillent mieux et moins cher avec toute la tâche décrite au départ qu'avec des allers-retours. Chaque brief contient : but, fichiers exacts, règles absolues, porte de sortie mesurable, format du rapport (dix lignes, chiffres).
2. **Les rapports sont des données, pas des récits.** Un agent rend des tables et des nombres ; la prose est pour Mic, écrite une fois par l'orchestrateur.
3. **Jamais de lecture d'export par un modèle.** Les exports (10 à 100 Mo) sont lus par des scripts qui rendent des tables. Un modèle lit la table.
4. **Jamais de gros fichier entier.** Extraits par numéros de lignes, grep, résumés. Un fichier de 2 000 lignes lu en entier coûte autant qu'une demi-heure de développement.
5. **Un chantier = une session = une branche.** Pas de session fleuve : une session longue se recompacte et relit son passé, ce qui coûte deux fois. Avant de finir, chaque session écrit son relais (DECISIONS, fiche, consigne) pour que la suivante reparte de fichiers, pas de mémoire.
6. **Verify une fois par commit**, essais ciblés pendant le travail. Pas de verify complet après chaque modification.
7. **Pas de mode rapide** (même modèle, deux fois le prix) : rien ici n'est urgent à la seconde.
8. **Workflows multi-agents seulement sur « go » de Mic**, avec deux ou trois agents à la fois, résultats mis en cache (une relance ne refait que ce qui manque, comme aujourd'hui).
9. **Relecture proportionnée** (D-081, D-083) : relecteur fort seulement si la pose ou le code gelé est touché.
10. **Pas de double travail** : avant de développer, chercher si une branche existe déjà (la 4.9.0.20 en est l'exemple : trois versions de travail déjà faites par une autre session).

---

## 5. La fenêtre de 5 heures

Le forfait de Mic compte la consommation sur une fenêtre glissante de cinq heures ; quand la limite est atteinte, tout s'arrête jusqu'à la réinitialisation (aujourd'hui : trois juges bloqués jusqu'à 19 h 40). Le niveau de modèle compte dans cette consommation : une heure d'agent rapide coûte à peu près la moitié d'une heure d'agent fort et un vingtième d'une heure du niveau éclair. Règles :

1. **Le lourd en début de fenêtre.** Ateliers, relectures fortes, chantiers de plusieurs heures : lancés juste après une réinitialisation, jamais à la fin d'une fenêtre.
2. **Un seul agent lourd à la fois** en régime normal ; plusieurs seulement en début de fenêtre et sur un « go ».
3. **Suivi écrit de la consommation.** Mic me donne son pourcentage quand il le voit ; chaque chantier note dans son rapport les jetons consommés ; l'orchestrateur tient l'ordre de grandeur par chantier dans `DECISIONS.md` (aujourd'hui : six chercheurs ≈ 1,15 million de jetons de sous-agents ; trois juges et une synthèse ≈ 0,8 million).
4. **Reprise automatique après la limite.** Quand la limite tombe, l'orchestrateur programme sa propre reprise à l'heure de réinitialisation (outil de rappel de la session) et relance ce qui manque depuis le cache. Mic n'a rien à faire.
5. **Les sessions distantes en arrière-plan** (créées par l'orchestrateur avec un niveau rapide) font les chantiers longs sans occuper la session principale ; l'orchestrateur ne lit que leur rapport final. Une session Claude locale chez Mic puise dans le même forfait : elle ajoute du parallélisme, pas du budget.
6. **Vingt pour cent de la fenêtre gardés** pour analyser l'export de terrain de Mic quand il arrive : c'est le travail qui fait avancer la 5.0, il ne doit jamais attendre la fenêtre suivante.
7. **Le terrain fixe le rythme.** Une version de test tous les deux ou trois jours de terrain ; entre deux, l'orchestrateur ne dépense rien à attendre : les sessions se terminent et sont réveillées par l'export suivant.

---

## 6. Cycle type d'un chantier

1. **Brief** (orchestrateur, 10 min, niveau fort) : extrait du cahier, fichiers, porte, format du rapport.
2. **Développement** (développeur rapide, 1 à 4 h, arrière-plan) : worktree, branche `claude/50-<chantier>`, essais, verify, commit, push, rapport de dix lignes. Au premier blocage : message à l'orchestrateur, pas d'improvisation.
3. **Relecture** (seulement si pose ou code gelé touché ; relecteur fort, 20 min, lecture seule) : diff, essais, porte.
4. **Acceptation** (orchestrateur, 5 min) : rapport contre la porte ; consignation dans `DECISIONS.md` ; paquet et consigne par un agent éclair.
5. **Terrain** (Mic) : séance, export.
6. **Analyse** (mesureur rapide par scripts, puis orchestrateur, 15 min) : table, décision, chantier suivant.

Coût attendu par chantier d'un jour d'agent : de l'ordre de 300 000 à 600 000 jetons au niveau rapide, soit une fraction d'une fenêtre ; une relecture forte ajoute 100 000 à 200 000. Les 95 jours du cahier se lissent ainsi sur les fenêtres de Mic sans en bloquer aucune, à condition de respecter les règles du § 4 et du § 5.

---

## 7. Ce que Mic décide

- Le « go » des ateliers multi-agents et des relectures fortes hors cas prévus.
- Le niveau de modèle d'une session distante quand il veut aller plus vite ou plus loin que la règle.
- Le pourcentage de fenêtre qu'il m'autorise à consommer sans lui demander (proposition : jusqu'à 60 % par fenêtre, au-delà je demande).
