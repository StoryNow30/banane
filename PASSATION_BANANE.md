# Banane — passation complète

**Destinataire : un assistant IA reprenant le projet à froid (ChatGPT ou autre).**
**Date : 15 septembre 2026. État à la version 4.5.7.**
**Auteur : Claude Opus 5, qui a mené les versions 4.5.0 à 4.5.7.**

Ce document est autoportant. Il contient le contexte, ce qui a été fait, ce qui a
été mesuré, ce qui a échoué, et les règles à ne pas enfreindre. Les chiffres
qu'il cite ont tous été mesurés sur des données réelles ; ceux qui sont des
hypothèses sont annoncés comme tels.

---

## 1. Contexte

### Le domaine

Mic est spécialiste du traitement de données 3D chez Trealis (ex-Eurailscout
France). Son travail porte sur le contrôle qualité de nuages de points LiDAR
pour l'infrastructure ferroviaire de SNCF Réseau. Il travaille dans **ESV**, une
application web (`esv.lidar.altametris.xyz/rails_validation/`) où il valide,
cut par cut, la position de profils de rail sur le nuage de points.

Un **cut** est une coupe transversale de la voie. Chaque cut porte **deux
rails** : gauche et droite. Sur chaque rail, ESV propose une position initiale
du profil (forme U50 dans tout le corpus disponible), et Mic la corrige à la
main puis valide.

Le **champignon** est la tête du rail. Sa géométrie est ce que le placement
cherche à faire coïncider avec le nuage de points. Deux surfaces comptent :
la **table de roulement** (le dessus) et le **flanc interne** (la face active,
côté intérieur de la voie).

### Banane

Banane est une **extension de navigateur Chrome MV3**, installée dans Edge, qui
s'attache à ESV. Elle a trois modes :

| mode | rôle |
|---|---|
| **Natif** | Observation strictement passive. Banane regarde Mic travailler et enregistre. Elle n'envoie aucune commande à ESV. C'est le mode de collecte de données. |
| **Pilote automatique** | Banane propose une position et l'applique sur une plage de cuts. Mode expérimental, contrôlé ensuite par Mic. |
| **Assisté** | Une proposition sur le cut affiché, à la demande. |

Un quatrième mode, **Correction** (« Mes corrections »), a été **retiré en
4.5.4** — voir §4.

### Architecture

- **Service worker** (`background.js`) : le cerveau de l'extension, orchestre tout.
- **Pages d'interface** : depuis la 4.5.4, une seule, `panel.html`, avec des
  onglets internes.
- **Scripts injectés dans ESV** : lisent l'état, le nuage de points, les gestes.
- **IndexedDB** (`banane-test-v3`, stores `clouds`/`events`/`records`) : stockage
  des nuages, partagé entre le service worker et les pages d'extension, qui sont
  de même origine.

### LE MOTEUR GELÉ — contrainte centrale

Quatre fichiers sont **gelés octet pour octet** depuis la version 4.4.0 :

```
src/geometry.js          — le calcul de placement
src/engine.js            — le pilote et la machine à états
vendor/capture-core.js   — transformations de coordonnées
vendor/lidar.js          — lecteur LiDAR partagé
```

`tools/verify.cjs` vérifie leurs SHA-256 contre
`audit/v4.4.0-frozen-engine-hashes.json` à chaque exécution du banc. **Ce
fichier d'empreintes ne doit jamais être modifié.** Mic a posé la règle ainsi :
*« Ne modifie pas verify.cjs ni ses empreintes simplement pour obtenir un
résultat vert. »*

Le banc doit rester vert : **339 tests au 15/09**, dont 201 hérités de la
référence V4.5.

### Autres règles posées par Mic, toujours en vigueur

- Ne pas injecter la correction humaine finale au moment où une proposition est
  produite (pas de fuite de la cible dans les entrées).
- Ne pas régler les seuils sur le jeu réservé.
- Ne pas introduire de SKIP automatique dans le pilote sans validation séparée
  de la règle métier.
- N'affirmer « candidat absent » que si les candidats intermédiaires réellement
  produits sont exposés.
- **Les unités de scène ne doivent jamais être appelées millimètres** sans
  calibration démontrée. `physicalCalibrationStatus` ne l'atteste pas. Toutes
  les valeurs de ce document sont en **unités de scène ×10⁻³**.
