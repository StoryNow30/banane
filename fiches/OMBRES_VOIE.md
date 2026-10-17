# Ombres de la voie : règle prudente dans Orbite, mémoire des différés dans l'Écho (audit 5.0, I8 et U1)

Branche `claude/50-ombres-voie`. Deux **ombres** : des calculs consignés qui ne posent jamais rien. Aucune action nouvelle dans ESV (ni geste, ni requête, ni déplacement de vue) ; `src/engine.js` n'est pas touché ; `DECISIONS.md` non plus. On consigne seulement ce qu'il **aurait fallu** faire.

Vocabulaire : comme `fiches/VOIE_PREDITE.md` et `fiches/G1_MEMOIRE_DIFFERES.md`. « L'opérateur » désigne la personne qui relit dans l'Écho.

## 1. Ce qui est livré

| Pièce | Où | Ce qu'elle fait |
|---|---|---|
| Module commun « recentrer sur la voie » | `src/voie-recentree.js` (`BananeVoieRecentree`) | Reçoit une voie prédite (appuis, ou un décalage) ; rend la décision du moteur recentré (`LotDecision.decideCut`), la confiance du moteur relancé, l'écart à la voie, la profondeur de chaîne et le geste de vue nécessaire (dans la vue, dézoom ×k, glissement en px) d'après la caméra capturée. Forme hors ligne : `choisirDansLePool` (G1). Jugement commun : `juger`, `ecartPose`. Ne commande rien. |
| Ombre d'Orbite | `background.js` (`voieOmbreNoter`, `voieOmbrePlanifier`), réglage `voiePrediteOmbre` | Un événement `voie-predite-ombre` par cut **différé** du lot : étage, confiance, écart à la voie, geste de vue, profondeur de chaîne, verdict de la règle prudente D-147 (posable ou non, et pourquoi). |
| Ombre de l'Écho | `src/native-session.js` (`observeMemoire`, `entreeSansFuite`), réglage `memoireDifferesOmbre` | Un événement `memoire-differes-ombre` à la fin de la **première visite** d'un cut que le lot a différé, calculé sans lire la référence humaine du cut, à partir des corrections déjà validées de la série. |
| Jugement commun | `tools/jointure-echo-orbite.cjs` | Juge les deux ombres contre la pose finale de l'opérateur : juste à 5 mm, juste à 10 mm, fausse (> 10 mm), mauvaise voie (> 50 mm) ; résumé `ombres` de même forme. |
| Rejeux | `tools/rejeu-voie-predite.cjs`, `tools/memoire-differes.cjs` | Emploient le module (vue, trace, règle, mesures ; recalage dans le pool) ; `--ombre` rejoue l'ombre d'Orbite sur un lot ; `concordance` compare l'ombre de l'Écho à (b) hors ligne. |
| U1 | `background.js` (`contratNoter`) | En plus de l'empreinte par onglet, la dernière empreinte connue (tous onglets) dans `chrome.storage.local` ; `contrat-esv` consigne `dernierConnu` quand l'onglet n'a pas d'empreinte propre, sans avis. |

Réglages : `src/settings.js`, actifs par défaut **pour consigner seulement** ; seuils figés dans `datasets/reglages-figes.json` (sous `voiePredite.ombre` et `memoireSerieB.ombre`) ; un essai vérifie réglages = fichier figé = constantes du module.

## 2. La pose est inchangée : comment c'est prouvé

