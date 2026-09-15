# Banane V4.5-R — journal des versions

Moteur de placement **gelé** depuis le début : `src/geometry.js`, `src/engine.js`,
`vendor/capture-core.js` et `vendor/lidar.js` sont inchangés dans toutes les
versions ci-dessous. `verify.cjs` n'a jamais été modifié.

Depuis la **4.5.0**, l'extension annonce sa version dans `manifest.json`,
`src/core.js`, la pastille flottante et l'interface — **4.5.7** pour la présente
livraison. Depuis la 4.5.4 il n'existe plus qu'**une seule page**, `panel.html`,
dont les vues sont des onglets internes. Les versions v4.5.1 à v4.5.5
mentionnées plus bas étaient des livraisons expérimentales antérieures, toutes
marquées `4.4.3` dans le manifeste.

Le suffixe « TEST » est **conservé** : le mode Natif reste strictement passif,
la confirmation serveur n'est pas observée et les unités ne sont pas calibrées
indépendamment (KI-001, KI-003, KI-009, KI-013, KI-019 ouverts). Retirer
« TEST » laisserait croire à une certification qui n'existe pas.

---

## 4.5.7 — 15 septembre 2026 — **une sélection appliquée toute seule : garde-fou refait**

Banc : **337 / 337**, `geometryUnchanged: true`.

### Le trou, trouvé au premier lot réel

Cut 6/4245. Le cerveau a sélectionné un candidat sur le rail droit, avec
`confidence: 0` et le motif « jamais à appliquer automatiquement ». **Le pilote
l'a appliqué quand même.**

Ma garantie reposait sur : confiance nulle ⟹ le pilote met en pause. Elle est
fausse. `src/engine.js` ligne 233, gelé :

```js
if(b.step==='apply' && low && scope.lowConfidence!=='attempt')
```

Avec la politique « Tenter la proposition expérimentale », la confiance n'est
plus consultée du tout. Le garde-fou ne tenait que pour l'autre politique.

### Le correctif

La sélection est coupée **à la source**, au démarrage du lot, quand la politique
permet de tenter. Le rail ambigu redevient alors `unresolved`, ce qui met le lot
en pause par le chemin `missing` — branche qui précède toute question de
confiance dans le moteur gelé.

Le biais vertical, lui, n'est jamais coupé : il conserve la confiance du moteur
et n'a jamais été en cause.

Le panneau le dit à l'écran quand la combinaison se présente, plutôt que de le
faire en silence.

Quatre tests ajoutés, dont un qui rejoue la condition exacte du moteur gelé pour
que personne ne se remette à croire que `confidence: 0` protège à lui seul, et
un qui vérifie statiquement l'ordre de chargement — une réorganisation de
`importScripts` casserait le branchement sans rien signaler.

### Ce que le cerveau a réellement fait sur 4245

| rail | qui a décidé | déplacement |
|---|---|---|
| gauche | **le moteur gelé** (graine, rapport de perte 9,41) | −56,0 latéral |
| gauche | le cerveau, biais vertical seul | +4,55 vertical |
| droite | **le cerveau**, sélection « graine » par accord de dévers | −3,0 latéral, +1,55 vertical |

Le grand placement visible à gauche est celui du moteur, pas du cerveau. La
seule décision du cerveau est le petit déplacement à droite.

---

## 4.5.6 — 15 septembre 2026 — **le cerveau branché, éteint par défaut**

Banc : **331 / 331**, `geometryUnchanged: true`. Les quatre empreintes gelées
sont identiques à la référence 4.4.0, vérifiées en plus par un test dédié.

### Comment il est branché sans toucher au moteur

`src/engine.js` est gelé et lie sa géométrie **au chargement**, depuis
`globalThis.BananeGeometry3` ; la proposition est construite ligne 95 et rangée
dans `this.s.proposal`, que `apply` consomme. Il n'existe aucun autre point
d'accroche.

