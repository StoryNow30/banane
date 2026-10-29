# Cadrage de la qualité de pose : regard indépendant sur CH-012, recadrage de la v7 (CH-021, 29/10/2026)

Lecture seule (rapport de CH-012, D-258 à D-267, cahier § 2 à 5, `fiches/BRUIT_REFERENCE.md`, `fiches/H6_VOIE_DECALEE.md`). Aucun export relu : les chiffres sont ceux du rapport ; ce qui en est déduit est dit « calcul », SUPPOSÉ. Population : partie 20, 172 cuts jugés (75 « contrôlé, bon » à 0 mm, 21 déplacés de plus de 100 mm).

## 1. Critique du cadrage

**Solide.** Séparation réglage / examen écrite avant, graine consignée, examen ouvert une fois ; critères écrits avant ; fidélité du rejeu (646 sur 646) ; comparaisons appariées, même référence ; Bonferroni ; refus d'intégrer un résultat non significatif ; l'oracle de D-265 (0 cut décalé sur 21 dans ±80 mm) ; le décalage de voie lu comme un choix parmi des voisins. Le défaut n'est pas dans l'exécution : il est dans la quantité visée.

**Faux ou fragile.**
1. **« Sous 3 mm » est sous le plafond de la mesure.** L'écart mesuré additionne l'écart vrai et le bruit de la référence (1,0 mm latéral, 1,26 mm vertical par rail dans la séance stricte ; 1,5 et 2,3 mm toutes séances). Calcul (gaussien, indépendant par axe et par rail, pire rail ; SUPPOSÉ) : un poseur **parfait** serait mesuré sous 3 mm pour environ 94 % des cuts avec le bruit de la séance stricte, environ 50 % avec le bruit toutes séances ; sous 5 mm, environ 100 % et 93 %. Le taux à 3 mm mesure la séance de l'opérateur autant qu'Ariane. Le 5 mm tient comme taux de partie, le 10 mm tient partout.
2. **Le taux à 3 mm est un taux d'acceptation déguisé.** Lu dans les taux du rapport (ÉTABLI, arithmétique sur 172) : 92 cuts sous 3 mm dont 75 non touchés à 0 mm ; corrigés : 17 de moins de 3 mm, 17 de 3 à 5, 31 de 5 à 10, 11 de 10 à 100, 21 de plus de 100. Les 17 corrections de moins de 3 mm sont de l'ordre du bruit de l'opérateur (il retouche dès 1 mm). Un gain à 3 mm ne peut venir que de cuts qu'il ne touche plus.
3. **Le budget D-223 n'est pas regardé.** Pose validée à plus de 50 mm : 3 % au plus. Ici 21 sur 172 jugés, 12 % [8 ; 18] (Wilson, calcul). Le bon dénominateur est le nombre de cuts posés par le lot sur la partie, absent du rapport ; même avec 400 posés on serait à 5 %. PROBABLE : la v6 dépasse le budget sur cette partie, par des mauvaises voies (vérité à 74 à 281 mm, D-265). On a cherché des millimètres pendant que le lot posait un cut jugé sur huit sur la mauvaise voie.
4. **Réglage et examen ne sont pas de même nature.** Partie 17 : poses à la main depuis ESV, lot presque absent (28 jugés) ; partie 20 : un lot a tourné. Apprendre H7 sur l'une et la rejouer sur l'autre change de population : la non-réplication était attendue. PROBABLE.
5. **« Réfuté » dépasse la puissance.** L'arrondi du clic déplace la pose d'un pixel au plus (0,5 mm) devant une référence bruitée de 1 à 2 mm : effet attendu nul ; 112 rails donnent ±4 points : le critère « borne basse ≥ −3 » ne pouvait pas être tenu, même par un effet nul. Mécanisme (SUPPOSÉ) : la référence passe par la même grille de pixels ; le biais de −0,25 mm est un biais contre la cible visée par Ariane, pas contre la référence. La ligne « À faire 1 » du rapport (intégrer l'arrondi comme correction d'un biais connu) est à retirer.
6. **L'oracle est sous la v6.** Meilleure hypothèse H0 à H6 sous 3 mm : environ 50 % des rails (D-266) ; v6 réelle : 53,5 % des cuts, donc plus de rails. Populations voisines (211 et 172 cuts), pas identiques ; si cela tient sur les mêmes cuts, l'étage fin de la v6 vient du moteur, pas du jeu d'hypothèses : y chercher un gain fin ne pouvait rien trouver. Une ligne sur `par-cut.json` tranche. PROBABLE.
7. **Le pire rail en 3D mélange des axes de qualité inégale** (référence verticale 1,0 à 4,1 mm selon la séance) : un recul vertical masque un gain latéral. Donner les taux par axe, latéral en tête. Mineur : identité de la partie 17 non tranchée (D-263) ; H8 et H9 jugées sur la partie 20 après ouverture sont du réglage.

