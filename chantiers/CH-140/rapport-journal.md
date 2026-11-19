# Rapport d'analyse du journal — lot du 18/11/2026 (Vision 20, build a19c5ed5)

**Périmètre.** Parties 6 à 15, 10 lots, journal v4 (104 346 événements, 839 records, 65 types).
Lots automatiques : 08:21:44 → 09:14:30 (heure de Paris, UTC+1) ; relecture jusqu'à 09:34:55 ;
correction opérateur 09:48:05 → 10:57:42. Base normale définie : médiane des écarts entre événements
du même type (ex. `validation-accepted` médiane 1 450 ms ; `adapter-progress` médiane 10 ms).
Comparaison : NOTES.md du lot 17/11 (Vision 19.1). Aucune donnée de terrain ci-dessous (ni UUID,
ni coordonnée géographique, ni nom) ; seuls des numéros partie/cut et des mesures en mm sont cités.

**Bilan mesuré (ÉTABLI).** 776 poses confirmées (776 écritures HTTP 204, toutes « rattachee »),
31 différés dont 15 écrits par la seconde passe → **16 différés non résolus en fin de session**.
Relecture : 2 608 relus, 267 corrigés, **0 refusé**, 2 577 marqués « vu ». `closureSummary`
(211 complets / 8 différés) ne décrit que le **dernier lot** (partie 15) à la clôture, pas la session.
Aucune double écriture (aucun partie/cut avec >1 `applied-verified` ou >1 `validation-ecriture-observee`).
Adapter : 0 erreur ; Rust/LiDAR : 6 862 captures toutes servies, 0 repli, 0 tranche rejouée.
Export timing : `status=flushed`, `flushComplete=true`, `pendingWrites=0`, `lost=0`, snapshot cohérent.

## Tableau des défauts potentiels

| # | Défaut potentiel | Preuve (type d'événement, fenêtre, compte) | Échantillon | Gravité | Confiance |
|---|---|---|---|---|---|
| 1 | **Validations acceptées sur preuve de navigation seule, état après non relu** | `validation-accepted` : 767/776 `validationProof=navigation-only`, `afterStateStatus=AFTER_STATE_MISSING_BECAUSE_TARGET_CHANGED`, `serverConfirmed=false` à l'acceptation ; `closureSummary.withoutFinalState=767`. Écriture confirmée à part (776×204, `withoutServerConfirmation=0`). Lots auto 08:21–09:14 | 776 validations | gênant (structurel) | ÉTABLI (mesure) / PROBABLE (risque) |
| 2 | **Clics d'application hors-canevas systématiques (mode tel-quel)** | `clic-hors-vue` 45 événements, `action=apply`, `mode=tel-quel`, `raison=hors-canevas` ; `clic-hors-vue-bilan` total **758** sur 9 lots (partie 15 : 207 pour 211 poses). Cible projetée loin hors canevas (ndc jusqu'à −7,5), repli « lecture rapide / chemin directe » | 9 lots, 758 clics | gênant (fragilité) | ÉTABLI |
| 3 | **Changements de partie refusés en 1re tentative (compteur ESV incomplet)** | `file-parties-changement` : 6 `issue=refus` sur 9 (« il reste des cuts à valider, N traités sur N+k »), repris en 2e tentative (`suivant-dernier`), +10 s chacun. Corrélé à `esv-observation kind=diag-compteur-bloque` ×120 (08:27–09:34, `cuts=3`) | 9 changements, 6 refus | gênant (friction, gérée) | ÉTABLI |
| 4 | **Garde-voie ombre : 3 écartements >15 mm validés sans pause** | `garde-voie-ombre` `auraitPause=true` : 7/92 (18,7 mm), 12/4501 (21,3 mm), 15/9682 (15,4 mm) ; ces 3 coupes ont `validation-accepted/VALIDATE` + `applied-verified` (garde en mode ombre, non bloquante) | 3 / 777 | gênant (bloquant si écartement réel confirmé) | ÉTABLI (détection) / PROBABLE (risque) |
| 5 | **Corrections de relecture à confiance nulle** | `relecture-ombre action=corrige` : 75/267 avec `confiance` 0 sur un rail (72) ou les deux (3 : 9/2733, 11/1726, 15/6574). Déclenchement sur écart >8 mm indépendamment de la confiance | 267 corrections, 75 | gênant (risque) | ÉTABLI (comptage) / PROBABLE (risque) |
| 6 | **Bilan de clôture trompeur sur les différés** | `closureSummary.deferred=8` (lot 15 à la clôture) dont 4 ensuite écrits par la passe (15/73, 15/9718, 15/9719, 15/9720) → 4 réellement restants (15/1, 15/6399, 15/6456, 15/9694). Non mis à jour après la passe. Session : 31 différés, 15 écrits, 16 restants | 31 différés / 8 closure | cosmétique → gênant (lecture) | ÉTABLI |
| 7 | **Correction opérateur arrêtée avec 33 cibles non traitées** | `correction-fin` 10:57:42 `raison=operateur`, comptes : total 119, traites 86 (48 corrigés + 38 validés), **vu 33** (aucune décision), a-faire 0 | 119 cibles | gênant (travail restant) | ÉTABLI |
| 8 | **Silences inter-phases / pause de relecture** | (a) silence total 13 min 05 s 09:34:59→09:48:04 (`eveil-relache`→`correction-debut`, wake-lock relâché) ; (b) `relecture-pause` « mic » 09:19:04→`relecture-reprise` 09:26:25 (7 min 22 s, cut 15/6558, 196/586), `veille-detectee ecartMs=256401` | 2 fenêtres | cosmétique → gênant | ÉTABLI (durées) / SUPPOSÉ (cause opérateur) |
| 9 | **Observations ESV perdues** | `esv-observation nom=railPairSeen` avec `perdus` : 7 (09:31:49) + 3 (09:34:08) = 10 | 2 / 26 985 | cosmétique | ÉTABLI |