`src/geometry-brain.js` se charge **entre** `geometry.js` et `engine.js` dans la
liste `importScripts` de `background.js` et y substitue une composition
« géométrie gelée + cerveau ». La géométrie d'origine reste accessible sous
`BananeGeometryFrozen`.

Quatre propriétés, chacune verrouillée par test :

- aucun fichier gelé n'est modifié ni muté ;
- `proposeBoth` est **le seul** point d'interposition — `DEFAULTS`, `median`,
  `robustLine`, `enforcePairSupport` et `propose` passent par identité ;
- **éteint, la composition est transparente** : elle rend exactement ce que rend
  la géométrie gelée, sans aucune marque ;
- une défaillance du cerveau rend la proposition gelée telle quelle, jamais une
  erreur — le cerveau ne peut pas empêcher le moteur de répondre.

### Éteint par défaut, et pourquoi

Interrupteur dans la vue Pilote, avec le compte rendu de ce que le cerveau a
fait au dernier passage. Chaque proposition qu'il touche porte `brainApplied`,
une `source` en `+brain-bias` ou `brain-candidate-selection`, et un motif
lisible par l'opérateur.

Il est éteint par défaut parce que **ses réglages sont ajustés sur un corpus
biaisé**. Mesure faite sur la session Natif de la part 6 (101 cuts, geste réel)
contre le corpus de corrections qui a servi à l'ajustement :

| | part 6, travail réel | parts 17/20, corrections |
|---|---:|---:|
| rails effectivement déplacés | 56 % | 80 % |
| amplitude médiane | 3,71 | **16,92** |
| p90 | 33,10 | 58,46 |

Les gestes du corpus d'ajustement sont **4,5 fois plus grands** à la médiane :
une session de correction s'ouvrait quand il y avait à corriger, le Natif
enregistre aussi les cuts déjà bons. Le garde-fou latéral du cerveau, tiré du
p90 de ce corpus (50,2), est donc trop permissif sur le travail réel.

Corollaire, qui corrige une affirmation de la 4.5.5 : la règle d'appui de paire
du moteur refuse **3 %** des cuts sur la part 6, pas 11 % comme mesuré sur le
corpus de corrections. Sur les cuts 3604 et 4244 elle refusait des déplacements
de 72 et 63, au-dessus du p90 observé (33). Elle avait probablement raison.

### Version identifiable

La 4.5.5b s'annonçait en interne comme 4.5.5, rendant les deux builds
indiscernables dans les exports. Corrigé.

---

## 4.5.5 — 15 septembre 2026 — **le cerveau de placement, ajusté et évalué**

Banc : **321 / 321** (201 de référence + 120 ajoutés), `geometryUnchanged: true`.
Moteur gelé inchangé, octet pour octet.

`src/brain.js` post-traite la sortie du moteur. Il ne relit ni nuage ni contour,
n'a aucune dépendance, et n'invente aucun candidat. Détail complet, limites
comprises, dans **`BRAIN_V1.md`**.

Corpus : 110 cuts, 220 rails de corrections humaines. Découpage par **parts
entières** — développement part 20 (168 rails), réservé part 17 (52 rails),
évalué une seule fois avec des réglages déjà figés.

| mesure | développement | **réservé** |
|---|---:|---:|
| propositions avant → après | 127 → 141 | 46 → 49 |
| erreur médiane avant → après | 5,20 → 3,06 | **4,24 → 2,77** |
| améliorés / dégradés | 93 / 34 | 32 / 14 |

(×10⁻³ unités de scène — **pas** des millimètres.)

**Ce qu'il fait.** Il retire un biais vertical systématique : sur 173 rails,
l'humain place plus haut de +4,28 ± 3,20, moyenne supérieure à l'écart-type. Le
résidu latéral vaut −0,82 ± 12,73 — du bruit — et **la règle d'ajustement le
rejette d'elle-même**. Il tranche aussi entre les trois candidats que le moteur
expose déjà, par accord de dévers avec le rail opposé.

