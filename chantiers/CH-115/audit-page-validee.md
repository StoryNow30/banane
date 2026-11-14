# CH-115 : audit « page validée contre vrai panneau » (reprise du 14/11)

Outil : `chantiers/CH-115/outils/audit.cjs`. La page validée (`comparaison-epure.html`, colonnes « Après ») est rejouée depuis l'arbre de son commit (04b1142) ; le vrai panneau vient de l'arbre courant. Mesures dans Chromium, animations arrêtées. Photos à 2 ×, hors dépôt.
Périmètre : 13 scènes (Repos, Lot en cours, Pause, À toi, Rattrapage, Relecture, Fin du lot, Constellation, Vers la partie 15, Constellation finie, Aurore, ESV ne répond plus, Erreur du lot) × Étroit (380 × 640) et Large (600 × 760) × Glacier et Sarcelle, soit 52 vues.
Mesuré dans chaque vue : position et taille de la ligne d'état, du mot, de la partie, de l'anneau, de l'arc, du chiffre, du titre, du rang, de la phrase, de la frise, du point en cours, de la trace, du premier point, de l'avis, du bilan de fin, de la ligne « à poser », des boutons, de la liste et de l'onglet. Sont aussi comparés les fonds, couleurs, polices, ombres et arcs, l'accent et le fond de la fenêtre, et la commande des détails (texte, style, retraits au bord de la tuile).

## Écarts trouvés au premier passage (Glacier, étroit : 259) et corrigés

| Écart | Cause | Correction |
|---|---|---|
| Ligne d'état 94 à 148 px trop bas (la page la colle en haut, y = 78) | `position:static` ajouté en compact | Tenue en haut par des marges automatiques (16 px des bords), avec une cale en bas de la hauteur de la ligne : centre identique, aucun chevauchement possible |
| Commande des détails en pilule bordée « Détails ▾ », absente au repos | Style propre au panneau | Mot discret en capitales (10,5 px, sans bord, opacité 0,75, à 10 px du bas et 14 px de la droite), présent dans tous les états d'Orbite et d'Écho ; en Constellation, pilule « Bilan et départs ▾ » comme sur la page |
| Tuile 46 px trop haute (« À toi », fin du lot) | Rembourrages ajoutés pour la pilule | Retirés |
| Trace des cuts absente avec une alerte et en fin de lot | Retrait ajouté pour les petites fenêtres | Rendue ; retirée seulement sous 560 px de haut, sous les tailles de la page |
| Police des points de la trace à 0 | Règle ajoutée contre une fausse troncature | Retirée |

## Résultat

**52 vues sur 52 identiques à la page validée à 2 px près**, styles compris (0 écart). Photos du vrai panneau (`capturer.cjs`, 140 vues, 360 × 480 et 600 × 760, deux thèmes) : aucun débordement, aucune troncature, aucun contraste sous 4,5:1.
