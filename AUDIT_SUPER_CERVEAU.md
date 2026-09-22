# AUDIT — SUPER CERVEAU / SUPER MOTEUR DE PLACEMENT

22 septembre 2026 · base `v4.7.0` (`efe6bab`) · lecture seule, aucun fichier modifié

Objectifs soumis à l'audit, **déclarés comme cibles et non dérivés d'une mesure** :
réduire de 90 % les mauvais placements, et de 90 % les différés.

Chaque énoncé ci-dessous est étiqueté **MESURÉ**, **ÉTABLI PAR LECTURE DU CODE**
ou **NON ÉTABLI**. Rien n'est présenté comme acquis sans sa source.

---

## 1. Ce que le moteur fait réellement

**ÉTABLI PAR LECTURE DU CODE** — `src/geometry-candidate-v1.js`, `propose()`.

Le placement d'un rail se fait en deux temps, et c'est essentiel pour la suite.

**Temps 1 — recalage de gabarit par balayage de grille.** Le contour CAO du rail,
fourni par ESV, est projeté en 2D dans le repère profil : `u` latéral, `z`
vertical. On en tire des ancres sur le dessus du champignon (`topAnchors`) et sur
le flanc interne (`faceAnchors`). Pour chaque décalage (u, z) d'une grille de
**±80 mm × ±40 mm au pas de 3 mm** — environ 1 400 positions — on calcule :

```
perte(u,z) = médiane sur les ancres de ( distance² au point LiDAR le plus proche )
             chaque terme PLAFONNÉ à 0,025² soit 25 mm
```

Le minimum donne une amorce.

**Temps 2 — deux droites robustes, et leur intersection.** Depuis cette amorce on
ajuste une droite au plan de roulement (`topRows`) et une au flanc interne
(`faceRows`), par médiane de pentes. **Le delta publié est l'intersection de ces
deux droites**, pas l'amorce du gabarit.

L'amorce ne sert donc qu'à **désigner le bon voisinage de points**. La précision
vient des deux ajustements. Cette séparation explique tout ce qui suit.

**Portes d'admission** : `top.count ≥ 15` (`minTop`), `faceCount ≥ 6`
(`minFace`), pentes non saturées, et `lossRatio ≥ 1,5` (competitive set).

**Confiance publiée** :

```
confiance = 100 × min(1, top/15, face/6, binsTop/5, binsFace/3) × exp(−résidu/0,006)
```

---

## 2. Le défaut structurel central

**ÉTABLI PAR LECTURE DU CODE.**

Reprenez la formule de confiance. Elle est composée du **nombre de points**, de
la **couverture en bandes**, et du **résidu d'ajustement**. Elle ne contient
**aucun terme** portant sur la question de savoir si la surface ajustée est la
bonne.

Elle répond à : *« ai-je ajusté proprement un plan ? »*
Elle ne répond pas à : *« ce plan est-il le champignon du rail ? »*

C'est une mesure de **qualité d'ajustement**, pas de **justesse de
correspondance**. Un gabarit qui se verrouille sur le patin du rail, sur le rail
voisin ou sur une arête de ballast y trouvera beaucoup de points, bien alignés,
à faible résidu — et sortira avec une confiance élevée.

**MESURÉ** : c'est exactement ce que le terrain a produit. Sur le lot du
21 septembre, un candidat A_STAR à **confiance 78 était faux de 78 mm**. Sur les
neuf cuts signalés et réellement appliqués, la correction humaine vaut **69 à
124 mm sur un seul rail** et environ zéro sur l'autre.

Le plafonnement de la perte à 25 mm aggrave le phénomène : au-delà, chaque ancre
contribue une constante. Dans les zones peu denses la perte devient **plate**,
sans gradient, et les plateaux engendrent des minima parasites.

**Conséquence de conception** : le garde d'écartement n'est pas une rustine. Il
est le **seul contrôle du système qui utilise une information de paire**. Le
pipeline par rail ne peut structurellement pas voir cette contrainte globale.

---

## 3. Les trois modes d'échec, et leur poids

**MESURÉ** sur le lot Edge du 21 septembre, partie 15, 74 cuts / 148 rails,
rejouable depuis `tests/fixtures/gauge-part15-smoke.json`.

| Mode | Mécanisme | Poids |
|---|---|---:|
| **E1 — Minimum parasite** | Le gabarit désigne le mauvais voisinage ; les deux droites ajustent proprement les mauvaises surfaces ; confiance élevée, placement faux de 69 à 124 mm | 10 cuts / 74 |
| **E2 — Famine du rail gauche** | `top.count` = 6 pour un seuil de 15 → abstention | 16 rails / 148, soit 16 cuts différés |
| **E3 — Ambiguïté réelle** | `lossRatio < 1,5` : deux placements concurrents plausibles | ~2 cuts |

