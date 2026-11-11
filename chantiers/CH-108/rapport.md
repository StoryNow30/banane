# CH-108 : rapport (agent)

**État : PRÊT** sur `chantier/CH-108`. Page de comparaison privée : https://claude.ai/artifact/NjhqrKmwnqTAsaBSJcmZnF (référence « tronc + direction-d.css » à côté du panneau construit, 35 écrans, 360 et 600, sombre et clair).

## Ce qui est fait
- `panel-signal.css` : la référence `maquettes/caractere/direction-d.css` fondue dans la feuille (jetons en tête, règles remplacées réécrites à leur place, aucun bloc de surcharge). Police `fonts/Inter-latin-opsz-wght.woff2` ; `fonts/Inter-latin-wght.woff2` retiré.
- Prolongé là où la référence ne dit rien : couches (menu, palette, boîte, note), réglages, feuille « Ce qui reste », détails techniques, registre et molette de la Constellation.
- `panel.css` (panneau d'origine) sur le même système : jetons, cartes changées en sections, pilules, vues en mots soulignés, petites capitales.
- Aucun changement dans `src/` ni dans le balisage : apparence seulement.

## Écarts voulus à la référence
- Couches flottantes sur un fond plein `--flottant` : la référence les rendait transparentes (texte de la page au travers).
- Compact : barre à 46 px (`--barre-h`), 8 px sous la ligne « à poser » (sinon la zone défilait de 2 à 7 px). Sections du fil, des étapes et de la fin alignées à 2 px du bord ; temps de la Constellation sans rembourrage latéral.
- Onde d'Écho bornée à son cercle de repos (échelle 0,8 → 1 au lieu de 0,86 → 1,18) et 4 px d'air au-dessus de l'anneau d'Écho : sinon elle touchait le mot d'état.
- Rond vide de la chaîne opaque ; « arrêter » cerclé du trait fort ; en-tête du registre en petites capitales ; note de section `sg-d` en minuscules.

## Preuves (mesurées)
- Relevé des styles calculés référence contre construit (`chantiers/CH-108/outils/ecarts-styles.cjs`, 140 photos) : les écarts restants sont ceux ci-dessus, la police (même fichier, nom de famille « Inter ») et des arrondis.
- `capturer.cjs` (140 photos) : 2 défauts, la relecture en pause en 360 qui défile de 45 px (58 px sur le tronc). Aucun contraste sous 4,5:1.
- `controle.cjs` : points 2, 3, 4, 6, 7, 8 BONS. Point 1 : trois numéros de la molette hors de sa fenêtre comptés « recouverts », résultat identique sur le tronc. Point 5 : seule la relecture en pause défile (320 : 63 px, 360 : 45 px), déjà vrai sur le tronc.
- `etats-hors.cjs` à 320 × 480 : 30 états regardés ; avis d'Écho muet et étapes de la relecture en pause à faire défiler, identiques sur le tronc.
- Orbite et mot d'état : 68 têtes de 320 à 600, 6,3 px au moins.
- Essais : 187 sur 187 (`ch104-*`, `ch105-*`, `ch106-*`, `ui5-*`, `signal-*`, `t16-panneau`, `panel-*`). Aucun essai n'épinglait une valeur changée ; aucun n'a été modifié.

## Outils
- `chantiers/CH-104/outils/capturer.cjs` : `FEUILLE_EN_PLUS=feuille.css` (photographier « tronc + feuille ») ; `STYLES=1` (relevé des styles calculés) ; la bande de la molette n'est plus comptée comme débordement. `controle.cjs` point 6 suit le nouveau nom de police.
- `chantiers/CH-108/outils/ecarts-styles.cjs`, `page-comparaison.py`.

## Non vérifié
- Le vrai panneau dans Chrome à côté d'ESV (seulement Chromium avec API simulée) ; le `verify` complet et la maquette ESV (intégrateur).
- Le rond de « 0 cut » montre un point en haut (bout arrondi d'un arc nul), comme la référence.
