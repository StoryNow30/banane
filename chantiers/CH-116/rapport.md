# CH-116 : corpus jugé et banc « GCV2.1 » (rapport, D-351)

Hors ligne, lecture seule, aucun fichier de l'extension touché. Outils : `outils/` (LISEZMOI). Sorties (numéros et millimètres seulement) : `sorties/`, à verser par l'intégrateur dans `banane-data/outils/analyse-lots/CH-116/`.

## 1. Corpus (ÉTABLI, `sorties/corpus.jsonl`, `sorties/resume.md`)
4 016 cuts posés ou différés par 25 lots-parties de 7 lots (04, 05 (examen), 06, 08/11 a et b, 11/11 p15-17, 12/11 p0, 1, 2, 23). 10/11 p9 et 12/11 p3, 4, 21, 22, 08/11 p5 et 7 : pas d'Écho joignable.

| | posés jugés | ≤ 10 | 10-50 | > 50 | différés jugés | corrigés | justes |
|---|---|---|---|---|---|---|---|
| corpus (sort réel du lot) | 545 | 479 | 36 | 30 | 247 | 231 | 16 |

Les 30 mauvaises voies sont toutes en zone ADV (06/11 : 7 ; 08/11 b : 3 ; 11/11 : 7 ; 12/11 : 13). Vérité = jointure `tools/jointure-echo-orbite.cjs` ; contrôlée contre `garde-gcv2 verite` sur 11/11 p17 : mêmes vecteurs au centième de mm, sauf 1675 (0,5 mm de plus en vertical : la jointure corrige la référence par l'écriture serveur, D-143). Non jugés : absent de l'Écho 2 619, visite trop courte ou sans référence 145, SKIP 17, posés sans décalage au journal 23 (deuxième passe surtout, dont 12/11 p23 5203 et 5209 comptés à plus de 50 mm dans les notes de la collection), D-285 437 (gardés dans le fichier avec leur classe, marqués `exclu: d285-…`, inclus au banc par `--avec-courtes`). Seuil de 1,5 s appliqué aussi aux visites sans action (choix de prudence : D-285 ne nomme que les validations).

## 2. Banc (`outils/banc.cjs`)
`rejouer` (patch et/ou variables, copie de HEAD hors dépôt, 25 lots-parties en ~15 min à 3 tâches), `juger` (tableau standard par lot, cuts changés contre une référence), `fidelite`, `croise` (validation croisée par lot ; examen sur 05/11 jamais vu au réglage). Essai : `tests/ch116-banc.test.cjs`. Rejeu du code livré (« livre ») contre le corpus : 561 posés jugés, 496 ≤ 10 mm, 36 de 10-50, 29 > 50 ; 591 différés ; 20 différés reposés justes, 1 faux (04/11 14/877) ; 4 bons bloqués.

## 3. Fidélité du rejeu livré au lot réel (ÉTABLI, `sorties/fidelite-livre.txt`)
Décisions identiques 3 963 / 4 016 (98,7 %) ; poses à 1 mm 3 312 / 3 403 (97,3 %). Les 53 décisions différentes :
- 28 cuts posés par la **deuxième passe livrée** (D-259 : étage `deferred`), que le banc ne joue pas par défaut. Rejouée (`livre-passe`, `BANC_LEVIERS={"deuxiemePasse":2,"passe2Leviers":{"sansVoieRien":true}}`), elle n'améliore pas la fidélité (98,4 %) : le banc n'a ni le plafond de 10 écritures ni l'arrêt au premier refus du service worker, et pose trop sur 11/11 p16 (405/421). Jugée, cette passe sans plafond repose 47 différés justes et 6 faux, et ajoute 1 posé à plus de 50 mm (`sorties/banc-livre-passe.md`). ÉTABLI ; à modéliser (plafond, arrêt) si un chantier règle la passe.
- 23 différés réels que le code d'aujourd'hui pose : 05/11 16 (p10 : 14), 04/11 5, 08/11 b 2. Cause SUPPOSÉE : code modifié depuis ces lots (Vision 5 à 15) ; non établie, le journal ne porte que « version 5 ».
- 2 posés réels que le rejeu diffère hors passe : 06/11 16/9166 (fenêtre), 08/11 b 6/281 (choix).
Poses différentes de plus de 1 mm : 82 (ADV 64, abords 12, PN 6), dont 18 de plus de 10 mm, presque toutes aux étages `deferred` ou `window` en ADV ; la plus grosse : 08/11 b 6/282 (160 mm, fenêtre au réel, première passe au rejeu).

## 4. Limites
- Corpus biaisé par le choix des cuts revus (l'opérateur suit la liste « verts à contrôler » sur 12/11 p23). 04/11 : 6 posés jugés seulement (Échos sans poses d'Ariane mémorisées).
- Le banc juge la pose L1-se du rejeu ; un cut posé au banc sans vérité n'est pas compté (« posés » contre « jugés »).
- Les captures réduites vivent hors dépôt (3,1 Go mesurés) : chaque session refait `extraire.sh` puis `preparer.cjs`.
