# Partie 0 du projet 3 : examen à réglages figés, puis apprentissage (D-224)

Branche `claude/50-apprentissage-3-0`, depuis `claude/50-test16` (75b47fd, test 16 livrée et figée). Aucun fichier de `src/` n'est modifié : ni le moteur, ni la v5, ni un réglage. Les parties sont désignées par leur rang (« 3:0 » = partie 0 du projet 3). Seuls des numéros de cut, des millimètres et des comptes figurent ici.

## En bref

- **Première mesure hors échantillon de la v5** (D-222 : le chiffre hors apprentissage est publié). Partie 3:0, lot de la test 15 rejoué avec les réglages livrés de la test 16 (`LEVIERS_LIVRES`, `BANC_LEVIERS` vide) et avec le témoin v4 (`LEVIERS_V4` entier), contre la vérité des deux Échos.
- La v5 **laisse moins de cuts sans pose que la v4 (18 → 15)** et **pose plus juste** (médiane 16,5 → 6,3 mm ; 6 → 14 poses à 10 mm ou moins). Mais **4 de ses 22 poses jugées sont à plus de 50 mm** (6 pour la v4), de 156 à 217 mm, toutes en ADV (les 22 poses jugées le sont). Le budget de D-223 (pose à plus de 50 mm : 3 % au plus) n'est **pas tenu** sur cette partie (4 sur 22, intervalle de Wilson 7,3 à 38,5 %). Sans la liste d'ESV (l'autre borne du rejeu) : 30 → 26 cuts sans pose, 16 poses jugées dont 9 à 10 mm ou moins et 3 à plus de 50 mm.
- Cet examen ne dit **rien** de la justesse globale des verts posés par la chaîne : seuls les cuts qui ont une vérité sont jugés (voir « Périmètre »).
- La partie passe en apprentissage sur ordre de l'opérateur expert (D-224), **après** l'examen. Aucun réglage n'a été changé d'après ce résultat ; les cuts restants sont listés plus bas pour la recherche de la semaine.

## 1. Données

| Pièce | Contenu |
|---|---|
| Lot de la test 15 (20/10, 21 h 06 Paris), 9 volumes | départ de partie 19 h 07 (9 064 validés, 336 invalides) ; 337 cuts au journal (336 cuts du lot et le cut 0, artefact de rechargement) ; 308 posés (dont 30 par la GCV2 du lot), 28 différés |
| Premier Écho (21/10, 8 h 26 à 8 h 33), 2 zips | 41 visites, 39 cuts ; fait sur les cuts restés rouges |
| Second Écho (21/10, 8 h 37 à 9 h 05), 8 zips | 543 visites, toute la partie ; verts compris |

SHA-256 des 9 + 2 + 8 archives : tous conformes à leurs `SHA256SUMS`.

**Segments 2 et 3 du second Écho, non reçus.** La numérotation passe de 1 (export final) à 4 puis 5 à 13. Mesuré : (1) les **543 visites annoncées sont toutes présentes** (543 enregistrements distincts, 18 705 événements dans l'export final, qui contient toute la session) ; (2) les 584 enregistrements des deux Échos sont distincts (aucune visite en double entre les deux sessions ; les 540 enregistrements répétés entre les envois automatiques du second Écho sont fusionnés par `recordId`, le segment le plus récent l'emporte) ; (3) ce qui manque ce sont des **nuages** : 641 des 2 234 nuages déclarés (28,7 %), qui appartiennent à 91 des 113 premières visites (8 h 37 min 50 s à 8 h 43 min 04 s). **La vérité ne dépend pas des nuages** (elle vient des poses de l'enregistrement de visite) : sur ces 91 visites, 13 portent une validation humaine, leur référence est lue normalement. Les nuages manquants ne gênent que d'éventuelles analyses sur ces 91 visites.

## 2. Jointure Écho ↔ Orbite

`tools/jointure-echo-orbite.cjs --echo <Écho 1> <Écho 2> --journal <journal> --partie 0` (base `auto`). Les deux Échos sont joints ensemble (deux sessions, 36 cuts vus dans les deux : visites rangées dans l'ordre du temps, la référence est la dernière validation dans le temps). Repère de scène : une seule translation, résidu nul sur 364 rails.

| Classe au journal | Cuts du journal | Cuts vus en Écho | Avec référence, **sans** la règle | Avec référence, **avec** la règle | Écart par cut sans la règle : médiane / P90 / max (mm) | > 5 mm / > 10 mm (cuts) |
|---|---:|---:|---:|---:|---|---|
| posée | 308 | 182 | 31 | 129 | 13,3 / 165,6 / 216,7 | 26 / 21 |
| différée | 28 | 28 | 25 | 26 | 200,7 / 232,9 / 242,3 | 25 / 25 |
| autre (cut 0) | 1 | 1 | 0 | 0 | | |
| hors journal (cuts hors du lot) | | 300 | 39 | 156 | 5,0 / 20,6 / 170,3 | 19 / 7 |
| **Total** | 337 | 511 | **95** | **311** | | |

Avec la règle « visité sans action = bon » (`--visite-sans-action-bonne`, 0,8 s, coupée par défaut, **non appliquée à la vérité principale**) : 216 cuts comptés à correction nulle (98 posés, 117 hors journal, 1 différé) ; restent sans référence 7 cuts déplacés sans validation, 192 visites trop courtes, 1 hors cut. Écarts par cut avec la règle : posées 0,0 / 16,0 / 216,7 (129 cuts), hors journal 0,0 / 5,5 / 170,3 (156). Les corrections à plus de 5 et 10 mm ne changent pas (la règle ajoute des corrections nulles).

Premier Écho seul (contrôle) : 39 cuts, 37 joints (10 posés, 27 différés), 2 hors journal ; 9 + 25 références ; mêmes valeurs pour les différés.

**Sur les 28 différés du panneau** : 25 ont une vérité (validation). Les trois autres : 862 et 884 (rails déplacés sans validation ; étiquettes de l'Écho « PASS_NO_DECISION » et « SKIP »), et 1461, un cut visité sans action dont l'écartement de départ à l'Écho diffère de celui du lot de plus de 2 mm (1461 : il n'entre pas dans le repère du lot). Le cut 0 n'est pas un cut.
**Sur les 336 cuts du lot** : vérité pour **56** (25 rouges + 31 verts) avec les seules validations, **154** (25 + 129) avec la règle. Les 126 verts du lot jamais visités et les 51 visites trop courtes n'ont **pas** de vérité. Un vert visité sans correction ne vaut « bon » que dans le jeu « avec la règle ».

**Ce que l'Écho ne couvre pas.** « Presque toutes les corrections » est exact pour les rouges (25 sur 28) mais pas pour les verts : 126 verts sur 308 n'ont aucune visite, 51 visites sont trop courtes, 2 verts sont déplacés sans validation. Les 300 cuts hors du lot que l'opérateur a relus ne servent pas à l'examen (le lot n'a pas décidé sur eux). Ambiguïté : les notes de l'opérateur citent comme « non visités » les cuts 26, 146, 212, 250, 296, 602 ; ils ont pourtant une visite dans le second Écho (et ne sont pas des cuts du lot, 296 et 602 y sont corrigés). La note vise vraisemblablement la liste de relecture, non l'Écho ; ces cuts n'entrent de toute façon pas dans l'examen. Les notes de l'opérateur concernent la relecture (cuts verts à contrôler), pas la précision de pose de la v5 ; elles ne sont pas utilisées ici.

## 3. Vérité (`verite-3-0.json`)

Même format que les vérités des autres lots : `{cut: {mic: {left: [x, latéral, vertical], right: [...]}, src}}`, en millimètres dans le repère profil de la **pose de départ du lot**. Fabriquée par un script hors dépôt (variante de `verite.cjs` des lots précédents) à partir de `micDepuisEcho` (même règle de référence que l'Écho) :

- cut rouge du lot : le départ de l'Écho est le départ d'ESV ; la vérité est la correction de l'Écho, retenue si l'écartement de départ coïncide à ± 2 mm (`src: echo`) ;
- cut vert (posé par le lot) : le départ de l'Écho est la pose d'Ariane ; la vérité est la pose réelle du lot plus la correction de l'Écho (`src: echo-pose-reelle`), toujours, sans test d'écartement ;
- **jeu principal `verite-3-0.json`** : validations humaines observées seulement (**56 cuts** : 25 rouges, 31 verts). **Jeu `verite-3-0-avec-regle.json`** : le même plus les cuts visités sans action (**154 cuts** : 25 rouges, 129 verts). Les deux jeux sont toujours donnés séparément ;
- aucune vérité n'est inventée pour un vert non visité, trop court ou déplacé sans validation.

Recoupement : les 154 cuts du jeu large, recalculés à part depuis la table de jointure (déplacement d'Ariane + écart humain), concordent à 0,01 mm près sur 308 rails.

## 4. Examen à réglages figés

**Réglages.** Code : `claude/50-test16` (75b47fd), `src/` strictement identique. Chaîne v5 : `LEVIERS_LIVRES` de `src/gcv2-l1.js` (= `LEVIERS_V4` + `LEVIERS_V5`), `BANC_LEVIERS` vide, comme la chaîne livrée `a3-bd3s`. Témoin v4 : `BANC_LEVIERS` = `LEVIERS_V4` entier (test 15). Banc : `tools/banc-differes.cjs rejouer`, profils `base,L1-se`, paramètres `gcv2-parametres-h6.json`, liste d'ESV du volume 1, comme `run1.sh`. L'outil n'a reçu qu'un changement de ligne de commande pour accepter la partie 0 (voir § 7). Jugement : `juger.cjs L1-se` (les poses du profil que la chaîne ne faisait pas déjà, contre la vérité). La partie était réservée au moment de l'examen (absente du manifeste) ; le mode `rejouer` ne consulte pas le manifeste, le jugement s'est fait sans régler.

**Fidélité du témoin v4 au lot réel.** 307 des 308 poses du lot réel sont retrouvées à 1 mm près par le rejeu v4 (278 poses de la chaîne, 29 sur 30 poses de la GCV2). En revanche le rejeu v4 laisse **18 cuts sans pose, contre 28 rouges au lot réel** : il pose en plus 10 cuts que le lot réel avait laissés (770, 771, 773, 833, 837 à 840, 847, 848 : chaîne refaite ou vue élargie, 7 cuts, et GCV2, 3 cuts). Le témoin v4 est donc plus généreux que la test 15 réelle. La liste d'ESV du volume 1 est un instantané pris **après** le lot (20 h 27, 28 invalides), non la liste du chargement de partie, qui n'est dans aucune archive : voir la sensibilité à la liste ci-dessous.

**Périmètre : ce que l'examen peut juger.** Les cuts qui ont une vérité d'Écho (56, ou 154 avec la règle sur 336), et parmi eux les poses que la v5 ou la v4 ajoutent à la chaîne (43 et 40 poses ajoutées, dont 22 et 20 jugées avec les seules validations, 30 et 28 avec la règle). **Ne peut pas juger** : les 126 verts non visités ; la justesse des verts posés par la chaîne (la chaîne est identique en v4 et en v5, 0 vert changé ; seule une partie des verts a été revue, et sans tirage au hasard : ne pas lire un pourcentage « à 10 mm » comme une justesse globale) ; les cuts sans vérité (13 poses ajoutées par la v5 n'en ont aucune, dont le cut 1461). Cuts à nuage vide : aucun (337 captures retrouvées, 0 nuage vide).

### Tableau (jeu principal : validations seules)

| | v4 (test 15) | v5 (test 16) |
|---|---:|---:|
| Cuts laissés sans pose (sur 337) | 18 | **15** |
| Poses ajoutées à la chaîne | 40 | 43 |
| Poses jugées | 20 | 22 |
| à 5 mm ou moins | 2 | **8** |
| à 10 mm ou moins | 6 | **14** |
| de 10 à 20 mm | 7 | 4 |
| à plus de 20 mm | 7 | 4 |
| à plus de 50 mm | 6 | **4** |
| mauvaise voie (> 100 mm en travers) | 6 | **4** |
| médiane (mm) | 16,5 | 6,3 |
| verts de la chaîne changés | 0 | 0 |

Avec la règle « visité sans action = bon » (jeu large), à part : poses jugées 28 (v4) et 30 (v5) ; à 5 mm ou moins 10 et 16 ; à 10 mm ou moins 14 et 22 ; de 10 à 20 mm 7 et 4 ; à plus de 20 mm 7 et 4 ; à plus de 50 mm 6 et 4 ; mauvaise voie 6 et 4 ; médiane 10,1 et 4,3 mm. Les poses à plus de 50 mm sont les mêmes : la règle n'ajoute que des cuts posés à 0 mm de la vérité.

Par origine (jeu principal) : sur les cuts que le lot réel avait laissés rouges, v4 10 poses jugées (2 à 5 mm, 6 à 10 mm, 2 à plus de 50 mm) ; v5 13 (4, 10, 1 à plus de 50 mm). Sur les cuts que la GCV2 du lot réel avait posés, v4 10 (aucune à 10 mm ou moins, 4 à plus de 50 mm) ; v5 9 (4 à 10 mm ou moins, 3 à plus de 50 mm).

Lecture : l'effectif est petit (22 poses), l'intervalle de Wilson sur 4 poses à plus de 50 mm va de 7,3 à 38,5 %. Aucune mesure précédente de la v5 n'était hors échantillon ; sur les neuf lots de réglage elle avait 0 pose à plus de 50 mm. Ici la v5 a **4 poses fausses de plus de 150 mm sur 22 jugées**.

### Sensibilité à la liste d'ESV (mêmes réglages, mêmes vérités, jeu principal)

Le rejeu sans liste est l'autre borne : v4 sans liste retrouve 294 poses réelles sur 308 (14 poses de la GCV2 du lot réel, qui dépendent de la liste, y manquent : 17, 496, 772, 774 à 779, 794, 797, 842, 869, 1459) et laisse 30 cuts sans pose (le lot réel : 28 rouges) ; v4 avec liste en retrouve 307 sur 308 mais pose 10 rouges de plus. Le lot réel est entre les deux, et on ne sait pas où.

| | v4 sans liste | v5 sans liste |
|---|---:|---:|
| Cuts laissés sans pose | 30 | 26 |
| Poses jugées (validations seules) | 12 | 16 |
| à 5 mm ou moins / à 10 mm ou moins | 2 / 8 | 3 / 9 |
| de 10 à 20 mm / à plus de 20 mm | 1 / 3 | 4 / 3 |
| à plus de 50 mm (mauvaise voie) | 3 (846, 847, 848) | **3 (846, 847, 848)** |
| médiane (mm) | 6,4 | 8,2 |
| verts de la chaîne changés | 0 | 0 |

Avec la règle (jeu large) : v4 17 poses jugées, 12 à 10 mm ou moins, 3 à plus de 50 mm ; v5 21, 13, 3. **Dans les deux conditions la v5 garde des poses fausses de plus de 150 mm en ADV** (846 et 847 dans les deux ; 848 sans liste, 794 et 869 avec liste), et le gain de la v5 sur la v4 est modeste sans liste (30 → 26 cuts sans pose ; poses à 10 mm ou moins 8 → 9).

### Les poses à plus de 50 mm de la v5 (jeu principal, avec liste)

| Cut | Erreur v5 (mm) | v4 | Ce que le rejeu montre (sans réglage) |
|---|---:|---:|---|
| 794 | 156 | 146 | ADV ; pose du lot réel (GCV2) de l'autre côté de la voie : la recherche recentrée (« remplace ») garde une paire à 82 mm au lieu de la voie de l'opérateur à −74 mm |
| 846 | 161 | 161 | ADV ; pose du lot réel (GCV2) conservée telle quelle : paire H1+H2 validée (p = 0,63) à 26 mm alors que l'opérateur est à 187 mm |
| 847 | 211 | 211 | ADV ; cut laissé rouge par le lot réel, posé par le rejeu aux positions de départ (hypothèse H0+H1+H2, p = 0,81) alors que l'opérateur déplace les deux rails de 205 à 219 mm |
| 869 | 217 | 217 | ADV ; pose du lot réel (GCV2) à −110 mm quand l'opérateur est à +107 mm, étiquette « sous-tau cohérent » |

Autres poses de la v5 entre 10 et 20 mm : 840 (10,1), 842 (11,3 ; v4 : 173), 858 (11,6), 859 (15,6). Les cuts 842 (173 → 11) et 772 à 776 (14 à 17 → 2 à 4) sont corrigés par la v5 ; 797 (22 en v4) et 848 (283 en v4) sont laissés sans pose.

Dans la zone 833 à 870 (ADV), l'opérateur déplace presque tous les cuts de 100 à 240 mm en travers : le départ d'ESV y est faux sur toute la zone, et les voisins posés par la chaîne ou la GCV2 y propagent la même erreur. Les verts faux de la chaîne vus dans l'Écho y sont aussi : 843, 861, 864, 867 (125 à 166 mm d'erreur), que la v5 ne touche pas.

### Les 15 cuts que la v5 laisse sans pose

| Cut | Vérité | Motif du moteur | Cause apparente (sans réglage) |
|---|---|---|---|
| 116, 663, 866, 884 | oui (884 : non) | `depart-le-plus-probable` | l'hypothèse la plus probable est la pose de départ d'ESV, alors que l'opérateur déplace les rails de 114 à 141 mm (116, 663, 866 ; abords pour 116 et 663, ADV pour 866 et 884) ; 884 n'a pas de vérité |
| 222, 448 | oui | `plus-de-150-mm` | la paire la plus probable est à plus de 150 mm du départ : refus ; l'opérateur est à 132 et 144 mm (abords) |
| 229, 598, 844, 845, 865, 870, 862 | oui (862 : non) | `sans-approche` | aucune approche du rail trouvée au-dessus du seuil ; abords (229, 598 ; opérateur à 128 et 101 mm) ou ADV (844, 845, 865, 870, 862 ; opérateur à 242, 241, 211, 141 mm ; 862 sans vérité) |
| 797, 848 | oui | `recherche-adv-contredite-rien` | la recherche recentrée contredit la pose existante et ne trouve pas de paire : rien. (v4 : 797 à 22 mm, 848 à 283 mm) |

Aucun n'a de nuage vide. Les cuts 841, 853, 858, 863 (sans pose en v4) sont posés par la v5 à 6, 6, 12, 4 mm.

## 5. Ce qui reste hors Écho, limites

- Les 126 verts du lot jamais visités et les 51 visites trop courtes n'ont pas de vérité ; la vérité des verts attend le contrôle complet de la partie par l'opérateur (un second Écho sur toute la partie est déjà arrivé, mais la visite n'est pas exhaustive).
- La liste d'ESV du banc est l'instantané de 20 h 27, après le lot ; la liste du lot réel est inconnue. Les résultats sont donnés avec et sans liste (§ 4) ; le chiffre principal est avec la liste, comme `run1.sh`.
- Vérité des verts posés par le lot : pose réelle du journal plus correction de l'Écho ; elle suppose que l'Écho part de la pose d'Ariane (contrôle de repère de la jointure : 0 mm sur les 31 verts corrigés).
- Les 22 poses jugées sont **toutes en zone d'ADV** (cuts 770 à 869) : aucune pose des abords n'est jugée (8 cuts des abords ont une vérité : 6 rouges, laissés sans pose par les deux versions, et 2 verts de la chaîne, 463 et 473). L'examen ne dit rien de la v5 hors ADV. Ne pas généraliser à une partie sans ADV, ni à l'inverse.
- Les 13 poses sans aucune vérité ne sont pas jugées.
- Le full `verify` (20 min) n'a pas été lancé ; seuls les essais qui lisent le manifeste, le banc et les réglages figés l'ont été (§ 7).

## 6. À rechercher (sans y toucher ici)

Les quatre poses à plus de 50 mm en ADV (794, 846, 847, 869), les verts faux de la chaîne dans le bloc 833 à 870, et les 15 cuts sans pose. Une recherche qui toucherait ces cuts relève du chantier d'apprentissage de la semaine, jugée contre le second Écho complet et les autres parties.

## 7. Passage en apprentissage (D-224)

- `datasets/manifeste-parties.json` : bloc `{projet: 3, parties: [0], date: 2026-10-21, decision: D-224}`, après l'examen. La date générale du fichier (2026-10-19) n'est pas changée.
- `tools/manifeste-parties.cjs` : le numéro de partie accepte 0 (entier naturel ; le projet reste strictement positif), `lireDesignations('3:0')` aussi. `tools/banc-differes.cjs` : `--partie 3:0` accepté et test de présence de la partie (`!a.partie` refusait 0). `tests/manifeste-parties.test.cjs` : le cas `1:0`, qui devait échouer, devient `1:-1` et `1:00` ; un essai vérifie l'état de 3:0. D'autres outils refusent encore `--partie 3:0` par la même expression (`l1-diag-hypotheses.cjs`, `gcv2-predire-differes.cjs`, `diag-differes.cjs`) : à adapter quand ils serviront à cette partie.
- Essais lancés : `manifeste-parties`, `gcv2-apprendre`, `reglages-figes`, `banc-differes`.