- Toute conclusion doit distinguer : fait observé, calcul reproduit,
  interprétation visuelle, hypothèse.
- Si une amélioration est invérifiable, la documenter sans la présenter comme un
  gain.

---

## 2. État à la reprise (V4.4.3)

Trois sessions Natif réelles avaient été livrées. Diagnostic mené sur ces
données :

### La chaîne causale de la perte

Session `1789370906681` (89 visites) :

1. **2 échecs d'envoi** sur toute la session ;
2. bascule `FULL → DEGRADED → METADATA_ONLY`, **sans retour possible** ;
3. en METADATA_ONLY toute capture LiDAR est refusée → 66 échecs ;
4. la tête de file rejouait l'élément fautif → file saturée à 128 →
   **196 événements jetés** ;
5. la session ne pouvait plus se fermer → **128 événements en attente, perdus** ;
6. **63 visites sur 89 incomplètes (71 %)**.

**Racine** : la session refuse volontairement certains envois (`Cible
différente : cut`, `chunkId` déjà utilisé, visite inconnue). Ces rejets sont
**corrects**, mais ils étaient comptés comme des pannes de transport, d'où la
cascade.

Les trois sessions formaient une expérience naturelle : la seule qui n'a jamais
dégradé était la seule sans perte.

---

## 3. Ce qui a été construit — versions 4.5.0 à 4.5.7

### 4.5.0 — première version officielle
Source unique des réglages (`src/settings.js`), format d'export compact
(`banane-native-session-v3-compact`), segmentation.

### 4.5.2 — le verrou du rendement identifié
Diagnostic sur 670 nuages, en reproduisant la projection du moteur sans le
modifier : **le flanc interne est quasi invisible des deux côtés** — médiane 0
point à gauche, 1 à droite, pour un seuil `minFace` de 6. Le filtre de
visibilité ESV (clipping) en retire les deux tiers.

Le filtre n'est **pas** contourné : un point non visible peut appartenir à un
autre cut et contaminerait l'ajustement. La perte est désormais mesurée par
bande (`clipLoss`) et affichée en direct.

### 4.5.3 — le mur des 64 Mio
Sur une session de 92 visites, l'export s'arrêtait à 717 objets sur 977 avec
`Message exceeded maximum allowed size of 64MiB`.

**Ce n'était pas la limite de téléchargement** mais celle de
`chrome.runtime.sendMessage` entre le panneau et le service worker.
`dataset()` renvoyait records et événements en un seul message.

Correctif : un **manifeste léger** (session sans visites ni événements), et le
panneau lit records, événements et nuages **directement dans IndexedDB**.

*Vérifié sur le terrain* : session `28bfe0a5`, 77,3 Mo, 646 objets, exportée
proprement en 2 segments, aucune erreur.

**Correction d'une mesure fausse.** Le panneau affichait « Instantanés
qualifiés : 9/119 — 8 % » en rouge. Le comptage était exact mais portait sur
les *instants de capture* et traitait en échec toute capture arrêtée par un
changement de cible ou de vue — motif `capture-interrupted-before-stable-boundary`,
86 cas sur 110. Ce motif est une réserve de **provenance**, pas un manque de
points : aux instants écartés, la médiane était de 6 bandes longitudinales
(minimum 6) et 151 points utiles (minimum 64).

Sur les mêmes données, la lecture **par repère** — un repère compte dès qu'un
instantané qualifié a existé pour lui — donne **34/34, soit 100 %**.

### 4.5.4 — 616 « échecs » qui n'en étaient pas

Corpus : **22 sessions réelles** du 15/09 (11 en 4.5.2, 11 en 4.5.3),
1 006 échecs de capture analysés un par un.

| motif | 4.5.2 | 4.5.3 | nature réelle |
|---|---:|---:|---|
| `capture-limit-per-visit-reached` | 530 (86 %) | 364 (93 %) | budget respecté |
| `Cible différente : cut` | 86 (14 %) | 26 (7 %) | refus légitime |
| **panne réelle** | **0** | **0** | — |

**Aucune panne de capture sur 22 sessions**, pendant que le panneau annonçait
jusqu'à 53 % d'échec en rouge.