**Mineurs / cosmétiques (groupés).** `dernier-cut-detecte` logue `commande=ctrl-entree` vs
`validation-en-place` `ctrl-entrée` (incohérence d'accent) ; `goto-cut` 3 cas `chemin=aucun` mais
`resultat=confirme`, `pret=null` ; `passe-differes-ombre` 10 entrées dupliquées (double évaluation
ombre, **sans** double écriture) ; 32 records `incomplete-no-after` (31 différés + 1 changement de lot,
captures abandonnées `capture-abandoned`) ; 2 différés (7/123, 7/124) non jugés par la passe mais relus
par la relecture (`passe-differes-ombre-fin` voit 29 différés vs 31 `defer-finalized`).

**Non-défauts vérifiés (pour mémoire).** L'écart 791 `validation-accepted` / 776 `applied-verified` =
**15 écritures de seconde passe** (`passe-differes-ecriture`, même ensemble partie/cut), qui n'émettent
pas `applied-verified` : structural, pas une confirmation manquante. `esv-observation nom=undefined`
(17 112) = autres kinds (write/resource/préchauffage/list-page), normal. 145 verdicts ombre
« je corrigerais » avec action « visite » = 138 coupes déjà « valid » à écart <8 mm (ombre plus
agressive que la règle réelle), normal. File de parties propre (fin `nombre-atteint`), relecture 0 refusé.

## Ce qui confirmerait / infirmerait chaque défaut sur un prochain lot

1. **Navigation-only** : activer la relecture de l'état après (ou comparer `afterStateStatus`) et
   juger via l'Écho un échantillon de poses navigation-only. *Confirme* si des poses sont fausses sans
   after-state ; *infirme* si les 204 + navigation suffisent (aucune pose fausse sur l'échantillon).
2. **Hors-canevas** : refaire un lot en mode normal (non tel-quel) et compter `clic-hors-vue-bilan`.
   *Confirme* si le mode tel-quel produit ~1 hors-canevas/pose et le mode normal ~0 ; vérifier que le
   repli « chemin directe » donne la même pose que le clic canvas (Écho).
3. **Compteur ESV** : lot sans différé restant → le changement doit passer en 1re tentative.
   *Confirme* si les refus disparaissent quand 0 différé non résolu ; *infirme* si refus même sans différé.
4. **Garde-voie** : juger 7/92, 12/4501, 15/9682 via Écho/terrain ; passer la garde en mode actif.
   *Confirme* (bloquant) si l'écartement >15 mm est réel et non corrigé ; *infirme* si la garde est
   volontairement ombre et ces coupes justes.
5. **Confiance nulle** : juger les 75 corrections (surtout 9/2733, 11/1726, 15/6574) via Écho ;
   vérifier si `confiance=0` = valeur manquante ou basse. *Confirme* si corrections fausses ;
   *infirme* si 0 est un sentinelle « non calculé » sans impact.
6. **Clôture différés** : mettre à jour `closureSummary` après la passe et recompter. *Confirme* si
   le compte final diffère du compte à la clôture (attendu : 16 restants session, 4 lot 15).
7. **33 « vu »** : reprendre la correction ou juger les 33 via Écho. *Confirme* si elles nécessitaient
   une action ; *infirme* si l'opérateur les a jugées bonnes (statut « vu » suffisant).
8. **Silences** : horodater les gestes opérateur (pause mic, absence). *Confirme* une pause volontaire
   si l'opérateur atteste ; *infirme* un décrochage si aucun geste et page inactive anormalement.
9. **Observations perdues** : surveiller `perdus` sous charge. *Confirme* si récurrent ; *infirme* si
   incident isolé (2 cas).

## Ce que le journal ne peut pas dire

- **Justesse des poses** : le journal prouve l'écriture (204) et la navigation, pas la géométrie finale
  correcte. Les 767 poses sans after-state, les 15 écritures de passe, les 267 corrections et les
  3 coupes garde-voie ne peuvent être jugées justes/fausses que par l'Écho ou le terrain.
- **Cause des silences inter-phases** (13 min, pause mic 7 min) : opérateur absent vs pause volontaire
  vs attente système — non mesuré (le wake-lock relâché suggère l'opérateur, sans preuve).
- **Dérive mémoire** : un seul instantané `machine.memoireJsMo` (518 utilisée / 635 allouée / 4192 Mo
  limite, source panneau, ~12 %) ; aucun champ mémoire dans les événements → dérive **non mesurée**.
- **Sémantique exacte** de `diag-compteur-bloque` (`valeur` 1/2/4, `cuts=3`) et de `confiance=0`
  (manquant vs bas) : interprétation probable, non spécifiée par le journal.
- **Chiffres Écho** (92 corrections candidates, 304 vus sans décision) : métriques Écho, non
  superposables aux 119 cibles de correction / 2 577 « vu » de relecture du journal ; jointure à faire.
- **Motif « branche » / « anomalie-non-corrigee »** de la passe (1 et 4 décisions) : le journal donne
  le motif, pas la justesse ; le 17/11 signalait « branche » à risque (4/6 fausses) — à juger, petit échantillon.

## Les 3 chiffres les plus parlants

1. **Cadence** : 776 posés en **52,8 min** de lots automatiques (14,7 poses/min), cut médian **1,45 s**
   (p90 2,84 s) — contre « cut médian 0,8 s » annoncé le 17/11 (métrique possiblement différente).
2. **Silences** : pendant les lots automatiques, **aucun silence > 6,2 s** ; **0** Maj+Espace (267)
   suivi d'un silence > 5 s ; **0** validation suivie d'un silence > 30 s. Le motif « page ESV muette
   3 min après le Maj+Espace du cut 2475 » du 17/11 **ne se reproduit pas** sur ce lot.
3. **Hors-canevas** : **758** clics d'application hors du canevas en mode tel-quel (~1 par pose ;
   partie 15 : 207 pour 211 poses), tous repliés sur « chemin directe / lecture rapide ».

---
*Scripts d'analyse (hors dépôt) : `/home/opencode/.ariane/tmp-lot18/analyse/` (probe, main1→main6).*
*Mesures avant interprétation ; tout ce qui n'est pas mesuré est marqué « non mesuré ».*