- **Orbite** (`tests/voie-predite-ombre-sw.test.cjs` et `-panne`, service worker réel en VM, moteur et GCV1 réels) : un lot de deux cuts (un posé, un différé), joué avec l'ombre coupée, active et en panne. Mêmes commandes ESV dans le même ordre, mêmes rails, mêmes enregistrements, mêmes événements métier, et décisions du lot (`lotObservation`) **identiques octet pour octet** (identifiants et horloges neutralisés). Un événement par différé, aucun pour un cut posé, aucun si le réglage est coupé ; une panne ne laisse qu'un événement « erreur ».
- L'ombre part **après** la décision et la commande du cut, sur des **copies** (capture, science, appuis réels au moment de la décision). Elle ne rend rien au lot, n'écrit ni dans `batch` ni dans ses appuis ; ses propres poses ne servent d'appuis qu'à elle (`tests/voie-recentree-ombres.test.cjs` : rien de ce qui est lu n'est modifié). Aucun fichier de `src/` ne la lit, sauf la session Écho pour sa propre ombre ; `src/engine.js` ne la nomme pas.
- **Écho** (`tests/memoire-differes-ombre.test.cjs` et `-fuite`) : l'entrée du calcul est construite par `entreeSansFuite`, qui ne lit que l'identité, la pose de départ et les instants des transitions (lectures de la référence humaine, de la pose finale, des intentions et des écritures **piégées** : aucune n'est touchée). Le même cut, posé juste ou à 40 mm par l'opérateur, donne le **même** événement. Aucune visite ne porte de commande d'Ariane ; la continuité est calculée comme avant, même si l'ombre tombe en panne.

## 3. Concordance avec les deux rejeux

- **Règle prudente, partie 1 du second projet** : `rejeu-voie-predite.cjs --variantes temoin,regle-wc-e10-p10 --ombre …` → la variante pose **27** différés sur 127 (21 à ≤ 5 mm, 27 à ≤ 10 mm, 0 faux, 0 mauvaise voie), comme D-147. L'ombre d'Orbite rejouée sur le même lot avec le code de l'extension (`ombreLot` → `evaluerDiffere`) : **27 posables, exactement les mêmes cuts** ; 15 exigent un dézoom (≤ ×1,38), 12 sont déjà dans la vue ; 0 cut posé d'origine changé. 128 événements (les 127 différés de la jointure, plus un cut non posé absent de la jointure), 60 avec relance du moteur.
- **G1 (b)** : `memoire-differes.cjs juger --propagation` sur les quatre fichiers de cas → **56 poses** (41 à ≤ 5 mm, 53 à ≤ 10 mm, 3 fausses, 0 mauvaise voie) ; rapport complet identique, ligne pour ligne, à celui de D-148.
- **Ombre de l'Écho contre (b) hors ligne**, partie 1, 127 cas, mémoire de l'Écho (l'opérateur a corrigé les cuts précédents de la série), réglage de l'ombre (`memoire-differes.cjs concordance`) :

| | Posés | ≤ 5 mm | ≤ 10 mm | Fausses | Mauvaise voie |
|---|---:|---:|---:|---:|---:|
| (b) hors ligne, recalage dans le pool | 48 | 37 | 47 | 1 (17,3 mm) | 0 |
| Ombre de l'Écho, moteur recentré sur le vrai nuage | 75 | 60 | 74 | 1 (12,6 mm) | 0 |

  Mémoire : 80 cas calculés, 37 « série instable », 10 têtes de série sans mémoire. Les deux formes posent ensemble 48 cuts, dont **43 à ≤ 3 mm l'une de l'autre** (écart médian 0,6 mm, P90 3,2, maximum 15,6) ; aux 5 écarts, le moteur est plus près de l'opérateur 4 fois sur 5. Le moteur pose 27 cuts de plus (21 où le pool voit « plusieurs minima près de la voie », 5 en étage « choice », 1 sans minimum), jamais l'inverse. Ce ne sont pas les 56 de G1 (autre mémoire, autre protocole : § 5).

## 4. Poids ajouté aux exports

Lot réel rejoué (partie 1 du second projet, 352 cuts, 128 différés) : 128 événements `voie-predite-ombre`, **87 Ko en JSON** (680 octets par événement en moyenne ; enveloppe du journal comprise, identifiants aléatoires), **7,6 Ko compressés**. Le journal de ce lot pèse 20,6 Mo (3,1 Mo compressé) : **+0,4 %** en clair, **+0,25 %** compressé. Les seuils ne sont écrits que sur le premier événement du lot. Coût de calcul : 60 relances du moteur sur ce lot (une par différé qui avait une reprise ou une pose d'ombre proche), dans la file de B1 (vidée pendant la capture suivante).

Écho (même partie, rejeu `concordance`) : 127 événements `memoire-differes-ombre`, **89 Ko en JSON** (700 octets par événement), **5 à 18 Ko compressés** selon le nombre d'identifiants propres à chaque événement. Un seul événement par première visite d'un différé ; calcul hors de la file des événements, deux relances du moteur par cut calculé (médiane 2,2 s, maximum 4,9 s sur ce rejeu).

**Les 87 Ko ci-dessus sont ceux de la seule voie prédite.** Toutes les ombres livrées à la 4.9.5 test 5 pèsent ensemble environ **0,5 Mo par lot de 350 cuts** (mesure de la relecture de la test 5, sur une capture du corpus de tests ; environ 130 différés), soit **+2,5 %** d'un journal Orbite de 20 Mo, très compressible :

| Ajout | Octets | Par lot de 350 cuts |
|---|---:|---:|
| faux vert + hauteur apprise, dans chaque décision qui pose (événement `gcv1-shadow-observed`) | 346 + 651 | ≈ 220 Ko |
| règles métier, un événement par cut (730 pour le premier, seuils compris) | 318 | ≈ 110 Ko |
| voie prédite, un événement par différé | ≈ 680 | ≈ 87 Ko |
| mémoire des différés (Écho), un événement par première visite d'un différé | ≈ 700 | ≈ 90 Ko, dans l'export Écho |

La décision passe de 710 à 1 760 octets environ (×2,5) : visible dans les tables, sans effet sur la pose. Les gestes de l'Écho (`operator-gesture`) et la liste des verts à contrôler (quelques kilo-octets) s'ajoutent, selon les gestes.

## 5. Écho : ce qui est fait, ce qui manque

Fait (partie sûre) : la mémoire de la série (`memoireSerie` : corrections déjà validées de la même série, les 3 plus proches, dispersion = éloignement × 3 mm ≤ 10 mm ; voie = droite des 2 plus proches), puis le moteur recentré sur cette voie, sur le nuage capturé autour de la pose de départ avant le premier geste. Le réglage est celui que G1 a retenu hors partie (D-148).

Ce qui manque pour le faire « proprement », exactement :

1. **La liste des cuts différés par le lot de la partie.** L'Écho la lit dans l'état d'Ariane (enregistrements de lot de la partie, `deferred-unresolved`). Si le lot n'a pas tourné dans ce navigateur, ou si son état a été remis à zéro, il n'y a pas de série : un seul événement `differes-inconnus` le dit, rien n'est calculé.
2. **La mémoire de l'Écho n'est pas celle du jugement de G1.** Dans l'Écho, l'opérateur a corrigé tous les cuts précédents de la série (mémoire « idéale ») ; les 56 poses de G1 sont jugées avec propagation (Ariane s'appuie sur ses propres poses). Avec la mémoire idéale, G1 ne retenait que 9 poses (D-148 : réglage instable à cette taille de données). L'ombre de l'Écho mesure donc une autre chose que les 56.
3. **Le recentrage n'est pas exactement celui de G1** : l'Écho relance le moteur sur le vrai nuage (`decideCut`), G1 recale dans un pool élargi calculé à l'avance. La commande `concordance` mesure l'écart entre les deux formes, cas par cas.
4. **Les poses de la série doivent être dans la même session et le même repère de scène** (un F5 change le repère : la mémoire repart de zéro), et validées de façon fiable (règle de la continuité, ou référence corrigée par l'écriture serveur, D-143).
5. **La capture de l'Écho couvre ±0,4 m** autour de la pose de départ (comme Orbite) : une voie plus loin n'est pas couverte.

## 6. Doutes

- Profondeur de chaîne des cuts posés par le lot : celle de leurs appuis **réels**. Dans le rejeu « en série », un cut posé peut avoir pour appui une pose de la règle ; sa profondeur peut alors différer d'une unité. Sans effet sur la partie 1 (mêmes 27 cuts), possible ailleurs.
- La mémoire de l'ombre d'Orbite est volatile : un redémarrage du service worker pendant un lot coupe la chaîne de l'ombre (prudent, mais elle sous-compte alors).
- Le calcul de l'ombre d'Orbite occupe le service worker (une relance du moteur, jusqu'à 2,5 s, pour 60 des 128 différés de la partie 1), pendant que la page capture le cut suivant ; aucune mesure de terrain du rythme du lot avec l'ombre active.
- Aucune des deux ombres n'a encore tourné sur une partie neuve : 27 poses sans faute laissent jusqu'à 12,5 % de fautes possibles (Wilson 95 %) ; il en faut 73 sans faute (audit, B2).

## 7. Rejouer

```
node tools/rejeu-voie-predite.cjs --corpus SEG… --journal JOURNAL.json --jointure JOINTURE.json --cache MEMOIRE.json \
     --variantes temoin,regle-wc-e10-p10 --sortie S.json --detail D.json --ombre OMBRE.jsonl
node tools/memoire-differes.cjs juger --propagation --cas cas-1.jsonl --cas cas-17.jsonl --cas cas-24.jsonl --cas cas-29.jsonl
node tools/memoire-differes.cjs concordance --cas cas-1.jsonl --corpus SEG… --json C.json --evenements ECHO.jsonl
node tools/jointure-echo-orbite.cjs --echo DOSSIER_ECHO --journal JOURNAL.json --sortie TABLE.json   # résumé « ombres »
```

Essais : `tests/voie-recentree.test.cjs`, `tests/voie-recentree-ombres.test.cjs`, `tests/voie-recentree-outils.test.cjs`, `tests/voie-predite-ombre-sw.test.cjs`, `tests/voie-predite-ombre-sw-panne.test.cjs`, `tests/memoire-differes-ombre.test.cjs`, `tests/memoire-differes-ombre-fuite.test.cjs`, `tests/jointure-ombres.test.cjs`, `tests/contrat-dernier-connu.test.cjs` (données synthétiques). Les corpus, journaux, jointures et cas restent hors dépôt.
