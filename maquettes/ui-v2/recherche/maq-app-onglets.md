# Maquette `app-onglets` — Onglets et accessoire

**Logique en une phrase.** Le lot est « ce qui joue » : comme le mini-lecteur d'une app de musique, un accessoire en direct reste posé au-dessus de trois onglets (Lot, À regarder, File) et dit dans chacun si Ariane tourne, où elle en est, avec la seule commande utile du moment.

## Références et ce qui en est pris
- SwiftPieces : block « Accessory Tab Bar » (vignette regardée : accessoire au-dessus de la barre, fil de progression, une commande) ; block « Agent Run » (puce d'état, chiffre, activité en cours, barre à segments, cellules de compte, Pause et Stop) ; pièces TrackingTabs (compteur après le titre), StatusTimeline (frise des parties), NowPlaying (barre qui devient page).
- mobbin, glossaire « Tab Bar » (libellés quand l'icône n'est pas universelle, au plus cinq onglets) et « Segmented Control » (Orbite / Écho).
- v0, gabarit Tasko (compteur « 124 » à côté de l'onglet ; une seule tuile pleine).
- beUI : échange de contenu (« let the old content leave faster than the new content arrives », trajet de quelques pixels).

## Sens des signes
- Accessoire inversé (clair sur encre en thème clair, encre sur clair en sombre) : il parle du lot, pas de l'onglet ouvert. Brique avec le mot « File arrêtée » et un triangle quand une file s'arrête.
- Indigo : l'action. Ambre : à regarder ; le compteur ambre de l'onglet « À regarder » dit combien. Vert avec coche : partie faite ; brique avec triangle : partie arrêtée.
- Barre à segments : douze segments, un par douzième du lot, le segment en cours en indigo ; total inconnu : trame sans quantité.
- Filtres de la liste (Tous / Différés / À examiner) : pilule noire = filtre choisi.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Changement d'onglet | fond d'onglet glisse ; nouveau contenu entre de 12 px du côté de l'onglet visé | 360 ms (forme) ; 220 ms `(.16,1,.3,1)` | on va à gauche ou à droite dans l'app | fond et contenu changent sur place |
| Liste « À regarder » | lignes entrent l'une après l'autre (6 px, opacité) | 200 ms, cascade 30 ms, plafonnée au 7e | lecture de haut en bas | apparaissent ensemble |
| Examiner un cut | page poussée depuis la droite (40 px) ; retour = autre entrée | 260 ms | empilement de navigation | apparaît |
| Arrivée d'un cut | chiffre de l'onglet Lot monte ; chiffre de l'accessoire s'éclaire ; fil de l'accessoire s'allonge | 240 ms, 240 ms, 360 ms | progrès visible depuis tous les onglets | changement sur place |
| Nouveau reste | compteur de l'onglet descend en place | 260 ms | « un de plus à regarder » | chiffre changé |
| Changement d'état | accessoire change de hauteur, son mot monte de 4 px | 420 ms ; 220 ms | la même pièce change d'état | sur place |
| Arrêt d'une file | accessoire devient brique et se secoue une fois (−6, 5, −3, 1 px) | 380 ms ease-out | refus, à voir tout de suite (rôle « error » de SwiftPieces) | couleur et mot seuls |
| « Arrêter » | bouton plein brique + trait qui se vide | 4 000 ms linéaire | délai de confirmation | trait absent |
| Total inconnu / relecture | trame qui défile | 900 ms linéaire | ça tourne | trame fixe |

## Pourquoi sans filiation
Motif pris aux apps de lecture (accessoire + onglets) et à l'Agent Run de SwiftPieces, à partir des seuls `commun.js`, `construire.cjs`, `verifier.cjs` et du squelette.

## Ni voie ni nuage
Écrans faits de cartes, de chiffres et de listes ; la barre à segments est un compteur de douzièmes, pas une voie ; la coupe n'est montrée que dans la page « Examiner », légendée.

## Autocritique
- Trois onglets pour un outil à peu d'écrans : l'onglet File est vide hors file de parties (il le dit en une phrase).
- L'accessoire répète le chiffre de l'onglet Lot quand celui-ci est ouvert : redondance assumée (mini-lecteur), mais visible.
- La barre à segments peut évoquer une jauge de « stories » ; le compte exact est donné à côté.

## Chiffres du vérificateur (dernier passage)
Vérificateur, 20 scènes × 2 thèmes × 3 largeurs, mouvement réduit : `app-onglets : 6060 textes mesurés, contraste minimal 5.74:1, 0 écarts, 0 erreurs de console`. Scénarios en mouvement normal (clair et sombre, 360 / 420 / 600) joués et regardés image par image : 0 erreur de console. Défilement interne conservé au fil des tics (mesuré).
