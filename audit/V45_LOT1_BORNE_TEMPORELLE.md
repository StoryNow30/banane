# Banane V4.5 lot 1, correctif de borne temporelle

## Cause et correction

Le premier banc appliquait la première transition `rail-state-changed` **aux deux rails** et ignorait `rail-and-loaded-view-changed`. Cela excluait à tort un rail encore inchangé lorsque Mic avait déplacé l'autre. La correction reconstruit les états successifs de la même visite à partir de `native-visit-started` et `native-state-observed`, reliés à `stateTransitions.eventSeq`. Elle compare séparément la position et les matrices de chaque rail. Une vue/caméra changée seule n'avance pas la borne des rails ; un rail déplacé avec changement de vue avance la borne **de ce rail seulement**. Un changement de matrice de profil sans déplacement est également une borne du rail concerné. Si état antérieur, état suivant, identité, repère ou instant ne permettent pas d'attribuer la transition, le banc applique aux deux rails une borne conservatrice et conserve `no-qualified-before-unattributed-rail-transition` ainsi que sa cause détaillée. Une chronologie tronquée reste exclue.

La finale humaine candidate exige maintenant une seule intention `VALIDATE`, un `eventSeq` commun, le **même état complet** juste avant l'intention, une identité concordante, une capture de cet état antérieure à l'intention et postérieure à l'instantané LiDAR choisi, une fraîcheur observée de 0 à 1 500 ms et une fin de visite non antérieure à l'intention. La fraîcheur est recalculée ; une association d'export contradictoire est refusée. Ces preuves n'en font ni un label revu ni une confirmation serveur.

## Rejeu du même témoin

Témoin inchangé : SHA-256 `275e1f217da4b5f7483399e7cf5954373fb5bccc77c13c9c3aedb9e76b2f274c`, 22 visites, 377 477 points. Le moteur, ses paramètres et ses empreintes restent inchangés. Résultats complets : `audit/v45-lot1-temporal/manifest.json`, `rails.json`, `overlays/` (26 SVG). Résultats précédents conservés dans `audit/v45-lot1/` pour rendre le différentiel contrôlable.

| Mesure | Avant correctif | Après correctif |
|---|---:|---:|
| Rails admis gauche / droit, toutes visites | 14 / 9 | 14 / 12 |
| Paires admises, toutes visites | 7 | 7 |
| Finales candidates gauche / droit parmi rails admis | 5 / 5 | 5 / 7 |
| Propositions gauche / droit, tous rails admis | 12 / 6 | 12 / 9 |
| Comparaisons gauche / droit | 3 / 2 | 3 / 4 |
| Comparaisons totales | 5 | 7 |
| Motifs « pas de snapshot qualifié » | 15 | 15 |
| Motifs « pas de snapshot avant déplacement de ce rail » | 6 | 3 |

**Liste exhaustive des changements d'éligibilité sur les 44 couples visite × rail** :

| Cut, rail | Avant | Après | Preuve temporelle et décision |
|---|---|---|---|
| 314 droit | Exclu | Entrée admise, finale candidate, proposition et comparaison | Snapshot droit acquis jusqu'à `19:42:58.272Z` ; premier déplacement **droit** observé à `19:42:58.642Z`. Le déplacement antérieur à `19:42:55.807Z` concerne la gauche. Finale observée 118 ms avant VALIDATE. |
| 332 droit | Exclu | Entrée admise et proposition, **non comparable** | Snapshot droit acquis jusqu'à `19:44:11.554Z` ; premier déplacement droit observé à `19:44:12.474Z`. Pas de finale candidate à comparer. |
| 333 droit | Exclu | Entrée admise, finale candidate, proposition et comparaison | Snapshot droit acquis jusqu'à `19:44:17.052Z` ; premier déplacement **droit** observé à `19:44:18.620Z`. Le déplacement antérieur à `19:44:15.854Z` concerne la gauche. Finale observée 65 ms avant VALIDATE. |

Les 41 autres couples ne changent ni d'admission, ni de snapshot choisi, ni de statut de référence ou de comparaison. Le retour à sept comparaisons sur ce témoin est une **conséquence vérifiée du critère par rail**, non une valeur cible. L'erreur euclidienne des deux comparaisons nouvellement réadmises est respectivement `0,000390` et `0,009157` en **unités de scène non calibrées** ; cela ne prouve pas une précision métier en millimètres ni une amélioration du moteur.

## Tests et limites

`node tools/verify.cjs` : **201/201 tests**, contre 195/195 dans le lot initial, zéro échec, empreintes figées moteur/pilote/lecteur inchangées. Les tests supplémentaires couvrent gauche déplacée avant acquisition du droit, changement de rail et de vue concomitant, caméra seule, changement de matrice de profil, changement de repère global, côté indéterminé avec exclusion des deux rails, reconstruction depuis les événements exportés et finale humaine décalée/incohérente. Le test de mutation de la seule finale confirme que l'entrée et la proposition ne changent pas tandis que l'association de la finale est refusée.

La comparaison d'états établit des changements **observés**, pas l'absence certaine d'un geste entre deux observations. Les finales restent candidates, non revues ; unités physiques non calibrées indépendamment ; pas de nouvelle collecte, d'essai ESV, d'entraînement ni de modification du moteur. Un test indépendant reste à constituer.
