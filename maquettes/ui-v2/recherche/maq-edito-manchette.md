# Maquette edito-manchette « La Une »

**Logique (une phrase).** Le panneau est la une du journal du lot : la manchette dit l'état en un ou deux mots lisibles à trois mètres, le chapeau et le grand chiffre disent où on en est, les rubriques sous filet donnent le détail.

## Références et ce qui en est pris
- landdding → site Fieldwork (fiche + site ouvert) : manchette serif pleine largeur, rubrique en capitales posée sur un filet épais. Pris : structure manchette / filet / rubriques.
- fontshare → fiches « Details » d'Erode (serif à contraste pour titres et citations) et Supreme (sans construite, sobre). Pris : le couple de polices, avec la raison.
- iter0 → « Launch brief » (libellé gris au-dessus, valeur forte). Pris : le bilan de fin en trois colonnes.
- wedoflow → gabarit Boldest : nombre géant + unité collée en petit. Pris : « 112 traités sur 240 ».
- beui → Digit Swap : chiffres en cases fixes (Erode et Supreme n'ont pas de chiffres tabulaires dans leur sous-ensemble web : mesuré, rapport largeur « 1111/0000 » = 0,58 avec ou sans `tnum`). Pris : cases de 0,56 em.
- Article « You Don't Need Animations » (blog recensé par insposite) : sous 300 ms, ease-out.

## Sens des signes
- Encre sur papier : tout ce qui va bien. Filet épais sous la manchette = progression (encre = fait, filet clair = reste ; pointillé + légende écrite quand le total est inconnu).
- Rouge unique « édition spéciale » = une décision vous attend, toujours avec « À vous » (ESV absent, onglet à choisir, file arrêtée, confirmation d'arrêt).
- Surtitre = identité du lot (« Lot · cuts 140 à 379 », « Partie 2 sur 3 »).

## Sans filiation
Partie d'une feuille blanche et des références ci-dessus ; aucune source d'Ariane, aucune autre maquette ouverte.
**Ni voie ni nuage :** c'est une page de journal (manchette, filets, rubriques) ; la seule figure est la coupe fonctionnelle de la vue « Examiner ».

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Changement d'état (phase, vue, activité, ou titre qui change : relecture, alerte) | La manchette se compose de bas en haut (clip + 0,25 em) ; chapeau et encadré « À vous » apparaissent | 280 ms puis 240 ms (+80 ms), cubic-bezier(.2,.8,.2,1) | « la une a changé » | posé d'un coup |
| Chaque cut posé (≈ 0,9 s) | Le compteur, le cut en cours, les différés montent d'un cran (seulement s'ils changent : `data-valeur` → `.change`) | 220 ms, ease-out | « le lot tourne », visible de loin | aucun |
| Avancement | Le filet de progression (conservé par `data-garder`) s'allonge en continu | 850 ms, linéaire | progression continue, sans saut | saut direct |
| Message | « Dernière minute » descend | 200 ms | une nouvelle | aucun |
| Appui | bouton à 0,97 | 80 ms | le bouton a entendu | aucun |
Contrôlé en navigateur (getAnimations) : tic → width ×1, chiffre ×2 ; état → composer, apparaître ; en mouvement réduit : rien.

## Autocritique
- Les chiffres en cases fixes espacent visiblement le « 1 » d'Erode (« 1 1 2 ») : c'est le prix de la stabilité.
- Le rouge peut rappeler une alerte générique ; il reste rare (une seule zone).
- La coupe de la vue Examiner ressemble à celle des autres maquettes (fonctionnelle, voulue).

## Vérificateur (20 scènes × 2 thèmes × 3 largeurs)
6 000 textes mesurés, contraste minimal 6,43:1, **0 écart, 0 erreur de console**. Captures regardées : 420 clair/sombre (toutes les scènes), 360, 600 ; trois tours de raffinement (surtitre dédoublé retiré, chapeau redondant remplacé par le temps restant, étiquettes de la coupe superposées corrigées, cases de chiffres, lien « Voir la liste »).