**Ce qu'il ne fait pas.** Une sélection porte `confidence: 0` : le pilote la met
donc en pause quel que soit le seuil, et ne l'applique jamais seul. Motif : sur
le développement, 2 des 14 sélections étaient fausses de ~82. Une sélection est
une piste à regarder en mode assisté, pas une position à appliquer.

**Limites, en clair.** 14 rails sur 46 sont dégradés par la correction de biais
sur le bloc réservé — le gain est sur la médiane, pas sur chaque rail. Un seul
bloc réservé, 52 rails, une seule part, un seul profil. Un estimateur physique
direct a été essayé et **abandonné** : erreur médiane 173 contre 5,20.

---

## 4.5.4 — 15 septembre 2026 — **une seule fenêtre, et 616 « échecs » qui n'en étaient pas**

Banc : **302 / 302** (201 de référence + 101 ajoutés), `geometryUnchanged: true`.

Corpus d'appui : **22 sessions réelles** du 15/09 (11 en 4.5.2, 11 en 4.5.3),
1 006 « échecs » de capture analysés un par un.

### Le taux d'échec de capture était faux, et de très loin

Le panneau annonçait jusqu'à **53 % d'échec** en rouge. Décompte des motifs sur
les 22 sessions :

| motif | 4.5.2 | 4.5.3 | nature |
| --- | ---: | ---: | --- |
| `capture-limit-per-visit-reached` | 530 (86 %) | 364 (93 %) | budget respecté |
| `Cible différente : cut` | 86 (14 %) | 26 (7 %) | refus légitime |
| **panne réelle** | **0** | **0** | — |

Aucune panne de capture sur 22 sessions. Le taux d'échec porte désormais
uniquement sur les vraies pannes ; budget et refus sont comptés et affichés à
part, avec la mention qu'ils sont normaux.

### Le budget par visite coupait avant la géométrie

Plus grave que l'affichage : le budget plat de 8 captures par visite coupait
parfois avant que les deux côtés soient qualifiés.

| | visites coupées | dont géométrie incomplète |
| --- | ---: | ---: |
| 4.5.2 | 48 | **26 (54 %)** |
| 4.5.3 | 25 | **9 (36 %)**, dont 6 sans aucun côté qualifié |

Le budget refusait donc exactement les captures qui manquaient. Il cède
maintenant tant qu'un côté n'a pas d'instantané qualifié (plafond porté à 24,
qui reste une borne dure), et reprend à 8 une fois la géométrie acquise —
à ce stade continuer ne fait que grossir l'export.

### Le vidage automatique ne libérait rien

Le vidage se déclenchait bien vers 30-37 Mo, mais la session ne repartait
jamais de zéro :

- session `3dd20460` — segment automatique de 314 objets à 09:39, export final
  de 680 objets à 09:41 : les 314 déjà écrits l'étaient une seconde fois ;
- session `28bfe0a5` (4.5.3) — 77,3 Mo accumulés pour 646 objets, dont 315
  déjà sur disque.

Un objet acquitté est désormais **purgé d'IndexedDB**. Deux garde-fous :
`cloudIds` garde la liste complète de tout ce qui a été produit, et
`merge-segments.cjs` contrôle l'intégrité sur l'**union** des identifiants
déclarés. Un segment automatique absent de la fusion est donc nommé, pas perdu
en silence. La purge rend la perte détectable au lieu de la masquer.

*Fait observé, à porter au crédit de la 4.5.3 :* la session `28bfe0a5`, 77,3 Mo
et 646 objets, s'est exportée proprement en 2 segments **sans erreur 64 Mio**.
Le mur du message est bien tombé ; ce qui restait était l'accumulation.

### Bouton « Annuler cette session »

Supprime nuages, visites et événements de la session en cours. Irréversible,
confirmation explicite chiffrée, aucun export produit, et le compte de ce qui a
été supprimé est affiché — un effacement muet ne serait pas vérifiable. Les
segments déjà téléchargés sur le disque ne sont pas touchés.

### Une seule fenêtre, navigable

Avant : cinq pages HTML, cinq fenêtres popup. Ouvrir le Natif depuis l'accueil
laissait deux fenêtres empilées ; la reprise manuelle en ouvrait une troisième.

