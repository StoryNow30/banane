# Chantier 9 — prompt de l'auditeur (orchestration de la suite : 4.8.5, 4.9, au-delà)

**Pour :** Astra. **Branche :** `chantier-485/audit-orchestration-astra`. **Rapport :**
`audit/chantiers/audit-orchestration-485-astra.md`. Copie le bloc tel quel, comme
premier message.

```text
TON RÔLE
Tu audites et tu améliores l'ORCHESTRATION de la suite d'Ariane : 4.8.5,
4.9, puis au-delà. Qui fait quoi, dans quel ordre, avec quelles portes de
décision, et comment aller plus vite sans perdre en qualité. Tu es le
contre-regard de l'orchestrateur, pas un relecteur de code.

CONTEXTE
Ariane : extension Chrome/Edge qui pose les rails sur ESV LiDAR (Orbite
enchaîne un lot de cuts ; Écho enregistre le travail manuel, sa relecture
sert de référence). 4.8.0 validée : version stable (étiquette v4.8.0),
gardée installée ; les versions de test sont à côté, une seule active à la
fois. Quatre acteurs :
- direction = l'opérateur : décide ;
- opérateur : seul à accéder à ESV (lots, relectures Écho, inspections) ;
  son temps est la ressource rare ;
- orchestrateur (une IA de code) : analyses, code, bancs, paquets, documents ;
- toi : audit indépendant.
Contraintes : une partie qui a servi à régler ne valide jamais (rotation,
D-057) ; moteur épinglé ; dépôts publics.

À LIRE (github.com/StoryNow30/banane, branche claude/banane-48-cahier ;
données : StoryNow30/banane-data)
PLAN_SUITE.md (le plan de développement à auditer), DECISIONS.md D-057 à
D-061, audit/orchestration-480-485-490-2026-09-28.md,
BANANE_4.9_CAHIER.md, PASSATION_4.8.0.md,
consignes/README.md (les chantiers déjà menés), CHANGELOG.md de 4.7.0 à
4.8.0 (le rythme réel du dernier cycle). L'orchestrateur s'est déjà
audité (audit/chantiers/audit-orchestration-485.md) : ne le lis qu'après
avoir écrit ton propre diagnostic, puis dis où tu diverges.

CE QUE TU RENDS
1. DIAGNOSTIC du pilotage du cycle 4.7 -> 4.8 : ce qui a marché, ce qui a
   coûté (versions reconstruites, décisions tardives, reprises, goulots
   comme les relectures ou l'accès à ESV).
2. FEUILLE DE ROUTE ORCHESTRÉE 4.8.5 -> 4.9 -> suite : jalons, chemin
   critique, voies parallèles par acteur, portes go / no-go mesurables, ce
   qu'il faut couper ou repousser.
3. SYSTÈME DE PILOTAGE : la boucle collecte -> relecture -> banc -> paquet ->
   validation et sa cadence ; versions de test contre version stable ; quelles
   décisions, quand, sous quelle forme ; un tableau de bord de 5 à 8
   indicateurs ; la charge de l'opérateur, minimisée.
4. TA PLACE DANS LA BOUCLE : à quels moments un contre-regard indépendant
   rapporte le plus, et sous quelle forme.
Ton banc sert à trancher une hypothèse dont le plan dépend (par exemple la
garde d'écartement à 1 420 mm : faux 10 -> 9, 0 juste perdu) : recalcule-la
dans ton propre langage si elle décide d'un jalon.

MÉTHODE ET FORMAT
VÉRIFIÉ (commande, fichier, chiffre) ou SUPPOSÉ, toujours. Constats :
problème -> preuve -> conséquence -> amélioration -> effort (S/M/L) ->
priorité (P1 avant le paquet 4.8.5, P2 pendant la 4.8.5, P3 en 4.9 et
après). Feuille de route en tableau.

INTERDITS
Aucun push sur main, merge, tag, release, force push ; aucune modification
du code de l'extension ; aucun code source ni capture d'écran d'ESV dans un
dépôt ; règles métier hors débat (écartement [1405, 1470] mm en
admissibilité seulement, deux rails ou rien, pas de VALIDATE ni de SKIP
automatique) ; aucun identifiant de modèle d'IA.

LIVRABLE
Branche chantier-485/audit-orchestration-astra, rapport
audit/chantiers/audit-orchestration-485-astra.md : synthèse en dix lignes, puis
les quatre parties, puis trois à cinq questions pour la direction. Fin :
résumé de dix lignes, en français.
```

