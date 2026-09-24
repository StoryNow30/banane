# Banane UI Next — proposition « La ligne », version 2

Proposition indépendante pour le chantier B (cahier 4.8, §5.4), faite sans
consulter les maquettes corrigées de Luna. Maquette statique : `index.html`
(ouvrir dans un navigateur) et sept planches en image (`ecran-*.png`).
**Données fictives.**

La version 1 (commit a74c225) posait l'idée ; la direction l'a retenue et a
demandé un vrai travail de design et des boutons plus simples. La version 2
garde l'idée et reprend tout le reste.

## L'idée, inchangée : le lot est une ligne

L'opérateur pose un cut en regardant la voie (amendement n°7) ; la décision
sur le lot fait de même (n°9). « La ligne » dessine donc le lot comme un
**schéma linéaire de ligne ferroviaire** : un repère par cut, comme un point
kilométrique, et au-dessus un **profil en long du déplacement posé**, avec la
bande de la garde de continuité (±30 mm). Un cut qui sort de la continuité de
la voie se voit sans rien lire.

## Ce que la version 2 change

**Le ruban devient une voie.** Deux rails fins, et une traverse par cut. La
forme porte l'état, la couleur ne fait que la renforcer :

| Traverse | Sens |
|---|---|
| pleine | posé par le moteur (ou validé par toi, en Natif) |
| creuse | posé par la voie |
| pointillée | différé : la place est vide, à combler plus tard |
| croix | refusé par l'écartement (rouge) ou SKIP de l'opérateur (gris) |
| fine et pâle | à venir |
| haute, noire, avec son numéro | le cut affiché ; rouge et « 409 ? » si la navigation est incertaine |

**Moins de cadres, plus de hiérarchie.** Plus aucune carte : des blocs séparés
par l'espace. Chaque écran se lit de haut en bas : l'état en capitales
colorées, un grand chiffre (le cut), une ligne de compteurs, la voie, le
détail, puis la barre d'action. Typographie Inter à chiffres tabulaires (la
police est embarquée avec la maquette ; dans l'extension, elle le serait aussi,
sans appel réseau).

**Un état, une action** (planche 7). Un seul bouton plein par écran, en bas à
gauche, toujours au même endroit. Les autres choix sont des liens à côté.
« Détails › » à droite ouvre le diagnostic. Règles :

1. Un bouton ne dit jamais « réussi » : la ligne d'état le dit, après l'effet
   observé.
2. Une action irréversible n'est jamais le bouton plein : elle est en rouge et
   demande une confirmation (Arrêter le lot, SKIP explicite).
3. Pas de bouton grisé pour une fonction future ou inutile dans l'état.
4. Un verbe et son objet, avec le numéro du cut quand l'action le vise.
5. Vert pour avancer, noir pour s'arrêter ou constater.

Avant / après, pour le Pilote : le panneau actuel (`panel.js`) a neuf
boutons d'action et en affiche jusqu'à six ensemble — sur un rail non résolu :
Démarrer (grisé), Arrêter, Réessayer, Reprise manuelle, SKIP explicite,
Télécharger le bilan, tous de même poids. « La ligne » en montre un, plus un
ou deux liens. Aucune fonction n'est retirée : chacune reste accessible dans
l'état où elle a un sens.

## Les planches

| # | Écran | Action principale |
|---|---|---|
| 1 | Pilote, lot en cours | Pause (lien : Arrêter le lot) |
| 2 | Pilote, navigation incertaine | J'ai vérifié le cut 409 · clôturer (lien : Journal) |
| 3 | Pilote, fin de lot | Télécharger le bilan et les LiDAR (lien : Nouveau lot) |
| 4 | Natif, collecte | Terminer et télécharger (lien : Pause) |
| 5 | Assisté | Appliquer les deux rails (lien : Ignorer) |
| 6 | Pilote, thème sombre | l'écran 1 posé sur ESV |
| 7 | Les boutons | les dix états et leur action |

## Les règles du cahier, et où elles sont

- **Politique effective affichée** : sous le compteur, en permanence.
- **« Différés : N » fidèle** : compteur ambre ; à l'écran 2, le cut incertain
  n'y est pas ajouté et une ligne le dit.
- **Incertitude visible avec son cut** : traverse rouge « 409 ? », titre,
  libellé du bouton.
- **Aucun bouton présenté comme réussi sur un simple accusé** : la dernière
  commande se lit en trois étapes — émise, effet, serveur (toujours « non
  disponible ») ; seul un effet observé passe au vert.
- **Écartement** : une plage 1405–1470 sans valeur centrale ni repère à 1435.
- **Deux rails ou aucun** : c'est le libellé même du bouton de l'Assisté.
- **Couverture jamais seule** : le bilan de fin de lot dit que la justesse
  n'est pas mesurée avant la relecture Natif.
- **Natif** : « Aucune commande n'est envoyée » reste affiché pendant toute la
  collecte.

## Ce que ça demande à l'extension

- Le profil lit, par cut, le déplacement latéral posé et l'écart à la voie : la
  4.7.8 les calcule déjà (`lotObservation`).
- La reprise des différés n'apparaît pas tant qu'elle n'existe pas (D2 et
  chantier 1) ; la ligne en sera le support naturel, chaque tronçon différé
  étant une cible de navigation.
- La police Inter (48 Ko, licence SIL OFL, `fonts/`).

## Intégration dans l'extension (chantier B, 24/09, D-045)

Retenue par la direction ; intégrée au panneau (`panel.html`, `panel.css`,
`panel.js`), rendus réels dans `integration/` (données fictives).

**Intégré.** Langage visuel (palette claire, thème sombre selon le système,
Inter embarquée dans `fonts/`, blocs sans cadres). Pilote : état en capitales,
cut en grand, compteurs (posés, dont par la voie, différés, SKIP, repris à la
main), politique effective sous les compteurs, **la voie** (une traverse par
cut, dans l'ordre d'ouverture) et **le profil en long** (écart de chaque cut à
la voie de ses voisins, bande de la garde 0–30 mm). Un bouton plein par état
dans les trois vues, les autres en liens ; « Démarrer » et les bornes masqués
pendant un lot ; « Archiver le résultat interrompu · cut N » ; SKIP explicite
confirmé. Aucun identifiant, aucun comportement retiré ; tests
`tests/panel-ligne.test.cjs`.

**Intégré en 4.7.17.** La commande en trois étapes (émise, effet, serveur ;
vert seulement pour un effet observé) ; la plage d'écartement dans l'Assisté
(calculée par le service worker comme le garde du moteur) ; le tiroir
« Détails › » (exports de diagnostic et dépannage ; en Natif, « Ce qui est
observé » et réglages) ; les pastilles d'état sur les onglets ; « Nouveau lot »
en fin de lot, qui rouvre les bornes sans rien lancer. Tests
`tests/panel-ligne-suite.test.cjs`, `tests/background-assiste-ecartement.test.cjs`.

**Pas repris.** La coupe dessinée des deux rails dans l'Assisté (planche 5) :
les déplacements restent écrits en millimètres ; « Pourquoi › » de l'Assisté.
