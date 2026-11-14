# CH-123 : passation (13/11, arrêt pour relance sur ordre de l'opérateur)

## État exact (ÉTABLI au banc de CH-116 sauf mention)
- Cible écrite et poussée avant tout rejeu : `cible.md` (51877c9). Mesure de CH-120 refaite au livré : les **128** retrouvés exactement (96 B, 32 C). Autopsie : `sorties/autopsie-128.md`, `sorties/liste-128.csv`. Terrain : 57 cuts à CH-120, 71 à CH-123 (22 ADV, 49 hors ADV). **10 cuts hors de portée** : nuage vide ou moteur aveugle à la vérité (oracle). Ils se déclarent comme tels au rapport.
- Éteint = livré : 4 016 cuts sur 4 016 identiques (`sorties/eteint-egal-livre.txt`, patch v1). Garde d'octobre éteinte (CH-120 + CH-123 v2) : retour 0, avec les 4 signalements du tronc (`sorties/garde/garde-eteint.md`).
- **Cible de rappel non atteinte** (≥ 43 des 128) : le meilleur réglage à moi seul fait +22 (v2E60) ; mon terrain plafonne vers 20. Les générateurs de CH-120 étendus à toutes les zones font +50 (28 chez moi), mais 3 A sortent (`sorties/rappel/rappel-ch120tous.md`).

## Réglages figés et verdicts (rappel et poses contre le livré : `sorties/rappel/`)
| Réglage (fichier figé) | Rappel | Poses | Verdict |
|---|---|---|---|
| v1 cA, apparié sans garde (`reglages-figes.json`) | +32, 1 sorti | 1 nouvelle > 50 (04/11 p15/469), justes déplacés, bons bloqués 4 → 9 | arrêté |
| v1 cC, cB, cACB, cACB-f3 | non mesurés (arbitrage : le compagnon hors ADV = genEcartement de CH-120) | — | abandonnés |
| v2E (`reglages-figes-v2.json`) | +18, 0 sorti | reposés justes 20 → 38, faux 1 → 8, 1 nouvelle > 50 (11/11 p16/4900) | arrêté |
| v2E60 | +22, 0 sorti | > 50 inchangé, reposés justes +22, faux +8 (10 à 50 mm) ; le modèle valide des H7 décalés de 12 à 21 mm | arrêté (pas de critère de précision sur la cellule) |
| v2AS | +14, 0 sorti | +6 justes, +2 faux, 1 juste au-delà de 10 mm (11/11 p16/5855) | arrêté |
| v2BS | +19, 0 sorti | +17 reposés justes en direct ; 3 ricochets du consensus (5850, 5851, 5855) | → v3 |
| v2EBS, v2AEBS | rejeux arrêtés avant la fin | — | abandonnés |
| v3BS-sr, sans ricochet (`reglages-figes-v3.json`) | — | garde d'octobre **ROUGE** : 2 justes en direct (2-19/5030, 2-20/289) | écarté (R1) |
| v3ABS-sr | garde arrêtée (sur-ensemble) | — | écarté |
| **v4BS-sd**, seulement les différés (`reglages-figes-v4.json`) | non mesuré | garde d'octobre au banc **VERTE** : retour 0, 0 recul, 0 vert changé (`sorties/garde/garde-v4BS-sd*`) | **à juger** |
| **v4ABS-sd** | non mesuré | garde **VERTE** : retour 0, 0 recul | **à juger** |

Patchs, à appliquer dans l'ordre : `generateurs.patch` de CH-120 (branche `chantier/CH-120`, 7d7dcd1), puis `hors-pool-v4.patch` (contient v2 et v3 ; `hors-pool.patch` et `-v2`, `-v3` sont des étapes). v4 touche `src/gcv2-l1.js` (H8, garde « sans paire », genEcartement hors ADV par `c123EcartZones`, `voisinLivre`, `c123SeulementDifferes`), `tools/banc-differes.cjs` (`voisinDe`) et les essais (`tests/ch123-hors-pool.test.cjs`, rouge puis vert ; `gcv2-l1-cap5`).

## Ce qui tournait et n'a pas fini
Rien. Les deux gardes v4 ont fini (vertes) ; aucun rappel ni croisé v4 n'a été lancé.

