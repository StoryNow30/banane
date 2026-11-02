# CH-038 : note de cause (lot arrêté au cut 115, « Vue ESV non recentrée sur le rail right. »)

Export de la 4.9.5.33 (02/11, `banane-data`, collection `2026-11-02_v4.9.5.33_lot-arrete-deplacement-vue`), journal lu par script. Heures UTC.

## Ce qui s'est passé (ÉTABLI : journal + code de `src/adapter-page.js`)
| Heure | Événement | Lecture |
|---|---|---|
| 09.749–11.378 | `amenerDansLaVue` (pré-vol) : bouton du rail droit, glisser clic droit 1 027 ms, NDC −1,001 → −0,7 ; remise « faite » en 333 ms | essai sans pose, décidé par `deplacerVuePlanifier` (`background.js`) |
| 11.502 | `apply` reçu, avec le plan `deplacerVue` | |
| ~11.5–12.2 | rail gauche : bouton, cible déjà dans la vue, clic de pose | aucun événement (pas de geste) |
| 12.22–13.234 | rail droit : bouton, **second glisser** 1 015 ms, NDC −1,001 → −0,7 | c'est `apply` lui-même (`clickPosition` → `amenerVue`) : le pré-vol ne garde rien, la pose refait le geste. Voulu, pas un doublon parasite |
| ~13.24 | clic de pose du rail droit | posé vite : un clic raté finit en 15 s au plus sur un autre message |
| 13.485, 25.560, 37.586 | trois `railPairSeen` espacés de 12,03 s | les trois pressions du bouton du rail droit par `remettreVue` → `select` (`recentrages:3` × `attenteMs:12000`) |
| 49.364 | `adapter-result apply` : erreur « Vue ESV non recentrée sur le rail right. » (37,9 s), dernier stade `vue-geste` | levée par `select` dans `remettreVue`, à la fin d'`apply` |

**Les deux rails étaient écrits dans ESV quand l'erreur est partie.** Le seul `select` après le second glisser est celui de la remise (`remettreVue`, appelé à la fin d'`apply`). La durée (3 × 12 s + le clic) le confirme. L'arrêt en « ecriture-incertaine » était donc juste : la pose était faite et pas validée.

## Pourquoi la sélection du rail droit échoue après la pose
- ÉTABLI (corpus, caméras de capture) : le bouton d'un rail centre la vue sur le rail (rail droit à NDC 0,000 / 0,000 dans sa caméra). Vue de 778 px à 0,514 mm/px : la demi-largeur fait 200 mm. La cible du lot est à **200,1 mm** du rail (`regles-metier-ombre`, `deplacementMm`), donc à NDC **−1,001**, juste hors de la vue. C'est exactement le cas que le déplacement de vue doit traiter.
- `select` attend une caméra stable **et le rail dans la vue** (`projectToView(...).inView`, |NDC| ≤ 1). Après la pose, le rail droit est à la cible. Dans la vue habituelle, il est donc à NDC ≈ −1,001 : **cette condition ne peut pas être remplie.** Trois attentes de 12 s, puis l'erreur.
- PROBABLE : le bouton ramène la vue habituelle du cut, centrée sur la position *d'origine* du rail. S'il centrait sur la position posée, le rail aurait été à NDC 0 et `select` aurait réussi. La seule autre explication est une caméra jamais stable pendant 36 s, qu'aucune trace n'appuie. Ce point vient du vrai ESV : la maquette ne le prouve pas.
- Le pré-vol n'a rien vu : il ne pose rien. Le rail reste au centre de la vue habituelle et la même `select` réussit (333 ms). Sa remise « faite » ne prouve rien pour la remise après pose. Le pré-vol est structurellement aveugle à ce cas.

## Pourquoi la remise est « inconnu »
`apply` lève une exception, et l'exception ne porte pas le rapport de remise. `detailRemise` (CH-031) ne reconnaît que « Vue ESV non restituée … (échelle à x %) ». « Vue ESV non recentrée » tombe donc en `inconnu`, `source:'erreur'`. C'est un échec de remise mal classé.

## Après l'arrêt (hors cause, ÉTABLI)
L'opérateur clôt le résultat incertain à 07:56:16. Chaque relance part du cut affiché (115), qui porte un résultat incertain archivé : refus « aucune nouvelle écriture automatique dans cette page » (`lot-non-demarre`). C'est une garde existante, pas un défaut. Le cut a été corrigé en Écho à 07:57 (`correction-liste` : 12 posés sur 12).

## Ce que le lot aurait dû faire
Cible hors vue à 200 mm, geste réussi, deux rails posés : la remise devait juger que **la vue habituelle est revenue** (caméra revenue à celle d'avant les gestes), et non que « le rail posé est dans la vue habituelle », ce qui est faux par construction quand la cible était hors vue. Remise jugée faite, la validation suit : le cut est posé et le lot continue. Si la vue ne revient vraiment pas après une écriture : arrêt avec une raison claire (« vue non restituée, deux rails posés, rien validé »), classée `echec` et non `inconnu`. Une panne de vue AVANT toute écriture (bouton, geste) doit différer le cut, sans écriture et sans SKIP.

## Correctif retenu (détail dans le rapport)
1. Page (patch d'adaptateur) : la vue habituelle de chaque côté est mémorisée avant les gestes. La remise après glisser presse le bouton et accepte « caméra stable revenue à cette vue » ou « rail dans la vue ». En cas d'échec, elle rend `ok:false` au lieu de lever, et `apply` lève le message « Vue ESV non restituée » (classé `echec`). Le pré-vol exige le retour à la vue habituelle.
2. Service worker : la raison est dite (`deplacer-vue`, `ecriture` avant ou après) ; la remise est classée `echec`. Le réglage `deplacerVue` reste allumé (D-268) : la cause se corrige.
