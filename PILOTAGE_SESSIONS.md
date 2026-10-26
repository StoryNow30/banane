# Pilotage par sessions courtes, modèles et compaction (D-086, 12 octobre 2026)

Instruction de l'opérateur : utiliser les tokens intelligemment, une session courte par chantier, savoir quel modèle Claude et quel niveau d'effort
conviennent à chaque tâche, compacter quand c'est nécessaire ou opportun. Complète D-081 (relectures) et D-083 (mode économe).

## 1. Principe

1. **Une session = un chantier** (un seul à la fois, comme le cahier § 6). Au démarrage : lire UNIQUEMENT la fiche du chantier (`fiches/`),
   pas le cahier entier, pas les rapports. Au besoin, lire un extrait ciblé (`grep`, `sed -n`).
2. **Fin de chantier = point de compaction** : DECISIONS à jour, branche poussée, fiche mise à jour, puis `/compact` (même session) ou nouvelle
   session avec la fiche. L'orchestrateur le dit à l'opérateur en une ligne.
3. **Zéro agent par défaut** (D-083). Un agent seulement pour : une relecture indépendante de code qui peut perdre des données (D-081), ou une lecture
   très volumineuse isolée. Jamais de cascade, jamais plus de 4 agents, environ 25 appels par agent, accord de l'opérateur avant plus de 2.
4. **Chaque tâche : une ligne de choix au départ** « modèle, effort, direct ou agent » (table ci-dessous). Ce que l'orchestrateur ne peut pas régler
   lui-même (le modèle et l'effort de la conversation) est demandé à l'opérateur ; ce qu'il règle (agents, workflows) est réglé par lui.

## 2. Routage modèle et effort (recommandations, à corriger avec les coûts mesurés)

| Tâche | Niveau de modèle | Effort | Comment |
|---|---|---|---|
| Dialogue avec l'opérateur, arbitrage simple, point d'étape | niveau rapide | moyen | conversation |
| Décision d'architecture, conception V3 (ordre des lectures d'ESV), cas ambigu | niveau fort | élevé | conversation, courte |
| Analyse d'un export de séance (`analyse-locale`, `perf-lot`) | niveau rapide | bas à moyen | direct, scripts du dépôt |
| Code borné (constante, fixture, test, version) | niveau rapide | moyen | direct |
| Code qui efface ou enregistre (vidage, export), conception de capture (V3) | niveau fort | élevé | direct, tests rouges d'abord |
| Relecture indépendante de ce code | niveau fort ou niveau maximal | élevé | **un** agent, angle précis |
| Texte, consigne, rapport, relevé `verify`, paquet, push | niveau éclair ou niveau rapide | bas | direct |
| Recherche dans le code (où est X ?) | niveau éclair | bas | `grep`, ou agent Explore |

Limites de cette table : prix et qualités des modèles non vérifiés ici ; l'ordre « plus fort = plus cher » est une hypothèse. Les coûts mesurés par chantier
(voir § 4) servent à la corriger.

## 3. Compaction : quand

| Déclencheur | Action |
|---|---|
| Fin d'un chantier ou d'une séance terrain analysée | `/compact` après mise à jour des documents |
| Contexte au-delà d'environ 150 000 tokens (le coût de chaque appel est proportionnel au contexte) | `/compact` à la prochaine pause naturelle |
| Avant de lancer un chantier de nature différente | `/compact` ou nouvelle session |
| Après une grosse lecture (cahier entier, rapport de plusieurs centaines de lignes) | compacter si elle n'est plus nécessaire |

`/compact`, `/clear` et le changement de modèle ou d'effort sont des commandes de l'opérateur : l'orchestrateur ne peut pas les lancer. Il signale
« point de compaction recommandé » et fournit, si la session change, la phrase de démarrage de la fiche.

## 4. Coût

À la clôture de chaque chantier, l'orchestrateur donne à l'opérateur une ligne : appels, agents, tokens lus et écrits (outil : lecture de la transcription,
comptée sur les messages de l'assistant), pour corriger le routage ci-dessus.

## 5. Gabarit d'une fiche de reprise (une page)

But en 2 lignes · Version et branche de départ · Ce qui est déjà acquis (liens, pas de recopie) · Reste à faire, dans l'ordre · Commandes utiles ·
Critères du cahier (références de paragraphes) · Décisions de l'opérateur en attente · Ce qu'il ne faut PAS relire · Modèle et effort conseillés.
