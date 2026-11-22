# Maquette edito-specimen « Le spécimen »

**Logique (une phrase).** Le lot est une planche de spécimen de fonderie : chaque mesure est une ligne avec sa méta minuscule au-dessus et sa valeur composée en très grand, entre filets d'un pixel ; le bloc plein marque ce qui est actif ou ce qui attend votre geste.

## Références et ce qui en est pris
- fontshare → liste des familles (méta 10 px puis nom à 120 px, filets, aucun rayon) ; l'onglet actif en bloc noir avec son effectif ; la grille « Glyphs » ; le compteur de tête qui change quand on filtre (100 → 55 → 17) ; fiche « Details » de Tabular (« chaque glyphe a la même chasse », pour les rapports chiffrés) et de Satoshi (`tnum` présent : mesuré 1,000).
- landdding → site Exemplar : nom de graisse en petit à gauche d'une ligne géante ; menu final en grille de mots séparés par des filets.
- beui → Digit Swap : chaque chiffre dans sa case, seul celui qui change bouge.

## Sens des signes
- Aucune couleur : encre et papier, clair comme sombre.
- Bloc plein (encre inversée) = actif (l'activité en cours, Orbite ou Écho) ou à vous (ESV absent, cause d'arrêt) ou action principale ; toujours un mot dedans.
- Grille d'avancement : une case = 10 cuts ; pleine = faite, cadre épais = en cours, grisée = à venir ; un chiffre dans la case = cuts à regarder dans cette tranche ; légende écrite sous la grille ; « la grille s'allonge » quand le total est inconnu.
- Hachures = action indisponible, raison écrite dessous.

## Sans filiation
Feuille blanche ; seul le moteur commun lu.
**Ni voie ni nuage :** c'est une planche de fonderie (lignes de spécimen, grille de glyphes) ; la grille découpe le lot en tranches de 10, elle ne figure aucun terrain.

## Partition de mouvement
| Événement | Ce qui bouge | Durée, courbe | Sens | Mouvement réduit |
|---|---|---|---|---|
| Chaque cut | seul le chiffre qui change roule dans sa case (clé par position) | 200 ms, ease-out | « ça avance », sans faire bouger les autres chiffres | aucun |
| Tranche de 10 terminée | la case se remplit de bas en haut | 300 ms | une tranche de plus | case pleine d'emblée |
| Changement d'état | la valeur d'état se tape de gauche à droite, pas à pas (12 pas) | 260 ms | nouvel état | posé |
| Changement d'activité (Orbite ↔ Écho) | le bloc plein descend dans l'onglet choisi | 180 ms | l'activité active a changé | posé |
| Appui | bouton à 0,98 | 80 ms | | aucun |
Contrôlé : tic → rouler ×2 ; état → balayer ; le bloc d'onglet ne s'anime plus sur un simple changement de phase (corrigé au 2e tour) ; réduit : rien.

## Autocritique
- Tabular en capitales (« EN COURS ») a l'espacement d'une machine à écrire : voulu, mais austère.
- Beaucoup de blocs noirs dans les états « À vous » (état + cause + bouton) : ils se suivent et forment un seul bloc, ce qui reste lisible.
- La grille peut paraître abstraite au premier regard ; la légende écrite est indispensable.

## Vérificateur
8 286 textes, contraste minimal 6,73:1, **0 écart, 0 erreur de console**. Tours : libellé « P2 relue » trompeur remplacé par « en relecture », animation d'onglet isolée sur le seul changement d'activité, vérification 360/420/600 clair et sombre.
