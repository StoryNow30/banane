# Rapport exécuté — Banane V4.5 lot 1

**Rapport historique avant correctif temporel.** Les cinq comparaisons et exclusions de 314/333 ci-dessous décrivent la première livraison. La borne par rail et le rejeu corrigés (sept comparaisons, trois changements d'éligibilité) sont documentés dans `V45_LOT1_BORNE_TEMPORELLE.md`. Ne pas interpréter cette version historique comme le résultat actuel.

## Provenance et vérifications

Base de travail : copie autonome de l'archive **V4.4.3 source+tests** fournie, sans modifier les ZIP d'origine. SHA-256 source : `6b6e46e4525132b7381d59898d28194428cf68abca6580c651e7940f6ca75962` ; ZIP installable : `bc617dadb78f5a5d82c35ad0237ad3850f5ddf1f328bcf766c334c1c62916011`. Les 70 fichiers communs ont le même contenu ; l'archive source ajoute 57 fichiers (tests et trois références de contrôle). Aucun écart de moteur ou de runtime. Témoin : `275e1f217da4b5f7483399e7cf5954373fb5bccc77c13c9c3aedb9e76b2f274c`.

`node tools/verify.cjs` sur la source originale extraite : **188 tests réussis**, moteur/pilote/lecteur commun conformes aux empreintes figées V4.4.0. Après ajout du banc : **195 tests réussis**, 0 échec, contrôle inchangé. 24 fichiers runtime analysés par le vérificateur ; le nouveau banc est vérifié par ses tests propres. Aucune session ESV ou test réel de fluidité n'a été exécuté pendant ce lot.

## Reproduction de Terra et évaluation stricte

| Indicateur | Banc V4.4.3 préexistant | Banc lot 1, avant tout changement de rail observé |
|---|---:|---:|
| Visites | 22 | 22 |
| Points dans le JSON | 377 477 | 377 477 |
| Géométries admises gauches / droites | 5 / 7 (contrat de comparaison humaine) | 14 / 9 (toutes visites, y compris sans finale comparable) |
| Paires admises | 5 (contrat de comparaison humaine) | 7 (toutes visites) |
| Références candidates par rail, gauche / droite | — | 5 / 5 |
| Propositions sur les géométries admises, gauche / droite | — | 12 / 6 |
| Comparaisons de propositions à finale humaine | 7 (3 gauche, 4 droite) | **5 (3 gauche, 2 droite)** |
| Non-résolutions ayant une référence candidate | 5 (2 gauche, 3 droite) | 5 (2 gauche, 3 droite) |

Les dénominateurs des géométries ne mesurent **pas la même chose** : le banc historique inclut l'éligibilité à une finale candidate ; le nouveau mesure d'abord les entrées géométriques admises indépendamment des finales. Les 12/6 propositions sur l'ensemble des visites ne doivent pas être annoncées comme 18 succès face à l'humain : de nombreuses visites n'ont pas de référence candidate. Parmi les cinq comparaisons strictes, cuts **313 gauche, 317 gauche/droit, 318 gauche/droit**. Cuts **314 droit et 333 droit** auparavant comparés : leurs snapshots choisis sont acquis après le premier changement de rail observé. Ils restent visibles dans le résultat historique, exclus de la nouvelle comparaison ; les cuts 315/316 ont des géométries mais deux rails non résolus par le moteur.

Erreurs sur cinq comparaisons strictes, **unités de scène non calibrées**, et non millimètres certifiés : gauche médiane latérale `0,003000`, verticale `0,003299`, euclidienne `0,003473` ; droite médiane latérale `0,003092`, verticale `0,002669`, euclidienne `0,005148`. P90, maximum et valeurs par rail sont dans `audit/v45-lot1/manifest.json` et `rails.json`. Avec 3 et 2 observations comparées par côté, ces distributions ne démontrent ni amélioration de précision ni performance générale.

Pertes par rail sur l'ensemble des 44 possibilités (22 × 2) : 15 sans snapshot qualifié et 6 sans snapshot qualifié **avant** le premier changement observé ; 23 entrées pré-correction sont retenues (14 gauche, 9 droite), 7 paires. Le moteur obtient une proposition sur 18 de ces 23 rails ; 5 sont non résolus. Les 23 superpositions incluent les géométries sans finale humaine comparable, qui ne servent pas au score.

## Traçabilité

| Exigence | Implémentation | Test / résultat |
|---|---|---|
| Conserver moteur et périmètre | Copie V4.4.3, adaptateur `reference`, empreintes source dans manifeste | 195/195 ; hashes gelés inchangés |
| Séparer entrée et référence | `prepareVisit`, puis `execute`, puis `referenceFor` | Test mutation finale seule : snapshot, hash et proposition identiques |
| Refuser nuage après correction observée | Filtre temporel sur snapshot entier et état initial | Test après changement + témoin 314, 333 exclus |
| Refuser mélange d'identités / repères | Cohérence snapshot, morceaux, pose, frame et ROI | Test identité de cut et transformation invalide exclus |
| Préserver examen des propositions | Diagnostic réel `templateAmbiguity`, 23 SVG, `rails.json` | 23 rendus créés ; alternative grossière identifiée |
| Distinguer mm et unités non calibrées | `physicalMillimetres:null` sans calibration indépendante | Test unité non vérifiée réussi |
| Permettre variantes futures | Interface moteur `id/parameters/run` | Adaptateur factice de test, algorithme inchangé |
| Préserver décisions ambiguës | Référence candidate uniquement après VALIDATE unique | Test intentions VALIDATE puis SKIP et SKIP seul |

## Limites et prochaine expérience

Les références restent non revues par Terra ; elles ne sont pas des vérités certifiées. Le témoin est une donnée de développement connue, jamais un test indépendant. La géométrie commence avant le premier **changement observé**, mais la granularité des observations ne prouve pas que tout geste initial a été vu. L'unité physique n'est pas indépendamment calibrée et les sources ne fournissent ni geominfo fiable, ni contexte passage à niveau, ni chaînage spatial sûr. Les SVG vérifient les données exportées, pas le rendu ESV réel. Aucun nouvel essai avec Mic ni mesure de fluidité WebGL pendant ce lot.

Prochaine expérience recommandée : faire revoir à Terra les cinq finales candidates retenues, faire confirmer les repères et unités sur quelques vues ESV et réserver un bloc spatial inédit ; comparer ensuite une variante géométrique **à entrées et initiales identiques**, en publiant refus et erreurs sur tous les dénominateurs. Ne pas entraîner sur ce seul témoin.
