# Lecteur « passage à niveau », voie encadrée, reprise des différés — mesure (25/09)

**Origine** : KI-058. Au premier lot 4.7.18 (partie 2), 2 faux au passage à
niveau et des différés en série ; au lot « long » (partie 3), le passage à
niveau 5377–5384 entièrement différé. Demande de l'opérateur : un lecteur
« passage à niveau » (point 1) et la reprise encadrée des différés (point 2),
à mettre en test sur le terrain (4.7.19). Bilans des lots :
`audit/lot-4718-p2-2026-09-25.md`, `audit/lot-4718-p3-2026-09-25.md`.

## Le lecteur (`src/level-crossing.js`)

- **Repérage** : part des points à côté des rails (9 à 45 cm, ±60 cm le long de
  la voie) au niveau du champignon. Voie courante 0–10 %, passage à niveau
  90–100 %. Seuil : 50 %.
- **Lecture** : profil en travers par pas de 2 mm. Niveau des surfaces hautes
  (75e centile des pas) ; rainures de 30 à 100 mm de large sous ce niveau
  moins 25 mm, trois pas vides ou à mi-profondeur tolérés ; la plus proche de la
  pose d'ESV ; bord repris depuis le dessus du champignon. Position : bord
  moins 3 mm, dessus du champignon plus 4 mm.
- **Calage** (Natif p24 et p30, relecture Natif p2 7801–7806, relectures des
  lots 4.7.18 p2 et p3) : 80 cuts lisibles sur les deux rails et jugés, écart
  latéral médian 3 mm (p90 7 mm), vertical 0,8 mm (p90 2,4 mm). Un cut au-delà
  de 10 mm (p3, 1456 : 80 mm sur un rail, écartement hors contrat, donc écarté
  par la décision). Calé et mesuré sur les mêmes cuts.
- Trois défauts corrigés en route, tous vus sur le terrain : niveau tiré vers le
  bas par une chaussée extérieure plus basse (partie 2, 772 droit : rainure
  invisible), un point isolé au fond qui coupait la rainure, des creux de 19 à
  20 cm pris pour des ornières (p24, 1828 et 1830).

## Deux façons de s'en servir — une seule tient

Banc relu : sessions Natif p24, p30 et p2 (7801–7806), lots Pilote des parties
31 (deux), 34, 2 (4.7.18) et 3 (4.7.18) avec leurs relectures ; règles de la
4.7.18, lecteur coupé puis actif. Décomptes sans double compte (les cuts
768–778 de la partie 2 figurent aussi dans le diagnostic de la partie 3).
Relevé : `audit/passage-niveau-lecteur-2026-09-25.json`.

| Façon | Décidés | Justes perdus | Faux |
|---|---|---|---|
| Lecteur coupé (4.7.18) | 440 | — | 2 (p2, 772 et 773) |
| **Arbitre** : premier passage gardé seulement si le moteur s'accorde avec l'ornière à 8 mm ; ni reprise ni choix au passage à niveau | 409 | **43** | 2 (les mêmes) |
| **Dernier recours** : l'ornière seulement sur un cut que la chaîne diffère | **485** | **0** | **3** |

L'arbitre retirait 43 cuts justes (7 premiers passages, 27 choix, 10 reprises,
le lecteur tranchant seul au passage à niveau) sans arrêter aucun faux : il
est écarté. Retenu : **le dernier recours**.

## Le dernier recours, en détail

| | |
|---|---|
| Cuts décidés en plus | **45** : 21 posés par l'ornière, puis 19 choix et 5 reprises que ces cuts rendent possibles (ils deviennent appuis) ; 4 doublons retirés (768–771, cuts de la partie 2 présents aussi dans le diagnostic de la partie 3) |
| Jugés | 36 |
| Faux | **1** : partie 34, cut 4551, posé par l'ornière sans appui, rail droit à 10,5 mm |
| Justes perdus, décisions modifiées | 0 ; 1 reprise déplacée de 0,5 à 2,4 mm (p3, 4276), juste |
| Posés par l'ornière | 21, tous sans appui (premier cut du passage à niveau) ; 17 jugés, médiane 2,9 mm, p90 6,0 mm |
| Lots 4.7.18 du terrain | +18 décidés, 17 jugés, 0 faux |

**Les passages à niveau du terrain, rejoués** :
- partie 3, **5377–5384** : 8 sur 8 décidés (5377 et 5381 par l'ornière, les
  autres repris ou choisis par la voie), de 0,8 à 8,7 mm de la pose validée ;
- partie 3, **4273–4274** : décidés (ornière 1,2 mm ; choix 3,8 mm) ;
- partie 2, **768–771** : décidés (1,9 à 8,3 mm).

**Ce que le lecteur ne corrige pas** : 772 (premier passage, 14,9 mm) et 773
(choix, 13,1 mm), deux cuts que la chaîne décide ; le lecteur n'y touche pas.

## Voie encadrée et reprise des différés

- **Voie encadrée** : un cut qui a des appuis posés des deux côtés est prédit par
  une courbe du second degré (deux appuis au moins de chaque côté, trois au
  plus, à 8 cuts au plus), une droite sinon. Mesuré sur la méthode de
  l'opérateur (7801–7806, `audit/lot-4718-p2-2026-09-25.md`) : 6,4 mm au pire,
  contre 20 à 32 mm pour la voie prolongée par l'avant seul. Au banc, elle ne
  change rien : en avancée normale, aucun appui n'est après le cut.
- **Lot « Reprise »** : après un lot Pilote qui a des différés, l'opérateur
  coche « Reprise des différés » ; le nouveau lot part des cuts posés et validés
  par le lot précédent à 8 cuts au plus d'un différé (figés dans son périmètre,
  consignés par sa première décision, rejoués à l'identique). Aucun cut validé à
  la main (§14 I). **Pas encore mesuré** : aucun lot de reprise n'existe.

## Décision (D-053)

| Réglage | Valeur | Décision |
|---|---|---|
| `crossing` | actif, en dernier recours | +45 décidés, 1 faux à 10,5 mm, aucun juste perdu |
| `crossingVoieMm` | 10 | Écart maximal à la voie quand il y a des appuis ; jamais atteint au banc (aucun cut posé par l'ornière n'avait d'appui) ; non déplacé |
| `framed` | actif | Sans effet en avancée normale ; utile à la reprise |
| `frameGap` | 8 | Couvre un passage à niveau de 8 cuts (5377–5384) ; non déplacé |
| `frameAnchors` | 3 | Méthode de l'opérateur (2 à 3 cuts de chaque côté) ; non déplacé |

**Limites.** Calage et mesure sur les mêmes cuts ; le faux de la partie 34 est
à 0,5 mm du seuil ; la reprise n'a pas de mesure terrain ; `crossingVoieMm`,
`frameGap` et `frameAnchors` n'ont pas de bilan de variation. Le prochain lot
relu (partie neuve avec passages à niveau, puis sa reprise) dira si la règle
tient.
