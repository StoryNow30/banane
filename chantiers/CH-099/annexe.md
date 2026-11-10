# CH-099 : annexe du rapport (détails, écarts au plan, contrôles, reproduction)

Tout nombre vient de `tools/ch099-rejeu.cjs` et des fichiers de `sorties/` (numéros de partie et de cut, millimètres, comptes ; aucun identifiant). Les sorties sont sur la branche à la demande de l'intégrateur (l'écriture dans `banane-data` a été refusée à cette session) : il les déplace dans `banane-data/outils/analyse-lots/CH-099/` à l'intégration, elles n'entrent pas au tronc.

## 1. Ce qui a été lu
| Lot | parties | posés | jugés | fautes | différés S0 / S60 / S90 | sans paire forte |
|---|---|--:|--:|--:|--:|--:|
| 04/11 | 6 à 15 | 957 | 6 | 0 | 26 / 17 / 13 | 6 |
| 05/11 | 8 à 12 | 831 | 211 (+ 18 écartés D-285) | 0 | 25 / 1 / 0 | 169 |
| 06/11 | 13 à 16 | 1 078 | 100 (+ 8 écartés) | 7 | 30 / 9 / 9 | 408 |
| 08/11, 16:13 | 3 et 4 | 109 | 16 | 0 | 6 / 3 / 0 | 2 |
| 08/11, 20:16 | 5 | 54 | 0 | 0 | 0 / 0 / 0 | 0 |
| 08/11, 21:30 | 6 | 193 | 27 | 3 | 6 / 5 / 5 | 1 |
| 08/11, 22:28 | 7 | 87 | 0 | 0 | 5 / 2 / 0 | 4 |

