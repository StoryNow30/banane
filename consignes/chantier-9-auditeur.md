# Chantier 9 — prompt de l'auditeur (orchestration de la suite : 4.8.5, 4.9, au-delà)

**Pour :** Astra. **Branche :** `chantier-485/audit-orchestration`. **Rapport :**
`audit/chantiers/audit-orchestration-485.md`. Copie le bloc tel quel, comme
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

À LIRE (github.com/StoryNow30/banane, branche main ; données :
StoryNow30/banane-data)
audit/orchestration-480-485-490-2026-09-28.md (le plan actuel),
BANANE_4.9_CAHIER.md, DECISIONS.md D-057 à D-059, PASSATION_4.8.0.md,
consignes/README.md (les chantiers déjà menés), CHANGELOG.md de 4.7.0 à
4.8.0 (le rythme réel du dernier cycle).

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
Branche chantier-485/audit-orchestration, rapport
audit/chantiers/audit-orchestration-485.md : synthèse en dix lignes, puis
les quatre parties, puis trois à cinq questions pour la direction. Fin :
résumé de dix lignes, en français.
```
