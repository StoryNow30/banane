# Maquette edito-affiche « L'affiche »

**Logique (une phrase).** Une affiche lisible à trois mètres : un mot et un nombre occupent la largeur, le fond dit s'il faut venir et le mot le redit, tout le détail est sous la ligne de flottaison.

## Références et ce qui en est pris
- fontshare → fiche « Details » de Technor (« pour l'affichage, plus c'est grand, mieux c'est ») ; la planche (nom à 120 px). Pris : Technor 800 pour le mot et le nombre.
- wedoflow → gabarit Boldest : le nombre géant avec son unité collée en petit. Pris : « 128 cuts restent ».
- landdding → « Browse by color », palettes nommées des fiches : chaque teinte est nommée ; rapport 2026 : « la typographie fait davantage le travail », « le mouvement montre le comportement du produit ».
- Article « 7 Practical Animation Tips » (blog recensé par insposite) : ease-out, transitions courtes.
- Switzer (déjà au dépôt) pour les consignes : grotesque neutre.

## Sens des signes (le fond de tout le panneau porte l'état, toujours redit par un mot)
- Papier : tout va bien ou rien n'est lancé (Prêt, En cours, Écho).
- Gris : arrêté ou en pause par vous, rien ne presse.
- Orange : « À vous », une décision vous attend (ESV absent, onglet à choisir, file arrêtée, reprise après rechargement).
- Nuit (bleu très sombre) : fini, le bilan est prêt.
- Nombre géant = ce qui reste à faire ; bande pleine dessous = ce qui est fait ; sans bande quand le total est inconnu (on affiche alors « 112 faits · total inconnu »).

## Sans filiation
Feuille blanche ; seul le moteur commun lu.
**Ni voie ni nuage :** une affiche typographique, un mot et un nombre ; aucun pictogramme, aucune figure de terrain.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Changement d'état | le fond de #panneau (conservé) glisse vers sa teinte ; le mot est « collé » de haut en bas, 2e ligne décalée de 60 ms | 400 ms ; 300 ms, cubic-bezier(.2,.8,.2,1) | nouvelle affiche ; « il faut venir » quand ça passe à l'orange | teinte et mot posés |
| Chaque cut | le chiffre du reste qui change descend dans sa case (Technor proportionnelle, mesuré : cases de 0,58 em) ; monte pour un compteur qui croît | 200 ms | le nombre baisse : le lot tourne | aucun |
| Avancement | la bande (conservée) s'allonge | 850 ms linéaire | progression | saut |
Contrôlé : tic → width, baisser ; état → background-color, coller ; réduit : rien.

## Autocritique
- « À vous » en très grand occupe la moitié de l'écran ; c'est le but (lisible de loin), mais la cause est plus bas.
- Les chiffres en cases fixes espacent le « 1 » (« 1 2 8 »).
- L'orange plein en thème sombre est vif dans une pièce sombre ; il ne paraît que lorsqu'il faut venir.

## Vérificateur
5 418 textes, contraste minimal 4,83:1, **0 écart, 0 erreur de console** (1er passage : 159 écarts à 4,33:1 sur l'orange sombre ; orange éclairci à #EE5B23). Tours : bornes sur une ligne, bouton principal désactivé qui restait plein, cases de chiffres resserrées, notes qui se replient.