**E1** est aujourd'hui entièrement intercepté par le garde d'écartement — mais
intercepté veut dire **différé**, pas corrigé. **MESURÉ** (KI-032) : sur ces
10 cuts, **0 sur 10** admettent un couple admissible dont les deux cellules
restent dans le competitive set. Le moteur **n'a pas produit** la bonne réponse ;
il n'y a pas de meilleur choix à faire parmi ce qu'il expose.

**E2** : cause **NON ÉTABLIE**. Le constat est mesuré — 43 à 50 points à droite
contre 6 à gauche à capture symétrique, deux sessions indépendantes du
15 septembre — mais on ignore s'il tient à la capture (ROI, clipping, LOD,
occultation) ou à la géométrie du moteur. `tools/diagnose-asymmetry.cjs` est
écrit et attend un export.

---

## 4. Objectif 1 — « 90 % de mauvais placements en moins »

### Le dénominateur n'existe pas

**NON ÉTABLI, et c'est le principal résultat de cet audit.**

Depuis 4.7, les 10 mauvais placements grossiers ne sont plus appliqués : ils sont
différés. Les mauvais placements qui subsistent sont donc, par construction, ceux
qui **franchissent le garde d'écartement** — c'est-à-dire les erreurs
**common-mode**, qui déplacent les deux rails en conservant l'écartement, ou les
erreurs longitudinales.

**Leur nombre n'a jamais été mesuré.** Le cahier 4.7 énonce explicitement que le
garde ne les couvre pas. L'observation terrain post-garde indique des retouches
humaines « de l'ordre de quelques mm » après les placements acceptés — mais c'est
un petit échantillon et une impression, pas un comptage.

> **On ne peut pas réduire de 90 % une quantité qui n'a jamais été comptée.**

**Premier livrable exigible du chantier** : mesurer le taux d'erreur résiduel des
placements acceptés, par comparaison à la correction humaine, rail par rail, sur
un lot post-4.7. Sans ce dénominateur, l'objectif 1 n'est ni pilotable ni
vérifiable.

### Ce qui réduirait réellement les mauvais placements

Le levier n'est pas un meilleur régresseur de position. C'est un **score de
justesse calibré** qui remplace la confiance actuelle.

Aujourd'hui rien ne sépare « j'ai bien ajusté » de « j'ai ajusté la bonne
chose ». Un modèle qui apprend cette séparation :

- empêche les E1 d'atteindre l'application, **en amont** du garde d'écartement ;
- attrape les erreurs common-mode, que le garde ne voit pas par construction ;
- et surtout, **autorise à desserrer `minTop`** : un ajustement affamé mais juste
  devient distinguable d'un ajustement affamé et faux. C'est ce qui rend le
  desserrage du §7bis sûr au lieu d'aveugle.

---

## 5. Objectif 2 — « 90 % de différés en moins »

**MESURÉ.** Sur le lot de référence, la 4.7 donne 46 traités et 28 différés.
Une réduction de 90 % signifie 28 → 3, soit récupérer 25 sur 28.

| Origine | Cuts | Ce qu'il faudrait | Difficulté |
|---|---:|---|---|
| E2 — famine gauche | 16 | Donner au rail gauche les points qui lui manquent, **ou** desserrer `minTop` avec un score de justesse qui sécurise le desserrage | Dépend entièrement du diagnostic — **inconnue majeure** |
| E1 — paire hors contrat | 10 | Produire la **bonne** paire là où le moteur n'expose aujourd'hui aucune hypothèse admissible | Vrai problème de recherche |
| E3 — ambiguïté | ~2 | Observation supplémentaire ; KI-031 chiffre le coût de lever cette garde | Corpus V2 |

**Atteindre 90 % suppose de résoudre E1 *et* E2.** Résoudre E2 seul plafonne la
récupération à 16 sur 28, soit **57 %** — et amène la couverture de 62 % à 84 %.
C'est déjà considérable, et c'est le scénario le plus probable à court terme.

**MESURÉ, à rappeler** : sur les 10 cuts E1, la bonne réponse n'est pas parmi les
candidats produits. Aucun arbitrage, aucun réordonnancement, aucun modèle de
sélection ne la trouvera. Il faut **générer des hypothèses que le moteur ne
génère pas** — c'est un changement de méthode de génération, pas de sélection.

---

## 6. Ce que les données permettent

**MESURÉ** : 22 corrections rejouables sur 91, soit 24 %.

Mais il faut distinguer deux problèmes d'apprentissage, qui n'ont **pas du tout**
le même volume de données disponible.

**Apprendre la position** — cible : la position humaine finale. Exige la
correspondance géométrique complète. **22 rails.** Apprendre un placement 3D sur
22 exemples, c'est surajuster, quelle que soit l'architecture.

