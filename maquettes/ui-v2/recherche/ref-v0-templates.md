# Référence : v0.app/templates (Chromium)

## Ce que j'ai ouvert exactement
- `/templates` (200) ; catégories : `/templates/dashboards`, `/templates/components`, `/templates/design-systems`, `/templates/layouts` (200, listes lues) ; `/templates/apps` répond 200 mais affiche la page générique « Templates » : la catégorie réelle est `/templates/apps-and-games` (ouverte, 200 : Seq, AI Chat Interface, Attendance app…).
- Gabarits ouverts en détail (page + aperçu dans son cadre, attente 15 s) :
  - Dashboards : **Pulse – Engineering Metrics & Incident Response Console**, **Tasko – Modern Task Management Dashboard**, **Dashboard – M.O.N.K.Y**, **Dashboard design requirements** ;
  - Components : **System resource widget**, **Glass Sonner** ;
  - Layouts : **⭐ Tabbed Layout**, **Custom dashboard layout**.
- Erreurs exactes : l'aperçu de **Pulse** reste blanc (cadre `preview-…vusercontent.net/?…&expectEnvVars=true`, 0 caractère de texte après 15 s) ; le **code** de chaque gabarit est derrière « Open in v0 » qui demande une connexion (« Log In / Sign Up ») : non contourné, je n'ai lu que la description « About » et l'aperçu rendu. Aucun défi.

## Structure observée (ÉTABLI = vu dans l'aperçu ou lu dans « About »)
- **System resource widget** : une carte compacte « System Monitor ▾ » qui se replie ; quatre mesures (CPU 33,4 %, GPU, VRAM, Network) chacune avec un libellé, un chiffre aligné à droite et une petite courbe ; « About » : mise à jour chaque seconde, « A collapsible interface that allows users to expand and view detailed memory usage ». → Le **résumé replié qui s'ouvre en détail** ; chiffres à droite, libellé à gauche.
- **Glass Sonner** : toast sombre avec un trait vertical coloré à gauche et le **mot du type en gras** (« Success: Item deleted successfully… ») ; cinq types Success / Error / Warning / Info / Loading. → La couleur n'est jamais seule : un mot la double.
- **Tasko** : barre latérale, titre « Dashboard » + sous-titre, une action principale pleine et une secondaire contour, quatre tuiles chiffrées dont **une seule pleine** (la plus importante), compte « 124 » en pastille à côté de l'onglet Tasks. → Une seule tuile mise en avant ; un compteur à côté du nom de l'onglet.
- **M.O.N.K.Y** : sombre, typographie à chasse fixe pour libellés en capitales, « Last updated 12:05 », tuiles « 49 % / 642' / 0 » avec étiquette, liste de notifications avec « CLEAR ALL » et « SHOW ALL (4) », bandeau « 1 NEW MESSAGE ». → « Dernière mise à jour » écrite, notifications regroupées avec un compte.
- **Tabbed Layout** : onglets ouvrables comme un navigateur (« Home » + « ⊕ »). → Écarté (Ariane n'ouvre pas de vues multiples).
- Listes de catégories : beaucoup de « Financial Dashboard », « Futuristic Dashboard » (néon, grilles de graphiques).

## Ce que j'en retiens pour Ariane
1. Un tableau de bord utile a **une** tuile dominante, le reste est secondaire (Tasko). Pour Ariane : l'état et le reste à faire dominent ; posés / différés / à examiner en ligne secondaire.
2. Le repli « carte compacte ↔ détail » (System Monitor) est le bon geste pour un panneau étroit.
3. « Dernière mise à jour » et compteurs explicites (M.O.N.K.Y) : on dit d'où vient un chiffre et quand.
4. Toast = trait + mot (Glass Sonner).

## Ce que j'écarte et pourquoi
- Les tableaux de bord à plusieurs graphiques (courbes hebdomadaires, barres) : grille de vérification « petits écrans : listes plutôt que graphiques complexes ».
- L'esthétique « futuriste » néon et les dégradés : contraires à la demande de l'opérateur.

## PROBABLE / SUPPOSÉ
- PROBABLE : Pulse présente des métriques d'incidents (titre et vignette de la liste : graphes de latence, bouton rouge en haut à droite), aperçu non chargé.
- SUPPOSÉ : le code React / Framer Motion de ces gabarits (non accessible sans compte).
