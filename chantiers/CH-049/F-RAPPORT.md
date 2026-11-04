# CH-049-F — Rejeu du moteur contre la pose humaine (parties 10, 13, 14, 15)

Mesure hors ligne, lecture seule (`chantiers/CH-049/rejeu-ecart-humain.cjs`, agrégats : `F-agregats.json`). Le moteur est le vrai `Shadow.scientificProposeBoth` (GCV1) ; aucun module de décision touché, aucun réglage ni règle proposé. Écart = moteur − pose humaine finale, repère profil de la pose de départ, pire des deux rails, en 3D.

## Périmètre et fidélité
- 134 cuts ont une pose humaine (64 différés, 36 hors journal, 7 posés, le reste hors classe). **90 rejouables** (28 sur le nuage du lot, 62 sur un nuage de l'Écho fusionné) ; **44 sans nuage exploitable** : 17 différés (partie 10 : 7, partie 13 : 10) et 27 hors journal. ÉTABLI.
- Fidélité du rejeu : 7 rails posés par Ariane et rejoués, écart médian 0,4 mm, max 9,3 mm (1 rail au-dessus de 2 mm) ; écartement du moteur identique à celui du journal sur les 8 cuts « hors contrat » ; pose humaine de l'Écho identique à la table sur 62 cuts. ÉTABLI.
- Biais : ces cuts sont ceux que l'opérateur a corrigés/validés, donc plutôt les difficiles ; les effectifs sont petits. Aucun chiffre ci-dessous ne se généralise sans nouvelle mesure. Zones (PN, ADV…) : NON MESURÉ (jeu d'apprentissage absent des données).

## (1) Où le moteur s'écarte
- Une paire est publiée par le moteur pour 23 cuts sur 90 (différés : 5 sur 47 ; hors journal : 14 sur 36 ; posés : 4 sur 7). Sur les 75 rails publiés, 60 sont à 5 mm ou moins de l'humain, 3 à plus de 50 mm (1 gauche, 2 droits). ÉTABLI.
- Motifs du moteur sur les 94 rails des différés rejoués : candidat 26, manque de points (minTop 23 + flanc 16 = 39), écartement hors contrat 18, ambiguïté 6, fenêtre 1, sans résultat 4. Le manque de points domine, et il est concentré : médiane de 512 points (partie 10) et 943 (partie 13) contre 6 153 (partie 14) et 6 482 (partie 15). Pour 26 des 28 différés de la partie 13 et les 18 de la partie 10, le lot n'avait aucun point (« Aucun point LiDAR disponible »). ÉTABLI (cause de la rareté des points non mesurée ici).
- L'erreur est latérale (longitudinal ≈ 0 ; vertical médian 1 à 3 mm). Candidat brut (même rejeté), 39 cuts à deux rails : médiane 5,5 mm, 19 à ≤ 5 mm, 17 à > 50 mm. Par rail : gauche médiane 3,4 mm, droit 2,9 mm ; p90 67 mm des deux côtés. ÉTABLI.

## (2) Écartement hors contrat (8 cuts, parties 14 et 15)
- Le rail DROIT dévie dans 7 cuts sur 8 : latéral −63 à −71 mm dans 6 (proche de la largeur de gabarit du moteur, 64 mm : PROBABLE), +121 mm dans 1. Le rail gauche reste à 2-23 mm dans ces 7 cuts. Dans le 8e (écartement 1682 mm) c'est le gauche qui dévie (251 mm) et le droit est à 2,7 mm. Écartement humain : 1431-1454 mm (8/8 dans le contrat). ÉTABLI.
- La seconde solution du moteur (A*) ne corrige pas : sur les 8 rails déviants, 1 est à 10 mm ou moins de l'humain ; sur les 24 rails à plus de 20 mm dans l'échantillon, 7 (3 à ≤ 5 mm). ÉTABLI.
- Écartement humain hors 1420-1470 mm sur 3 cuts de l'échantillon rejoué (1 des 17 cuts à > 50 mm) : référence à examiner. ÉTABLI.

## (3) Cascade « validable après un différé, 0 appui »
8 cuts à garde « après un différé » ont une pose humaine (tous sur nuage du lot). Les 4 différés : paire du moteur publiée, écarts 1 à 4,8 mm, tous ≤ 5 mm. Les 4 posés ensuite : paire publiée pour 2 (écarts 5,5 / 0,4 mm, et 10,5 / 60,1 mm avec écartement humain 1512 mm hors contrat), non publiée pour 2. Au total 6 paires publiées : 5 à 5,5 mm ou moins, 1 à 60 mm. ÉTABLI sur 8 cuts ; ne se généralise pas (SUPPOSÉ).

## (4) Cuts supplémentaires posables sans dépasser le budget D-223
Sur les cuts que le lot n'a pas posés (différés + hors journal), la paire publiée par le moteur seul existe pour 19 cuts : 18 à ≤ 5 mm, 1 entre 10 et 20 mm, **0 au-delà de 50 mm**. Dont 5 différés (5 sur 64 avec pose humaine, soit 8 %, tous ≤ 5 mm). Borne haute à 95 % (Wilson) de la part > 50 mm : 16,8 % — le budget de 3 % ne peut pas être prouvé à cet effectif (zéro échec ne l'établirait qu'à partir d'une centaine de cuts). Avec écartement ignoré (paire brute), 10 différés sur 15 sont à > 50 mm : ce n'est pas un gain. Valeur : ≤ 5 cuts sur 64 différés avec référence. ÉTABLI (effectif), budget : NON DÉMONTRÉ.

## Non mesuré
Zones ; part des poses du lot déjà à > 50 mm sur ces parties (aucun jugement Écho du lot de ces parties) ; moteur sur les 44 cuts sans nuage ; ce que donnerait un chargement de points plus complet.