Plus grave : le budget plat de 8 captures par visite coupait **avant** que la
géométrie soit acquise — 26 visites sur 48 en 4.5.2 (54 %), 9 sur 25 en 4.5.3.
Il refusait exactement les captures qui manquaient. Corrigé : le budget cède
tant qu'un côté n'a pas d'instantané qualifié (plafond 24), puis revient à 8.

**Le vidage automatique ne libérait rien.** Session `3dd20460` : segment
automatique de 314 objets à 09:39, export final de 680 à 09:41 — les 314 écrits
une seconde fois. Corrigé par purge d'IndexedDB après acquittement, avec les
identifiants toujours déclarés pour que la fusion signale un segment manquant.

*Vérifié sur le terrain*, session `59a33996`, 159 visites, 1502 objets :

| | objets déclarés | volume en base |
|---|---:|---:|
| v4.5.2, segment 2 | 792 | 74,9 Mo |
| v4.5.4, segment 2 | 1013 | **37,0 Mo** |
| v4.5.4, segment 3 | 1502 | **37,3 Mo** |

Fusion des 4 segments : 1502 déclarés, **1502 présents, 0 manquant**.

**Autres changements 4.5.4** : bouton « Annuler cette session » (irréversible,
confirmation chiffrée, compte rendu de ce qui a été supprimé) ; une seule
fenêtre avec onglets internes au lieu de cinq pages ; mode Correction retiré.

*Effet de bord assumé* : le budget qui cède fait passer de 3,6-4,0 à 5,5
captures par visite (+45 %), et la file d'envoi de 9-37 à **101** (plafond 512,
aucun rejet). Marge passée de 14× à 5×.

### 4.5.5 — le cerveau de placement
Voir §5.

### 4.5.6 — le cerveau branché
Voir §6.

### 4.5.7 — garde-fou refait
Voir §7.

---

## 4. Le mode Correction, retiré en 4.5.4

Mic ne l'utilisait plus. Retiré : page supprimée, `manual-page.js` plus injecté
dans ESV, `manual-start`/`pause`/`resume` refusées. `manual-end` et
`manual-download` restent ouvertes pour récupérer une session déjà enregistrée.

**Ce mode produisait pourtant le signal de supervision** (`initial` +
`corrected` + `displacementLocal`). Vérification faite après coup : **86 % des
visites Natif portent une référence finale humaine**, donc le mode était
redondant. Le retrait ne coupe pas la source de labels.

---

## 5. Le cerveau de placement — construction et évaluation

### Ce que fait déjà le moteur gelé

Sur le corpus de corrections (220 rails), le moteur propose sur **173** (79 %) et
se trompe de **4,84 en médiane**. Témoin : ne rien déplacer donne 16,97. Le
moteur fait donc déjà 3,5× mieux que l'inaction.

Les 47 abstentions se répartissent ainsi : 37 « plusieurs placements concurrents »,
7 « grand déplacement isolé », 3 autres.

### Le corpus d'ajustement

110 cuts, **220 rails**, parts 17 et 20, profil U50, issus des sessions
« Mes corrections » (fichiers 06 et 07 de la passation).

Découpage en **parts entières** — développement = part 20 (168 rails), réservé =
part 17 (52 rails), évalué **une seule fois** avec des réglages déjà figés. Un
tirage aléatoire de cuts aurait fait fuir l'information : deux cuts voisins
partagent la voie et souvent le geste.

### Ce que le cerveau fait

**1. Il retire un biais vertical systématique.**

| résidu (humain − moteur), n=173 | moyenne | écart-type | rapport |
|---|---:|---:|---:|
| **vertical** | **+4,28** | 3,20 | **1,34** |
| latéral | −0,82 | 12,73 | 0,06 |

Le vertical domine sa dispersion → biais. Le latéral non → bruit. La règle
d'ajustement (`|moyenne| / écart-type ≥ 1`) **rejette le latéral d'elle-même**.
Le biais se retrouve dans les deux blocs séparément (17 : +3,52 ; 20 : +4,55).

**2. Il tranche entre les candidats que le moteur expose déjà.**

Sur abstention pour concurrence, le moteur a produit trois positions :
`metrics.seed` (graine fine), `metrics.surfaceIntersection` (table × face
active), `metrics.templateAmbiguity.alternative` (meilleure de grille
grossière). Meilleur des trois sur le développement : médiane 4,03,
**29 sur 33 sous 10**. Le moteur ne sait pas laquelle choisir.

