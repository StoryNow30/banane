# Maquette `app-ilot` — Îlot et fil

**Logique en une phrase.** Le travail d'Ariane est un flux d'événements : un îlot noir dit l'état en une ligne et s'ouvre en place quand il faut l'opérateur (actions, réglage, cause d'un arrêt), et dessous un fil d'activité, le plus récent en haut, raconte ce qui s'est passé et tient ce qui reste à regarder.

## Références et ce qui en est pris
- SwiftPieces : ScrollIsland (îlot flottant qui grandit en panneau en place, anneau de part faite, titre qui change) ; FollowScroll (le fil qui suit le plus récent sans arracher le lecteur) ; StatusTimeline (le détail qui sort de son nœud → l'examen s'ouvre dans la ligne) ; pattern « Activity Timeline » (« Runs of one kind fold into one line » → « Cuts 241 à 251 posés »).
- beUI : bloc « Dynamic Island » manipulé (pilule qui s'élargit, petit libellé en capitales au-dessus d'un chiffre qui roule) ; guide (« move the shape first, then introduce its label »).
- mobbin : « Status Dot » (jamais seul : un mot l'accompagne), « Toast ».

## Sens des signes
- Noir : la voix d'Ariane, au même endroit dans les deux thèmes. Blanc plein dans l'îlot : l'action à faire. Brique cerclée : Arrêter.
- Anneau blanc : part faite quand le total est connu. Trois points qui passent : ça tourne, total inconnu (jamais d'anneau deviné).
- Fil : rond plein = maintenant ; ambre + deux barres = différé ; vert + œil = posé mais à examiner ; trait court = suite de cuts posés repliée ; coche = partie faite ; triangle brique = arrêt ; drapeau = départ du lot.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Îlot ouvert / refermé (toucher, Échap) | largeur et hauteur de l'îlot, puis le contenu apparaît (fondu retardé à 35 %) | forme 440 ms `(.2,.95,.25,1.02)` ; contenu 380 ms | la forme d'abord, le libellé ensuite (beUI) | ouvert / fermé sans trajet |
| Changement d'état | l'îlot s'ouvre seul en pause, arrêt, fin, incident ; se referme en cours | idem | Ariane appelle l'opérateur seulement quand il le faut | sur place |
| Arrivée d'un cut | chiffre de l'îlot monte de 0,35 em ; ligne « Ariane pose le cut … » s'éclaire ; nouvelle ligne du fil descend de 10 px | 240 / 260 / 260 ms | le fil s'écrit par le haut | sur place |
| Le lecteur a défilé | le fil garde ce qu'il lisait (ancrage du défilement, conservation au fil des tics) | — | on n'arrache pas le lecteur (FollowScroll) | idem |
| Examiner un cut | la ligne s'agrandit et montre la coupe ; le fil défile jusqu'à elle | hauteur 420 ms | le détail sort de son nœud | sans trajet |
| Total inconnu / relecture | trois points en relais | 660 ms par point, décalés de 220 ms | ça tourne | points fixes |
| « Arrêter » | trait de confirmation qui se vide | 4 000 ms | | absent |

## Pourquoi sans filiation
Motif d'îlot et de fil d'activité pris aux références (SwiftPieces, beUI), sans voir l'interface actuelle ni les autres maquettes.

## Ni voie ni nuage
Un îlot et une frise d'événements (frise de temps, pas de voie) ; aucun dessin de rail ni de nuage hors de la coupe d'examen, petite et légendée.

## Autocritique
- L'îlot noir fermé est plus petit qu'un « visage » : lisible de loin grâce au contraste, mais le chiffre (40 px) reste moins gros que dans d'autres maquettes.
- Le fil est reconstruit à partir des restes et des compteurs : il ne montre pas d'heure, faute de mesure (aucune heure n'est inventée).
- Les boutons « Examiner / Ouvrir » sur chaque ligne alourdissent le fil quand il y a beaucoup de restes ; le filtre « À regarder » aide.

## Chiffres du vérificateur (dernier passage)
Vérificateur, 20 scènes × 2 thèmes × 3 largeurs, mouvement réduit : `app-ilot : 8820 textes mesurés, contraste minimal 5.95:1, 0 écarts, 0 erreurs de console`. Scénarios en mouvement normal (clair et sombre, 360 / 420 / 600) joués et regardés image par image : 0 erreur de console. Défilement interne conservé au fil des tics (mesuré).
