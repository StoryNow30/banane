# CH-099 : plan fermé, écrit et commité AVANT tout calcul (10/11/2026)

Étude hors ligne (D-322). Aucun fichier de l'extension n'est modifié. Rien n'a été calculé ni lu dans les données au moment où ce plan est commité : la liste ci-dessous est fermée. Toute mesure hors liste sera écrite au rapport sous le titre « hors plan » et ne comptera pas pour le verdict.

## 1. Outils figés (lus, jamais modifiés)
- `src/recherche-large.js`, empreinte SHA-256 `70f4b0bb6f311947…` (tronc `abdf63f`).
- `tools/banc-differes.cjs`, empreinte `5acf0aeab96826c6…`, option `--recherche-large`.
- Script d'analyse propre au chantier : `tools/ch099-rejeu.cjs`, essai `tests/ch099-rejeu.test.cjs` (données synthétiques). Sorties par cut hors dépôt (`banane-data/outils/analyse-lots/CH-099/`) : numéros de cut et millimètres seulement.

## 2. Règle et variantes (liste fermée : 3)
Règle de CH-034, mode `differer`, telle quelle : `porteeMm:400, pasMm:120, loinMm:50, rapport:1.5, presMm:15, cellulesMax:12, zones:null, passe:true, sansPaireLoin:true, soutienFace:0, grainesMode:'grille'`.

| Variante | `soutienTop` | Rôle |
|---|---|---|
| S0 | 0 | règle examinée par CH-034 |
| **S60** | 60 | **variante du verdict** (valeur du réglage au tronc, recommandée pour le terrain par CH-034 § 5) |
| S90 | 90 | sensibilité |

Aucun autre seuil n'est touché. Modes `choisir` et `choisir-sur`, graines `pics`, règle du protocole (`sansPaireLoin:false`) : non rejoués. Une seule lecture par variante et par population ; aucun réglage sur ces données.

## 3. Populations (toutes en apprentissage, D-322 ; cuts choisis par l'opérateur : biais dit en tête du rapport)
- F08 : les 3 mauvaises voies du 08/11. Préalable : la capture de chacun couvre ±400 mm en travers (étendue latérale des points par rail, mesurée) ; sinon le cut est « non rejouable ».
- F06 : les 7 fautes et les 108 jugés du 06/11.
- F04 : les 4 poses fausses en PN/ADV des 04 et 05/11.
- C05 : les 229 posés jugés du 05/11 (coût).
- Les témoins du manifeste (`datasets/manifeste-parties.json`) ne sont jamais lus ; l'outil refuse une partie réservée.

## 4. Définitions (figées)
- Écart d'une pose : distance 3D à la pose finale de l'opérateur, pire rail. **Faute** : plus de 50 mm. **Juste** : 10 mm au plus. Entre les deux : « moyenne », comptée à part.
- Chaque mesure est donnée deux fois : avec et sans les lignes « visité sans action ». Les validations sans mouvement de moins de 1,5 s sont écartées (D-285).
- **Série** : fautes consécutives d'une même partie, séparées par 2 cuts au plus. Une série est « rejouable » si la capture d'au moins une de ses fautes est disponible et couvre ±400 mm. Une série est « différée » si toutes ses fautes rejouables le sont.
- « Nuages trop pauvres » : la décision rend `aucune-paire-forte` pour plus de la moitié des fautes rejouables (variante S60).
- Intervalles : Wilson à 95 % (formule de `tools/juger.cjs`).

## 5. Mesures (liste fermée)
- M1. Par faute, par série et par variante : décision de la recherche large sur la pose réellement validée par le lot (état, motif, écart de la meilleure paire à la pose et à la vérité).
- M2. Par faute et par série : signalée ou non par chacune des trois gardes en ombre : garde « après un différé » (R3, `coupures:2, appuisMin:2`), grappe (`grappe-differes` des règles métier), garde de voie (`seuilMm:15, fenetre:20, voisinesMin:5`). Source : l'événement d'ombre du journal du lot quand il existe ; sinon le module du tronc rejoué sur l'état du journal, et la ligne est marquée « rejouée ». Puis l'union recherche large ∪ gardes, et l'apport propre de chacune.
- M3. Coût : poses jugées justes différées (F06 : 108 jugés ; C05 : 229 jugés) par variante ; part des posés différés sur tous les posés des lots rejoués (jugés ou non).
- M4. Seconde chance : sur les cuts différés par la variante, ce que posent la deuxième passe (rejeu `banc-differes`, profil L1-se, 2 passes, levier branché) et B1-écart (événement d'ombre du journal, sinon rejeu) : justes à 10 mm, faux (10 à 50 mm), plus de 50 mm, sans pose ; borne de Wilson ; avec et sans « visité sans action ». Si l'état du lot manque pour rejouer la passe sur une population, c'est écrit « non rejouable », sans substitut.
- M5. Contrôle de fidélité du rejeu : écart entre la pose rejouée (profil base) et la pose du journal sur les cuts rejoués (médiane, maximum).

## 6. Verdict (seuils du ticket, variante S60, fautes à plus de 50 mm rejouables de F08 + F06 + F04)
- **Non concluable** : moins de 3 séries rejouables.
- **Abandon** : moins de la moitié des fautes différées, ou plus de 8 % des posés différés (M3, tous posés), ou nuages trop pauvres (§ 4).
- **Candidat pour l'ombre** : au moins 70 % des fautes différées (7 sur 10 au ticket) ET moins de 8 % des posés différés.
- Entre les deux : « ni candidat ni abandon », écrit tel quel.
- S0 et S90 sont rapportées à côté, sans changer le verdict. Tout résultat est PROBABLE au mieux (plus de partie d'examen vierge, D-322).

## 7. Contrôle avant de conclure
Rejeu indépendant de M1 par un second agent à partir du plan seul (mêmes entrées, script écrit sans lire le premier) : les décisions par cut doivent coïncider ; puis critique adverse du rapport (effectifs, dénominateurs, lignes « visité sans action », séries) avant envoi.