Le cerveau tranche par le **dévers** : le geste vertical est corrélé entre les
deux files (r = 0,46 ; écart gauche−droite 0,94 ± 9,67). Il retient le candidat
dont le vertical s'accorde avec le rail opposé résolu. **Il n'invente aucun
candidat.**

### Résultats

| mesure | développement (part 20) | **réservé (part 17)** |
|---|---:|---:|
| propositions avant → après | 127 → 141 | 46 → 49 |
| erreur médiane avant → après | 5,20 → 3,06 | **4,24 → 2,77** |
| p90 avant → après | 9,66 → 7,15 | 6,40 → 5,24 |
| améliorés / dégradés | 93 / 34 | 32 / 14 |
| sélections | 14 | 3 |

### Limites — à lire avant toute extrapolation

- **14 rails sur 46 sont dégradés** sur le bloc réservé. Le gain est sur la
  médiane, pas sur chaque rail.
- **Le sélecteur n'est pas fiable** : 2 des 14 sélections du développement
  étaient fausses de ~82. Le réservé n'en a produit que 3, trop peu pour
  conclure.
- Un seul bloc réservé, 52 rails, une part, **un seul profil (U50)**.
- **LE CORPUS D'AJUSTEMENT EST BIAISÉ.** Voir §8 — c'est le point le plus
  important de ce document.

### Fichiers

```
src/brain.js              post-traitement pur, aucune dépendance
tools/brain-dataset.cjs   construction du jeu supervisé
tools/brain-fit.cjs       ajustement + évaluation par blocs
tests/brain.test.cjs      19 tests
BRAIN_V1.md               rapport complet
audit/brain-fit-v1.json   résultats chiffrés
```

---

## 6. Comment le cerveau est branché sans toucher au moteur

`src/engine.js` est gelé. Il lie sa géométrie **au chargement**, depuis
`globalThis.BananeGeometry3` ; la proposition est construite ligne 95 et rangée
dans `this.s.proposal`, que `apply` consomme. **Il n'existe aucun autre point
d'accroche.**

`src/geometry-brain.js` se charge **entre** `geometry.js` et `engine.js` dans la
liste `importScripts` de `background.js` et y substitue une composition
« géométrie gelée + cerveau ». La géométrie d'origine reste sous
`BananeGeometryFrozen`.

Quatre propriétés, chacune verrouillée par test :

- aucun fichier gelé n'est modifié ni muté ;
- `proposeBoth` est **le seul** point d'interposition ; `DEFAULTS`, `median`,
  `robustLine`, `enforcePairSupport`, `propose` passent par identité ;
- **éteint, la composition est transparente** : elle rend exactement ce que rend
  la géométrie gelée, sans marque. Installer la version sans rien activer ne
  change strictement rien ;
- une défaillance du cerveau rend la proposition gelée telle quelle, jamais une
  erreur.

**Le cerveau est éteint par défaut.** Interrupteur dans la vue Pilote. Chaque
proposition touchée porte `brainApplied`, une `source` en `+brain-bias` ou
`brain-candidate-selection`, et un motif lisible par l'opérateur.

**Fragilité à connaître** : réorganiser la liste `importScripts` débrancherait le
cerveau en silence. Un test vérifie statiquement l'ordre.

---

## 7. L'incident du cut 6/4245 — un garde-fou qui ne tenait pas

Premier lot réel avec le cerveau allumé. Le cerveau a sélectionné un candidat sur
le rail droit, avec `confidence: 0` et le motif « jamais à appliquer
automatiquement ». **Le pilote l'a appliqué quand même.**

La garantie reposait sur : confiance nulle ⟹ le pilote met en pause. Elle est
fausse. `src/engine.js` ligne 233, gelé :

```js
if(b.step==='apply' && low && scope.lowConfidence!=='attempt')
```

Avec la politique « Tenter la proposition expérimentale », la confiance n'est
**pas consultée du tout**. Le garde-fou ne tenait que pour l'autre politique.

Correctif 4.5.7 : la sélection est coupée à la source quand la politique permet
de tenter. Le rail ambigu redevient `unresolved`, ce qui met le lot en pause par
le chemin `missing` — branche antérieure à toute question de confiance.

