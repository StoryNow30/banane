# CH-103 : une proposition pour le panneau, d'après Linear et Cursor (rien n'est intégré)

Étude : `chantiers/CH-103/etude.md`. Maquettes seulement ; aucun fichier de l'extension ne change.

- `variables.css` : couleurs (sombre, clair), échelle de texte, espacements, rayons. `ariane.css` : les composants (tête et onglets, menu, état, avis, avancement, propriétés, liste, boutons, pied).
- `fonts/InterVariable.woff2` : Inter 4.66, SIL OFL 1.1 (`fonts/LICENCE-Inter.txt`). Aucune ressource extérieure.
- `generer.cjs` : fabrique `index.html` (les deux écrans, sans capture). Avec `--captures DOSSIER --sortie FICHIER`, fabrique la page publiée, hors dépôt, avec le panneau actuel à côté.
- `outils/capturer2.cjs` (repris de CH-101) photographie le panneau du tronc ; `outils/voir.cjs` photographie les deux écrans et mesure. Les images restent hors dépôt.

## Parti pris
Une police, des gris, des traits fins. L'état est un signe, un mot et une phrase ; l'avancement, une barre fine et un pourcentage. Une seule couleur, l'orange, et seulement quand c'est à l'opérateur.

## Où sont les actions d'aujourd'hui
| Action | Où |
|---|---|
| Orbite, Écho, Aurore | tête, à gauche |
| Onglet ESV (« Utilisé par Ariane — ESV ») | tête, bouton « ESV » |
| Commandes (Ctrl K), Réglages, Vider le cache | menu « ··· », un clic |
| Pause, Arrêter le lot | pied |
| Réessayer ce cut, Reprise manuelle | dans l'avis, sous l'état |
| À poser : Ouvrir, Examiner ; verts à contrôler | section « À poser » : ouverte en 600 × 760, un clic en 360 × 480 |

Le bouton « SKIP explicite » reste absent (D-320). Aucune action ajoutée ni supprimée.

## Mesuré pendant la session (ÉTABLI)
- `outils/voir.cjs`, 2 écrans × 2 tailles × 2 thèmes : aucun élément hors du cadre, aucune troncature, corps sans défilement ; contraste le plus faible 5,02:1 (éléments inactifs exclus) ; menu ouvert dans le cadre en 360 px, aucune entrée coupée ; Inter chargée, aucune requête extérieure.
- Page publiée : pas de défilement horizontal à 400 px ni à 1280 px.

## À valider avant toute intégration (SUPPOSÉ)
- Le pourcentage : position du cut en cours dans la plage du lot (4812 dans 4790 à 4900, soit 20 %). Le panneau actuel écrit « total inconnu ».
- La phrase de l'avis sans « ou le passer » (bouton masqué, D-320).
- « Vider le cache » passe dans le menu ; la ligne « Cache des exports » disparaît de l'écran.

## Non vérifié
- Le rendu sur le poste de l'opérateur (la police est embarquée, ce qui doit l'aligner sur le nôtre).
- La comparaison avec Linear et Cursor a été faite par la session elle-même, captures côte à côte ; aucun regard indépendant.
- Les six autres états ne sont pas dessinés (ils attendent la réponse de l'opérateur).
