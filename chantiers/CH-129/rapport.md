# CH-129 : rapport (agent) — retour de l'opérateur sur la Vision 18 (D-361, D-362)

Branche `chantier/CH-129`, partie du tronc 15a3ac9. Page montrée à l'opérateur : `chantiers/CH-129/panneau-vision19.html` (vrai panneau à l'échelle 1, largeur de 320 à 720 px, 18 scènes, 3 palettes), version 3 vue sans objection (« go » du 16/11).

## Ce qui change (ÉTABLI : vrai panneau dans Chromium, API simulée)
- **Disposition** : une seule mise en page de 320 à 720 px. Au-delà de 480 px, la trace des cuts reste une ligne pleine largeur (38 px de haut, au lieu d'une boîte d'une demi-largeur de 150 px) et les boutons du pied vont par paires. Pendant une Constellation, la ligne « Constellation · partie k sur n » porte la trace (une tuile au lieu de deux) ; en fin de lot, le bilan « Lot terminé » est replié avec les détails.
- **Phrases courtes** : la tuile dit l'état en deux ou trois mots (« Relecture en cours », « Rattrapage en cours », « 93 cuts traités », « Prêt à lancer », « Vers la partie 15 », « 7 cuts à revoir »…) ; la phrase complète et ses chiffres restent dans les détails (`sg-phrase-longue`). Les consignes (« ne touche à rien » pendant le rattrapage et les passages, « corrige-le, puis valide dans ESV ») restent visibles d'emblée, en ligne sobre.
- **Avis** : un refus d'action (par exemple « Relecture après le lot en cours… ») n'est plus une carte rouge mais une ligne à trait ambre, en entier ; le rouge reste aux pannes.
- **Police** : quatre tailles de texte au lieu de treize à quinze (11 px, 13 px, phrase de 16 à 19 px, grands chiffres), rien sous 11 px, chiffres tabulaires (`chantiers/CH-129/outils/polices.cjs`).
- **Réglages** : clic du mode rapide, passage de l'Aurore, série de cuts et rattrapage ne sont plus à l'écran ; les cases d'origine et le service worker gardent exactement leurs valeurs (essai). Le compteur d'apprentissage et « Parties traitées » restent.
- **Palette « Signal »** (couleurs de la Vision 15) à côté de Glacier (par défaut) et Sarcelle, sans recharger ; les détails techniques suivent la palette et le thème.
- **Constellation (D-362)** : l'écran garde la tuile d'état, ses boutons, l'alerte et le choix du nombre de parties ; le bilan par partie et les départs ont leur écran, ouvert par un bouton à icône dans l'en-tête (hors des onglets), refermé par le même bouton, « Retour à la Constellation » ou Échap. La tuile prend la hauteur de son contenu.
- Aucun message nouveau vers le service worker, aucun ordre retiré, rien de retiré du journal ni des exports.

## Fichiers pour l'intégration
- `panel-signal.css` (section CH-129 en fin de feuille), `src/signal-rendu.js`, `src/ui5.js`. Aucun fichier protégé, aucun fichier nouveau au paquet.
- Essais : `tests/ch129-panneau-navigateur.test.cjs` (nouveau, 6 tests, rouges sur le tronc) ; mis à jour, raison écrite dans chaque fichier : `tests/signal-rendu.test.cjs`, `tests/signal-vocabulaire-orbite.test.cjs`, `tests/ch115-palette-epure-navigateur.test.cjs`, `tests/ui5-constellation-aurore.test.cjs`, `tests/ui5-navigateur-signal-constellation-aurore.test.cjs`, `tests/ui5-navigateur-signal-onglet-file.test.cjs`.
- Outils (hors paquet) : `chantiers/CH-129/outils/` (audit, polices, modèle de page), `chantiers/CH-115/outils/page.cjs` (scènes de CH-129).

## Preuves (ÉTABLI)
- Essais du panneau (80 fichiers) : 302 réussis, 0 échec, 1 sauté.
- Audit `chantiers/CH-129/outils/audit.cjs` : 13 scènes × 7 largeurs (320 à 720 px) × 3 palettes = 273 vues, 0 débordement, 0 troncature, 0 contraste sous 4,5:1 (la bande du sélecteur de parties reste exclue, CH-108). Défaut trouvé et corrigé : à 320 px, la pastille ESV rognée à côté du bouton des statistiques.
- Maquette ESV (`tests/esv-maquette/essais.cjs`, sur 5403eb6) : 89 essais, 86 réussis, 0 échec, 3 sautés ; suite complémentaire 15 sur 15. Code 0.

## Non vérifié
Le vrai panneau dans Chrome à côté d'ESV ; le verify complet (intégrateur, sur le tronc).
