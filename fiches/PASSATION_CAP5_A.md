# Passation du cap 5, agent A (nuit du 20 au 21/10)

Ce document se lit avec `fiches/L1_CAP5.md` (v4 de la test 15, parité banc / extension, premiers leviers v5) et la fiche de l'agent B (branche `claude/50-l1-cap5b`, recherche recentrée en ADV).

## 1. Où en est la branche

`claude/50-l1-cap5` est poussée. Elle est fusionnée avec `claude/50-l1-cap5b` jusqu'à 89b9323. **Tous les leviers v5 sont coupés par défaut : l'extension reste la v4b de la test 15.** Avec les leviers par défaut, 2:19 rejoué au banc donne 0 décision différente de la v4b sur 248.

| Commit | Contenu |
|---|---|
| 1fd974c | v4 au banc : leviers livrés = v4 |
| 1f793df | v4 dans l'extension : transport et correction de la chaîne (base de la test 15) |
| be1aefc | banc aligné sur l'extension : chaîne L1-s refaite posée seulement par une commande « lot » |
| 3ebe7ee | leviers de qualité v5 (p sans voie, anomalie, « sans voie : rien »), fiche L1_CAP5.md |
| 8cb7958 | deuxième passe de fin de lot, voie de la liste d'ESV, recapture des captures vides (extension, coupée) |
| 78a16aa | levier `branche` : voie géométrique rail par rail en ADV ; passes alternées |
| 493557c | leviers `voieProcheSureCuts`, `soutienMinDessus`, `soutienMinFlanc` |
| a2ccb8a, 217b4db | fusions de `claude/50-l1-cap5b` (217b4db : jusqu'à 89b9323) ; levier de banc `passesAlternees` |

La test 15, livrée au terrain, a été faite par le coordinateur depuis `claude/50-test15` (07080f6), qui fusionne 1f793df et be1aefc.

## 2. Mesures (banc, L1-se, vérité opérateur de l'Écho)

Les rejeux sont dans `scratchpad/c5/r-<nom>/r-<partie>.jsonl`. Le juge est `c5/juger.cjs` ; les vérités sont `c5/verite-<partie>.json`. « Posables » veut dire différés hors captures vides. La colonne « > 20 » compte toutes les poses à plus de 20 mm.

### Résultats par partie

Chaque case donne : posables / jugées / ≤ 5 / ≤ 10 / 10–20 / > 20.

| Partie (différés réels) | v4b (test 15) | mB = b-r2 (B) | mX = mB + leviers A |
|---|---|---|---|
| 2:19 (207) | 3 / 235 / 195 / 234 / 1 / 0 | 2 / 236 / 196 / 235 / 1 / 0 | 2 / 236 / 196 / 235 / 1 / 0 |
| 2:17 (41) | 18 / 23 / 11 / 17 / 3 / 3 | 6 / 35 / 25 / 34 / 1 / 0 | 6 / 35 / 25 / 33 / 2 / 0 |
| 2:18 (37) | 18 / 18 / 10 / 14 / 4 / 0 | 12 / 23 / 17 / 21 / 2 / 0 | 13 / 22 / 16 / 20 / 2 / 0 |
| 2:11 (12) | 3 / 8 / 3 / 6 / 2 / 0 | 2 / 9 / 3 / 7 / 2 / 0 | 3 / 8 / 3 / 7 / 1 / 0 |
| 2:20 fd7067f7 (42) | 8 (+29 vides) / 8 / 5 / 7 / 1 / 0 | 0 / 16 / 11 / 14 / 2 / 0 | 0 / 16 / 11 / 14 / 2 / 0 |
| 2:20 f228f6f9 (123) | 2 / 175 / 134 / 173 / 2 / 0 | 1 / 175 / 134 / 172 / 3 / 0 | 1 / 175 / 134 / 172 / 3 / 0 |
| 2:6 (11) | 3 / 8 / 4 / 6 / 2 / 0 | 3 / 8 / 4 / 6 / 2 / 0 | 4 / 7 / 4 / 5 / 2 / 0 |
| 2:7 (21) | 2 / 19 / 10 / 14 / 3 / 2 | **3** / 18 / 10 / 14 / 3 / **1 (5684)** | 3 / 18 / 10 / 14 / 3 / 1 |
| 2:13 (3) | 0 / 0 | 0 / 0 | 0 / 0 |

### Sur l'ensemble des parties

| Ensemble | Jugées | ≤ 5 mm | ≤ 10 mm | > 20 mm | > 50 mm | Mauvaise voie |
|---|---|---|---|---|---|---|
| v4b | 494 | 372 | 471 (95,3 %) | 5 | 0 | 0 |
| mB | 520 | 400 | 503 (96,7 %) | 1 | 0 | 0 |
| mX | 517 | 399 | 500 (96,7 %) | 1 | 0 | 0 |

- **mB = b-r2 à l'identique** : 0 décision différente sur les 9 lots, depuis 217b4db. Il reste deux écarts au cap :
  - 2:7, avec 3 différés posables contre 2 en v4b, et 5684 à 37,4 mm ;
  - 2:17, 2:18 et 2:20 fd7067f7 passent sous la v4b, mais 2:17 (6) et 2:18 (12) restent au-dessus de 5.
- **mX n'apporte rien sur mB.** La preuve du nuage sur les deux rails retire 195 (12,8 mm), 6456 (11,9) et 3505 (5,8, une bonne pose), d'où un différé de plus en 2:18, 2:11 et 2:6. Elle ne retire pas 5684, posée dans mB par un autre chemin. La branche rail par rail ne gagne rien que la recherche recentrée de B ne fasse déjà.

Chaînes exactes (fichiers `c5/b-r2.leviers` et `c5/mX.leviers` ; `leviers.json` et `commit.txt` dans `r-mB` et `r-mX`) :
- mB = b-r2 : `{"diag":true,"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true},"rechercheDiag":true,"rechercheADV":true,"rechVoieParCutMm":40,"rechHauteurMaxMm":30,"rechContraMinMm":20,"rechContraMaxMm":45,"rechRemplace":true,"rechRemplaceMm":12,"rechContraRien":true}`
- mX = mB, plus `{"branche":true,"brancheVertMm":60,"soutienMinDessus":20,"soutienMinFlanc":1,"passesAlternees":true,"deuxiemePasse":30}`.

## 3. Ce qui a marché, ce qui a échoué

| Levier ou essai | Résultat | Raison |
|---|---|---|
| Transport et correction de la chaîne dans l'extension (1f793df) | parité banc / service worker : 2:19 248/248, 2:20 f228 281/281 ; le témoin négatif (ancien background.js) montre 4 écarts, tous expliqués | `tools/parite-l1se-sw.cjs` |
| Banc : commande « engine » dans le chemin L1-s b | écart corrigé au banc (be1aefc) | l'extension n'envoie que des commandes « lot » |
| Seuils p sans voie et anomalie sans voie (3ebe7ee) | rejetés | en validation croisée, appris par une seule partie (2:7, 2:17) |
| « Sans voie sûre : rien » seul (q8) | rejeté | les premières poses n'amorcent plus le transport : f228 passe de 2 à 69 différés |
| Deuxième passe à sens alterné, passe 2 « sans voie : rien » (e1) | f228 1 différé, 2:18 15, qualité ≥ 96 % ; mais 2:19 9, 2:7 12, 2:13 2 | les cuts de début de lot n'ont aucune voie |
| Voie de la liste d'ESV (vl0, vl1) | presque absente | zones entièrement rouges au départ ; fiable seulement pour des trous de 10 cuts au plus |
| Branche rail par rail (e2, e6) | gagne 9652, 9653 (4,3 mm ; était une mauvaise voie), 467, 99 | la voie prolongée de plus d'un cut est fausse ; la hauteur prolongée n'est pas fiable (tolérance 60 mm) |
| Voisin le plus proche à 1 cut comme voie sûre (e6) | rend du volume : 2:18 15, 2:11 3, 2:7 3 | — |
| Preuve du nuage sur les deux rails, 20 / 1 (e7, mX) | hors ligne (validation croisée sur e6, poids 10–20 = 1,2) : 0 > 20 par partie, 96,9 % ≤ 10 ; seuils appris par pli : champignon 20 ou 30, flanc 1 ou 2 | au rejeu réel, des effets en cascade : 3220 revient corrigé à 29 mm (e7) ; sur mB, coûte un différé dans 3 parties |
| Recapture des captures vides (extension, coupée) | essai service worker au vert | non mesurable au banc : le corpus ne garde que la capture faite |

### Validation croisée hors ligne des seuils de nuage (base e6, poids de la bande 10–20 = 1,2)

Une ligne par partie laissée de côté : seuils appris sans elle, puis résultat sur elle.

| Partie laissée de côté | Seuils appris | Posables | Jugées | ≤ 10 | 10–20 | > 20 |
|---|---|---|---|---|---|---|
| 2:19 | champignon ≥ 30, flanc ≥ 1 | 9 | 229 | 229 | 0 | 0 |
| 2:17 | champignon ≥ 30, flanc ≥ 1 | 22 | 19 | 16 | 3 | 0 |
| 2:18 | champignon ≥ 30, flanc ≥ 1 | 18 | 17 | 14 | 3 | 0 |
| 2:11 | champignon ≥ 30, flanc ≥ 1 | 4 | 8 | 6 | 2 | 0 |
| fd7067f7 | champignon ≥ 30, flanc ≥ 1 | 7 | 9 | 8 | 1 | 0 |
| f228f6f9 | champignon ≥ 30, flanc ≥ 1 | 1 | 175 | 173 | 2 | 0 |
| 2:6 | champignon ≥ 20, flanc ≥ 2 | 7 | 4 | 4 | 0 | 0 |
| 2:7 | champignon ≥ 20, flanc ≥ 1 | 5 | 16 | 12 | 4 | 0 |
| 2:13 | champignon ≥ 30, flanc ≥ 1 | 2 | 0 | – | – | – |

Commande : `POIDS_A20=1.2 node c5/cvsout.cjs e6`. Avec le poids 0,5, le pli fd7067f7 apprend champignon ≥ 30 sans flanc, et 97 (22,8 mm) y reste.

## 4. Pistes suivantes, classées

1. **2:7, 5684 (37,4 mm) et le volume (3 contre 2 en v4b).** À 5684, l'opérateur s'écarte de 45 mm de ses propres voisins. Même cas pour 3220. Vérifier la vérité (Écho), puis trouver une preuve contre la paire : continuité de l'opérateur, ou soutien.
2. **2:18 (12) et 2:17 (6)**. Voir la liste des différés restants de b-r2 (fiche de B). Pistes :
   - leviers 2 et 3 de B (au-delà de 150 mm, détection du rail en ADV) ;
   - « anomalie-non-corrigee » (2:11 7320, 2:6 3722 4756, 2:7 5576 5901, f228 649, 2:18 153).
3. **Captures vides de 2:20 fd7067f7** (29 cuts) : la recapture est prête dans l'extension, coupée. Elle ne se mesure que sur le terrain.
4. **Précision ≤ 5 mm (v6)** : 400/520 dans mB. À regarder : raffinement sub-centimétrique de la hauteur et du travers.
5. La preuve du nuage n'est à reprendre que si elle s'applique à toutes les poses, y compris celles de la recherche recentrée, et seulement si elle ne coûte pas de différé.

## 5. Commandes

- Rejouer les 9 lots, d'un commit propre de wt/C5, sur un cœur (écrit `commit.txt` et `leviers.json`) : `bash c5/runc.sh NOM 'LEVIERS_JSON' CŒUR`
- Un seul lot : `bash c5/run1.sh NOM 'LEVIERS_JSON' PARTIE CŒUR L1-se`. Pour une autre racine, `RACINE=… bash c5/run1r.sh …`.
- Juger : `node c5/juger.cjs L1-se c5/r-NOM/r-PARTIE.jsonl c5/verite-PARTIE.json`
- Tableau par partie et validation croisée de configurations : `node c5/cv.cjs v4b,NOM1,NOM2`
- Décisions identiques entre deux rejeux (sans diagnostic) : `node c5/memes.cjs A.jsonl B.jsonl`
- Poses gagnées ou perdues entre deux rejeux : `node c5/perdus.cjs A B`
- Parité banc / service worker : `node tools/parite-l1se-sw.cjs --partie 2:19 --journal … --corpus … --lot 79b34f68 --liste c5/../ap/listes/liste-2-19.json --banc c5/r-v4b/r-2-19.jsonl --sortie S.jsonl [--coupe N] [--progres]`. Pour le témoin, ajouter `node --preserve-symlinks --preserve-symlinks-main` et une racine faite de liens.

## 6. Pièges connus

- **Reproductibilité** : partir d'un commit poussé (runc.sh refuse un arbre sale) et garder `commit.txt` et `leviers.json`.
  - b-r2 n'a été reproduit qu'après le levier `rechOrdreGraines` (8a7dc7a, par défaut l'ordre de b-r2) et avec `rechContraRien:true` dans la chaîne.
  - Les rejeux e1 à e7 tournaient avec des passes toujours alternées. Pour les refaire aujourd'hui : `"passesAlternees":true`.
- **Témoins de danger** : 9527 (202 mm en p2a, « sous τ cohérent » sans voie) et 9653 (250 mm avec le choix par écartement de référence). Vérifier les deux à chaque configuration.
- **Cœurs** : l'agent A tourne sur les cœurs 0 et 1, l'agent B sur 2 et 3. Les rejeux de la recherche recentrée sont lents (~70 min pour 9 lots sur un cœur). Un rejeu de parité dans le service worker prend 1 à 2 h par lot.
- **Tuer un rejeu** : utiliser `c5/tuer.sh MOTIF`. `pkill -f` tue aussi le shell appelant.
- **Disque** : environ 1,4 Go libres. Ne pas dupliquer les lots. Les dossiers missions, bruit, ref, trace, p16b et rm ne sont pas à l'agent A : ne pas y toucher.
- **Juge** : `juger.cjs` compte « p20 » au-delà de 20 mm, > 50 compris. Un rejeu sans profil « base » est jugé sur ses poses non « lot ».
- **Vérité de 2:7** : construite sur le seul export final de l'Écho (`c5/echo7`) ; avec tous les exports, la mémoire ne suffit pas.
