# CH-138 : rapport (arrêt propre, 18/11, sur ordre de la mère : quota de l'opérateur presque épuisé)

## État
- **Fait et poussé.** Essais rouges (`tests/ui5-panneau.test.cjs` : le compteur doit dater d'après le 19/10 ; `tests/compteur-gcv2.test.cjs` : le compteur couvre exactement ses sources, et ses totaux sont la somme des parties). Sources : `datasets/compteur-gcv2-sources.json` passe de 13 à 92 parties (79 nouvelles, toutes `en-file`, champ `cadre` : `echo-dedie` ou `echo-pendant-lot`). Le fragment de nom de l'opérateur est retiré des notes. L'outil n'a pas changé.
- **Pas fait.** `datasets/compteur-gcv2.json` et `fiches/COMPTEUR_GCV2.md` ne sont **pas régénérés** : ils restent ceux du 19/10. Les deux essais rouges restent donc rouges. Total avant (ÉTABLI, 19/10) : **2 684 corrigés, 5 258 apprenables**. Total après : non mesuré.

## Recensement (ÉTABLI)
- banane-data, du 19/10 au 17/11 : 393 fichiers Écho dans 45 collections, dont 22 en 7z (Écho p20 du 29/10).
- Aucun export ne porte de projet : `projectId` est nul dans les Échos comme dans les journaux de lot. Les notes ne nomment le projet que jusqu'au 22/10.
- Une partie est donc identifiée par son numéro et le nombre de lignes de sa liste d'ESV, lus dans l'instantané de liste et dans les événements `list-summary` de l'Écho. Deux Échos qui ont la même empreinte forment une seule partie.
- Projets sûrs, d'après les notes : p2-13/17/18/19/20, p3-0/1/5, p4-2 (9 parties). Les 70 autres sont en projet « ? » (`projetCertain:false`).
- Aucune empreinte nouvelle ne recoupe une partie déjà comptée. Totaux relus sur les anciens Échos : p1-12 10 005, p1-13 9 961, p1-14 9 887, p1-15 9 729, p1-16 9 635, p1-24 9 275/9 278, p1-29 9 231, p2-1 9 864, p2-6 9 884, p2-7 9 791, p2-10 9 933, p2-11 9 792. Seule p1-17 (Écho en 7z, sans `list-summary`) n'a pas de total : qu'elle diffère des parties 17 nouvelles est SUPPOSÉ.
- 11 groupes de visites sans liste sont rattachés par la liste du lot de la même séance (PROBABLE, voir les notes des sources). Quatre bribes sont écartées, 13 visites en tout : p2 et p3 du 02/11, p7 du 12/11, p16 du 04/11.

## Doublons possibles (mesurés, ÉTABLI : parties gardées séparées)
- p9, 9 434 lignes (05/11) contre 9 440 (12/11) : aucun cut commun, et les poses finales sont à 142 km les unes des autres. Pas de clé de trajectoire.
- p0, 10 006 lignes (23/10) contre 10 008 (02/11) : 29 numéros de cut sont corrigés dans les deux Échos, mais leurs poses finales sont à 212 km en médiane. Aucune des 239 poses du 02/11 n'est à moins de 1 m d'une des 319 poses du 23/10 (la plus proche est à 9 m en médiane). Les clés de trajectoire diffèrent, mais elles varient aussi dans une même partie (deux clés dans l'Écho p24).

## Pourquoi la génération n'est pas finie
- Premier passage avec un tas de 8 Go : manque de mémoire. L'Écho p0 du 23/10 (514 Mo, 57 zips) passe seul avec 13 Go.
- Deuxième passage avec 13 Go : arrêté sur ordre avant la fin.

## Commande qui finit le travail (machine à 16 Go, ~20 Go de disque libres)
```
git clone --filter=blob:none --sparse -b claude/execute-prompt-00-18ra5a <banane-data> bd
cd bd && git sparse-checkout set --no-cone $(node -e 'for(const s of require("<banane>/datasets/compteur-gcv2-sources.json").sources)for(const d of s.dossiers)console.log("/collections/"+d.split("/")[0]+"/")' | sort -u) && cd ..
# 7z : extraire dans x7z/<dossier de la source>/ ; pour p1-17, les seuls segments ariane-native-v4-*.json
7z x -ox7z/2026-10-29_v4.9.5.23_echo-partie-20/raw 'bd/collections/2026-10-29_v4.9.5.23_echo-partie-20/raw/*.7z'
7z x -ox17 'bd/collections/2026-10-14_v4.9.0.12_partie-17/echo p17 (z)/z.7z.001' && mkdir -p 'x7z/2026-10-14_v4.9.0.12_partie-17/echo p17 (z)' && find x17 -name 'ariane-native-v4-*.json' -exec mv {} 'x7z/2026-10-14_v4.9.0.12_partie-17/echo p17 (z)/' \;
node --max-old-space-size=13000 tools/compteur-gcv2.cjs --donnees bd --racine-supplementaire x7z --sortie datasets/compteur-gcv2.json --md fiches/COMPTEUR_GCV2.md
node --test tests/compteur-gcv2.test.cjs tests/ui5-panneau.test.cjs && node tools/scan-identite.cjs
```
Le doublon p0 est tranché : il n'y a rien à refaire. Reste à rapporter le total après, et sa ventilation par `cadre` et entre projet sûr et « ? », à partir de `sources[]` du JSON généré.

## Fini — génération faite le 18/11 (intégrateur)

Génération terminée sur les 92 parties, `--max-old-space-size=13000`, 7z dépliés sur deux niveaux (l'archive contient des `.zip`). ÉTABLI.

- **Cuts corrigés : 6 761** (dont 4 485 de plus de 5 mm, 2 684 de plus de 10 mm) ; validés tels quels : 1 366 ; visités sans action (≥ 0,6 s) : 9 631 ; **apprenables : 17 758**. Avant, au 19/10 : 2 684 et 5 258.
- File : 4 623 corrigés / 13 734 apprenables ; appris : 2 138 / 4 024.
- Essais : `compteur-gcv2` et `ui5-panneau` **27 sur 27**, les deux essais rouges passent. `scan-identite` ne relève rien (motifs confidentiels absents de cette machine : seuls les quatre motifs publics sont contrôlés).

Ventilation, lue dans `sources[]` du JSON généré et rapprochée du fichier des sources :

| Cadre | Projet | Parties | Corrigés | Apprenables |
|---|---|---:|---:|---:|
| non précisé | sûr | 13 | 2 684 | 5 258 |
| `echo-dedie` | sûr | 9 | 893 | 2 396 |
| `echo-dedie` | ? | 29 | 1 721 | 6 779 |
| `echo-pendant-lot` | ? | 41 | 1 463 | 3 325 |

Les 13 parties déjà comptées le 19/10 rendent exactement l'ancien total (2 684 / 5 258) : la génération ne recompte rien, elle ajoute. PROBABLE pour les 70 parties en projet « ? », dont le rattachement repose sur le numéro de partie et la taille de la liste d'ESV.
