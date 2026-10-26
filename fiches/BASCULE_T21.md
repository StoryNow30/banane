# Bascule Orbite / Écho et cuts skippés (test 21)

## Le défaut (rapporté par l'opérateur)

Signal ouvert en Orbite, état « Terminé », aucun lot ouvert : la bascule montrait Écho avec un cadenas et la raison « Orbite est disponible après la séance Écho ». L'opérateur venait de finir une séance Écho (export final fait), puis des lots.

## Cause (ÉTABLIE, lecture du code et essai rouge)

1. `src/ui5.js` (`echoEtat`) ne connaît que quatre statuts ouverts de la séance Écho (en cours, en pause, démarrage, ESV muet). Tout autre statut avec des visites, donc une séance **FINIE** (`FINISHED`), devient « Séance à terminer ». Le service worker garde cette séance finie tant qu'elle n'est pas remplacée ou abandonnée (`src/native-session.js`, `close`, puis `start`) : après l'export final, l'étiquette reste donc indéfiniment. Le bouton « Terminer » du panneau d'origine est d'ailleurs masqué pour une séance `FINISHED` (`panel.js`, `native-end`).
2. `src/signal-rendu.js` (`modele`) rangeait « Séance à terminer » dans les séances actives (`ECHO_ACTIF`) et, Orbite affiché, verrouillait **l'autre** segment (Écho) avec le texte de l'autre activité (« Orbite est disponible… »). Deux défauts : un verrou sur le chemin qui permet de remédier, et un texte qui ne désigne pas l'activité verrouillée. Depuis Écho avec un lot ouvert, le même code verrouillait Orbite avec « Écho est disponible après le lot ».

## Référence : l'ancien panneau

Les vues Orbite et Écho (`panel.js`, `naviguer`) ne se verrouillent jamais. Seuls les départs sont refusés : `native-start` grisé quand un lot est actif, `start-batch` grisé quand une séance Écho est ouverte (`openStatus`, quatre statuts ouverts). Une séance `FINISHED` ne bloque rien, ni côté panneau ni côté moteur (`active()` de `src/native-session.js` n'a que les statuts ouverts).

## Correctif (texte et logique de `m.bascule` seulement, d'après la revue D3 et R2)

La bascule Orbite / Écho est une **navigation** : elle n'est jamais verrouillée, comme les vues du panneau d'origine. Les départs restent refusés là où ils l'étaient : boutons d'origine grisés (`native-start` pendant un lot, `start-batch` pendant une séance ouverte) et écran Écho « Disponible après le lot Orbite ». La palette (« Passer en Écho / Orbite ») lit la même valeur.

Quatre cas couverts par un essai (segment cliquable, aucun cadenas) : séance Écho en cours rouverte en Orbite ; lot en cours avec `#native` (vue Écho) ; séance terminée ; lot ouvert en Orbite.

Libellé (`src/ui5.js`) : `FINISHED` donne « Séance terminée » (plus « Séance à terminer », qui ne subsiste que pour un statut inconnu avec des visites). Seuls les quatre statuts ouverts comptent comme séance ouverte (raison du cache « après la séance Écho »).

## Cuts skippés dans « Parties traitées » (Historique T21, d'après R3)

- `src/historique-parties.js` : `sautes` = cuts distincts de `batch.skipped` (les SKIP de l'opérateur vus par le moteur ; Ariane n'en envoie jamais), dans la fiche de fin (`banane55FinsLot`) et dans l'entrée de `partsHistory`. Une fiche écrite avant le champ, un lot sans fiche ou une valeur abîmée donnent null, jamais 0.
- `src/signal-rendu.js` : la ligne montre « · N skippé(s) » dès que la valeur est connue, y compris 0 ; l'ancien « N ignorés » devient « N ignorés au départ » (cuts ignorés au départ du lot, autre chose). L'heure de la ligne est celle de Paris (règle du panneau d'origine), de même que l'heure des différés (`src/ui5.js`).
- La vue du panneau transporte déjà `partsHistory` jusqu'au rendu (`background.js`, `src/ui5.js`) ; un essai du service worker réel le vérifie.

## Essais

`tests/signal-rendu.test.cjs` (bascule : quatre cas, palette, libellés ; ligne de l'historique, heure de Paris), `tests/ui5-panneau.test.cjs` (libellé de la séance selon le statut) et `tests/t20a-historique.test.cjs` (module et service worker réel).
