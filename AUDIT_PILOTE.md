# Audit du mode Pilote automatique

Banc : **364 / 364**, `geometryUnchanged: true`. Aucun fichier gelé modifié.
Corpus d'appui : **37 cycles de pilote réels** du 15/09, parts 6 et 31.

Unités de scène ×10⁻³ pour les distances. Ce ne sont pas des millimètres.

---

## Le périmètre, et ce qu'il interdit

| fichier | rôle | gelé ? |
|---|---|---|
| `src/engine.js` | machine à états du lot, décisions | **OUI** |
| `src/geometry.js` | placement | **OUI** |
| `src/adapter-page.js` | actions dans ESV : lire, cliquer, valider | non |
| `background.js` | orchestration | non |
| `panel.js` | interface | non |

**La moitié du pilote est gelée.** Plusieurs défauts ci-dessous sont dans
`src/engine.js` et ne peuvent pas être corrigés sans lever le gel — décision de
Mic, pas la mienne. Ils sont marqués **[GELÉ]**.

---

## Où passe le temps

37 cycles mesurés, du démarrage d'un cut à sa validation :

| étape | médiane | part |
|---|---:|---:|
| **capture LiDAR** | **6,95 s** | **85 %** |
| application du placement | 0,70 s | 9 % |
| proposition du moteur | 0,36 s | 4 % |
| validation | 0,07 s | 1 % |
| **total par cut** | **8,16 s** | |

Décomposition de la capture (90 mesures) :

| jalon | médiane |
|---|---:|
| attente avant la première lecture | 2 391 ms |
| première lecture terminée | 4 112 ms |
| deuxième rail terminé | 6 742 ms |

**L'attente domine la lecture.** C'est là qu'est le gisement.

---

## Défaut 1 — l'identification des rails refaite à chaque sondage

**Corrigé.**

`context()` reparcourt la scène et calcule, pour chaque rail, la moyenne des
ordonnées de **tous les sommets du contour** — 625 sommets par rail sur le
terrain — uniquement pour décider quel objet est à gauche.

Or `context()` est appelé par `snapshot()` → `assertExpected()` → `guard()`,
c'est-à-dire **à chaque itération de `waitFor`, toutes les 80 ms**, pendant
toute la capture. Sur 2,4 s d'attente par rail, cela fait une trentaine de
reparcours complets par rail et par cut.

Effet pervers : ce calcul consomme le temps processeur dont ESV a besoin pour
stabiliser son niveau de détail — donc il rallonge exactement ce qu'il attend.

Le résultat ne change pas tant que le cut, le profil, la racine et sa matrice
sont les mêmes. Il est désormais conservé et revalidé par une regex et une
comparaison de 16 nombres. **Les poses restent relues à neuf** : `railState()`
lit les matrices monde à chaque appel, donc un rail déplacé est vu
immédiatement — propriété verrouillée par test, car mémoïser les poses aurait
cassé en silence le contrôle « les rails n'ont pas bougé ».

*Réserve de Mic, juste :* si ESV remplaçait l'objet Three.js d'un rail par un
nouvel objet de même pose, une garde « même cut + même matrice racine »
servirait une référence orpheline. La garde vérifie donc **aussi** que les
objets mémorisés sont encore enfants de la racine. Deux tests ajoutés : le
remplacement à l'identique réidentifie bien le nouvel objet, et un objet
détaché force un recalcul au lieu d'être servi depuis le cache.

## Défaut 2 — la signature du niveau de détail sérialisée deux fois

**Corrigé, et sorti dans son propre fichier pour être auditable.**