## Prochaine étape
1. Rejeu de mesure de v4BS-sd et v4ABS-sd (`mesure-ch123.cjs` + `banc-mesure-pool.patch` de CH-120 + les deux patchs ; `BANC_LEVIERS` du fichier figé). Rappel : `outils/gains.cjs`. Poses : `banc.cjs juger --ref livre`. Portes : `outils/portes.cjs`. Attendu (SUPPOSÉ) : rappel +19 à +25, seuls les différés du livré changent, 0 décision changée ailleurs. À VÉRIFIER : `outils/identiques.cjs` hors des cuts touchés.
2. Validation croisée : `banc.cjs croise --noms livre,v4BS-sd,v4ABS-sd`, puis examen 05/11.
3. Service worker : le même branchement que le banc (`voisinLivre` : le voisin de la GCV2 est la décision du pool d'avant) dans `background.js`, en patch, puis la parité `parite-l1se-sw --passe`.
4. Rapport d'une page, avec les 10 cuts hors de portée et l'attribution par clé (CH-120 contre CH-123).

## Pièges
- **Données hors dépôt, à refaire** : clone partiel de `banane-data` (sparse) ; `extraire.sh`, puis `preparer.cjs --effacer-segments` (~40 min, 3,1 Go de captures, `CH116_TRAVAIL=~/ch116`) ; `corpus.jsonl` copié de `banane-data/outils/analyse-lots/CH-116/sorties/` ; vérités `outils/verites.cjs` de CH-120 ; lots d'octobre pour la garde : 12 dossiers `BANANE_LOTS` extraits des zips des collections du manifeste `datasets/garde-gcv2/manifeste.json` (4,8 Go). Ne pas extraire les Échos du 12/11 p3 et p4.
- **Durées** : rejeu complet du banc ~7 min (livré) à 15 min (avec relances du moteur), 4 tâches ; 11/11 p16 seul en prend 10 à 25. Garde au banc (outil de CH-116 f8feb89, pas encore sur le tronc : je l'ai prise de `chantier/CH-116` dans un arbre à part) : ~11 min.
- **Tâches de fond tuées** à 30 min par le harnais et au redémarrage du conteneur : lancer les rejeux en `nohup setsid`, et les suivre par leurs journaux. R7 : deux rejeux lourds au plus à la fois.
- La mesure du pool ne change aucune décision (rejeu de mesure = livré, 0 cut changé) : ses rejeux servent aussi au jugement des poses.
- Ricochets : une pose de la GCV2 n'entre que dans `validesL1` (transport) sous L1-se. C'est par là que passent les cascades du consensus.

## Reprise du 13 et du 14/11 (session suivante) : état final
- Rapport : `rapport.md`. Réglage proposé à l'examen vierge : **v4BS-sd seul** (`leviers-v4BS-sd.json` ; `base/generateurs-ch120-7d7dcd1.patch` puis `hors-pool-v4.patch`, inchangé). v4ABS-sd est écarté après jugement (une pose à 10,1 mm).
- Jugement refait avec les zones du lot (`BANC_ZONES=journal`, audit 4) : `sorties/v4/` et `sorties/rappel/*v4*`. Les sorties d'avant (`rappel-v2*`, `poses-v2*`, `cA`) sont aux zones du banc.
- Outils ajoutés : `touches.cjs` (cuts touchés, décisions changées ailleurs, R3 ; demande `banc-touches.patch`), `couts.cjs`, `rappel-par-cause.cjs`, `axe-ch124.cjs` (copie de travail de `chantier/CH-124`, 233fd8e), `parite.cjs`.
- Service worker : `hors-pool-v4-sw.patch`, à appliquer après `hors-pool-v4.patch` ; parité faite sur 04/11 p15 seulement.
- Rien ne tourne. Données hors dépôt à refaire comme plus haut ; le rejeu complet prend 8 à 12 min à 4 tâches, une parité de 70 cuts 7 min.
- Pièges nouveaux : `hors-pool-v4.patch` ne s'applique pas sur le `generateurs.patch` de la pointe de `chantier/CH-120` ; un conteneur relancé garde les fichiers mais tue les rejeux (effacer les mesures partielles) ; la mesure du pool nomme ses fichiers par le début de l'identifiant du lot : hors dépôt seulement.
