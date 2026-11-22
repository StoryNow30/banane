# Maquette `app-fil` — Fil et commandes

**Logique en une phrase.** Un outil de bureau : un fil d'Ariane dit où l'on est (Lot › Partie › Cut) et chaque maillon s'ouvre en sélecteur ; l'état est en grand au milieu avec un inspecteur ; en bas, une barre de commandes donne l'action du moment et ouvre une palette qui range toutes les actions, possibles ou non, avec leur raccourci.

## Références et ce qui en est pris
- navbar.gallery, type « Breadcrumbs » : Clerk (« Personal account ⌃ / Application ⌃ / Development ⌃ », chaque maillon est un sélecteur) ; type « Announcement » (Daytona : une bande mince pour un message) ; type « Search Bar » (raccourci clavier).
- mobbin, glossaire « Command Palette », avec sa mise en garde « Avoid if there are only a few commands » : ici la palette ne cherche pas, elle **range et explique** (commandes impossibles barrées avec leur raison).
- beUI, bloc « Command Palette » et durées de menu (150–250 ms).
- v0, M.O.N.K.Y (libellés en capitales à chasse fixe, inspecteur).

## Sens des signes
- Encre (noir en clair, blanc en sombre) = l'action à faire. Bleu = là où est le clavier (ligne choisie de la palette, contour de focus), rien d'autre.
- Ambre avec un point (« ● 3 ») = à regarder. Brique avec trait épais à gauche = cause d'un arrêt. Vert = partie faite (case cochée).
- Chaque commande porte sa lettre (P pause, C continuer, A arrêter, L lancer, N préparer, E exporter, R reste, B retour, K palette).
- Commande impossible : contour pointillé dans la barre, barrée dans la palette, raison écrite.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Ouvrir un maillon | sélecteur sort de son maillon (échelle 0,97 → 1, 4 px) | 160 ms `(.16,1,.3,1)` | il vient de là où l'on a cliqué | apparaît |
| Palette (bouton, K, ⌘K) | voile en fondu, palette monte de 10 px | 150 ms ; 200 ms | une couche au-dessus, on revient d'Échap | apparaît |
| ↑ ↓ dans la palette | la ligne choisie prend le fond bleu et son trait | immédiat | fréquent : pas de chorégraphie (beUI, « 100× a day ») | idem |
| Arrivée d'un cut | numéro du maillon « Cut … » descend en place ; compteur monte de 0,2 em ; règle s'allonge | 200 / 220 / 360 ms | le fil d'Ariane suit Ariane | sur place |
| Changement d'état | mot d'état monte de 4 px | 200 ms | | sur place |
| Incident | bande d'annonce descend | 220 ms | | apparaît |
| « Arrêter » | trait qui se vide dans le bouton | 4 000 ms | | absent |
| Total inconnu | pointillés qui défilent sur la règle | 900 ms linéaire | ça tourne | fixes |

## Pourquoi sans filiation
Motifs d'outils de bureau (fil d'Ariane-sélecteur, palette de commandes) pris aux références, sur le seul moteur commun.

## Ni voie ni nuage
Le fil d'Ariane est de la navigation (Lot › Partie › Cut), la règle est une jauge graduée ; la coupe n'est montrée que dans « Examiner », petite et légendée.

## Autocritique
- La palette est utile au clavier, moins à distance : pour un opérateur loin de l'écran, seule la grande ligne d'état compte.
- L'esthétique « outil » (chasse fixe, capitales) peut paraître froide.
- Sur 360 px, le fil d'Ariane passe sur deux lignes.

## Chiffres du vérificateur (dernier passage)
Vérificateur, 20 scènes × 2 thèmes × 3 largeurs, mouvement réduit : `app-fil : 5442 textes mesurés, contraste minimal 5.94:1, 0 écarts, 0 erreurs de console`. Scénarios en mouvement normal (clair et sombre, 360 / 420 / 600) joués et regardés image par image : 0 erreur de console. Défilement interne conservé au fil des tics (mesuré).
