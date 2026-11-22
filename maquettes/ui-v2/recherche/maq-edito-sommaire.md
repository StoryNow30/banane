# Maquette edito-sommaire « Le sommaire »

**Logique (une phrase).** Le lot est un petit livre dont le panneau montre la table des matières : chaque chapitre (préparer, poser, regarder ce qui reste, exporter ; ou chaque partie d'une file) mène par des points de conduite à son chiffre, un signet marque le chapitre où l'on est, et le détail descend en notes de bas de page.

## Références et ce qui en est pris
- wedoflow → fiche de gabarit : index numéroté des pages. Pris : chapitres numérotés (I, II, III…).
- iter0 → page « Launch CEO » : liste verticale des étapes avec un filet à gauche de l'étape courante ; le « Launch brief » qui cite ses sources en pied. Pris : le signet dans la marge, les notes de bas de page.
- dithergarden (via insposite) : rubriques numérotées.
- fontshare → « Pairs » (mise en colonne de presse) ; choix final hors fontshare : Newsreader (Google Fonts), dessinée pour lire l'actualité à l'écran, tailles optiques, chiffres alignés à chasse fixe par défaut (mesuré 1,000) : la colonne des chiffres reste droite sans artifice.

## Sens des signes
- Bordeaux du signet = « on en est ici », seule couleur, jamais autre chose.
- Gris = chapitre fini ; gras = chapitre en cours ; « à venir » écrit.
- Double filet + « † À vous » = ce qui vous attend ; la croix † renvoie à cet encadré depuis la table.
- Notes ¹ ² : différés et verts expliqués en pied de page.

## Sans filiation
Feuille blanche ; seul le moteur commun lu.
**Ni voie ni nuage :** c'est une table des matières de livre (points de conduite, signet, notes) ; aucune figure de terrain hors la coupe fonctionnelle de la vue Examiner.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Changement d'état | le titre italique se pose, ses lettres se resserrent (approche .06 em → -.01 em, opacité) ; le chapeau et l'encadré « À vous » apparaissent | 300 ms ; 240 ms (+100 ms) | nouveau chapitre de l'histoire | posé |
| Changement de chapitre (relecture → partie suivante, fin) | le signet (conservé par `data-garder`) glisse dans la marge jusqu'à la ligne courante et prend sa hauteur | 320 ms, cubic-bezier(.2,.8,.2,1) | « on est passé ici » | le signet saute |
| Chaque cut | la valeur de la ligne « Poser » et du cut en cours monte d'un cran | 200 ms | ça avance | aucun |
Contrôlé : tic → chiffre ×2 ; état → poser, paraître ; signet observé en train de glisser (transition top + height) pendant la relecture ; réduit : rien.

## Autocritique
- Centré, littéraire : très lisible de près, moins de loin que l'affiche ; le grand titre italique et « 112 traités sur 240 » portent la lecture à distance.
- Les points de conduite sont un ornement fonctionnel ; à 360 px ils deviennent courts.
- Newsreader pèse 437 Kio en base64 (fichier variable à tailles optiques).

## Vérificateur
5 772 textes, contraste minimal 6,39:1, **0 écart, 0 erreur de console** (1er passage : 78 écarts « forme 1,00:1 signet » : le vérificateur mesure le fond de l'élément contre lui-même ; le ruban est devenu une bordure, mesurée contre la page). Tours : signet absent en relecture (classe composée), « relue et corrigée » affiché pour la partie en cours de relecture, phrase redondante retirée en Prêt, bilan sans coupure de mot.
