# CH-033 : protocole écrit avant toute mesure de signal (31/10/2026)

Écrit et poussé AVANT le calcul d'un seul descripteur ci-dessous. Ce qui est déjà connu à cette heure (sans signal) : les comptes de `tools/juger-lot.cjs` sur le corpus (§ 1) et le rapport CH-015 (où sont les 21 fautes de la partie 20, par tronçon de cuts). Aucune valeur de H10 à H13 n'a été calculée.

## 1. Corpus (comptes de `juger-lot`, ÉTABLI)
Couples lot + Écho de l'opérateur, du 26/10 au 29/10 : parties 15, 16, 17, 18, 19, 20 (4.9.5.21), 0 (4.9.5.22, Écho .23), 1 (4.9.5.23), 20 (4.9.5.23, lot du 28/10, Écho du 29/10), 17 (4.9.5.23, lot de CH-012). Les lots du 29/10 au 31/10 (4.9.5.24 à .28) n'ont aucun Écho : ils servent seulement à mesurer un coût (cuts signalés sur les posés), jamais un rappel.

## 2. Unité, étiquette
- Unité : un cut **posé** par le lot (définition de `juger-lot`). Étiquette « faute » : posé jugé à plus de 50 mm (pire rail, 3D) ; « bon » : jugé à 50 mm au plus. Non jugés : comptés seulement dans le coût.

## 3. Séparation réglage / examen (déterministe, par tronçon, pour garder chaque épisode de fautes d'un seul côté)
- **Réglage** : partie 20 (lot du 28/10), cuts de numéro **inférieur à 8 000**.
- **Examen** : partie 20 (lot du 28/10), cuts de numéro **8 000 et plus** ; et tous les posés jugés des autres couples (§ 1).
- L'examen est ouvert **une fois**, après le commit des seuils figés (`chantiers/CH-033/SEUILS.md`, empreinte du script). Graine des intervalles par rééchantillonnage : **20261031**. Intervalles des proportions : Wilson 95 %.
- Réserve écrite avant : toutes les fautes connues sont de la même partie (sauf une) ; l'examen « autres parties » ne teste que les fausses alarmes.

## 4. Ce que le lot sait au moment de poser (aucune fuite)
- Les cuts **sains** : lignes de la liste d'ESV qui ne sont pas des cibles du lot, de statut `valid`, et qu'aucune écriture du journal n'a touchées (la relecture en est exclue). Ils existaient avant le lot.
- La pose de départ d'ESV du cut et la pose d'Ariane (déplacement du lot, repère profil, journal).
- Interdit : toute pose de l'opérateur, tout cut posé par le lot comme appui de la géométrie.

## 5. Hypothèses nouvelles (aucune n'est H0 à H9, ni R1 à R3)
Géométrie commune : pour le cut i, les cuts sains j avec |j − i| ≤ 200, au moins 5 de chaque côté, les 15 plus proches de chaque côté ; centre de voie = milieu des deux bords ; repère local (origine au barycentre, axe x le long de la direction principale) ; ajustement par moindres carrés y = a + b·x + c·x², z = a' + b'·x + c'·x² ; évalué à l'abscisse du centre posé. Moins de 5 sains d'un côté : **non évaluable** (compté à part).
- **H10 (pose hors du tracé sain)** : |écart latéral entre le centre posé et le tracé interpolé| > T10.
- **H11 (départ hors de la fenêtre de recherche)** : |écart latéral entre le centre de DÉPART d'ESV et le tracé interpolé| > T11. Mécanisme : la recherche du moteur est bornée à ±80 mm du départ (D-265) ; si la voie saine passe plus loin, le moteur ne peut pas l'atteindre. Variante a priori **T11 = 80 mm** (non réglée) et variante réglée.
- **H12 (hauteur hors du tracé sain)** : |écart vertical entre le centre posé et le tracé interpolé| > T12.
- **H13 (écartement hors de la partie)** : |écartement posé − médiane des écartements des 30 sains les plus proches| > T13.
- Le signe qui relie l'axe latéral du profil (journal) à la normale horizontale du tracé (liste d'ESV) est fixé sur le réglage seul.

## 6. Réglage des seuils (sur le réglage seul)
Grille : 20, 30, 40, 50, 60, 80, 100, 150 mm (H13 : 5, 10, 15, 20, 30 mm). Règle : le **plus grand** seuil qui garde un rappel d'au moins 10 des 13 fautes du réglage (77 %) ; s'il n'existe pas, l'hypothèse est réfutée au réglage et n'est pas portée à l'examen. Une combinaison (H10 ou H11) est permise si elle est déclarée dans `SEUILS.md` avant l'examen.

## 7. Critère de l'examen (écrit avant)
Une hypothèse **tient** si, sur l'examen : rappel des fautes ≥ 5 sur 9 (les 8 de la partie 20 au-delà du cut 8 000 et celle de la partie 17) ; précision sur les jugés ≥ 30 % ; posés signalés ≤ 5 % des posés évaluables de l'examen (tous lots, jugés ou non) ; et le taux d'évaluabilité est donné. Sinon : PROBABLE (rappel tenu, coût dépassé) ou réfutée. Le gain attendu sur le budget D-223 est calculé seulement si elle tient.