**Ce que le cerveau avait réellement fait sur 4245** :

| rail | qui a décidé | déplacement |
|---|---|---|
| gauche | **le moteur gelé** (graine, rapport de perte 9,41) | −56,0 latéral |
| gauche | le cerveau, biais vertical seul | +4,55 vertical |
| droite | **le cerveau**, sélection « graine » par dévers | −3,0 latéral, +1,55 vertical |

Mic a jugé le résultat correct à l'œil dans ESV. **C'est la seule donnée qui
existe sur ce cut** : le lot s'est terminé en `AFTER_STATE_MISSING` avant que
Banane puisse relire la position finale. Une sélection confirmée bonne.

**Désaccord en cours.** Mic trouve le verrouillage 4.5.7 trop sévère et veut
continuer à tester les sélections en l'état. Il a raison sur deux points : le
chiffre « 1 sur 7 » vient du corpus biaisé (§8), et couper les sélections
empêche de les observer, donc de corriger ce chiffre. Un réglage d'essai
explicite (`autoriserSelectionSansPause`, éteint par défaut) est **codé mais non
livré** — Mic décide des développements.

---

## 8. LE POINT LE PLUS IMPORTANT — le corpus d'ajustement est biaisé

Mesure faite sur la session Natif de la part 6 (101 cuts, geste réel de Mic)
contre le corpus de corrections qui a servi à l'ajustement du cerveau :

| | part 6, travail réel | parts 17/20, corrections |
|---|---:|---:|
| rails effectivement déplacés | 56 % | 80 % |
| amplitude médiane | **3,71** | **16,92** |
| p75 | 11,28 | 42,71 |
| p90 | 33,10 | 58,46 |

**Les gestes du corpus d'ajustement sont 4,5 fois plus grands à la médiane.**
Explication : une session de correction s'ouvrait quand il y avait à corriger ;
le Natif enregistre aussi les cuts déjà bons.

Conséquences directes :

1. Le garde-fou latéral du cerveau (50,2) vient du p90 de ce corpus. Le p90 réel
   est à 33. **Il est trop permissif**, pas trop strict.
2. Le chiffre « 1 sélection sur 7 très fausse » vient du même corpus. Il est
   probablement faux, dans un sens inconnu.
3. Une affirmation de la 4.5.5 est **corrigée** : la règle d'appui de paire du
   moteur refuse **3 %** des cuts sur la part 6, pas 11 % comme mesuré sur le
   corpus de corrections. Sur les cuts 3604 et 4244 elle refusait des
   déplacements de 72 et 63, au-dessus du p90 observé (33). **Elle avait
   probablement raison.**

---

## 9. Ce qui est disponible et non encore exploité

La collecte Natif du 15/09 contient bien plus de supervision que le corpus
d'ajustement :

| | corpus corrections (utilisé) | collecte Natif (non exploitée) |
|---|---:|---:|
| cuts | 110 | 462 + 94 |
| parts | 17, 20 | 2, 3, 4, 5, 6 |
| rails supervisés | 220 | ~1 100 (borne haute) |
| profil | U50 | U50 |

**Borne haute, pas un compte de labels confirmés** : le banc applique des règles
de provenance strictes (une seule intention VALIDATE, fraîcheur 0-1500 ms,
postériorité à l'instantané, concordance d'`eventSeq`). Mesurer le rendement
réel après filtres est la première chose à faire.

Réajuster le cerveau sur ces données est le correctif de fond du §8. Méthode
identique, données représentatives.

---

## 10. Ce qui reste non traité, mesuré et documenté

- **Clipping** : 49 % des points de la zone retirés, **57 % du flanc interne**.
  Non contourné : un point non visible peut appartenir à un autre cut. Question
  ouverte que seul Mic peut trancher devant ESV — boîtes de découpe trop serrées
  (réparable) ou flanc non vu sous l'angle du scan (non réparable sans changer
  la prise de vue) ?
- **Flanc interne** : médiane 0 à 1 point pour un seuil moteur de 6. Verrou du
  rendement, tient au contrat d'entrée du moteur.
