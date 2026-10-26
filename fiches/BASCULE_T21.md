# Bascule Orbite / Écho et cuts skippés (test 21)

## Le défaut (rapporté par l'opérateur)

Signal ouvert en Orbite, état « Terminé », aucun lot ouvert : la bascule montrait Écho avec un cadenas et la raison « Orbite est disponible après la séance Écho ». L'opérateur venait de finir une séance Écho (export final fait), puis des lots.

## Cause (ÉTABLIE, lecture du code et essai rouge)

1. `src/ui5.js` (`echoEtat`) ne connaît que quatre statuts ouverts de la séance Écho (en cours, en pause, démarrage, ESV muet). Tout autre statut avec des visites, donc une séance **FINIE** (`FINISHED`), devient « Séance à terminer ». Le service worker garde cette séance finie tant qu'elle n'est pas remplacée ou abandonnée (`src/native-session.js`, `close`, puis `start`) : après l'export final, l'étiquette reste donc indéfiniment. Le bouton « Terminer » du panneau d'origine est d'ailleurs masqué pour une séance `FINISHED` (`panel.js`, `native-end`).
2. `src/signal-rendu.js` (`modele`) rangeait « Séance à terminer » dans les séances actives (`ECHO_ACTIF`) et, Orbite affiché, verrouillait **l'autre** segment (Écho) avec le texte de l'autre activité (« Orbite est disponible… »). Deux défauts : un verrou sur le chemin qui permet de remédier, et un texte qui ne désigne pas l'activité verrouillée. Depuis Écho avec un lot ouvert, le même code verrouillait Orbite avec « Écho est disponible après le lot ».

## Référence : l'ancien panneau

Les vues Orbite et Écho (`panel.js`, `naviguer`) ne se verrouillent jamais. Seuls les départs sont refusés : `native-start` grisé quand un lot est actif, `start-batch` grisé quand une séance Écho est ouverte (`openStatus`, quatre statuts ouverts). Une séance `FINISHED` ne bloque rien, ni côté panneau ni côté moteur (`active()` de `src/native-session.js` n'a que les statuts ouverts).

## Correctif (texte et logique de `m.bascule` seulement)

| Activité affichée | Condition | Segment verrouillé | Raison |
|---|---|---|---|
| Orbite | lot ouvert | Écho | Écho est disponible après le lot |
| Orbite | pas de lot (séance Écho ouverte, finie ou absente) | aucun | |
| Écho | séance ouverte, pas de lot | Orbite | Orbite est disponible après la séance Écho |
| Écho | séance finie (« Séance à terminer »), absente, ou lot ouvert | aucun | |

Depuis Écho avec un lot ouvert, l'écran Écho dit déjà « Disponible après le lot Orbite » : Orbite doit rester accessible pour suivre le lot. La palette (« Passer en Écho / Orbite ») lit la même valeur.

Limite (SUPPOSÉ, hors périmètre) : l'étiquette « Séance à terminer » reste trompeuse pour une séance finie ; Signal ne propose pas de la clore autrement que par le démarrage d'une nouvelle séance ou l'abandon (feuille de réglages). Non touché ici.

## Cuts skippés dans « Parties traitées » (Historique T21)

- `src/historique-parties.js` : `skippes` = cuts distincts de `batch.skipped` (les SKIP de l'opérateur vus par le moteur ; Ariane n'en envoie jamais), dans la fiche de fin (`banane55FinsLot`) et dans l'entrée de `partsHistory`. Une fiche écrite avant le champ, un lot sans fiche ou une valeur abîmée donnent null, jamais 0.
- `src/signal-rendu.js` : la ligne montre « · N skippé(s) » dès que la valeur est connue, y compris 0 ; l'ancien « N ignorés » devient « N ignorés au départ » (cuts ignorés au départ du lot, autre chose).
- La vue du panneau transporte déjà `partsHistory` jusqu'au rendu (`background.js`, `src/ui5.js`) ; un essai du service worker réel le vérifie.

## Essais

`tests/signal-rendu.test.cjs` (bascule : tous les cas du tableau, cadenas sur le bon segment, texte de l'activité visée ; ligne de l'historique) et `tests/t20a-historique.test.cjs` (module et service worker réel).
