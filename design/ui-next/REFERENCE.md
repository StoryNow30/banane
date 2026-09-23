# Banane UI Next — référence visuelle

Retenue par la direction le 23 septembre 2026 comme **référence de style** pour
le chantier B du cahier 4.8 (§5.4, Banane UI Next). Aucun développement n'est
engagé par cette note : elle dit à quoi l'interface doit ressembler le jour où
le chantier démarre. Le périmètre fonctionnel reste celui du §5.4 ;
l'interface reste opérateur, compacte et discrète dans ESV.

Captures : `reference-1-apercu.jpg` (cartes de limites, chiffres clés) et
`reference-2-consommation.jpg` (courbe, infobulle, tableaux par catégorie). Elles
montrent un tableau de bord sans rapport avec Banane ; seul le style compte.

## Ce qu'on en retient

- **Fond clair et sobre, un seul accent** : un vert sourd pour les actions, les
  barres et les courbes, jamais pour décorer.
- **Hiérarchie par la typographie** : gros chiffres clés, décimales et unités
  atténuées (`23 616,00`, `31,14 B`), petits libellés gris au-dessus.
- **Cartes à bord fin, sans ombre**, avec un pied discret : un statut à gauche
  (« par défaut »), une action à droite (« Détails → »).
- **Barres de progression fines**, valeur et échéance alignées en colonnes à
  droite. Une donnée absente se dessine en pointillés et se dit « non
  rapportée » : jamais confondue avec zéro.
- **Couleur d'alerte douce et rare** : seule la valeur concernée change (ocre),
  rien d'autre.
- **Rangée de chiffres clés** en cellules égales, la première légèrement teintée.
- **Commandes segmentées compactes** (7 j / 30 j / 90 j, Valeur / Tokens,
  courbe / barres).
- **Graphique épuré** : quadrillage pointillé léger, séries en nuances d'un même
  vert, infobulle en carte avec détail et total.
- **Tableaux par catégorie** : barre de répartition empilée en tête, puis lignes
  avec une petite barre proportionnelle sous chaque valeur.
- **Fraîcheur et provenance visibles** : « mis à jour à l'instant », « données
  de session locale », « comment c'est calculé ⓘ ».

## Transposition à Banane

- **Carte de lot Pilote** : cuts traités, différés et refusés par l'écartement
  en barres fines ; politique effective et état du lot dans le pied de carte.
- **Chiffres clés** : couverture, erreur médiane contre la relecture, biais
  d'écartement, rails calés — chacun avec sa provenance (« relecture Natif du
  JJ/MM ») et « non mesuré » en pointillés quand il n'y a pas de référence.
- **Courbe** par cut ou par jour ; infobulle avec le détail par rail.
- **Tableaux** par partie et par motif d'abstention, barre de répartition en tête.
- Les règles conservées du §5.4 s'expriment dans ce style : `Différés : N`
  fidèle, incertitude de navigation visible avec son cut, aucun bouton présenté
  comme réussi sur un simple accusé.
