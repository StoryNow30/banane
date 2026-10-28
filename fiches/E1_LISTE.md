# E1 — Mémoire de la liste d'ESV et diff-liste (plan 5.0, idée 1)

Statut : livré sur la branche `claude/50-e1-liste`, version non montée. Accord de l'opérateur : D-122, question 1 (garder localement, par partie, les bords qu'Ariane a écrits ; exporter un instantané compact de la liste).

## Principe

ESV réécrit la ligne de sa liste des coupes à chaque validation (statut, drapeaux, six bords monde). Quand tu relis une partie après Orbite, chaque cut que tu corriges change ses bords dans la liste. Donc : liste relue − bords écrits par Ariane = ta correction, exactement, sans séance Écho. Ariane ne fait aucune requête vers ESV pour cela : elle lit la table que l'observateur passif tient déjà en mémoire de la page.

## Ce qui est gardé (en local, dans `chrome.storage.local`)

- **Instantané** : à chaque chargement complet de la liste d'une partie (au démarrage de la séance, là où la fiche de départ est calculée), une table compacte : par ligne, indice (= numéro de cut), statut, drapeaux (`TreatedByOperator`, `SeenByOperator`), six bords monde arrondis au dixième de millimètre. Mesuré sur une voie synthétique de 9 000 lignes : 326 Ko brut, 106 Ko zippé. Dernier instantané par partie, douze parties au plus. Une liste identique à la précédente n'est pas re-traitée.
- **Mémoire des bords d'Ariane** : par partie, cut → six nombres, heure, version, alimentée par les validations 2xx observées pendant un lot en cours (jamais en Écho, jamais hors lot). Une centaine d'octets par cut.
- **Compteur** : à chaque chargement d'une partie connue, les cuts mémorisés dont un bord diffère de plus de 1 mm de la liste donnent un événement `ecart-liste` (cut, écart par rail en mm, statut, nouveau ou déjà signalé) et un compteur « corrections constatées, dont N depuis le dernier passage ». Le panneau (résumé de la partie) et `CONTENU.txt` ne montrent que des comptes et des millimètres, aucune coordonnée.

Les coordonnées ne sortent que dans le fichier d'instantané exporté, `ariane-liste-partieN-<heure>.json`, rangé dans les volumes zip d'Orbite (« Tout télécharger ») et d'Écho. Les corps d'écriture sont déjà dans le journal.

## Protocole pour l'opérateur

1. Lot Orbite sur la partie ; export comme d'habitude (le vidage automatique après export ne touche pas la mémoire de la liste).
2. Relis la partie dans ESV (tous les cuts posés), corrige ce qui doit l'être.
3. **Recharge la liste** : F5 sur ESV, puis démarre une séance Ariane (Orbite ou Écho) sur la même partie. À ce chargement Ariane compare, émet les `ecart-liste` et range le nouvel instantané. Le résumé de la partie dit « N corrections constatées ».
4. **Exporte** (Orbite « Tout télécharger » ou Écho « Terminer et télécharger ») : l'instantané et le résumé arrivent dans les volumes.
5. Hors ligne : `node tools/diff-liste.cjs AVANT.json APRES.json` (deux instantanés de la même partie, avant et après ta relecture) ou `node tools/diff-liste.cjs --journal ariane-journal-v4-….json APRES.json` (écritures d'Ariane du journal contre la liste relue). Options : `--detail` (une ligne par cut), `--json sortie.json`, `--seuil mm`, et `--journal` avec deux instantanés pour séparer les cuts d'Ariane des verts d'extraction.

Le premier instantané d'une partie (avant la relecture) sert d'AVANT ; il n'y a pas de comparaison à ce moment-là si Ariane n'a rien posé sur cette partie.

## Réglage et vidage

`listeMemoire.actif` (src/settings.js), vrai par défaut : faux = rien n'est gardé, comparé ni exporté. Le bouton « Vider le cache des exports » efface aussi la mémoire de la liste et les instantanés (vidage manuel seulement ; le vidage automatique après export les garde, il en faut pour la relecture qui suit).

## Limites

- Il faut que l'observateur ait vu la liste entière depuis sa première page (pas de rechargement partiel, pas de table tronquée ni rompue) : sinon pas d'instantané, dit par « saute » dans le retour interne, rien d'affiché.
- « Inchangé » ne veut dire « juste » que si tu as relu toute la partie. Un autre opérateur, une ré-extraction ou une écriture d'Ariane postérieure au journal changent aussi des lignes : on ne compte que les bords qui diffèrent de plus de 1 mm de ce qu'Ariane a écrit, mais on ne sait pas qui les a changés.
- Les drapeaux sont pollués par Ariane (elle écrit `TreatedByOperator:true`) : `diff-liste` les rapporte sans en tirer de conclusion.
- La mémoire d'une partie repart de zéro si l'identité de la liste change (même numéro de partie, autre liste).
- Écritures faites par Ariane hors lot (reprise manuelle, pause) : non mémorisées. Écho : rien n'est mémorisé (ce sont tes poses).
- `diff-liste` : latéral/vertical dans un repère profil tiré des voisins de la référence ; si les deux voisins manquent, distance 3D seule (dit dans le résumé). Le journal v4 ne donne la table que par l'empreinte de sa clé : s'il en contient plusieurs, la plus écrite est choisie.
- Trois zones de code existantes sont touchées par quelques lignes (observateur : message `banane5:liste` ; pont : relais ; service worker : trois accroches) ; la logique est dans `src/liste-memoire.js` et `tools/diff-liste.cjs`.
