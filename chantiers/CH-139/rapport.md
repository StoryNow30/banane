# CH-139 — lot A1 : la règle « branche » (écartée) et ce que l'ancre achète

**Méthode.** Rejeu fidèle du corpus de CH-116 (4 016 cuts, banc à zones de lot `BANC_ZONES=journal`, deuxième passe plafonnée à 10, profil L1-se), sans toucher à `src/` : les variantes sont des leviers du banc. Trois rejeux complets, même corpus, même banc.

| Rejeu | Ce qu'il allume | Différés | Justes ≤ 10 mm | 10–50 mm | > 50 mm | Fausses > 10 mm (total) |
|---|---|---:|---:|---:|---:|---:|
| `ch139-livre-zjp` — le livré | rien (ancre éteinte) | **564** | **506** | 36 | **29** | **65** |
| `ch139-N-zjp` — l'ancre | levier `ancre` (CH-124) | 596 | 508 | 36 | 0 | 36 |
| `ch139-sans-branche` | ancre + retrait du passage « branche » | **602** | **505** | 36 | 0 | 36 |

Les trois rejeux jugent 571, 544 et 541 poses (les cuts sans référence ne sont pas jugés). Total des cuts : 4 016 dans les trois.

## 1. La question du lot : « la passe ne pose plus sur `branche` »

**Réponse : écarté.** Le retrait supprime 12 décisions de la passe (non posées), mais il **coûte 6 différés de plus** (596 → 602) et **3 justes** (508 → 505), sans **aucune** erreur évitée : 5 justes perdues (0511/2005, 0511/4974, 0511/9335, 0411/170, 1211/5285), 0 fausse devenue différée.

Le terrain des 16 et 17/11 (6 poses « branche », 4 fausses de 26 à 50 mm) n'est donc pas reproduit par ce corpus : ici, bloquer « branche » fait perdre des poses justes et n'évite rien. **Le passage reste.** Les deux mesures ne se contredisent pas sur la même population : elles ne portent pas sur les mêmes lots ni sur le même état du code.

## 2. Ce que A1 a mesuré sans le chercher : l'ancre vaut 29 erreurs grossières

Écart entre le livré (ancre éteinte) et le même rejeu avec le levier `ancre` (CH-124) :

- **> 50 mm : 29 → 0.** Les 29 sont réparties sur quatre lots : 1111 (6), 1211 (13), 0611 (7), 0811b (3).
- 10–50 mm : 36 → 36, inchangé.
- Justes ≤ 10 mm : 506 → 508.
- Différés : 564 → 596 (**32 de plus**), soit 32 poses en moins.

Autrement dit : allumer l'ancre **diffère 32 cuts et supprime 29 poses à plus de 5 cm**, sans dégrader la tranche 10–50 mm. C'est le fait le plus lourd de ce lot, et il ne concerne pas « branche » : il concerne **A2** (l'ancre muette sur le terrain, D-357), qui décide de l'ordre du lot B. La question d'A2 n'est donc pas « l'ancre sert-elle ? » — au banc, oui — mais « **se tait-elle souvent sur les lots réels ?** » : quand N n'a pas de liste d'ESV, l'ancre ne protège rien.

## 3. Vérification du point de départ du plan

Le plan (`fiches/PLAN_ARIANE_6.md`, D-373) cite **571 → 603 différés, 29 → 0, 503 justes**. Le mesuré du 19/11 : **564 → 596 différés**, 29 → 0 confirmé, **506 → 508 justes**. L'écart (7 différés, 3 justes) vient de l'écriture de la passe changée par D-363 depuis les chiffres de D-357 — le point de départ d'Ariane 6 est `564` (livré) et `596` (avec ancre), pas `603`.

## 4. Ce que le banc ne juge pas

- Les cuts sans référence (3 265 au compteur) : aucune pose n'y est jugée.
- La justesse d'une décision « branche » isolée : ce qui est mesuré est l'effet du retrait sur le lot entier, pas la qualité de chaque décision.
- Pourquoi le terrain des 16–17/11 a vu 4 fausses sur 6 : cause non établie ; ce corpus-ci ne les reproduit pas.

**Pointers** : `banane-data/outils/analyse-lots/CH-139/sorties/` (`differentiel.md`, `differentiel.csv`, `resume.json`, `motifs-*.md`, `*-tableau.md`) ; scripts et protocole dans le même dossier (`mesure.cjs`, `rejeux.sh`, `rejeux-v18.sh`, `plafond-arret-v18.patch`, `NOTE.md`), rejouables depuis `/home/opencode/.ariane/tmp-CH-139/travail/`.