Désormais une seule page avec une barre d'onglets — Accueil, Natif, Pilote,
Assisté — la vue portée par le fragment d'URL. Une demande d'ouverture sur une
fenêtre déjà présente la ramène au premier plan et lui demande de changer de
vue. Le test correspondant est plus strict que l'ancien : quelle que soit la
suite de demandes, il n'existe jamais qu'une fenêtre.

### Mode Correction retiré

`corrections.html` supprimée, `manual-page.js` n'est plus injecté dans la page
ESV, et `manual-start` / `manual-pause` / `manual-resume` sont refusées.
`manual-end` et `manual-download` restent ouvertes : retirer un mode ne doit pas
rendre illisibles les données déjà enregistrées avec.

### Note sur `tools/verify.cjs`

Le relevé d'empreintes (ligne 15) énumérait les cinq pages HTML. Il découvre
maintenant les pages présentes. Ce relevé **n'assure aucun contrôle** : le
moteur gelé est vérifié lignes 11-13 contre
`audit/v4.4.0-frozen-engine-hashes.json`, fichier non modifié, et les quatre
empreintes gelées restent identiques à la référence.

---

## 4.5.3 — 15 septembre 2026 — **le mur des 64 Mio, et une mesure qui mentait**

Banc : **288 / 288** (201 de référence + 87 ajoutés), `geometryUnchanged: true`.

### Le vrai mur de l'export n'était pas le téléchargement

Sur une session de 92 visites, l'export s'arrêtait après 2 segments, 717 objets
sur 977 sauvés, avec `Message exceeded maximum allowed size of 64MiB`.

Le plafond n'est **pas** celui du fichier téléchargé : c'est celui d'un message
`chrome.runtime.sendMessage` entre le panneau et le service worker. L'ancien
chemin renvoyait toute la session — visites, événements, identifiants — dans
une seule réponse. Passé 64 Mio de métadonnées, le message est refusé et
l'export s'interrompt là où il en est.

Correctif :

- `exportManifest()` renvoie un **manifeste léger** : la session sans ses
  visites ni ses événements, plus les compteurs et la liste des identifiants
  de nuages restant à écrire ;
- le panneau lit visites, événements et nuages **directement dans IndexedDB**
  (`BananeStorage3`, même origine que le service worker), avec repli sur le
  message si le magasin n'est pas joignable ;
- fin de session et re-téléchargement passent par ce même chemin.

Le volume transitant par message ne dépend donc plus de la taille de la
session. `tests/export-manifeste.test.cjs` verrouille la propriété : le
manifeste ne porte aucune visite ni aucun événement, et reste sous
`LIMITE / 8`.

### Une mesure de qualité qui donnait un chiffre juste sur la mauvaise chose

Le panneau affichait « Instantanés qualifiés : 9 / 119 — 8 % » et passait la
boîte en alerte. Le comptage était exact, mais il mesurait les **instants de
capture** et traitait en échec toute capture arrêtée par un changement de
cible, de vue ou de découpe — motif `capture-interrupted-before-stable-boundary`.

Sur la session du 15/09 (21 visites, 190 blocs, 69 résumés), reproduction faite
sur l'export lui-même :

| lecture | résultat |
| --- | --- |
| instants de capture qualifiés | 9 / 119 — **8 %** |
| dont écartés pour interruption **seule** | 86 sur 110 |
| dont portant un défaut de couverture réel | 24 sur 110 |
| **repères ayant obtenu un instantané qualifié** | **34 / 34 — 100 %** |

Aux instants écartés, la médiane était de **6 bandes longitudinales** (minimum
requis : 6) et **151 points utiles** (minimum requis : 64). La couverture était
donc suffisante : l'écart tenait à la provenance, pas au nombre de points.

Ce qui conditionne réellement une proposition du moteur, c'est qu'un instantané
qualifié ait existé **pour ce repère**. C'est désormais le chiffre de tête :
« Repères avec instantané qualifié ». Le taux par instant reste affiché, mais
dit maintenant combien d'écarts tiennent à l'interruption seule.

