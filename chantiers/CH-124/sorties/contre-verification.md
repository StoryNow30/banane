# CH-124 : contre-vérification de l'ancre (fuite par la liste, artefact, provenance)

## D'où viennent ces chiffres
- **Mise en œuvre indépendante** : un agent a réécrit le calcul en Python sans lire mes outils (`outils/contre-verif/*.py` : cheminement, modèle cinématique, calage local). Il a été coupé deux fois par la limite d'usage avant d'écrire son rapport : **son verdict écrit n'existe pas**. J'ai fait tourner son script d'analyse (`variantes.py`) sur ses propres sorties ; la sortie brute est `contre-verification-brut.txt`. Ses réglages ne sont pas les miens (grille propre, paramètres communs à toutes les parties).
- **Mes contrôles** : `outils/ancre.cjs juger [--fin]`, et l'heure des instantanés lue dans les journaux.
- **Examens vierges** (mesure de CH-116 avec mes outils 233fd8e, résumé donné par l'intégrateur, détail non lu) : 191 cuts jugés, pose finale à 2,8 mm de l'axe en médiane, 15,5 mm au plus ; les mauvaises voies à plus de 120 mm ; désignation 2 sur 2.

## F1. Provenance de la liste (ÉTABLI)
L'export ne garde que le dernier instantané de chaque partie. Sur les 24 lots-parties du corpus :
- 10 ont un instantané pris AVANT leur premier cut (0 à 0,1 min avant ; 7,4 min pour le second lot de 0511 p9) : 0411 p13 ; 0511 p8, p9 (deux rangs), p11, p12 ; 0811a p3, p4 ; 1211 p0, p1. Toutes les lignes des cuts posés y sont la pose de départ.
- 14 ont un instantané pris APRÈS leur dernier cut (0,1 à 8,9 min après) : lignes des cuts posés réécrites. Tous les lots qui portent les 30 mauvaises voies sont dans ce cas.

## F2. Lignes déjà touchées (ÉTABLI : aucune fuite mesurable)
- Mes outils, modèle ajusté et calé sur les SEULES lignes jamais touchées de la liste exportée (statut 0, drapeaux 0), aucune ligne remise à son état de départ (`--fin`) : 30 désignations sur 30, pose finale à 36,4 mm de l'axe au plus ; mêmes chiffres à 0,3 mm près qu'avec la liste de départ reconstituée.
- Mise en œuvre indépendante, liste exportée telle quelle (a = 5, w = 10) : 790 cuts jugés, médiane 4,0, q99 29,9, max 39,9 mm, aucun au-delà de 40 mm ; 30 mauvaises voies sur 30 désignées, pose d'Ariane à 120 mm au moins ; 0 pose juste ou « 10-50 » au-delà de 40 mm sur 515 ; cuts écartés par D-285 (437) : 32 mm au plus. Écart par cut jugé entre liste exportée et liste de départ : médiane 0,26, q99 2,2, max 3,1 mm.

## F3. Parties lotées deux fois (ÉTABLI)
Rangs traités à part (mise en œuvre indépendante) : écart par cut de 0,9 mm au plus avec la variante de départ. Dans mes outils, les lignes posées par l'autre rang portent un drapeau : elles n'entrent pas dans la voie courante.

## F4. Orientation du plan d'une ligne réécrite (ÉTABLI)
Une pose reste dans le plan de sa coupe (composante longitudinale de ± 0,1 à 0,2 mm). L'effet sur l'axe est borné par l'écart entre liste exportée et liste de départ : 0,3 mm sur les 30 mauvaises voies (mes outils), 3,1 mm au plus sur tous les cuts jugés (mise en œuvre indépendante).

## F5. Témoins (ÉTABLI, mise en œuvre indépendante)
- **Sans cinématique** (axe = trajectoire + constante locale) : 242 cuts jugés au-delà de 40 mm (max 248), pose finale plus près que la pose fausse dans 13 cas sur 30 seulement. La trajectoire seule n'est pas l'axe : le modèle du véhicule est nécessaire.
- **Sens inversé** : 144 cuts jugés au-delà de 40 mm (max 270). Le résultat n'est pas un artefact du calage local.
- Fenêtre du calage (± 50, 100, 400 cuts) et suppression de l'épinglage aux poses par défaut : mêmes désignations, écart de 4,9 mm au plus.
- Paramètres communs loin de la vallée (a = 8, w = 2) : 14 cuts jugés au-delà de 40 mm (max 50), 30 poses fausses encore à plus de 120 mm.

## Artefact relevé par l'agent
1211 p23, cuts 5494 et 5499 : la « pose finale » du corpus est la pose par défaut d'ESV (1 500,0 mm), vue sans action. Ce n'est pas une pose de rail. Ces deux cuts sont à moins de 20 m du bout de la partie : l'ancre s'y tait.

## Règle de production qui en découle
La liste est lue AVANT le premier cut de la partie (instantané pris au chargement de la liste), une fois par lot ; le modèle est calculé une fois. Une ligne n'entre dans la voie courante que si elle est valide et sans drapeau. La pose de départ de chaque cut doit se caler sur sa ligne (sinon l'ancre se tait pour ce cut).
