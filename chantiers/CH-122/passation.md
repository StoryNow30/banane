# CH-122 : passation (arrêt pour relance, ordre de l'opérateur, 13/11)

## 1. État exact
- Aucun réglage n'atteint la cible ET ne passe la garde d'octobre. Rien à allumer.
- Cible écrite avant tout rejeu : `cible.md` (65ff14d). Réglages figés avant jugement : `reglage-fige.md` (v1 A/B, v2B, v3B, B'). Sorties : `sorties/` (bancs, gardes, poses de la chaîne changées).
- Référence livrée refaite au banc de CH-116 : 561 posés jugés, 496 ≤ 10 mm, 36 de 10-50, 29 > 50, 591 différés (ÉTABLI, identique à CH-116). Fautes du livré : GCV2 35, chaîne 30 (29 en ADV).
- Garde d'octobre du patch ÉTEINT : verte, retour 0 (`sorties/garde/garde-eteint.md`, ÉTABLI).

## 2. Réglages et verdicts (banc de novembre en validation croisée un lot dehors ; garde d'octobre = hold-out externe)
| Réglage | Novembre (justes / 10-50 / > 50 / différés ; livré 496 / 36 / 29 / 591) | Garde d'octobre | Verdict |
|---|---|---|---|
| v1 A | 520 / 32 / 26 / 634, bons bloqués 19, MV nouvelle 0411 | non passée | écarté (cible A non tenue) |
| v1 B | 536 / 37 / 27 / 588, bons bloqués 9 ; 4 MV nouvelles (1111 16/4506, 4507, 5848, 5851) | ROUGE : 14 MV nouvelles (terrain 23/10), 3:0, reglage-9 | écarté |
| v2 B (pose de la chaîne en ADV candidate) | 569 / 33 / 19 / 579, bons bloqués 14 ; 1 MV nouvelle 0511 (10/4978) ; 506 poses de la chaîne changées (98 jugées : 20 mieux, 15 pire) | non lancée (pas de garde de voie) | non proposé |
| v3 B (v2 + garde de voie obligatoire) | 5 lots sur 7 rejoués, non jugé | ROUGE : 3 MV nouvelles ; 410 verts changés (poses de la chaîne déplacées), 29 justes passés > 20 mm | écarté (R1) |
| B' (modèles B + garde de voie obligatoire, chaîne intacte) | non jugé (R1 : garde d'abord) | ROUGE : 5 MV nouvelles sans passe (terrain 23/10 : lot1 1135 ; lot2 1328, 1329, 1332, 1334) ; reglage-9 : 21 justes passés > 20 mm (2-19, 2-20 f228), sans pose 25 → 36 | écarté (R1) |
| B-ancre (modèles B + garde d'ancre de CH-124 θ = 75 mm, chaîne intacte) | — | — | patch PRÉPARÉ, NON figé, NON jugé (attente du feu vert de l'intégrateur) |

Leçons (ÉTABLIES sur ces mesures) : (1) les 4 MV nouvelles de B : bonne paire absente du pool, candidat à 150-256 mm en travers de la voie des voisins validés, poids appris POSITIF sur `dvFit` ; (2) la puce ne doit jamais déplacer une pose de la chaîne (v2, v3) ; (3) une garde de voie de voisins ne suffit pas en octobre : les MV nouvelles de B' sont des poses sans voisin ou à voisins faux ; (4) en octobre, la puce dégrade aussi des justes de la GCV2 (21-35 mm) : le modèle appris en novembre ne se transporte pas (régime 4.9, CH-118).

## 3. Ce qui tournait et n'a pas fini (arrêté)
- Jugement de novembre de v3B : 1111 et 1211 manquent (`~/ch116/rejeux/pucev3B`), sans objet (v3 écarté).
- Rien d'autre : gardes v3 et B' finies.

## 4. Prochaine étape
- B-ancre : `puce-bancre.patch` (préparé sur `puce.patch` : clé `puceAncre:null` ; axe donné par cut ; garde sur tout candidat non validé par le livré ; ancre muette = rien de nouveau ; `tools/banc-differes.cjs` lit `BANC_ANCRE`). À FIGER (ajouter son § à `reglage-fige.md`, θ = 75 mm a priori, non réglé), puis, au feu vert : garde d'octobre d'abord (il faut alors les axes des lots d'octobre : `axes-ancre.cjs` lit les métas du banc de CH-116 ; pour octobre, écrire l'équivalent sur `BANANE_LOTS`, avec la lib de CH-124 inchangée), puis validation croisée.
- Axes de novembre : `outils/axes-ancre.cjs` (lib de CH-124 utilisée telle quelle, arbre `chantier/CH-124` 233fd8e) → `CH116_TRAVAIL/ancre/<clé>.json` ; contrôle : identiques à `CH-124/sorties/ancre-corpus.csv` sur 4 016 cuts (écart 0,00 mm). Le banc veut un seul fichier `{"<lotId>:<partie>": {cut: mm}}` : à assembler depuis ces fichiers et `meta/<clé>.json` (champ `lotId`), pas encore fait.
- Pour l'extension (si un réglage tient) : le chemin `background.js` n'est pas écrit (contre-expertise et ancre) ; un réglage sans parité ne s'allume pas.
- Examens vierges (12/11 p3, p4 ; lot 1312v) : jamais extraits ni lus ici.

## 5. Pièges rencontrés
- Le conteneur a redémarré deux fois : tout ce qui est hors dépôt survit sur disque, mais les tâches de fond meurent ; un rejeu interrompu laisse des `.part`, le banc reprend les lots-parties sans `.jsonl`.
- R7 : deux rejeux lourds au plus à la fois (4 cœurs, 15 Go) ; le jugement croisé (`outils/juger-croise.sh`, variable `JOBS`) et une garde en même temps, c'est déjà deux.
- `apprendre.cjs` sur `jeu2` (39 520 candidats) : lancer avec `--max-old-space-size=4096` (un appel a été tué, code 137).
- Chemins hors dépôt à refaire dans une session neuve : `~/ch116` (banc de CH-116 : `extraire.sh` puis `preparer.cjs --effacer-segments`, 3,1 Go de captures) ; `~/ch116/corpus.jsonl` (copie de `banane-data/outils/analyse-lots/CH-116/sorties/corpus.jsonl`) ; jeux `jeu-livre` (`puce.patch`, `BANC_LEVIERS={"puceJeu":true}`) et `jeu2` (`puce-v2.patch`, `{"puceJeu":true,"contreChaineZones":["adv"]}`) ; lots d'octobre `~/lots-oct` (4,8 Go, extraits de `banane-data/collections/2026-10-1[6-9]*`, `2026-10-2[03]*` d'après `datasets/garde-gcv2/base-test18.json`) pour `BANANE_LOTS`.
- Ne jamais lancer `git ls-tree -l` dans un clone partiel de `banane-data` : il télécharge tous les objets.
- La garde (`tools/garde-gcv2.cjs --rejouer`) impose ses leviers (`BANC_LEVIERS` de la base) : un réglage se garde en copie « allumée » (modèle et clés écrits dans `LEVIERS_V4` de la copie), comme `~/ch122/allume*`. Depuis f8feb89, `banc.cjs garde` existe au tronc (15 min) : à préférer.