- Populations du plan (§ 3) : 05/11, 06/11, 08/11 de 21:30 et partie 14 du 04/11, soit 2 208 posés. Les autres lots (1 101 posés) sont **hors plan** : ils ont été lus pour le coût seulement (décision sur la pose, aucune vérité).
- **À signaler à l'intégrateur** : parmi eux, les parties 6, 7, 8, 9, 11, 12 du 04/11 (607 posés, 14 différés S60) sont dites « réservées » par la note du manifeste (reçues sans Écho). Aucune vérité n'y existe et rien n'y a été réglé, mais le script ne contrôle pas le manifeste. Sans elles : 23 posés différés sur 2 702 (0,85 %).
- 2 889 posés sur 3 309 n'ont pas été visités par l'Écho ; plusieurs parties n'ont aucun Écho. « Lu cut par cut » ne vaut que pour les parties jugées des 06 et 08/11.
- Le lot du 05/11 est le projet des parties 8 à 12 passées en apprentissage par D-287 ; les témoins du manifeste (parties 11 et 25 d'un autre projet) ne sont pas lus.

## 2. Les 10 fautes, cut par cut
| Lot | partie | cut | écart (mm) | pose par | S0 | S60 | S90 | paire la plus proche de la vérité (mm) | gardes (après un différé, grappe, voie) | banc conjoint, S60 | B1-écart V1 / V2 |
|---|--:|--:|--:|---|---|---|---|--:|---|---|---|
| 06/11 | 15 | 7260 | 125,7 | L1-e | garde | garde | garde | 130 | 1, 1, 0 | posé à 126,1 | non différé |
| 06/11 | 15 | 7423 | 174,0 | L1-e | **différer** | garde (paire pauvre) | garde | 15,6 | 0, 0, 0 | posé à 174,2 | non différé |
| 06/11 | 16 | 9266 | 262,7 | chaîne | **différer** | **différer** | **différer** | 5,7 | 0, 0, 0 | reposé à 1,8 (passe, rang 4) | sans pose |
| 06/11 | 16 | 9267 | 315,1 | L1-e | **différer** | **différer** | **différer** | 6,3 | 0, 0, 0 | différé | 0,9 / 0,9 |
| 06/11 | 16 | 9270 | 238,3 | chaîne | **différer** | **différer** | **différer** | 4,0 | 1, 1, 0 | différé | sans pose |
| 06/11 | 16 | 9271 | 185,4 | L1-e | **différer** | **différer** | **différer** | 6,0 | 1, 1, 0 | différé | sans pose |
| 06/11 | 16 | 9272 | 163,9 | L1-e | garde | garde | garde | 3,7 | 0, 0, 0 | posé à 163,7 | non différé |
| 08/11 | 6 | 220 | 173,9 | chaîne | **différer** | **différer** | **différer** | 6,3 | 1, 1, 1 | reposé à 3,0 (passe, rang 7) | sans pose |
| 08/11 | 6 | 360 | 156,1 | chaîne | **différer** | **différer** | **différer** | 6,1 | 0, 0, 1 | reposé à 2,9 (passe, rang 15 : au-delà du plafond) | 2,9 / 2,9 |
| 08/11 | 6 | 361 | 156,5 | chaîne | **différer** | **différer** | **différer** | 3,1 | 0, 0, 1 | posé à 9,4 par la GCV2 (effet indirect) | 2,3 / sans pose |

- Le vrai rail est une paire forte du nuage, à 3 à 6 mm de la vérité, pour 8 fautes sur 10 (pas 7260 : 130 mm ; 7423 : 15,6 mm, paire pauvre). C'est le constat de CH-034 sur la partie 20, retrouvé hors d'elle.
- 9272 : la bonne paire existe (rang 9) mais la pose fausse est une paire forte mieux ajustée : la règle la garde.
- 7423 : la meilleure paire (40 et 39 points de dessus) est à 15,9 mm de la vérité ; sous 60 points, S60 ne la laisse pas contredire la pose.
- Les 5 fautes posées par la chaîne sont différées (5 sur 5) ; 2 sur 5 de celles posées par la décision L1-e. 361, à 9,4 mm, est « juste » à 0,6 mm du seuil.

## 3. Coût (rejeu statique)
- Poses jugées justes différées par S60 : 05/11 partie 10 cut 3702 ; 06/11 partie 16 cuts 9160 et 9162 ; 08/11 partie 6 cut 182. Sur les 11 différés jugés : 7 fautes, 4 justes ; 26 différés ne sont pas jugés.
- Zones des 37 différés S60 : 30 en appareil de voie, 5 en passage à niveau, 2 en voie courante. Chemin : 28 poses de la chaîne, 9 de L1-e.
- Les poses entre 10 et 50 mm (19) ne sont différées par aucune variante.
- Temps hors ligne sur cette machine : 0,6 s par cut en médiane pour les trois variantes ensemble (hors plan ; le temps dans le navigateur n'est pas mesuré).

## 4. Gardes en ombre (plan M2)
- Sources : garde « après un différé » et grappe = événements du journal ; garde de voie = module rejoué sur la liste de fin de lot, lecture « avant seulement » (aucun événement dans ces journaux).
- Les 04 et 05/11, la garde « après un différé » était ACTIVE : elle a retenu 39 cuts et ne peut signaler aucun posé. Le tableau du rapport se limite donc aux lots où elle était en ombre (06 et 08/11). Sur tous les lots, grappe : 31 justes sur 331 et 47 posés sur 3 309 ; garde de voie : 4 et 41.
- Sans « visité sans action » (88 justes) : garde « après un différé » 30, grappe 22, voie 3, les trois 34, recherche large S60 3, union 36.

## 5. Seconde chance (plan M4, M5)
- Banc : `tools/banc-differes.cjs rejouer`, profils base et L1-se, leviers `deuxiemePasse:2`, `passe2Leviers:{sansVoieRien:true}` (la recette de CH-034), sans puis avec `--recherche-large` S60. Lots : 06/11 parties 15 et 16, 08/11 partie 6 (deux lots), 04/11 partie 14, 05/11 partie 8.
- Statique et conjoint ne diffèrent pas le même ensemble : 12 cuts communs sur 14 ; statique seul : 9161, 361 ; conjoint seul : 170, 282.
- Poses de la passe avec levier : 24 (17 sans), 18 jugées : 16 justes, 2 entre 10 et 50 mm ; sans « visité sans action » : 15 et 2 ; sous plafond : 11 et 2. Le rang sous plafond est l'ordre des cuts, passe 1 puis passe 2 : SUPPOSÉ, l'ordre réel d'écriture n'est pas rejoué.
- Effets indirects (59 cuts changent sans être différés par le levier) : 3 posés deviennent différés (9161 non jugé ; 9274 juste à 9,2 mm ; 9275 juste à 5,1 mm) ; 13 différés deviennent posés, dont 11 jugés : 10 justes (0,9 à 4,3 mm) et 9173 à 18,1 mm ; parmi les cuts posés des deux côtés et jugés, 8 meilleurs de plus de 2 mm, 3 pires (9175 : 1,8 → 19,1 ; 9176 : 3,3 → 18,9 ; 9178 : 0,3 → 17,3).
- Fidélité : profil base contre la pose réelle, 700 poses, médiane 0,44 mm, 5 à plus de 2 mm, maximum 159,9 mm au cut 282 du 08/11 (l'un des 14 « différés par le levier » au banc ; en statique la règle garde sa pose réelle : artefact du rejeu). Profil L1-se : 1 001 poses, médiane 0,45 mm, 37 à plus de 2 mm, 12 à plus de 10 mm, 18 états différents sur 1 094. Exemple de bruit : 9176 est à 18,5 mm en réalité, 3,3 au témoin, 18,9 avec levier.
- B1-écart (`scripts/b1-rejeu.cjs`, écrit par un second agent, sans essai ; `sorties/b1-ecart.json`). Fidélité : 50 événements réels sur 50 (verdict, source, pose à 0,0 mm), à condition de ramener la liste à son état de début de lot (le service worker la lit une fois par lot). Contrefactuel statique sur les 14 cuts différés par S60 des 06 et 08/11, V1 = appuis sans ces cuts, V2 = appuis réels : 6 posables dans chaque version. Fautes : voir § 2 (360 et 9267 justes dans les deux versions, 361 en V1 seulement). Justes différées : 9162 reposé à 4,8 mm en V2 seulement ; 9160 et 182 sans pose. 9161 (validation écartée D-285, non jugé) : V1 pose à 231 mm de la pose du lot, V2 à 0,4 mm. 14 cuts : aucun taux.

## 6. Cuts retenus par la garde alors active (04 et 05/11) : détail du § 4 du rapport
- 39 cuts retenus (22 et 17), 35 rejoués (4 de la partie 10 du 05/11 n'ont pas de pose du lot consignée), 18 jugeables après D-285 : 17 justes, 1 à 10,9 mm (05/11, partie 10, cut 6425), 0 faute. La recherche large garde les 4 cuts de CH-056 dans les trois variantes ; sur les 18 jugeables, S60 n'en diffère aucun, S0 un seul (6425).
- Nombres par cut : `sorties/constat-poses-sans-garde.json`. Cette lecture n'est couverte ni par le rejeu indépendant ni par le juge commun : elle est à refaire par l'intégrateur avant toute correction de CH-056 et CH-057.

## 7. Écarts au plan et mesures hors plan
- **Couverture ±400 mm** : le plan disait « étendue latérale des points par rail ». Mesurée d'abord dans la bande verticale du moteur (±100 mm), elle dépend des objets présents ; elle est mesurée à toutes les hauteurs, avec une tolérance de 20 mm (les captures sont découpées à 399-400 mm de chaque rail : en strict, 1 143 posés seulement passeraient). Choix fait après avoir vu les trois captures du 08/11, avant tout résultat de la règle.
- **Verdict** : le plan comptait les fautes de trois populations ; celle des 04 et 05/11 se révèle vide (§ 6). Les deux lectures sont au rapport (7 sur 10 ; 7 sur 12).
- **Hors plan** : les lots ajoutés pour le coût (§ 1) ; les 35 poses retenues par la garde ; les totaux de bout en bout et les effets indirects du banc ; la ventilation chaîne / L1-e ; le temps ; la concordance avec le juge de CH-100 (pris à la demande de l'intégrateur, avec la ligne d'export de `tools/juger-lot.cjs` du même commit).
- Série : définition du plan (2 cuts d'écart au plus) et celle du juge commun (10 cuts, aucun jugé à 50 mm ou moins entre deux) donnent les mêmes 5 séries.

## 8. Contrôles et critique adverse
- Rejeu indépendant : 536 cuts (les 360 jugés, 26 écartés et 150 non jugés tirés au sort, graine 20261110) ; il couvre 14 des 37 différés S60 et 31 des 98 différés S0, aucune pose contrefactuelle.
- Juge commun : 3 168 posés (les deux lots du 08/11 sans Écho, 141 posés, n'y passent pas).
- Critique adverse (agent sans accès au raisonnement, recompte depuis `sorties/`) : comptes du brouillon confirmés à l'unité, sauf trois erreurs corrigées (dénominateurs des gardes ; « 35 retenus » pour 39 ; « 331 jugés » pour 331 justes). Reproches de fond repris au rapport : le verdict dépend du § 4 ; le plafond D-259 d'abord ; le prix complet ; la mesure M4 stricte (3 sur 3, borne 56 %) ; le coût sur les lots des fautes ; statique contre conjoint ; la fidélité du profil complet ; l'en-tête sur les parties lues.

## 9. Non vérifié
- Le temps dans le navigateur ; l'ordre réel d'écriture de la deuxième passe sous plafond ; la garde de voie sur les cuts retenus par la garde active.
- Limite commune aux deux rejeux statiques (le mien et l'indépendant) : la pose donnée à la règle est celle relue après l'écriture, alors que le service worker lui donnerait la pose attendue de la commande, avant écriture ; l'écart entre les deux n'est pas mesuré. Le banc conjoint, qui part de la pose commandée, rend les mêmes décisions sur les 10 fautes.
- Le rejeu conjoint sur les lots sans faute, où tombent 23 des 37 différés statiques (17 le 04/11) : le prix de bout en bout n'y est pas mesuré.
- Les motifs confidentiels d'identité (variable absente de cette session) : seuls les motifs publics ont été cherchés dans les fichiers versés.

## 10. Reproduire
```
node tools/ch099-rejeu.cjs decisions --lot LOT --echo ECHO… --etiquette NOM [--tranche i/n] --sortie F.jsonl
node tools/ch099-rejeu.cjs decisions --garde-reelle --lot LOT --echo ECHO… --etiquette NOM --sortie G.jsonl
node tools/ch099-rejeu.cjs juges --lot LOT --echo ECHO… --etiquette NOM --sortie J.jsonl --ecrire-verites V.jsonl
node tools/ch099-rejeu.cjs seconde-chance --temoin BANC.jsonl --rl BANC.jsonl --etiquette NOM --decisions F.jsonl… --verites V.jsonl --sortie SC.jsonl
node tools/ch099-rejeu.cjs synthese --decisions F.jsonl… --json synthese.json
python3 chantiers/CH-099/scripts/sorties.py DOSSIER_DE_TRAVAIL chantiers/CH-099/sorties
```
Essais : `node --test tests/ch099-rejeu.test.cjs` (7), `tests/juge-poses-faux.test.cjs` (5, repris de CH-100).
