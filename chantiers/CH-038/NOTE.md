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

## Ce que le lot aurait dû faire (exigences de l'opérateur et de l'intégrateur, 02/11 : « il ne doit pas s'arrêter pour cette raison »)
- Aucune validation n'a été envoyée pour le cut 115 (ÉTABLI : `validation-intent`, `-observation`, `-accepted`, `-ecriture-observee` existent pour les cuts 1 et 105 à 114, pas pour 115). Seuls les rails ont été déplacés. C'est l'ordre du code : `apply` pose et relit, puis le moteur valide.
- Une vue non restituée n'est pas une pose ratée : les deux rails sont posés et relus. `apply` doit rendre son résultat normal, marqué `vueNonRestituee`, avec un détail (pressions, écarts), et le cut est validé comme les autres.
- La remise est bornée à quelques secondes, jamais 3 × 12 s. Elle accepte « vue habituelle revenue » ou « rail dans la vue ».
- Le service worker journalise l'avertissement `vue-non-restituee` et ne s'arrête jamais pour la vue, sauf après N remises ratées de suite (N = 3). Dans ce cas, il s'arrête après la validation du cut, avec une raison claire.
- Le cut suivant repart de l'état réel de la caméra (le bouton du rail recentre). Une panne avant `apply` (pré-vol) diffère déjà le cut. Pas de patch moteur (`src/engine.js` est gelé sur la base V4.6.0).
- Toujours jamais de SKIP, jamais de validation d'un cut non résolu.

## Correctif retenu
1. Page (patch d'adaptateur) : vue habituelle mémorisée avant les gestes ; remise bornée (2 pressions de 1,5 s par défaut, réglables par le plan) ; `apply` ne lève plus pour une vue non restituée ; le pré-vol exige la vue revenue.
2. Service worker : avertissement `vue-non-restituee`, compte des remises ratées de suite, arrêt après la validation du 3e (`vue-non-restituee-arret`). Une erreur de pose avec plan dit ce qui est écrit dans ESV (`ecriture`). Le réglage `deplacerVue` reste allumé (D-268).
