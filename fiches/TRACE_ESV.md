# Trace d'Ariane dans ESV : les écritures d'un lot Orbite comparées à celles d'une Écho (mesure I6, plan 5.0)

**Exigence.** La trace laissée dans ESV par Ariane doit être exactement celle d'un traitement manuel, sans marque distinctive. L'audit 5.0 (I6) avait montré, par lecture du code, qu'Ariane n'émet aucune requête propre. Cette fiche ajoute la mesure qui manquait : ce que le serveur reçoit réellement, cut par cut, d'un lot Orbite et de l'opérateur, sur les mêmes parties.

**Outil.** `tools/trace-ecritures.cjs` (hors ligne, lecture seule), essai `tests/trace-ecritures.test.cjs` sur données synthétiques (14 cas, dont quatre contre-épreuves qui ajoutent à Orbite un champ, un ordre inversé, un rythme de machine, des lectures en trop, et vérifient que l'outil les signale).

```
node tools/trace-ecritures.cjs --orbite <dossier du lot extrait> --echo <dossiers des exports Écho> --partie N
     [--pause-s 120] [--sortie resultat.json] [--csv-cuts table.csv]
```

Chiffres de cette fiche : version 4.9.5.3, 16 octobre 2026.
- **Partie 29** : lot Orbite de 245 cuts (collection `2026-10-16_v4.9.5.3_partie-29`, dossier « lot ») contre l'Écho de l'opérateur sur la même partie, deux sessions, 1 012 visites sur 821 cuts. Cette Écho est une relecture faite avec un soin particulier : elle contient des pauses plus longues que d'ordinaire.
- **Partie 1 du second projet** : lot Orbite de 352 cuts (collection `2026-10-16_v4.9.5.3_projet2-partie-1`) contre l'Écho, une session, 885 visites sur 765 cuts.

## Ce qui est lu et comment

- Relevés `esv-observation` de genre `write` : une ligne par requête d'écriture vue par l'observateur de la page (méthode, code, tentative, durée, numéro de ligne = numéro du cut, corps). Dans l'Écho, les `serverWrites` des visites recoupent ces relevés : 1 302 sur 1 302 (partie 29) et 886 sur 886 (partie 1) y figurent. Le journal Orbite n'a pas de `serverWrites`.
- Relevés `esv-event` (ce qu'ESV annonce sur sa page) et `resource` (requêtes de nuages de points, comptées par fenêtres de 250 ms) pour dater l'arrivée sur un cut et compter les lectures.
- **Nature** d'une écriture : `seen` (seul champ SeenByOperator), `validation` (ExtractionStatus « valid » et TreatedByOperator), `autre` (le reste).
- **Deux coupes de l'Écho.** ESV n'écrit « seen » que la première fois qu'un cut est vu : sur les cuts que le lot avait déjà visités, l'Écho n'écrit jamais « seen » (0 sur 236 cuts en partie 29, 0 sur 352 en partie 1), contre 98,5 % et 100 % sur les cuts neufs. Comparer l'Écho entière à Orbite fausserait donc les séquences. La comparaison est faite deux fois : Écho entière (pour le rythme) et Écho limitée aux **cuts neufs** (pour les champs, l'ordre, les séquences, le parcours).

## Ce qui est identique

| Mesure | Partie 29 (Orbite / Écho) | Partie 1 (Orbite / Écho) |
|---|---|---|
| Écritures | 454 / 1 302 | 577 / 886 |
| Méthode, classe d'adresse, canal | PUT, écriture de paire de rails, XHR : 100 % des deux côtés | idem |
| Code de retour | 204 : 454 sur 454 / 1 302 sur 1 302 | 204 : 577 sur 577 / 885 sur 886 (un 502 côté Écho, voir plus bas) |
| Champs d'une écriture `seen` | 1 champ (SeenByOperator) : même | même |
| Champs d'une écriture `validation` | 12 champs, **même ordre des clés**, mêmes types | idem |
| Valeurs énumérées | ExtractionStatus « valid », TreatedByOperator vrai, type de rail et orientations : mêmes valeurs | idem |
| Chiffres significatifs des coordonnées | même médiane pour les six champs de bord | idem |
| Écritures par cut visité | 1,85 / 1,59 (Écho entière), 1,83 (cuts neufs) | 1,63 / 1,16 (entière), 1,53 (cuts neufs) |
| Ordre au sein d'un cut | `seen` puis `validation` : 209 séquences S>V sur 210 posés / 477 S>V sur 488 validés (cuts neufs) | 224 sur 224 / 189 sur 204 |
| Entrelacement | validation précédée d'une écriture d'un autre cut : 0 sur 209 / 4 sur 496 (0,8 %, cuts neufs) | 0 sur 224 / 6 sur 207 (2,9 %) |
| Enchaînement d'écritures consécutives | seuls S>V même cut, V>S cut suivant, S>S (cut différé) : les mêmes que l'Écho | idem |
| Durée de la requête (médiane) | 58,7 ms / 55,5 ms | 63,6 ms / 63,6 ms |
| Rechargement de la liste | 1,00 par validation / 1,06 | 1,00 / 1,05 |
| Parcours (partie 1) | pas médian de 1 cut, 90,3 % de pas d'un cut contre 93,4 %, test de Kolmogorov-Smirnov p = 0,84 | |

Pour les écritures elles-mêmes (nature, champs, valeurs, codes, ordre dans le cut) l'outil ne trouve **aucune** écriture qu'un humain ne fait jamais : zéro champ, zéro valeur, zéro code, zéro séquence propre à Orbite sur les deux parties (« écritures qu'un humain ne fait jamais : 0 »).

## Ce qui diffère

**1. Gestes que l'Écho fait et qu'Ariane ne fait jamais** (aucun n'est une marque d'Ariane : leur absence est un manque d'humanité, pas un signe) :
- SKIP (ExtractionStatus « skipped ») : 1 écriture sur 726 en partie 29, 23 sur 472 en partie 1 (4,9 %) ; Orbite : 0.
- Seconde validation du même cut (correction après validation) : 11 cuts en partie 29 (1,5 % des cuts validés), 7 en partie 1 ; Orbite : 0.
- Une écriture en échec (502) reprise par ESV à la tentative 2 : 1 cas en partie 1 ; Orbite : 0 échec sur 1 031 écritures. La reprise est faite par ESV lui-même.
- Cuts visités sans aucune écriture (déjà vus, non validés) : 16 et 109 côté Écho ; 0 et 1 côté Orbite.

**2. Lectures de nuages de points par cut visité** (c'est de la lecture, hors écritures, mais le serveur la voit) :

| | Orbite | Écho entière | Écho cuts neufs |
|---|---|---|---|
| Partie 29, requêtes par cut | 4,24 (médiane 3, p95 13) | 1,73 (médiane 1, p95 9) | 1,96 |
| Partie 29, Mo par cut | 1,82 | 0,66 | 0,76 |
| Partie 1, requêtes par cut | 2,49 (médiane 2, p95 6) | 1,77 (médiane 1, p95 5) | 1,57 |
| Partie 1, Mo par cut | 0,75 | 0,51 | 0,45 |

Rapport 2,4 en partie 29 (2,2 sur les cuts neufs) et 1,4 en partie 1 (1,6 sur les cuts neufs) ; Kolmogorov-Smirnov p < 0,0001 dans les quatre comparaisons. Toutes les requêtes ont le code 200. Ce sont des requêtes qu'ESV émet de lui-même, plus nombreuses quand Ariane pilote ; la cause n'est pas établie (voir doutes).

**3. Rythme** (sur l'Écho entière, intervalles de plus de 120 s mis à part comme pauses) :

| | Partie 29 Orbite / Écho | Partie 1 Orbite / Écho |
|---|---|---|
| Cycle entre deux validations, médiane | 2,10 s / 2,22 s | 2,67 s / 3,26 s |
| p5 – p95 | 0,80 – 8,7 s / 1,08 – 12,2 s | 1,96 – 9,2 s / 1,18 – 24,5 s |
| Écart absolu médian / médiane | 0,43 / 0,29 | 0,17 / 0,35 |
| Part des cycles dans 2–3 s | 20 % / 37 % | 59 % / 24 % |
| Cycles de plus de 10 s | 1,0 % / 6,9 % (Fisher p = 0,0003) | 5,4 % / 10,7 % (p = 0,02) |
| Intervalles entre écritures de plus de 5 s | 1,1 % / 6,6 % (p < 10⁻⁶) | 1,0 % / 9,3 % (p < 10⁻⁶) |
| Validations par minute de travail | 19,5 / 14,1 | 12,6 / 9,2 |
| Pic de validations sur 5 minutes | 116 / 110 | 92 / 91 |
| Plus longue plage sans pause de 10 s | 5,9 min / 3,6 min | 4,1 min / 4,0 min |
| Kolmogorov-Smirnov sur le cycle | D = 0,11, p = 0,04 | D = 0,23, p < 0,0001 |
| Autocorrélation d'ordre 1 des cycles | 0,12 / −0,04 | 0,31 / −0,01 |

Lecture : le cycle d'Orbite n'est pas celui d'une machine (partie 29 : plus dispersé que l'humain au sens de l'écart absolu médian), et son débit de pointe est celui que l'opérateur tient lui-même (116 contre 110 validations en 5 minutes). Mais Orbite ne fait **presque jamais de pause** (un intervalle de plus de 5 s entre écritures pour 100, contre 7 à 9 chez l'humain) et, en partie 1, son cycle se concentre (59 % entre 2 et 3 s, écart absolu médian divisé par deux). Les lots mesurés durent 11 minutes (partie 29) et 18 minutes (partie 1).

**4. Parcours** (partie 29 seulement) : Orbite avance toujours vers l'avant et par sauts (pas médian 3 cuts, p90 93, 42 % de pas d'un cut, aucun retour en arrière) ; l'Écho avance cut par cut (pas médian 1, p90 8 ; 88 % de pas d'un cut ; sur les cuts neufs 63 %, p90 16, 2 retours en arrière). Kolmogorov-Smirnov p < 0,0001. En partie 1 il n'y a pas de différence (p = 0,84). Le lot de la partie 29 ne visite que des cuts à traiter, l'opérateur relisait la partie entière : c'est probablement le choix des cuts, pas un réglage.

**5. Délais internes à un cut.** De l'événement « sélectionné » d'ESV à l'écriture `seen` : médiane 1,53 s contre 1,28 s (partie 29), 1,45 s contre 0,65 s (partie 1). Du `seen` à la validation : médiane 0,91 s contre 0,99 s (partie 29, p90 2,8 s contre 1,7 s), 1,66 s contre 1,53 s (partie 1, p90 2,7 s contre 3,8 s). C'est du temps de page, pas visible du serveur tel quel ; ESV est plus lent à réagir pendant le lot, peut-être parce que la page est plus chargée (non établi).

## Une différence pourrait-elle trahir Ariane côté serveur ? Classement par risque

| Rang | Différence | Risque | Pourquoi |
|---|---|---|---|
| 1 | Lectures de nuages de points par cut : ×1,4 à ×2,4 | **moyen**, à vérifier en premier | Seule différence qui change le nombre de requêtes reçues par cut. Les requêtes sont de même forme et toutes en 200. Un serveur qui compterait les lectures par cut verrait un compte médian de 2 à 3 (humain : 1). Le compte humain va jusqu'à 18 – 32, donc Orbite reste dans la plage humaine. |
| 2 | Rythme : très peu de pauses, cycle concentré (partie 1) | **faible à moyen** | Débit de pointe humain (116 / 110), plage sans pause de 4,1 à 5,9 min, cycle non régulier à la machine. Mais aucune des longues pauses de l'humain (30 – 120 s : 2,5 % des cycles chez l'humain en partie 29, 0 chez Orbite) sur des lots de 11 et 18 minutes. Un lot de plusieurs heures sans pause serait, lui, inhumain ; il n'a pas été mesuré. |
| 3 | Parcours par sauts vers l'avant (partie 29) | faible | Visible dans la suite des `seen`. Dépend du choix des cuts du lot ; identique à l'humain en partie 1. |
| 4 | Aucun SKIP, aucune seconde validation, aucun échec | très faible | Ces gestes sont rares et propres à une séance (SKIP : 0,1 % à 4,9 %). Leur absence ne marque pas Ariane, elle ne permet pas de la distinguer d'un opérateur qui ne s'en sert pas. |
| 5 | Délais internes d'ESV plus longs | très faible | Non visibles du serveur. |
| 6 | Champs, ordre des clés, valeurs, types, nombre de chiffres, codes, méthode, canal, ordre `seen` puis `validation`, entrelacement | **aucun** | Identiques. |

Aucune différence n'est une marque d'Ariane au sens d'un champ, d'un code ou d'un ordre inconnu d'un traitement manuel. Les seuls écarts sont de **quantité** (lectures) et de **cadence** (pauses).

## Ce que les exports ne permettent pas de voir, et comment le vérifier sur la maquette

L'observateur de page n'enveloppe que `XMLHttpRequest` (tout ce qu'ESV écrit passe par là : 100 % de `xhr`). Il ne voit pas `fetch`, `sendBeacon`, `WebSocket`, ni les en-têtes, l'adresse réseau, les cookies, ni ce que le serveur enregistre de son côté. Les relevés `resource` ne comptent que la classe « nuages de points ».

1. **Télémétrie cliente d'ESV** (requêtes d'analyse, de présence, d'activité émises par la page). Non vue. Vérification sur la maquette : capture réseau complète (onglet Réseau en conservant le journal, export HAR, ou journal du serveur de la maquette) pendant (a) une série manuelle de N cuts et (b) un lot Orbite sur les mêmes N cuts ; comparer par point d'accès : méthode, chemin ramené à sa forme, nombre par cut, clés du corps, en-têtes, cadence ; ajouter les trames WebSocket et les balises. Toute requête présente dans (b) et absente de (a), ou dans des quantités différentes, est une marque.
2. **Événements de l'interface.** Les gestes d'Ariane sont des événements synthétiques (`isTrusted` faux, sans `pointerdown` ni `pointermove` précédant le clic). Si le code d'ESV les écoute pour rapporter une activité, ce serait invisible ici. Vérification : chercher dans le code de la page de la maquette `isTrusted`, `mousemove`, `pointer`, `idle`, `activity`, `visibilitychange` ; puis mesurer le trafic pendant 60 s sans geste, avec gestes humains, avec gestes d'Ariane.
3. **En-têtes et identité** (cookies, agent, adresse) : mêmes que l'opérateur par construction (même navigateur, même compte, aucun `setRequestHeader` dans Ariane) ; à confirmer sur le HAR de la vérification 1.
4. **Horodatage serveur.** Les exports donnent les instants vus de la page, pas ceux de réception. Vérification : lire le journal du serveur de la maquette pendant le lot.
5. **Lots longs.** Mesurer sur la maquette un lot d'une heure et plus : pauses, débit horaire, régularité.
6. **Pourquoi plus de lectures.** Sur la maquette, compter les requêtes de nuages de points par cut pour chaque commande d'Ariane isolément (arrivée sur le cut, vue, déplacement) afin d'attribuer l'excédent à une commande précise.

Toute action nouvelle dans ESV, y compris pour réduire un des écarts ci-dessus (ajouter des pauses, varier le parcours, limiter les lectures), reste **à soumettre à l'opérateur** (règle 1 du cahier). Cette fiche n'en propose aucune.

## Doutes et limites

- Deux parties, un opérateur, un poste, une version : la mesure compare deux séances, pas des populations. Un autre jour, une autre relecture donnerait d'autres chiffres de rythme.
- L'Écho de la partie 29 est une relecture soignée ; ses pauses sont plus longues que celles d'un traitement courant. La comparaison de rythme est donc favorable à une conclusion « Orbite sans pauses » plus tranchée qu'elle ne l'est peut-être.
- Les valeurs p des tests (Kolmogorov-Smirnov, Fisher) sont indicatives : les intervalles successifs ne sont pas indépendants.
- La cause de l'excédent de lectures est une hypothèse (commandes de vue d'Ariane qui font recharger des morceaux de nuage), non établie. Elles sont rattachées à un cut par l'heure (dernier événement « sélectionné »), ce qui est approximatif aux changements de cut.
- Le numéro de ligne des écritures est pris pour le numéro du cut (vérifié par la jointure Écho-Orbite pour les validations, D-143). Une écriture en échec sans numéro de ligne prend celui de sa reprise.
- En partie 1, deux écritures manuelles (un `seen` et une validation) datent de 2 h 23 avant le lot ; elles sont comptées « hors cut visité » et n'entrent ni dans les cuts du lot ni dans les cycles.
- Les « cuts neufs » de l'Écho sont ceux que le lot n'avait pas visités : l'opérateur les a peut-être choisis plus difficiles.