Le statut `insufficient` du moteur n'est **pas** modifié : rester prudent sur un
instantané pris à cheval sur une interruption est le bon comportement. Seule la
lecture qu'en fait le panneau change.

`tests/qualite-mesure.test.cjs` (11 tests) rejoue la session réelle et verrouille
les deux lectures ainsi que l'écart entre elles.

### La note de santé nomme sa cause

La capture du 15/09 montrait « NIVEAU DU COLLECTEUR : complet » au-dessus de
« La collecte est gênée » : deux affirmations contradictoires, dont aucune
n'indiquait que l'alerte venait du taux d'échec de capture. La note énumère
désormais les causes effectivement déclenchantes, chiffrées, et les refus
définitifs y sont signalés comme normaux plutôt que comptés comme pannes.

### Terrain du 15/09 au matin (v4.5.2, session 52a880f3)

21 visites, 259 objets LiDAR, un seul segment, `FINISHED`. Fait observé :
`dropped: 0`, `sendFailures: 0`, `setAside: 0`, `queueDepthMax: 10`,
`degradationLevels: ["FULL"]`, 6 captures échouées sur 75 (**8 %**). Aucun
identifiant manquant : 259 déclarés, 259 présents.

Non traité, documenté : le clipping retire **47 %** des points de la zone
(163 003 conservés contre 147 076 retirés) et **52 %** du flanc interne. Le
filtre n'est pas contourné — un point non visible peut appartenir à un autre
cut. C'est une perte mesurée, pas un gain annoncé.

---

## 4.5.2 — 15 septembre 2026 — **le verrou du rendement identifié**

Banc : **272 / 272** (201 de référence + 71 ajoutés), `geometryUnchanged: true`.

**Le flanc interne est le verrou, et le clipping en retire les deux tiers.**
Diagnostic mené sur une session réelle de 670 nuages, en reproduisant la
projection du moteur sans le modifier :

- la capture est symétrique (mêmes points en ROI, mêmes tranches) ;
- le flanc interne est quasi invisible des DEUX côtés : médiane 0 point à
  gauche, 1 à droite, pour un seuil `minFace` de 6 ;
- en comptant les points retirés par le filtre de visibilité, **16 chunks
  atteignaient le seuil à gauche contre 47 sans le filtre**, 15 contre 49 à
  droite — environ trois fois plus.

Le filtre n'est PAS contourné : un point non visible peut appartenir à un autre
cut et contaminerait l'ajustement. La perte est désormais **mesurée par bande**
dans chaque capture (`clipLoss`), agrégée dans la session, et affichée en
direct. La cause se voit pendant la collecte au lieu de se redécouvrir par une
enquête hors ligne.

Nouvel outil `tools/diagnose-asymmetry.cjs` : où se situe le champignon par
rapport à la fenêtre de recherche du moteur, quel serait le meilleur nombre de
points de plan de roulement atteignable, et le flanc est-il seulement présent.

**Tests bâtis sur la forme réelle.** Les cinq défauts d'export des 14 et 15
septembre ont tous été trouvés par les données de terrain, jamais par les tests
synthétiques, qui ne reproduisaient pas la vraie structure. Un extrait réduit
d'une session réelle (`tests/fixtures/terrain-reel.json`, 118 nuages, 8 visites)
sert maintenant de base à neuf tests d'export, dont l'invariant central :
**quel que soit le découpage, refusionner rend la session entière**, points
compris.

**Rétablissement du collecteur prouvé par injection de pannes.** Le correctif le
plus important du chantier n'avait jamais été exercé en conditions réelles,
faute de session dégradée. Sept tests rejouent la séquence d'événements réelle
en provoquant coupures, refus définitifs et saturation, et vérifient un
invariant de **conservation** : tout élément mis en file finit envoyé, ou compté
comme jeté, ou écarté avec sa cause. Rien ne disparaît en silence.

