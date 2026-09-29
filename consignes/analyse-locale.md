# Analyse locale des exports (quand ils pèsent des Go)

Un lot Orbite pèse environ 1,2 Mo par cut visité, une relecture Écho autant par
visite. Au-delà de quelques centaines de cuts, l'envoi est impossible (la session
n'a ni le disque ni le canal). L'analyse se fait donc chez l'opérateur, et seuls
les résultats (quelques centaines de Ko) sont envoyés.

- **Kit** : `banane-data/travail/2026-09-29_analyse-locale/ariane-analyse-locale.zip`,
  mode d'emploi pas à pas dans le zip (`LISEZMOI.txt`). Construit par
  `python3 tools/kit-analyse-locale.py`.
- **Outil** : `node tools/analyse-locale.cjs DOSSIER_RACINE` (un sous-dossier par lot,
  un par relecture ; le numéro de la partie est le premier nombre du nom). Sortie :
  `resultats/resultats-ariane-AAAA-MM-JJ.json.gz` (rapports d'acceptation, temps,
  extraits du journal) et `resultats/RESUME.md`.
- **Mode léger** (`acceptance-report.cjs --leger`) : les points bruts sont écartés dès la
  lecture ; les rapports sont identiques au mode complet (essai
  `tests/analyse-locale.test.cjs`, et comparaison sur des exports réels). Le rejeu hors
  ligne (`--rejeu-lot`) l'exclut : il reste réservé aux échantillons complets.
- **Conservation** : l'opérateur garde ses exports bruts. Pour une étude qui exige le
  rejeu, on lui demande un échantillon (quelques dizaines de cuts), pas le lot entier.
- **Lecture des résultats** : `gunzip` puis JSON ; `lots[].acceptation.rapport` est le
  rapport d'acceptation, `lots[].perf.mesures` les temps, `lots[].extraits` la fin de lot,
  les pauses, les erreurs et le relevé passif (`releve.couples` : « total du compteur /
  texte M cuts »).