**Ce que la mesure ne peut pas dire** : la distance au vrai rail (biais de l'opérateur, invisible) ; si une correction de moins de 3 mm en est une ; le coût en temps d'une correction selon sa taille (dans les durées de visite de l'Écho, jamais exploité) ; rien sur les posés non visités par l'Écho (60 sur 86 dans la base v6) ; rien sur les différés.

**Autre définition de la qualité.** Celle que l'opérateur applique : il regarde et ne touche pas (**acceptation**), retouche d'un geste (**fine**, 10 mm au plus), déplace (**moyenne**, 10 à 50 mm), change de voie (**faute**, plus de 50 mm). Le cahier § 4 a déjà la deuxième (« sans retouche »). Partie 20 : acceptation 44 %, sans retouche 81 %, faute 12 %. Chaque taux pèse sur son temps ; aucun ne dépend d'un seuil placé dans le bruit de la référence.

## 2. Où est l'amélioration (partie 20, 172 jugés)

| Gisement | Taille | Levier | Qualification |
|---|---|---|---|
| Fautes de voie (plus de 100 mm) | 21, 12 % | Aucun candidat dans ±80 mm : **s'abstenir** (différer) ou générer hors fenêtre | ÉTABLI ; abstention SUPPOSÉE détectable |
| Moyennes (10 à 100 mm) | 11, 6 % | Étage différé ; voisins du lot faux là (écart médian 87 à 154 mm) | ÉTABLI |
| Retouches 5 à 10 mm | 31, 18 % | Seul gisement du « sous 5 mm » ; axe dominant non donné | ÉTABLI ; levier SUPPOSÉ |
| Retouches sous 5 mm | 34, 20 % | Zone grise de la référence : pas un gisement | PROBABLE |
| Acceptés tels quels | 75, 44 % | À ne pas perdre (garde, cahier § 2) | ÉTABLI |

Le mode voie décalée / étage différé (32 cuts, 19 %) porte le risque et le temps ; les 31 cuts de 5 à 10 mm portent le seul gain du critère de D-258. La cohérence entre voisins ne sert qu'en relecture (voisin humain à moins de 5 mm pour 53 % des rails, à moins de 10 mm pour 70 %, ÉTABLI) ; au lot, les voisins sont faux où il faudrait qu'ils soient justes. La hauteur reste inconnue : référence verticale la moins bonne, axes non séparés sur les 48 retouches fines.

## 3. Recadrage : quatre étapes

Donnée commune : des **cuts posés par le lot et visités par l'Écho** sur une partie fermée (partie 0 de la test 24, puis chaque partie neuve, rotation D-192). C'est le goulet (539 posés sur 558 sans Écho sur la partie 0 du 26/10) : sans séance Écho sur les posés, rien ne se juge.

| Étape | Fait | Critère de sortie (écrit avant) | Donnée, puissance | Risque | Abandonne |
|---|---|---|---|---|---|
| **1. La mesure** (aucun module de décision) | `tools/juger-lot.cjs` donne les quatre taux du § 1, par axe, et le budget D-223 sur les posés | Le tableau sort sur les huit lots du 26/10 et la partie 20 ; les comptes de ce document y sont retrouvés | Aucune | Aucun | « Sous 3 mm » comme cible ; « sous 5 mm » autrement qu'en différence appariée |
| **2. Les fautes** (autonomie, sûreté) | Dans le journal du lot, ce qui distingue les 21 (second candidat fort à plus de 50 mm, « voie concurrente » de H6) ; une garde qui **diffère** au lieu de poser | Sur l'examen : fautes ≤ 3 % des posés, borne haute comprise (125 posés jugés sans faute, cahier § 5) ; différés en plus ≤ X points (X à l'opérateur) ; 0 accepté perdu | Les 21 (réglage) ; partie 0 de la test 24 (examen) | Hausse des différés contre « sous 5 % » ; garde qui éteint l'étage différé | Corriger ces cuts en v7 (génération hors ±80 mm) : v8 |
| **3. L'étage fin** (autonomie) | Diagnostic par axe des 48 retouches de 3 à 10 mm, puis un levier du moteur (plan de roulement si vertical, profil si latéral), pas du jeu d'hypothèses | Gain apparié, mêmes cuts, même référence : +10 points à 5 mm, intervalle excluant 0 (environ 120 cuts appariés, SUPPOSÉ 15 % de discordants ; +5 points demanderait 300 à 500 cuts, calcul SUPPOSÉ) ; 0 cut dégradé de plus de 2 mm | 2 à 3 parties avec Écho sur les posés | Zone grise ; référence verticale variable | Tout gain revendiqué sous 3 mm |
| **4. L'assistance** (relecture, pas d'autonomie) | Proposer le décalage du voisin humain le plus proche (H6 humain, qui bat H9) sur les cuts déplacés de plus de 20 mm | Temps par cut relu en baisse sur la même partie (durées de visite) ; propositions à moins de 10 mm de la pose finale ≥ 70 % | Une relecture avec, une sans | **Ancrage** : la proposition devient la référence et contamine la mesure des étapes 2 et 3 ; garder des séances Écho sans assistance | Mesurer l'assistance en millimètres |

Ordre : 1 tout de suite ; 2 avant 3 (une faute coûte plus que dix retouches, D-223) ; 4 seulement si l'opérateur accepte la contrainte de l'ancrage.

## 4. Questions à l'opérateur (une par décision)

1. **Cible.** Remplacer « sous 5 mm » par deux chiffres : fautes à plus de 50 mm ≤ 3 % des cuts posés (D-223, avec l'effectif) et gain d'acceptation apparié entre versions ; « sous 5 mm » reste un indicateur de différence ; « sous 3 mm » est abandonné tant qu'aucune mesure à l'aveugle (ESV local, D-260) n'existe. Acceptez-vous ?
2. **Définition.** Un cut que vous regardez et ne touchez pas est-il une pose de qualité, quelle que soit sa distance à ce que vous auriez cliqué ?
3. **Compromis.** Pour retirer les poses sur la mauvaise voie, acceptez-vous plus de différés, et jusqu'à combien de points ?
4. **Effort.** Une séance Écho sur les cuts posés par le lot à chaque partie neuve (de l'ordre de 150 jugés par partie, deux ou trois parties par comparaison) : acceptez-vous cet effort ?
5. **Assistance.** Voulez-vous une proposition de voie en relecture, sachant qu'elle ancre vos poses et dégrade la référence qui mesure Ariane ?
