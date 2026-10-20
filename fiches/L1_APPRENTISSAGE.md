# Apprentissage de la GCV2 sur les Échos : décision L1-e des différés (test 14)

Chantier `claude/50-l1-apprentissage`, depuis `claude/50-l1-differes` (d7ff266, test 13). Demande de l'opérateur (20/10) : apprendre de toutes les erreurs de la GCV2 sur ses Échos, sans erreur de plus. Cadre accepté : classer chaque erreur par cause et corriger à la source (aucune mémorisation de cut) ; mesurer deux fois (sur 2:19, la partie dont l'erreur a été apprise, et hors apprentissage) ; aucune pose sans preuve dans le nuage ; paquet seulement si le chiffre hors apprentissage bat la test 13 sans dégrader la précision.

Les parties sont désignées par leur rang (« 2:19 » = projet 2, partie 19). Seuls des numéros de cut, des millimètres et des comptes figurent ici.

## En bref

| | 2:19 (dans l'apprentissage) | 2:11, 2:17, 2:18 (hors apprentissage) |
|---|---|---|
| Différés du lot, test 13 → test 14 | 202 → **22** (248 cuts) | 60 → **55** (484 cuts) |
| Différés réels jugés validés (test 13 → test 14) | 5 → **184** | 23 → **28** (2:17, 2:18) |
| dont à 10 mm au plus de l'opérateur | 0 → **182** | 19 → **25** |
| dont à plus de 10 mm | 5 → **2** | 4 → **3** |
| dont à plus de 50 mm (mauvaise voie) | 0 → **0** | 1 → **1** (le même cut, 2:17 cut 9556) |
| Poses sans validation (approchés) | 8 → **0** | 24 → **0** |
| Cuts posés par la chaîne changés | 0 | 0 |

Le gain est massif sur 2:19 et modeste ailleurs : le défaut appris (paires trop larges en ADV) domine 2:19 et n'apparaît que par endroits dans les autres parties. **Le zéro différé n'est pas atteint, même sur 2:19 (22)** ; sur le terrain, rien ne dit qu'une partie neuve ressemble à 2:19.

## 1. Constat : les erreurs de la GCV2 sur 2:19, cut par cut

Premier lot réel de la GCV2 (test 13, profil L1-s), partie 2:19, 248 cuts, contre l'Écho complet de l'opérateur (`tools/l1-diag-hypotheses.cjs` : toutes les hypothèses de chaque différé, à côté de la pose finale de l'opérateur ; 236 cas jugés, dont 33 par la pose du lot plus sa correction).

- **34 cuts validés par la GCV2** : corrigés par l'opérateur de 26,9 mm en médiane (q90 31,9, max 35,6), **tous sur le rail gauche, en travers, du même côté** ; le rail droit est juste à ± 1 mm. Aucune mauvaise voie.
- **191 refus « plus de 150 mm »** : la paire proposée était à 28,9 mm médians de l'opérateur, même biais (rail gauche, −29 mm en travers), probabilité médiane 0,30 (sous τ = 0,49). L'opérateur déplace le rail gauche de −203 mm et le droit de −135 mm depuis la pose d'ESV.
- **9 poses sans validation** : 8 restent à plus de 50 mm de l'opérateur (médiane 114,6 mm).

**Cause.** Aucune hypothèse du rail gauche ne tombe sur la pose de l'opérateur (la plus proche : 27,9 mm médians ; à 10 mm : 6 cas sur 203), alors que le rail droit est presque toujours trouvé (202 sur 203 à 10 mm). Les paires de la GCV2 sont **trop larges** : 1 455 à 1 470 mm, contre **1 433,5 mm** pour l'opérateur. Le contrat du moteur (1 420 à 1 470 mm) les laisse passer ; la médiane d'écartement des cuts que le lot vient de valider (1 465 mm) les confirme, parce que la chaîne du lot a fait la même erreur de 30 mm.

**Le même défaut ailleurs.** 2:17 (cuts 9643 à 9651) : rail gauche à 22 à 28 mm, écartement 1 465 à 1 470 mm contre 1 440 à 1 449 mm pour l'opérateur. 2:18 (cuts 195 à 198) : paires à 1 470 mm. 2:1 (cuts 373, 400, 424 à 429, 576, 577) : paires trop larges de 20 à 35 mm. Mais d'autres erreurs n'ont rien à voir : en 2:1 (cuts 295 à 306) et 2:17 (9527, 9556, 9557), la GCV2 choisit une autre voie (erreurs de 120 à 310 mm) parce qu'aucune de ses hypothèses n'est sur la voie de l'opérateur.

## 2. Où est l'écartement juste

Écartement final de l'opérateur (Échos) : médiane 1 433,5 (2:19), 1 436,4 (2:17), 1 436,5 (2:18) ; 80 % entre 1 430 et 1 447 mm. En ADV de 2:1 (sans liste d'ESV), 1 448 à 1 461 mm : **il n'y a pas d'écartement universel**.

Référence retenue : les **lignes valides de la liste d'ESV que personne n'a touchées dans la séance** (drapeaux 0 : ni vues ni traitées par l'opérateur ; ESV marque aussi les validations d'Ariane). Médianes : 1 433,8 (2:19), 1 434,3 (2:17), 1 435,5 (2:18), 1 434,0 (2:11). Les lignes touchées ne servent pas : en 2:19, les validées de la séance vont jusqu'à 1 465 mm (q90), avec l'erreur de la chaîne. Référence au cut : médiane des 20 lignes valides non touchées les plus proches (`src/gcv2-l1e.js`, `referenceEcartement`). Écart médian à l'opérateur : 3,5 à 8,4 mm selon la partie.

## 3. La règle L1-e (`src/gcv2-l1e.js`, profil du lot « L1-se »)

Sur la décision de la test 13 (mêmes hypothèses, mêmes probabilités, même paire, `deciderL1`) :

1. **anomalie** : l'écartement de la paire s'écarte de la référence de 15 à 40 mm (sous 15 mm : dispersion naturelle ; au-delà de 40 mm : autre chose qu'un rail mal placé) ;
2. **correction** : le rail le **moins probable** de la paire va en travers jusqu'à l'écartement de référence, **si le nuage le soutient à sa nouvelle place** (5 points de dessus, 3 de flanc, comme H6) : aucune pose sans preuve ;
3. « valider » (test 13) : validé, corrigé s'il y a anomalie soutenue ; « rien, plus de 150 mm » : validé **seulement** s'il y a anomalie soutenue ; « poser sans valider » : **rien** (plus de pose approchée : 52 % des approchés jugés sur les 10 parties restaient à plus de 50 mm de l'opérateur) ; tout autre « rien » : rien ;
4. sans instantané de la liste : la décision de la test 13, sans pose approchée.

La chaîne du lot, les cuts qu'elle pose, la vue déplacée et la règle « jamais appui ni voisin » (D-221) sont ceux de L1-s. Les seuils (15, 40, 20 lignes) viennent du diagnostic de 2:19 ; ils n'ont pas été cherchés sur les autres parties.

Code : `src/gcv2-l1e.js` (module pur), `src/gcv2-l1.js` (`deciderL1e`, `REGLE_E`, `soutienRail`, variante consignée dans `l1` : `correction`, `test13`), `background.js` (profil « L1-se », défaut ; instantané de la liste lu une fois par lot dans le stockage local), `tools/banc-differes.cjs` (profil « L1-se », `--liste`).

## 4. Essai écarté : une sélection apprise sur tous les Échos

Avant la règle, un modèle appris (`tools/l1-apprendre-ecartement.cjs`, modèle `tools/l1-apprendre-ecartement-modele.cjs`) : candidats = toutes les paires d'hypothèses et les mêmes ramenées à 1 435 mm ; régression logistique sur 19 traits (probabilités, écart à 1 435, rail ramené, soutien, zone, origines, concurrence) ; τ choisi par validation croisée interne (90 % à 10 mm, au plus 2 % de plus de 50 mm). Validation croisée par partie sur 10 parties jugées (515 différés) : **le seuil ne se transporte pas** (τ = 1 pour 9 parties sur 10 ; 2:1, jugée par un modèle appris sans elle : 39 poses, 9 mauvaises voies). Sur l'ensemble des cas, classés par score hors apprentissage : parmi les 60 premiers, 5 mauvaises voies, toutes en 2:1. Écarté : une sélection libre des paires refait les mauvaises voies de 2:1, et 1 435 mm n'est pas l'écartement de 2:1.

## 5. Mesures

### 5.1 Rejeu du code (banc conjoint, `tools/banc-differes.cjs rejouer --profils base,L1-s,L1-se --liste …`)

| Partie | Cuts | Différés réels | L1-s (test 13) : différés (approchés) | L1-se (test 14) : différés | Cuts de la chaîne changés |
|---|--:|--:|--:|--:|--:|
| 2:19 | 248 | 207 | 202 (8) | **22** | 0 |
| 2:17 | 139 | 41 | 30 (14) | **26** | 0 |
| 2:18 | 214 | 37 | 25 (7) | **24** | 0 |
| 2:11 | 131 | 12 | 5 (3) | **5** | 0 |

### 5.2 Contre l'opérateur (`comparer` : différés réels, pose de départ de l'Écho = celle du lot)

| Partie | Jugés | L1-s validés : ≤ 10 / > 10 / > 50 mm | L1-s approchés (> 50 mm) | L1-se validés : ≤ 10 / > 10 / > 50 mm | Laissés L1-s → L1-se |
|---|--:|---|--:|---|---|
| 2:19 | 205 | 5 : 0 / 5 / 0 | 8 (2) | **184 : 182 / 2 / 0** | 192 → 21 |
| 2:17 | 41 | 11 : 10 / 1 / 1 | 14 (6) | **15 : 14 / 1 / 1** | 16 → 26 |
| 2:18 | 32 | 12 : 9 / 3 / 0 | 5 (1) | **13 : 11 / 2 / 0** | 15 → 19 |

2:11 (6 différés jugés, fichier de jugés du diagnostic) : L1-s 6 poses, 3 à 10 mm ; L1-se 6 poses, 4 à 10 mm ; 0 de plus de 50 mm. Sur 2:19, avec les 33 cuts que la GCV2 a réellement posés (jugés par leur pose plus la correction de l'opérateur) : 215 poses de L1-se jugées, **215 à 10 mm au plus**, médiane 3,0 mm, 0 de plus de 50 mm (rejeu jugé par `tools/l1-diag-hypotheses.cjs`).

« Laissés » monte en 2:17 et 2:18 parce que les approchés de la test 13 redeviennent des différés ordinaires : le nombre de différés (laissés + approchés) baisse partout (2:17 : 30 → 26 ; 2:18 : 20 → 19 parmi les jugés).

### 5.3 Les 36 autres lots du banc (sans liste d'ESV dans leur export)

Sans instantané de liste, L1-se est L1-s sans pose approchée (essai `tests/banc-differes.test.cjs`, et par construction) : **mêmes différés, mêmes poses validées, mêmes erreurs** ; les 189 approchés du banc L1-s (`fiches/L1S_BANC_SYNTHESE.md`) restent des différés au lieu d'être déplacés. Dans ESV, l'extension 4.9.5.8 et plus garde l'instantané : la correction s'appliquera sur le terrain, mais **elle n'a pas été mesurée sur ces parties**, en particulier sur 2:1, où l'écartement de l'opérateur en ADV (1 448 à 1 461 mm) est loin de 1 435 mm.

## 6. Ce qui reste différé, et pourquoi

Motifs des différés de L1-se au rejeu (décision de la test 13 sur le même cut, puis la correction) :

| Partie | Différés | Sous τ (ex-approchés) | « Plus de 150 mm » sans anomalie | « Plus de 150 mm », anomalie non soutenue par le nuage | Départ le plus probable | Sous δ | Sans nuage |
|---|--:|--:|--:|--:|--:|--:|--:|
| 2:19 | 22 | 8 | 3 | 4 | 6 | 0 | 1 |
| 2:17 | 26 | 14 | 4 | 0 | 8 | 0 | 0 |
| 2:18 | 24 | 7 | 5 | 3 | 7 | 2 | 0 |
| 2:11 | 5 | 3 | 0 | 0 | 1 | 1 | 0 |

Les cuts « sous τ » étaient posés sans validation par la test 13 (approchés) ; ils restent rouges, à la pose de départ d'ESV. Les « plus de 150 mm » sans anomalie sont surtout ceux où aucune hypothèse n'est sur la voie de l'opérateur (2:17 : 9528, 9552 ; erreurs de 50 à 240 mm si on les posait) : la règle ne les touche pas, c'est voulu.

## 7. Vérifications

- Prédictions scellées (2:17, 2:18, 2:19 ; `scelle` et `scelle-copie`) : empreintes inchangées.
- Cuts posés par la chaîne : 0 changé sur les quatre lots rejoués.
- Essais : `tests/gcv2-l1e.test.cjs` (référence, correction, soutien exigé, décision, sans liste = L1-s sans approché), `tests/lot-profil-l1se-sw.test.cjs` (service worker : variante L1-e, référence lue dans l'instantané, aucune pose sans validation), profils L1-s et L1-se dans les essais de chaîne, de vue et de validation, `tests/banc-differes.test.cjs`.
- verify (cœurs 0 et 1) : 2 430 essais, 2 428 réussis, 0 échec, 2 ignorés (corpus natif absent) ; moteur identique à la base V4.6.0, géométrie inchangée.

## 8. Limites

- Les seuils viennent de 2:19 ; hors apprentissage, 3 parties seulement ont une liste d'ESV (2:11, 2:17, 2:18) et le gain y est modeste (+5 poses justes, différés 60 → 55).
- La référence suppose que les lignes valides non touchées sont justes ; une partie où l'extraction d'origine serait fausse donnerait une fausse référence.
- L'écartement de l'opérateur n'est pas fixe (ADV de 2:1 : 1 448 à 1 461 mm) : la correction peut y tirer une paire juste vers une fausse place, si l'écart dépasse 15 mm. Non mesurable sans liste ni Écho de cette zone.
- La mauvaise voie de 2:17 cut 9556 (test 13 comme test 14) n'est pas corrigée : aucune hypothèse n'est sur la voie de l'opérateur.

## 9. Paquet

`ariane-4.9.5-test.14.zip` (construit par `tools/package.py` sur 49a2c60) : 2 580 393 octets, SHA-256 `ff9030ae614ea7b9dd53949f46efd2a2eea10b93528b95af23e67ab14362765a`, manifeste 4.9.5.14, « 4.9.5 test 14 (L1-e) », CRC valide. Consigne : `consignes/seance-terrain-4.9.5-test-14-2026-10-20.md`.