**Apprendre la justesse** — cible : l'ampleur de l'erreur du moteur. Le vecteur
de caractéristiques existe **déjà** : `metrics` contient `topCount`, `faceCount`,
`residual`, `binsTop`, `binsFace`, `templateLoss`, `lossRatio`, `separation`,
`alternative`, plus l'écartement de paire. Ils sont calculés à chaque cut et
**déjà présents dans l'export de diagnostic**.

Et l'étiquette est bien plus largement disponible : **l'écartement est mesurable
sur les 91 corrections**, parce que c'est une distance, pas un rejeu. Chaque
placement appliqué puis retouché fournit une amplitude d'erreur.

> Le modèle de justesse dispose d'un corpus plusieurs fois supérieur à celui du
> modèle de position, **sur des données déjà collectées**, et sans modifier le
> pipeline de capture.

C'est le résultat le plus exploitable de cet audit.

---

## 7. Architectures

### A1 — paramètres appris hors ligne

Se branche sur `metrics`, déjà calculé. Aucune dépendance, aucun coût runtime,
rejouable à l'identique. Peut porter un modèle réellement appris — arbres
boostés, régression logistique calibrée, petit réseau dense — dont on n'embarque
que les coefficients.

**Recommandation : A1 commence par le score de justesse, pas par la position.**
Plus de données, attaque le défaut structurel du §2, et sert les deux objectifs
à la fois.

### A2 — inférence embarquée

Travaille sur le nuage brut. C'est la seule voie capable de traiter E2 si la
cause est géométrique : un modèle peut apprendre à trouver le plan de roulement
là où l'extracteur géométrique échoue, et à proposer des hypothèses que le
balayage de gabarit ne produit pas — donc la seule voie vers E1.

Contraintes à instruire **avant** de choisir l'architecture du modèle : service
worker MV3, **aucun code hébergé à distance** (politique Chrome Web Store :
runtime et poids dans le paquet), première dépendance externe du dépôt, budget
d'inférence par cut qui joue contre le chantier Pilot Fast.

### Le couplage, rendu concret

Il ne s'agit pas de fusionner deux modèles. La forme naturelle épouse
l'architecture existante :

```
A2  → génère des hypothèses de placement (y compris là où le gabarit n'en produit aucune)
A1  → score la justesse de chaque hypothèse, calibré
garde d'écartement → dernier contrôle de paire, inchangé
```

A2 attaque E1 et E2 en **génération**. A1 attaque le défaut du §2 en
**sélection**. C'est complémentaire, pas redondant — et c'est ce qui justifie de
mener les deux pistes.

---

## 8. Plafonds

**Ce qu'aucun modèle ne franchira.** Si le rail gauche ne porte réellement que
6 points sur son plan de roulement parce que la capture n'en livre pas
davantage, aucune architecture n'en invente. Le diagnostic du rail gauche décide
donc si l'objectif 2 est majoritairement accessible ou majoritairement bloqué.

> **C'est la mesure la plus déterminante de tout le programme 4.8**, et elle ne
> coûte qu'un export de session passé dans un outil déjà écrit.

**L'étalonnage physique n'est pas établi.** `physicalCalibrationStatus` ne
l'atteste pas : les unités sont des unités de scène, pas des millimètres
certifiés. Toute cible exprimée en millimètres hérite de cette incertitude.

**Aucune confirmation serveur ESV** n'est disponible. Une navigation observée
n'est pas un enregistrement.

---

## 9. Verdict

| Objectif | Atteignable ? |
|---|---|
| **90 % de mauvais placements en moins** | **Non évaluable en l'état** : le dénominateur n'a jamais été mesuré. Doit être compté avant d'être réduit. |
| **90 % de différés en moins** | **Non démontré.** 57 % semble accessible en résolvant la seule famine du rail gauche. Les 33 points restants exigent de générer des hypothèses correctes là où il n'en existe aucune — recherche, pas réglage. |

Ces réponses ne sont pas un refus des objectifs. Ce sont les conditions à réunir
pour pouvoir les viser avec des chiffres qui tiennent.

## 10. Trois mesures à obtenir, par ordre de valeur

1. **Diagnostic du rail gauche.** Un export de session dans
   `tools/diagnose-asymmetry.cjs`. Décide si l'objectif 2 est accessible.
2. **Dénominateur de l'objectif 1.** Taux d'erreur résiduel des placements
   acceptés post-4.7, contre correction humaine.
3. **Taux de qualification.** Collecte pilote de 15–20 cuts et lecture de
   `exclusionCauses`, avant d'engager la collecte complète.

Les trois sont peu coûteuses, aucune ne demande d'écrire du moteur, et chacune
débloque une décision qui sans elle serait prise à l'aveugle.