`loadedSignature()`, appelée au même rythme, faisait un `JSON.stringify` par
nœud (jusqu'à 512), triait ces chaînes, puis refaisait un `JSON.stringify` de
l'ensemble.

*Réserve de Mic, juste :* cette fonction décide QUAND lire. Une collision ne
donnerait pas une métrique fausse — elle ferait lire un nuage incomplet. Et il
se méfiait à raison d'une simple somme commutative.

Le calcul est désormais dans `src/lod-signature.js`, testable seul, et combine
**quatre grandeurs indépendantes** : nombre de nœuds, somme des empreintes,
ou-exclusif des empreintes, état des nuages. Une collision exigerait qu'un
remplacement conserve à la fois le compte, la somme **et** le ou-exclusif.

`tests/lod-signature.test.cjs` vérifie les sept propriétés demandées, une par
une, plus le cas défavorable à 512 nœuds — la limite réelle d'ESV :

| propriété | attendu | vérifié |
|---|---|---|
| permutation des mêmes nœuds | même signature | ✓ |
| ajout d'un nœud | différente | ✓ |
| retrait d'un nœud | différente | ✓ |
| remplacement A→B à compte constant | différente | ✓ |
| version de tampon | différente | ✓ |
| matrice monde | différente | ✓ |
| plage de dessin | différente | ✓ |

Plus : nombre de points, état des nuages, stabilité entre deux appels,
indépendance des deux combinateurs, et robustesse aux champs manquants.

## Défaut 3 — les constantes du pilote invisibles et non réglables

**Corrigé.**

`tentativesParVue`, `stabiliteMs`, `budgetCaptureMs`, cadence de sondage,
lectures stables exigées et trois plafonds d'attente étaient codés en dur dans
`adapter-page.js`. C'est le défaut que `src/settings.js` avait corrigé pour la
collecte et qui n'avait jamais été traité pour le pilote.

Déplacés dans `S.pilote`, avec unité et raison d'être, et affichables dans les
réglages. Un test vérifie qu'aucune de ces valeurs ne reste écrite en dur.

**`stabiliteMs: 800` n'est pas réduit.** C'est un paramètre de QUALITÉ : le
baisser lit un nuage moins chargé. Il est rendu visible pour pouvoir être
étudié, pas ajusté à l'aveugle. C'est le principal levier de temps restant.

---

## Défaut 4 — une politique du moteur est rendue inaccessible par l'ordre de ses propres contrôles

**NON CORRIGÉ. [GELÉ] — demande un arbitrage.**

*Révisé après revue de Mic, qui a vu plus loin que la première rédaction.*

Ce n'est pas seulement « ESV navigue trop vite ». `src/engine.js` :

```
ligne 185  refuse de DÉMARRER le lot sans `allowNavigationEvidence`,
           puisque l'adaptateur n'a pas de confirmation serveur
ligne 171  if(!evidence.afterObserved) throw AFTER_STATE_MISSING   ← s'exécute
ligne 172  if(!serverConfirmed && !scope.allowNavigationEvidence) throw
```

Le moteur **exige** que l'opérateur déclare « la navigation observée me suffit
comme preuve » pour seulement démarrer. Puis, sur le chemin où la navigation
EST observée mais la relecture manquée, il lève à la ligne 171 — **avant**
d'atteindre la ligne 172 où cette déclaration serait consultée.

La politique existe, elle est obligatoire, et elle est inatteignable
exactement là où elle servirait. C'est une contradiction interne, pas une
limite d'ESV.

C'est le défaut qui a arrêté **12 lots sur 12** sur le terrain du 15/09.

Séquence, `adapter-page.js` `decisionAndNext` :

1. Banane clique le bouton de validation d'ESV — **c'est Banane, pas
   l'opérateur** ; l'étiquette `observed-legacy-validation-button` nomme le
   mécanisme, pas son auteur ;
2. ce bouton **valide ET navigue** : il n'existe pas de validation sans
   navigation dans ESV ;
3. Banane relit aussitôt l'état sur la même identité — le libellé a déjà
   changé ;
4. `afterObserved = false` ;
5. `engine.js` ligne 171 lève, ligne 257 pose `PAUSED_AFTER_STATE_MISSING`.
   **Le lot s'arrête.**

**Formulation corrigée après revue.** J'avais écrit « le cut EST validé ». La
télémétrie ne le démontre pas. Elle démontre que le bouton identifié comme
bouton de validation a été cliqué, que le cut a changé, et que la navigation
attendue a été observée. Il n'existe **aucune confirmation serveur**. La
formulation juste est : *la commande de validation a été déclenchée et la
navigation attendue a été observée ; tout indique que la validation ESV a
réussi, mais Banane n'en a pas de preuve indépendante.* Le lot s'arrête donc
sur une relecture manquée, pas sur un échec constaté — ce qui reste le
problème, sans aller au-delà de ce qui est prouvé.

**Ce que j'ai essayé et qui ne marche pas.** J'ai rapproché la relecture du
clic, en supprimant la construction d'objet et l'appel à `progress(...)` qui
s'intercalaient. C'est **inerte** : aucun des deux ne rend la main à la boucle
d'événements, il n'y avait donc aucun yield à supprimer. Si ESV change son
libellé de façon synchrone — ce que montrent les journaux — la relecture
échouait avant et échoue encore. Le changement est conservé parce qu'il est
gratuit et meilleur si le gestionnaire d'ESV était asynchrone, mais **il ne
doit pas être présenté comme un correctif**.

**Les trois issues possibles, aucune n'est de mon ressort :**

| issue | ce qu'elle coûte |
|---|---|
| lever le gel de `engine.js` pour ne plus arrêter le lot sur une relecture manquée | le moteur n'est plus identique à la référence 4.4.0 |
| ne plus valider avec le bouton d'ESV, mais placer puis naviguer avec « Next » | les cuts ne sont plus validés : changement métier |
| accepter l'arrêt et relancer le lot cut par cut | ce que tu fais déjà, sans automatisation réelle |

---

## Défaut 5 — aucune action offerte après cet arrêt

**Partiellement corrigé (4.5.5b).**

`PAUSED_AFTER_STATE_MISSING` n'active ni Réessayer, ni SKIP, ni Reprise
manuelle : l'opérateur voyait un message sans savoir quoi faire. Le panneau
explique désormais ce qui s'est passé et quoi faire. **La reprise automatique du
lot au cut suivant reste impossible** : elle est dans `engine.js`.

## Défaut 6 — le SKIP affirme avoir été transmis sans l'avoir vérifié

**NON CORRIGÉ — signalé.** Le vocabulaire devrait changer avant même le
mécanisme : `shortcutDispatched: true` dit ce qui est su, `commandSent: true`
dit plus. Le renommage est bloqué par `engine.js` ligne 160, qui lève si
`evidence.commandSent !== true` — donc il demande le même arbitrage que le
défaut 4.

`nativeDecision('VALIDATE')` passe par `nativeClick`, qui vérifie que le bouton
existe et n'est pas désactivé, et lève sinon. `nativeDecision('SKIP')` envoie
deux `KeyboardEvent` et retourne `commandSent: true` **sans aucune
vérification** : aucun bouton, aucun accusé, rien.

La conséquence est rattrapée en aval — `waitFor` lève si le cut ne change pas —
mais l'affirmation `commandSent: true` est faite avant toute preuve. C'est
précisément le genre de déclaration que le reste du projet s'interdit.

Non corrigé parce que je ne sais pas ce qu'ESV expose pour confirmer la prise en
compte du raccourci. À investiguer devant ESV.

## Défaut 7 — l'écartement de voie n'est vérifié nulle part

**NON CORRIGÉ — trouvé par Mic, à l'œil, sur le cut 6/9480.**

Ni le moteur ni le cerveau ne contrôlent l'écartement résultant du placement.
Chaque rail est placé indépendamment.

| | écartement |
|---|---:|
| initial ESV, cut 6/9480 | 1 499,93 |
| après placement Banane | **1 517,73** |
| moteur seul, sans le cerveau | 1 518,19 |

Et ce que fait l'opérateur, sur 211 cuts et trois parts :

| | avant | après correction humaine |
|---|---:|---:|
| parts 17/20 | 1 482,85 ± 35,79 | **1 437,07 ± 5,20** |
| part 6 | 1 438,71 ± 27,10 | **1 435,99 ± 3,85** |

**L'opérateur ramène systématiquement l'écartement vers ~1 436, en divisant la
dispersion par 7.** Sur 9480, Banane est partie de 1 499,93 et l'a poussé à
1 517,73 : elle s'est éloignée de 82 dans la mauvaise direction.

*Mon erreur d'analyse :* j'avais mesuré la corrélation entre les déplacements
latéraux gauche/droite (r = 0,032) et conclu « pas de contrainte de paire
latérale exploitable ». C'était la mauvaise statistique — deux rails peuvent
bouger de façon décorrélée en conservant l'écartement. Il fallait mesurer la
**distance résultante**, pas la corrélation des gestes.

C'est de loin la piste la plus prometteuse ouverte à ce jour, et elle relève du
cerveau, pas du pilote. Non implémentée : elle demande un ajustement sur données
Natif représentatives, pas sur le corpus biaisé.

## Défaut 8 — le placement est appliqué par clics simulés dans le canevas

**NON CORRIGÉ — inhérent.**

`clickPosition()` projette la position visée en coordonnées écran, envoie un
`MouseEvent`, puis vérifie par relecture que le rail a bougé à moins de 1e-3 de
la cible. C'est robuste — la vérification est réelle — mais cela impose de
**sélectionner chaque rail**, donc de bouger la caméra, donc d'attendre sa
stabilisation : ~240 ms plancher par rail, deux fois par cut.

Si ESV exposait une écriture directe de la pose, ces attentes disparaîtraient.
À vérifier devant ESV.

## Défaut 9 — le lot ne reprend pas après « Reprise manuelle »

**[GELÉ] — signalé.**

`manualTakeover()` pose `b.state = 'MANUAL_TAKEOVER'` et `b.step = 'manual'`.
Aucun chemin ne ramène le lot en `RUNNING` sur le cut suivant : il faut relancer
un lot. Sur un lot de 23 cuts dont un seul est ambigu, cela coupe les 22 autres.

*Aggravé, relevé par Mic :* la même fonction écrit
`« Cut N préservé pour reprise manuelle. Ouvre Mes corrections. »` — or le mode
Correction a été retiré en 4.5.4. Le moteur gelé contient donc un chemin vers un
flux de travail qui n'existe plus. Le panneau traduit ce message à l'affichage,
mais c'est un pansement : la référence obsolète reste dans la machine à états.

Le flux correct demanderait : pause → l'opérateur corrige dans ESV → Banane
observe le changement d'identité → l'opérateur confirme « repris manuellement »
→ Banane journalise `MANUAL_COMPLETION` **sans prétendre avoir validé** →
reprise du lot au cut suivant. Cela demande de modifier la machine à états.

## Défaut 10 — conséquence du défaut 4, pas un défaut distinct

*Reformulé après revue.*

Formulation juste : **avec le comportement synchrone observé sur cet ESV**, un
lot d'un seul cut ne peut pas se terminer normalement. Le code réussirait si ESV
laissait l'ancien cut affiché assez longtemps pour que la relecture passe.

Ligne 247 : si `now.identity.cut === scope.end`, le lot se termine — mais on n'y
arrive jamais, la relecture ayant échoué avant. Tes essais à un seul cut (3604,
3605, 4244, 4245, 9480, 31/1, 31/3) tombaient tous dans ce cas.

**Ce défaut disparaît de lui-même si le défaut 4 est réparé.** Il ne mérite pas
de correctif propre.

---

## Ce qui va plus vite maintenant, et ce que je ne promets pas

Les défauts 1, 2 et 3 retirent du travail d'une boucle qui tourne toutes les
80 ms pendant 85 % du temps du pilote. **Je n'annonce aucun chiffre de gain :
il se mesure sur ESV réel, pas sur le banc.** Les trois changements sont
neutres en qualité — on calcule la même chose, moins souvent ou moins cher — ce
que vérifient les tests d'équivalence.

Le gisement restant est `stabiliteMs: 800`, soit ~1,6 s plancher par cut pour
les deux rails. Le réduire est un arbitrage qualité/temps qui demande une
mesure, pas une décision de ma part.

---

## Tests ajoutés

`tests/adapter.test.cjs` passe de 11 à 23 tests, plus `tests/lod-signature.test.cjs` (13) :

- relecture après validation, dans les deux régimes de navigation d'ESV ;
- l'identification des rails n'est pas refaite à chaque lecture d'état ;
- elle est refaite dès que le cut change ;
- **un rail déplacé est vu immédiatement malgré la mémoïsation** ;
- gauche et droite ne s'échangent pas après mémoïsation, ordre de scène inversé ;
- les réglages du pilote viennent de la source unique, aucun n'est codé en dur ;
- ils sont affichables avec une explication ;
- un repli existe si la source unique est absente.

Vérification de non-complaisance : le test de mémoïsation **échoue** quand on
désactive le correctif. Les deux tests de relecture passent dans les deux cas —
ils verrouillent le comportement, ils ne prouvent pas un correctif, et le
document le dit.