- **Interruption des captures** : 86,5 % des captures s'arrêtent sur un
  mouvement de l'opérateur (`RAIL_STATE_CHANGED` 33 %, `VIEW_CHANGED` 33 %,
  `TARGET_CHANGED` 21 %), 5 % vont au bout. Durée médiane 733 ms, p90 1 881 ms.
  *Hypothèse non démontrée* : l'opérateur se déplace plus vite que la capture ne
  finit. La vérifier demanderait de croiser les intentions clavier avec les
  instants de capture.
- **KI-005** : diagnostic fait, correctif différé.
- **Répétabilité humaine jamais mesurée.** Si Mic replace deux fois le même cut
  à l'aveugle et obtient 4 d'écart, alors le cerveau à 2,77 est déjà sous le
  bruit de label et il n'y a plus rien à gagner. **C'est la mesure la plus
  importante qui manque** et elle coûte ~30 minutes.

---

## 11. Erreurs commises pendant ce chantier

À lire pour ne pas les répéter.

1. **L'outil de fusion perdait des données en silence.** Il prenait les
   métadonnées du premier segment → 20 visites au lieu de 43, tout en annonçant
   « 0 manquant ». Corrigé par sémantique d'union + contrôle d'intégrité sur
   l'union.
2. **Le premier correctif de budget était pire que le défaut** : mesurer les
   métadonnées dépliées a produit **802 segments, 10,8 Go**.
3. **Une variable masquée** (`const L` là où `L` était le module LiDAR) a fait
   échouer toutes les captures en `READ_ERROR`.
4. **Une mesure juste sur la mauvaise grandeur** : « 8 % qualifiés » était un
   comptage exact d'une grandeur qui ne décidait de rien. Trouvé seulement en
   remontant du chiffre affiché jusqu'aux motifs individuels.
5. **Un cerveau livré sans être branché**, avec des résultats annoncés comme
   s'ils s'appliquaient. Mic a testé le moteur seul en croyant tester le cerveau.
6. **Une garantie de sûreté qui ne tenait pas** (§7), testée contre des seuils
   au lieu de la condition réelle du moteur.
7. **Deux builds indiscernables** : « 4.5.5b » s'annonçait comme 4.5.5.
8. **Un estimateur physique essayé et abandonné** : ramener le contour sur les
   médianes du nuage par bande donne une erreur médiane de **173** contre 5,20.
   Les médianes sont dominées par des points loin de la tête. Consigné pour que
   personne ne le retente.

**Le motif récurrent, et le plus important** : conclure depuis le corpus qu'on a
sous la main sans avoir d'abord demandé s'il représente ce sur quoi on
généralise. Le corpus de corrections a piégé l'analyse deux fois de suite.
Devant tout chiffre, la question qui tranche est : *mesuré sur quoi, et est-ce
que ça ressemble au travail réel ?*

---

## 12. Reproduire

```bash
node tools/verify.cjs                    # banc complet, 339 tests
node tools/brain-dataset.cjs CHEMIN/banane-corrections-*.json --out jeu.json
node tools/brain-fit.cjs --input jeu.json --dev 20 --reserve 17 --out audit/brain-fit-v1.json
node tools/merge-segments.cjs --out fusion.json segments/*.json
node tools/export-simulate.cjs --input session.json --out-dir segs --segment-bytes 40000000
```

Documents : `CHANGELOG_V45R.md` (journal détaillé), `BRAIN_V1.md` (rapport du
cerveau), `KNOWN_ISSUES.md`, `DECISIONS.md`, `PLACEMENT_LAB.md` (contrat du banc
de placement).

---

## 13. Priorités, par rapport valeur/coût

1. **Mesurer la répétabilité de Mic** (~30 min de son temps). Détermine s'il
   reste de la marge avant de poursuivre le cerveau.
2. **Réajuster le cerveau sur la collecte Natif** (§9). Corrige le biais de
   corpus du §8, apporte 5 parts nouvelles.
3. **Trancher la question du clipping dans ESV** (~2 min de son temps). Décide
   si l'amont est réparable.
4. **Continuer à observer les sélections du cerveau**, en notant pour chaque cut
   si le choix était bon. Quelques dizaines de jugements remplaceraient un
   chiffre qu'on sait faux par un chiffre réel.

Ce qui restera hors de portée sans nouvelles données : **le profil**. Tout le
corpus disponible est en U50.