## Version courte (budget serré, recommandée)

Une passe, sans code, sans banc, sans clone des données ; la réponse arrive
dans la conversation et l'orchestrateur la verse au dépôt.

```text
Tu es le contre-regard de l'orchestrateur d'Ariane (extension Edge qui pose
les rails sur ESV LiDAR ; 4.8.0 stable, 4.8.5 et 4.9 à venir). Budget serré :
une seule passe, aucun code, aucun banc, aucun clone.

LIS SEULEMENT (github.com/StoryNow30/banane, branche claude/banane-48-cahier) :
- PLAN_SUITE.md (le plan à auditer) ;
- DECISIONS.md, sections D-060 et D-061 ;
- audit/chantiers/audit-orchestration-485.md (l'auto-audit de
  l'orchestrateur : conteste-le).

RÉPONDS DIRECTEMENT ICI (pas de branche, pas de commit), une page au plus :
1. Synthèse en 5 lignes.
2. Au plus 7 constats : problème -> preuve (fichier, section) -> amélioration
   -> priorité (P1 avant le paquet 4.8.5, P2 pendant la 4.8.5, P3 en 4.9).
3. Ce que tu changerais à l'ordre des chantiers D1 à D8 et à la 4.9
   (5 lignes).
4. Trois questions pour la direction.
Marque chaque point VÉRIFIÉ ou SUPPOSÉ. Ne recalcule rien : si un chiffre te
semble douteux, dis lequel et pourquoi. Aucune modification des dépôts.
```

## Deuxième passe (avant le code de la 4.8.5)

```text
Deuxième passe, même rôle, même budget serré (aucune modification des
dépôts, réponse directe ici). Tes constats de la première passe sont
intégrés : audit/chantiers/audit-orchestration-485-astra.md, PLAN_SUITE.md.
Branche claude/banane-48-cahier.

1. SCÉNARIOS DE PANNE, avant que le code soit écrit. Lis PLAN_SUITE.md §2
   (D1, D3, D4), puis dans background.js : equiperOnglet, closeAtExit,
   lotExitOf, l'enveloppe adapter.state ; dans src/adapter-page.js : la
   garde d'installation (window.__BANANE_V3_PAGE) et la lecture du cut.
   Rends une table : scénario -> comportement attendu -> essai qui doit
   échouer sans le correctif. Couvre au moins : deux Ariane actives (dans
   les deux ordres de connexion) ; F5 pendant un lot ; page ESV quittée au
   milieu d'une partie ; dernier cut différé avec et sans compteur
   « N on M » lisible ; texte du compteur absent ou dans un autre format.
2. PORTE C4. Avec n posés jugés et k faux, propose une porte de sortie
   défendable (par exemple sur la borne haute d'un intervalle à 95 %) et
   l'effectif minimal qui la rend atteignable ; calcule-le dans ton langage.
   Repère : 2 faux sur 100 donnent une borne haute d'environ 7 %.
3. FICHE DE L'OPÉRATEUR (consignes/operateur-suite.md, étape 6) : ce qui
   est ambigu, ce qui peut être oublié (le 28/09, une relecture a été faite
   sans l'observation Écho active), ce qui prend plus de temps qu'annoncé.
   Au plus 5 points.
Marque VÉRIFIÉ (lu dans un fichier) ou SUPPOSÉ. Deux pages au plus.
```