**Interface.** Bloc « Qualité de capture » : instantanés qualifiés, points
retirés au clipping, et flanc interne conservé avec son taux de retrait. Passe
en alerte quand le clipping retire la majorité du flanc, avec l'explication.

## 4.5.1 — 15 septembre 2026 (après retour terrain v4.5.4)

Banc : **256 / 256**.

- **Une queue trop courte n'est plus isolée dans son propre segment.** Chaque
  segment répète les métadonnées et reconstruit son dictionnaire : mesuré sur un
  export réel, un segment de queue isolait **1,8 Mo de nuages utiles au prix de
  13,4 Mo de surcoût**. On ne coupe désormais que si le segment courant est déjà
  substantiel ET si ce qui reste justifie son propre surcoût.
  Vérifié sur la session du 15/09 à 07:27 : **1 segment de 47,9 Mo au lieu de 2
  totalisant 61,3 Mo**.
- `exportTrace` figé à chaque fermeture de segment, et plus seulement après la
  boucle : il manquait dans tous les segments sauf le dernier (observé sur le
  terrain, présent dans 3 fichiers sur 4).
- Cinq tests de découpage : session tenant dans le budget, queue courte, queue
  substantielle, absence de segments minuscules, budget portant sur le fichier
  écrit.

## 4.5.0 — 15 septembre 2026 — **PREMIÈRE VERSION OFFICIELLE**

Banc : **251 / 251** (201 de référence + 50 ajoutés), `geometryUnchanged: true`.

- **Version officielle 4.5.0** dans `manifest.json`, `src/core.js`,
  `src/bridge.js`, `background.js` et les cinq pages. `src/engine.js`, pourtant
  gelé, lit `K.VERSION` : la montée de version n'a demandé aucune modification
  du moteur.
- **Réglages réunis dans `src/settings.js`.** Ils vivaient dans quatre fichiers ;
  chaque valeur porte désormais son unité, sa raison d'être et la mesure de
  terrain qui l'a fixée. Les seuils géométriques restent dans le moteur gelé, et
  un test vérifie qu'aucun d'eux ne se glisse dans les réglages de collecte.
- **Onze tests de cohérence des réglages** : ordre des seuils de file,
  hystérésis suffisante, marge sous la limite de téléchargement, plancher
  d'objets par segment, cohérence version manifeste/code.
- **Interface.** Le bloc « Santé de la collecte » utilisait des couleurs claires
  héritées d'un thème générique, invisibles sur le fond sombre de Banane : refait
  aux couleurs de la charte, avec un état sain explicite. Nouvelle section
  « Réglages de la collecte » consultable dans la fenêtre Natif. Progression
  d'export lisible pendant l'écriture des segments.

## v4.5.5 — 15 septembre 2026 (après retour terrain v4.5.3)

Banc : **240 / 240**.

- **`exportTrace` manquait dans tous les segments sauf le dernier.** La trace
  n'était posée qu'après la boucle des nuages, or les segments intermédiaires
  sont fermés pendant la boucle. Observé sur le terrain : présente dans 3
  fichiers sur 4, absente du `seg01` de l'export final. Elle est désormais
  figée à chaque fermeture, avec l'état cumulé à cet instant, l'index du
  segment et le nombre d'objets qu'il contient en propre.

## v4.5.4 — 15 septembre 2026 (matin, après second retour terrain)

Banc : **240 / 240** (201 de référence + 39 ajoutés).

- **Budget de segment corrigé.** Il ne comptait que les nuages : un export réel
  de 27,3 Mo de nuages produisait un fichier de 40,7 Mo une fois ajoutés 7,2 Mo
  de dictionnaires et 6,2 Mo de métadonnées. Le budget porte désormais sur le
  poids réel du fichier (en-tête replié + nuages + dictionnaires), avec suivi
  incrémental du poids des dictionnaires dans l'interner.
- Budget porté à 48 Mo avec une réserve de 4 Mo. Vérifié sur une session réelle
  de 189 Mo : 2 segments de 46,1 et 29,0 Mo, contre 40,7 et 34,4 Mo auparavant.
