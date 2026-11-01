# Maquette edito-rature « La liste rayée »

**Logique (une phrase).** Le lot s'écrit comme une liste en phrases : chaque cut traité se raye d'un trait de crayon, ce qui reste se lit en clair, et le crayon bleu du correcteur annote en marge ce qui attend l'opérateur.

## Références et ce qui en est pris
- iter0 → accueil, étape « Sharpen » : le trait de crayon qui raye une ligne et la note manuscrite en italique qui donne la raison ; le dialogue dont les anciens messages s'estompent vers le haut. Pris : le mécanisme (SVG `pathLength=1`, deux passages d'épaisseurs différentes, `stroke-dashoffset` animé) — ni le dessin, ni le filtre de grain, ni le code.
- beui → « Agent Activity / Streaming Text » : le flux monte d'une seule transformation. Pris : la liste monte d'une ligne à chaque cut.
- swiftpieces (lecture du dépôt, `text-reveal.mdx`) : cascade calculée pour un total constant. Pris : la grande phrase s'écrit mot à mot en 0,6 s quelle que soit sa longueur.
- fontshare → fiche « Details » de Sentient (robuste, grands contre-poinçons, italique « divine ») : police unique, l'italique = voix de l'annotateur.
- microcopy (via insposite) : phrases complètes qui disent quoi faire (encarts d'incident).

## Sens des signes
- Rayé au crayon graphite = traité. Gras + curseur clignotant = ce qu'Ariane fait maintenant. Gris = pas encore fait.
- Bleu de correcteur, précédé d'une flèche, en marge = à regarder par vous (différé, vert à examiner, incident, confirmation d'arrêt). Aucune autre couleur.
- Le réglage est une phrase à trous : « Poser du cut [140] au cut [379], en une seule partie. »

## Sans filiation
Feuille blanche et références ; aucun fichier d'Ariane ni autre maquette ouverts.
**Ni voie ni nuage :** c'est une liste de choses à faire qu'on raye ; les cuts sont des lignes de texte, pas un tracé.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Chaque cut traité | La liste monte d'une ligne (une seule transformation) puis le crayon raye la ligne qui vient de finir | 260 ms ; trait 340 ms (+120 ms), cubic-bezier(.3,.7,.2,1) | « un de plus de fait », lisible de loin | lignes rayées d'emblée, sans tracé ni montée |
| Changement d'état (ou de titre : relecture, alerte) | La grande phrase s'écrit mot à mot ; l'encart bleu apparaît ensuite | 0,6 s au total (pas = 380 ms / nb de mots), 220 ms par mot | « Ariane dit autre chose » | phrase posée |
| Nombres de la phrase | chiffres en cases (Sentient proportionnelle, mesuré 0,64) qui montent d'un cran | 200 ms | valeur nouvelle | aucun |
| Curseur | clignote sur la ligne en cours | 1,1 s, pas à pas | « elle écrit ici » | fixe (règle étendue aux pseudo-éléments) |
Contrôlé : tic → monter ×1, rayer ×2, chiffre ; état → écrire ×5 ; réduit : rien (le clignotement a été trouvé et coupé au 2e tour).

## Autocritique
- Le trait sur chaque ligne passée finit par faire une colonne grise ; les plus anciennes sont estompées pour garder la hiérarchie.
- La liste ne montre que les 5 derniers cuts : choix de lisibilité, l'historique complet est dans ESV.
- Le curseur clignotant est un clin d'œil de traitement de texte ; on pourrait le retirer si l'opérateur le trouve distrayant.

## Vérificateur
6 360 textes, contraste minimal 5,33:1, **0 écart, 0 erreur de console**. Tours de raffinement : trait trop bas (soulignement) remonté au milieu de l'œil, trait partiel corrigé (`vector-effect` retiré), « ? » orphelin (espace fine insécable), animation de liste qui se déclenchait aussi au changement d'état isolée sur le compteur de cuts, liste « Avant de lancer » sans valeur retirée, boutons à note qui se replient à 360 px.
