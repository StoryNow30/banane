# Relais : Sol 6.1 prend l'orchestration de la 4.9 (30/09/2026)

Écrit par la session Claude qui orchestrait jusqu'ici. À lire après `BANANE_4.9_CAHIER.md` (v0.2, signé le 30/09, § 2.4).

## État
- `main` = `50b2bcb` (4.8.5 stable `v4.8.5` = `323356c`). Branche `claude/banane-486-ki069` (`654209d`) = 4.8.6 stable (D-065, KI-069), 3 commits devant `main`, fast-forward possible ; la direction la fusionne et crée `v4.8.6`. Branche `claude/banane-49-cahier-v02` (cahier + consignes) fusionnable ensuite sans conflit (essayé).
- Base de code de la 4.9 : 4.8.6 stable. V1 ne commence pas avant que `v4.8.6` existe.
- Décisions : § 2.4 du cahier. Trois chantiers ajoutés par la direction sont à cadrer (revenir à un cut ; faux 398/402 de la partie 20 ; régresseur de position) : objectif, porte, mesure, ordre, à soumettre avant exécution.
- Dépôt de données : `StoryNow30/banane-data` (collections, travail). Ne rien y déposer sans la direction.

## Ce que l'orchestrateur fait
Cadrer et faire exécuter les chantiers un par un (§ 6 du cahier, carte du code § 14), relire chaque diff avec une relecture indépendante (Claude ou Grok, jamais l'exécutant), préparer les paquets de test (`git archive <commit>` + `tools/package.py`, SHA reproductible), tenir `DECISIONS.md` (prochain numéro : D-066), analyser les exports par `tools/analyse-locale.cjs` et la page `reducteur-exports.html`. La direction seule fusionne, étiquette, publie.

## Leçons
- Les chiffres : toujours fichier:ligne ; deux erreurs passées (48 % et 63 % sont la même étape ; « 1,8 s » d'analyse n'a pas de source, le dépôt dit 1,43 s).
- Compteur ESV « N on M treated » : M = nombre de cuts, dernier cut = M−1.
- Un paquet dépend du commit exact (il embarque les docs) : le SHA n'est reproductible qu'avec `git archive` du même commit.
- Les poids : ≈ 1,2 Mo par cut visité ; le lot 33 a pesé 1,03 Go (KI-068). L'opérateur ne peut pas lancer de script sur son poste : exports allégés par la page navigateur.
- Astra (audit avant version stable, D-061) est indisponible environ une semaine à partir du 30/09.
- L'opérateur veut des réponses courtes, une chose à la fois, le chemin normal ; quota limité.

## Restes ouverts
KI-068/V2 (export), « lot terminé sauf différés », dérive en chaîne (cuts 108-114, partie 25, non démontrée), relecture de la partie 20 inutilisable, mesure C4 conforme (≥ 100 jugés) jamais faite pour la 4.8.x (D-063).