- **Plancher de 48 objets par segment.** Sans lui, une session aux métadonnées
  volumineuses dégénérait : une première tentative de correction, qui mesurait
  les métadonnées non repliées, a produit 802 segments d'un objet chacun.
- Trois tests de non-régression sur le suivi de poids.

## v4.5.3 — 15 septembre 2026 (matin, après premier retour terrain)

Banc : **237 / 237**.

- **Fusion de segments : perte silencieuse de visites corrigée (grave).** Les
  nuages d'un segment sont incrémentaux, mais les métadonnées sont un
  instantané complet au moment du vidage. L'ancienne fusion prenait celles du
  premier segment : sur deux segments réels, elle rendait 20 visites au lieu de
  43 et 781 événements au lieu de 1 626, tout en annonçant « 0 manquant ».
  Désormais : union des records et des événements, état de session le plus
  avancé retenu, contrôle d'intégrité sur l'union des `cloudIds`, tri par
  horodatage plutôt que par nom de fichier.
- `exportTrace` n'atterrissait jamais dans les fichiers : l'en-tête était
  sérialisé avant son calcul. L'en-tête est maintenant écrit à la fermeture.
- Numérotation des segments continue sur la session au lieu de repartir à
  `seg01` à chaque vidage automatique.
- Cinq tests de non-régression sur la fusion.

## v4.5.2 — 15 septembre 2026 (nuit)

Banc : **232 / 232**.

- **Refus définitifs distingués des pannes.** La session refuse par conception
  certains envois (`Cible différente : cut`, `chunkId` déjà utilisé, visite
  inconnue). Ils étaient comptés comme des échecs de transport, d'où réessais
  inutiles puis bascule en `METADATA_ONLY`. Ils sortent désormais immédiatement
  avec leur cause, sans dégrader le collecteur.
- Profondeur de file portée de 128 à **512** : 128 était atteint sur les deux
  sessions dégradées du corpus historique.
- `coverage()` était **O(n²)** précisément quand la qualification n'arrive
  jamais — les cas qui dominent les pertes. Accumulateur incrémental O(1) ;
  `coverage()` délègue au même code, donc l'équivalence est vraie par
  construction. Mesure : 32 000 points, **197,1 → 30,3 ms**.
- Tampons `railTotals` et `visibleTotals` supprimés : jusqu'à 50 000 points × 3
  coordonnées par rail et par capture cessent d'être conservés.
- `Math.max(...xs)` levait `RangeError` au-delà d'environ 125 000 points
  (latent avec les réglages actuels, mais bloquant toute hausse de limite).
- Bloc « Santé de la collecte » dans la fenêtre Natif, rafraîchi toutes les 5 s.

## v4.5.1 — 14 septembre 2026 (soir)

Banc : **229 / 229**.

- **Mur des 64 Mo levé.** `panel.js` construisait `serialized.join(',')`, soit
  une chaîne JavaScript unique de la taille de tous les nuages réunis. Le Blob
  reçoit désormais les morceaux séparément et chaque nuage est relâché aussitôt
  sérialisé.
- **Format compact** `banane-native-session-v3-compact` : repères, identités,
  observations de vue et repères de coordonnées internés ; `pointsProfileLocal`
  (dérivable) et `pointSources` (diagnostic) retirés et déclarés. Gain mesuré
  de 61 à 67 % sur trois sessions réelles.
- **Équivalence prouvée** : `rails.json`, `overlays.json` et les 26
  superpositions SVG identiques au bit près après réhydratation, y compris
  depuis trois segments refusionnés.
- **Vidage automatique** au seuil de 36 Mo en attente, pendant la collecte.
- **Dégradation du collecteur redevenue réversible**, avec hystérésis et pic
  conservé pour le diagnostic. Auparavant un seul échec d'envoi coupait le
  LiDAR pour toute la session.
- **File d'envoi débloquée** : réessais bornés avec temporisation croissante,
  puis mise à l'écart de l'élément fautif avec sa cause.
