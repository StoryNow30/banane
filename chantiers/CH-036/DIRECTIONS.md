# CH-036 b : deux directions esthétiques (Constellation et Aurore)

**Demande** (opérateur, test 30, relayée par l'intégrateur le 01/11) : « je trouve pas ouf l'esthétique globale de l'UI/UX affichée, visuellement pas fou ». Il faut repenser l'esthétique de tous les états, proposer deux directions nettement différentes, puis attendre son choix avant de coder.

**Défauts relevés sur sa capture** (« Aurore terminée », environ 520 × 750) :
- texte gris trop petit et trop faible ;
- libellé de barre tronqué ;
- hiérarchie plate ;
- grand vide au milieu, tassement en bas ;
- étoiles décoratives, sans sens ;
- mêmes chiffres répétés trois fois.

**Figma** : fichier Signal (clé `ZrK16dO2MGOQp9lufe7lwF`), page « CH-036 b · Deux directions » (nœud `148:2`). Planche « Lire d'abord » : nœud `152:5500`.
- 11 états :
  - Constellation : prête, en cours, arrêtée, terminée ;
  - Aurore : vide, liste proposée, cut ouvert, cut corrigé, autre partie (traversée de CH-035), passage, terminée.
- Deux directions × (520 × 750, 360 × 640) × (sombre, clair) = 88 fenêtres.
- Aucune image ; polices et graisses déjà livrées seulement (IBM Plex Sans 400, 500, 600 ; Mono 400, 500).

## Commun aux deux directions
- **Titre :** il dit l'essentiel, en grand.
- **Texte :** aucun texte sous 12 px. Le gris est toujours l'encre secondaire (contraste d'au moins 4,5:1). Rien n'est tronqué.
- **Chiffres et étoiles :** chaque chiffre apparaît une seule fois ; l'étoile porte toujours un état.
- **Décisions du 01/11 respectées :** départs et motifs visibles d'emblée ; onglets libellés en 360.
- **Barre :** sous 560 px, la puce de l'onglet ESV ne garde que sa pastille. Avec quatre onglets, la barre demande 567 px pour une fenêtre de 520.

## A · Ciel
- **Allure :** douce et immersive. Des cartes arrondies sur le fond.
- **Constellation :** un vrai ciel, les parties en étoiles sur un arc reliées par le fil ; la partie en cours rayonne.
- **Aurore :** une aube. Un soleil se lève au-dessus de l'horizon à mesure que les cuts sont revus ; c'est la seule couleur chaude de l'écran.
- **Action :** dans un pied fixe, toujours à la même place.

## B · Cadran
- **Allure :** précise et éditoriale. Pas de cartes : des filets fins, de grands chiffres tabulaires alignés en colonnes.
- **Objet :** une orbite, un anneau segmenté en un arc par partie, à la mesure de ses cuts ; une pointe chaude au bout de l'arc, l'aube qui avance.
- **Actions :** dans l'en-tête, à côté de l'anneau.
- **Bilan et départs :** un registre.

## Hors périmètre
Les deux défauts fonctionnels de l'Aurore (ouverture vers une autre partie ; dernier cut validé) vont à CH-037.
