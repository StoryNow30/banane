# BANANE 4.8 — SUPER CERVEAU + BANANE UI NEXT

Version du cahier : **2.0 — engagement 90 %** · **signé le 22 septembre 2026**
Base : `v4.7.0`, checkpoint `efe6bab5c1a27f3580f3c9f9cc643a36771ca98c`

Décision prise à la signature : **le chantier vitesse est reporté en 4.9.** La
4.8 porte le cerveau et l'interface. Concentrer l'effort sur la couverture plutôt
que de le partager entre deux objectifs qui se disputaient le même budget de
temps d'exécution.

Cette version remplace la 1.0, qui posait 90 % comme une cible non démontrée.
Elle pose 90 % comme un **engagement conditionnel** : une méthode qui y mène,
des préconditions qui deviennent des obligations, des jalons qui confirment ou
déclenchent un repli. Tout ajout ultérieur passe par un amendement (§16).

---

## 1. Frontière de version

**4.8 — Super cerveau + Banane UI Next.** Deux chantiers : la qualité de
placement, et l'interface opérateur.

**4.9 — Pilot Fast.** Le chantier vitesse, reporté à la signature. Sa première
tâche reste l'instrumentation par phase du pilote — capture, analyse, sélection,
clic, validation, navigation, chargement du nuage suivant — sans laquelle toute
optimisation serait une devinette. Un chargement Potree long a été observé sur le
lot réel : il se peut que le temps dominant ne soit pas dans l'orchestration
Banane du tout.

**5.0 — Multi-session, multi-onglets, multi-parties.**

---

## 2. L'engagement

> **90 % des cuts d'un lot traités avec les deux rails dans le contrat
> d'écartement, sans dégradation de la qualité de placement.**

Départ mesuré : 62 %. Il faut récupérer 21 cuts sur 74.

Cet engagement est **tenable** si les préconditions du §3 sont réunies. Elles ne
sont pas des souhaits : ce sont des obligations de projet, chacune avec son
jalon, son seuil et son repli. Un engagement sans préconditions nommées n'est
pas un engagement, c'est une espérance.

---

## 3. Pourquoi 90 % est atteignable — la méthode

### 3.1 Ce qui bloque aujourd'hui

**MESURÉ**, lot Edge du 21 septembre, 74 cuts, rejouable depuis
`tests/fixtures/gauge-part15-smoke.json`. Avec la 4.7 : 46 traités, 28 différés.

| Mode | Mécanisme | Poids |
|---|---|---:|
| **E1 — minimum parasite** | Le gabarit se verrouille sur la mauvaise surface ; les droites l'ajustent proprement ; confiance élevée, placement faux de 69 à 124 mm | 10 cuts |
| **E2 — famine du rail gauche** | 6 points de plan de roulement pour un seuil de 15 → abstention | 16 cuts |
| **E3 — ambiguïté réelle** | Deux placements concurrents plausibles | ~2 cuts |

### 3.2 Le défaut structurel

**ÉTABLI PAR LECTURE DU CODE.** La confiance publiée vaut :

```
100 × min(1, top/15, face/6, binsTop/5, binsFace/3) × exp(−résidu/0,006)
```

Nombre de points, couverture, résidu. **Aucun terme ne dit si la surface ajustée
est la bonne.** Elle répond à « ai-je ajusté proprement un plan ? », jamais à
« ce plan est-il le champignon ? ». D'où un candidat faux de 78 mm publié à
confiance 78.

Le garde d'écartement est aujourd'hui le **seul contrôle utilisant une
information de paire**. Le pipeline par rail ne peut structurellement pas la voir.

### 3.3 Le levier : la bonne réponse est probablement déjà calculée

**ÉTABLI PAR LECTURE DU CODE**, et c'est le fondement de l'engagement.

`propose()` balaie une grille de ±80 × ±40 mm au pas de 3 mm — environ
**1 400 positions par rail** — et conserve **toutes** leurs pertes dans `coarse[]`.
Une extraction de **tous les minima locaux** séparés de 20 mm existe déjà, écrite
et testée, derrière le drapeau `lab.multiMinima`.

Puis le moteur **jette tout sauf le minimum global**. Le critère
`lossRatio ≥ 1,5` ne compare que le meilleur au second.

Quand KI-032 mesure que 0 des 10 cuts hors contrat n'admettent de paire
admissible **dans le competitive set**, cela signifie : pas dans la bande des
1,5×. Cela ne dit **pas** que la bonne réponse est absente de la grille.

> **Hypothèse centrale : pour E1, la bonne position est présente parmi les
> minima locaux déjà calculés, mais mal classée par la perte de gabarit.**

Si elle est vraie, E1 cesse d'être un problème de recherche et devient un
problème de **classement** — qui se traite.

### 3.4 La recherche contrainte par la paire

La méthode qui porte l'engagement, et qui attaque E1 **et** E2 avec le même
mécanisme :

```
1. Énumérer les minima locaux de chaque rail        (code existant, lab.multiMinima)
2. Former les couples gauche × droite
3. NE GARDER que les couples dont l'écartement prévu est dans le contrat
4. Classer les couples survivants par un score de justesse appris
5. Publier si le score dépasse un seuil calibré, sinon s'abstenir
```

Ce que cela change :

**Le garde d'écartement devient un générateur, plus seulement un veto.** Au lieu
de refuser une paire fausse après coup, la contrainte physique **élimine d'emblée
les couples impossibles**. C'est de l'information gratuite, aujourd'hui inutilisée.

**E2 est attaqué par le même mécanisme.** Avec 6 points, le rail gauche ne peut
pas être placé indépendamment — mais connaissant le rail droit et le contrat, sa
position est fortement contrainte. On passe de *chercher* à *vérifier une
hypothèse*, ce qui demande beaucoup moins de points.

**La sécurité est renforcée, pas affaiblie.** Le garde final reste en place, et
l'abstention reste la sortie par défaut quand aucun couple ne convainc.

### 3.5 Un plancher qui ne dépend d'aucun apprentissage

Les étapes 1 à 3 sont **purement algorithmiques**. Le filtrage par contrat
d'écartement des couples de minima locaux ne demande ni données, ni modèle, ni
entraînement — uniquement du code déjà écrit.

> L'engagement repose donc d'abord sur un gain algorithmique, dont
> l'apprentissage est l'amplificateur — pas l'inverse.

C'est ce qui le rend tenable même si la collecte déçoit.

### 3.6 Ce que l'apprentissage ajoute

Le score de justesse du §2.4 étape 4. Il attaque directement le défaut du §2.2,
et il dispose du corpus le plus large : le vecteur de caractéristiques existe
déjà dans `metrics` — `topCount`, `faceCount`, `residual`, `binsTop`, `binsFace`,
`templateLoss`, `lossRatio`, `separation`, `alternative` — auquel s'ajoute
l'écartement de la paire. L'étiquette d'erreur est disponible sur **les 91
corrections** et pas seulement sur les 22 rejouables, parce que l'écartement est
une distance et non un rejeu.

C'est aussi lui qui rend **sûr** le desserrage de `minTop` : un ajustement affamé
mais juste devient distinguable d'un affamé et faux.

---

## 4. Préconditions de l'engagement

Chacune est une **obligation**, avec son jalon, son seuil et son repli. Si toutes
sont tenues, 90 % est promis. Si l'une tombe, le repli correspondant s'applique
et l'engagement est renégocié par amendement — pas abandonné en silence.

### P0 — L'expérience décisive *(jalon : avant tout développement)*

Rejouer GCV1 sur les 10 cuts hors contrat, grille conservée, minima locaux
énumérés sur les deux rails. Question unique : **existe-t-il un couple de minima
dont l'écartement est dans le contrat et qui tombe près de la correction
humaine ?**

| Résultat | Conséquence |
|---|---|
| Oui sur ≥ 7 des 10 | E1 est un problème de classement. **90 % est promis.** |
| Oui sur 3 à 6 | Engagement révisé à 85 %, méthode inchangée |
| Oui sur < 3 | E1 est un problème de génération. **Repli à 84 %**, et la génération d'hypothèses passe en recherche 4.9 |

Coût : les nuages des 10 cuts et du code déjà écrit. **Quelques heures.** C'est le
jalon le moins cher et le plus déterminant du programme ; rien ne démarre avant.

### P1 — Diagnostic du rail gauche *(jalon : avant la collecte complète)*

Un export de session dans `tools/diagnose-asymmetry.cjs`. Détermine si les 6
points contre 43–50 tiennent à la capture — ROI, clipping, niveau de détail,
occultation — ou à la géométrie du moteur.

**Repli** : si la cause est en amont, la priorité bascule du cerveau vers la
chaîne d'acquisition. Le chantier reste, son instrument change. Un modèle
entraîné sur des données affamées ne corrige pas une capture défaillante.

### P2 — Plancher de reproductibilité humaine *(jalon : pendant la collecte)*

**Aucune cible d'erreur n'est interprétable sans lui.** L'étiquette est la
correction de l'opérateur, et sa variance propre n'a jamais été mesurée. Si le
même opérateur replace le même champignon à 3 mm près, aucun modèle ne descendra
sous 3 mm.

Protocole, à intégrer à la collecte : un échantillon d'au moins **30 cuts
replacés en aveugle**, par le même opérateur à quelques jours d'écart ou par deux
opérateurs. On en tire l'écart-type de la référence, qui devient le **plancher
déclaré** de toute cible de qualité.

S'y ajoute que `physicalCalibrationStatus` n'atteste pas les millimètres : les
unités sont des unités de scène. Toute cible en millimètres hérite de cette
incertitude et doit le dire.

### P3 — Volume de collecte *(jalon : fin de collecte)*

| Usage | Minimum | Confortable |
|---|---:|---:|
| Score de justesse — modèle à ~15 caractéristiques | 300 rails exploitables | 600 |
| Régresseur de position | 1 000 rails | — |

**Repli sous 150 rails** : la piste apprise n'est pas engagée. On livre la
recherche contrainte par la paire avec un classement déterministe réglé à la
main — le plancher du §3.5, qui ne demande aucune donnée.

**Le régresseur de position n'est pas engagé en 4.8.** Le volume requis est hors
d'atteinte du calendrier. Le cerveau 4.8 **classe** ; il ne régresse pas.

### P4 — Taux de qualification *(jalon : avant la collecte complète)*

Aujourd'hui **24 %** : 22 exemples retenus sur 91. Sept conditions doivent tenir
ensemble, dont une fenêtre de lecture de la référence humaine de **1 500 ms** et
l'exigence d'une **intention unique**.

Collecte pilote de 15–20 cuts, lecture de l'histogramme `exclusionCauses` que
`tools/native-offline-evaluate.cjs` produit déjà. **Seuil exigé : 60 %.** En
dessous, on corrige le protocole ou le seuil avant d'engager la collecte
complète — sinon P3 est hors d'atteinte par simple arithmétique.

### P5 — Dénominateur des mauvais placements *(jalon : premier lot 4.8)*

Depuis le garde d'écartement, les mauvais placements résiduels sont ceux qui le
**franchissent** : erreurs common-mode conservant l'écartement. **Leur taux n'a
jamais été compté.** On ne réduit pas de 90 % une quantité non mesurée.

Mesure : erreur résiduelle des placements acceptés contre correction humaine,
rail par rail, sur un lot post-4.7. Sans elle, l'objectif « −90 % de mauvais
placements » reste sans dénominateur et n'est pas engageable.

### P6 — Budget d'inférence *(jalon : avant tout code A2)*

Le chantier vitesse est reporté, mais le budget reste — et sa raison change. Un
cerveau lent rend le pilote pénible quoi qu'il arrive, et la 4.9 ne doit pas
hériter d'une régression qu'elle ne pourra pas rattraper.

**Budget fixé d'avance : 150 ms par cut, les deux rails compris.** Au-delà, A2
n'entre pas en production 4.8, quelle que soit sa qualité.

---

## 5. Chantiers

### 5.1 Contrat de placement — commun à toutes les pistes

```
entrée  : capture LiDAR du cut + contexte géométrique
sortie  : par rail — delta, score de justesse, ou ABSTENTION motivée
          par paire — écartement prévu
```

L'abstention reste une sortie **de premier rang** : un modèle qui ne sait pas
doit le dire. Aucune sortie ne contourne le garde d'écartement. Toute sortie est
**rejouable à l'identique**.

### 5.2 Banc d'évaluation unique

Un seul banc score n'importe quelle implémentation du contrat : couverture,
distribution d'erreur par rail, interceptions conservées, abstentions par cause,
comparaison directe à GCV1 **sur les mêmes entrées**.

Règle de comparaison : « surpasse GCV1 » se mesure à abstentions comptées. Un
modèle qui s'abstient moins mais place plus mal ne surpasse rien.

Toute revendication chiffrée passe par ce banc.

### 5.3 Chantier A — le cerveau

**A0 — Recherche contrainte par la paire.** Le §3.4, étapes 1 à 3. Activation et
production du code `multiMinima` existant, génération des couples, filtrage par
contrat. Aucune donnée requise. **C'est le socle, et il est livré en premier.**

**A1 — Score de justesse appris hors ligne.** Le §3.4 étape 4. Caractéristiques
déjà calculées, déploiement des seuls coefficients, aucune dépendance, aucun coût
runtime. **Première cible de l'apprentissage — pas la position.**

**A2 — Inférence embarquée.** Seule voie si P1 montre que le plan de roulement
gauche doit être trouvé autrement que par l'extracteur géométrique. Contraintes :
service worker MV3, **aucun code hébergé à distance**, poids dans le paquet,
première dépendance externe du dépôt, budget P6.

**Couplage.** A2 génère des hypothèses, A1 les classe, le garde vérifie la paire.
Retenu seulement s'il est mesuré supérieur à chaque piste seule.

### 5.4 Chantier B — Banane UI Next

Interface **opérateur**, plus de laboratoire : état du pilote, rail et côté
traités, proposition ou absence, statut de validation ou de SKIP, anomalie, et
les seules commandes nécessaires. Diagnostic replié mais accessible. Compacte,
lisible, discrète dans ESV.

Modèle une-fenêtre-quatre-vues **conservé** : il a réglé de vrais problèmes.

Conservé de 4.7 : politique effective affichée, `Différés : N` fidèle à la
finalisation durable, incertitude de navigation visible avec son cut, aucun
bouton présenté comme réussi sur un simple accusé.

### 5.5 Chemin des commandes — règle conservée

Même sans chantier vitesse, la règle vaut pour tout code 4.8 : **boutons DOM
conservés**. Ils se vérifient avant d'agir — présence, `disabled` — alors qu'un
`KeyboardEvent` synthétique ne prouve pas sa prise en compte (défaut 6
d'`AUDIT_PILOTE.md`). Le passage aux touches `D` et `Maj+Espace` relève de la 4.9
et de sa mesure.

---

## 6. Critères d'acceptation

**C1 — Couverture.** ≥ 90 % des cuts avec les deux rails dans le contrat, sous
réserve du résultat de P0.

**C2 — Non-régression.** Distribution d'erreur non dégradée face à 4.7, médiane
**et** queue haute rapportées. Une médiane qui s'améliore pendant que la queue
enfle est un échec. Le plancher P2 est rappelé à côté de tout chiffre d'erreur.

**C3 — Interceptions conservées.** Les 10 cas hors contrat connus restent
interceptés. Une régression ici annule C1 quel qu'en soit le niveau.

**C4 — Mauvais placements.** −90 % par rapport au dénominateur établi en P5.

**C5 — Desserrage mesuré.** Chaque curseur du §8 reçoit son bilan chiffré ; ceux
que la mesure soutient sont desserrés. Un curseur conservé sans bilan est un
manquement, pas une prudence.

**C1 sans C2 et C3 ne vaut rien.** « Moins de différés » seul se satisfait en
publiant n'importe quoi.

---

## 7. Invariants de correction — intouchables

Non par principe : **les affaiblir ne rend aucun cut de plus et ne gagne aucune
seconde.** Ce ne sont pas des arbitrages couverture/qualité, ce sont des
conditions de correction. Les baisser ne produit que des échecs silencieux.

1. Contrat d'écartement `[1405, 1470] mm`, critère d'admissibilité — jamais une
   cible à viser. « Le candidat le plus proche de 1435 » ne sera jamais implémenté.
2. Les deux étages du garde restent en place et indépendants.
3. Aucune application partielle.
4. Aucun auto-SKIP.
5. Aucun rejeu ; au plus une émission physique par opération.
6. Contrôles d'identité et de cible avant toute commande.
7. Une navigation observée n'est jamais une confirmation serveur.
8. `reconcileRequired` ferme toute écriture sur un état incertain.
9. Les deux verdicts de transition VALIDATE restent inchangés.
10. `DEFERRED_UNRESOLVED` et son protocole durable restent intacts.

**L'abstention reste légitime.** On réduit les différés en donnant au moteur de
quoi décider — pas en lui interdisant de se taire.

---

## 8. Curseurs — desserrés sur mesure

Les vrais garde-fous au sens de l'ordonnance : ils arbitrent couverture contre
qualité, leur coût se mesure, les baisser est une décision ordinaire.

| Curseur | 4.7 | Coût mesuré aujourd'hui |
|---|---|---|
| `minTop` | 15 | Cause les 16 abstentions gauches |
| Competitive set `loss/lmin` | ≤ 1,5 | **Écarte peut-être la bonne réponse — P0 tranche** |
| Garde d'ambiguïté S1 | active | +1 abstention, −1 erreur > 50 mm, 0 erreur nouvelle |
| Seuil de confiance | neutralisé en Pilote GCV1 | 0 cut mis en pause pour cette cause sur 74 |
| Fenêtre de fraîcheur | 1 500 ms | Contribue au taux de 24 % |

Méthode : bilan chiffré sur le banc du §5.2, puis décision datée dans
`DECISIONS.md` portant la valeur retenue et son coût. On baisse sur un bilan — y
compris quand le bilan conclut qu'il faut baisser beaucoup.

**Le competitive set devient le curseur central du programme.** Si P0 confirme
l'hypothèse du §3.3, c'est lui qui écartait la bonne réponse, et la recherche
contrainte par la paire le remplace par un critère physique bien meilleur.

**Le contrat d'écartement n'est pas un curseur** : c'est la géométrie de la voie.
Son taux de faux refus mesuré est nul — 0 changement de classe sur 56 paires,
écart prévu/observé de 0,5253 mm au maximum. Élargissement possible, mais par
amendement portant une justification ferroviaire.

**Un garde ne place jamais rien : il refuse.** Les 10 paires hors contrat ont été
appliquées **puis validées** alors que le garde n'existait pas encore.

---

## 9. Gel géométrique

`src/geometry.js` est gelé à 4.4.0, vérifié octet pour octet par
`tools/verify.cjs`. **Dégel pré-autorisé** si les quatre conditions sont réunies :

1. P1 **démontre** que la cause est dans ce fichier ;
2. décision explicite et datée dans `DECISIONS.md`, comme pour `engine.js` en V4.6 ;
3. ré-épinglage sur `audit/v4.8.0-geometry-baseline.json`, qui recopie à
   l'identique les empreintes historiques 4.4.0 — elle ne peut pas assouplir le
   gel par la bande ; le banc échoue sur toute dérive non déclarée ;
4. effet mesuré avant/après sur le banc du §5.2.

`audit/v4.4.0-frozen-engine-hashes.json` n'est jamais modifié.

La science GCV1 — A_STAR, S1, seuils, pools, clusters, confidence — reste figée
sauf amendement adossé à une mesure. **La recherche contrainte par la paire
n'est pas une modification de cette science** : elle consomme des minima que le
moteur calcule déjà et n'en change ni le calcul ni les paramètres.

---

## 10. Données et provenance

Les lots existants et ceux collectés pour 4.8 sont
`DEVELOPMENT / TRAINING / REGRESSION_CONSUMED`. Ils ne seront **plus jamais**
présentés comme holdout indépendant.

Conservés systématiquement : provenance LiDAR, décisions du moteur, corrections
humaines, et le lien exact entre les trois.

Interdits : promotion automatique d'un `usableForTraining:false` ; entrée d'une
correction humaine dans l'entrée moteur ; association par proximité temporelle ;
capture LiDAR devinée.

---

## 11. Preuve et limite de revendication

**Aucun lot n'est réservé en aveugle.** Décision prise et assumée. Conséquence :

> Les chiffres de développement de 4.8 sont mesurés sur les données qui ont servi
> à régler le moteur. Ils ne démontrent pas la généralisation.

**Confirmation terrain.** Le premier lot 4.8 passé en Edge sur une partie non
utilisée pour l'entraînement fait office de validation aveugle — c'est de la
production, pas du réglage. Rapportée séparément, avec son effectif.

**C'est ce chiffre-là, et lui seul, qui vaut engagement tenu.**

Quatre niveaux de preuve, jamais confondus : contrôle de code, test simulé,
intégration locale, preuve terrain.

---

## 12. Livrables

1. **P0** — l'expérience décisive. Avant tout le reste.
2. **P1** — diagnostic du rail gauche.
3. **P4** — taux de qualification, avant la collecte complète.
4. **P2** — plancher de reproductibilité humaine.
5. **P5** — dénominateur des mauvais placements.
6. Banc d'évaluation unique.
7. **A0** — recherche contrainte par la paire. Le socle.
8. **A1** — score de justesse, mesuré.
9. **A2** — si P1 le justifie, dans le budget P6.
10. Couplage, retenu seulement s'il est mesuré supérieur.
11. Banane UI Next.
12. C1 à C5 sur le banc, plus la confirmation terrain du §11.
13. Bilan de chaque curseur du §8, valeurs retenues datées.
14. Known issues à jour, release reproductible selon la procédure 4.7.

---

## 13. Hors périmètre

- Régresseur de position appris — volume requis hors calendrier (P3).
- Rouvrir les audits fermés : GCV1 239, external24, S1 complet, Gauge complet,
  les 56 applications de la partie 15, support adaptive, No-Support Generator,
  Brain V2, pair arbitration V2.
- Retuner seuils, pools, clusters ou confidence sans bilan sur le banc.
- Choisir un écartement cible.
- Affaiblir un invariant du §7 — sans gain possible, par construction.
- Desserrer un curseur du §8 sans bilan chiffré et décision datée.
- Refondre le modèle de fenêtre.
- **Chantier vitesse — reporté en 4.9** par décision de signature, avec son
  instrumentation par phase et la question des raccourcis clavier.
- Multi-session, multi-onglets, multi-parties — c'est 5.0.

---

## 14. Tests d'acceptation

**A. Non-régression 4.7.** `DEFERRED_UNRESOLVED`, protocole durable et frontières
de crash, garde d'écartement à deux étages, VALIDATE, SKIP explicite, reprise
manuelle, G8.1, Observation, Assisté, Natif, Pilote normal : inchangés.

**B. Invariants.** Chacun des dix points du §7 a son essai.

**C. Curseurs.** Chaque valeur retenue est traçable jusqu'à son bilan. Un curseur
modifié sans bilan fait échouer la revue.

**D. Contrat de placement.** Abstention motivée plutôt que proposition devinée ;
sortie rejouable à l'identique.

**E. Recherche contrainte par la paire.** Aucun couple hors contrat n'est jamais
proposé ; le garde final reste actif et reste vérifié.

**F. Banc.** Mêmes entrées, mêmes scores d'une exécution à l'autre.

**G. Objectifs.** C1 à C5 rapportés ensemble. C1 seul n'est jamais présenté comme
un résultat. Le plancher P2 accompagne tout chiffre d'erreur.

**H. Interface.** Politique effective affichée, `Différés : N` fidèle, incertitude
visible avec son cut.

**I. Provenance.** Aucune fuite de correction humaine dans l'entrée moteur,
aucune promotion automatique.

---

## 15. Tableau de bord de l'engagement

| Précondition | Jalon | Seuil | Si non tenue |
|---|---|---|---|
| P0 — bonne réponse dans la grille | avant tout dev | ≥ 7/10 | 3–6 → 85 % · < 3 → 84 % et recherche en 4.9 |
| P1 — cause de la famine gauche | avant collecte | établie | priorité bascule vers la capture |
| P2 — plancher humain | pendant collecte | ≥ 30 cuts replacés | aucune cible d'erreur n'est publiée |
| P3 — volume | fin collecte | ≥ 300 rails | < 150 → classement déterministe seul |
| P4 — qualification | avant collecte | ≥ 60 % | protocole ou seuil corrigé avant de lancer |
| P5 — dénominateur | premier lot | mesuré | C4 non engageable |
| P6 — budget inférence | avant code A2 | ≤ 150 ms/cut | A2 hors production 4.8 |

*Le chantier vitesse étant reporté en 4.9, aucune précondition ne porte sur le
temps d'exécution du pilote en 4.8 — hors P6, qui protège la 4.9.*

---

## 16. Ce qui reste hors de portée de toute méthode

Si le rail gauche ne porte réellement que 6 points parce que la capture n'en
livre pas davantage, aucune architecture n'en invente — d'où P1.

`physicalCalibrationStatus` n'atteste pas les millimètres : unités de scène.

Aucune confirmation serveur ESV n'est disponible ; une navigation observée n'est
pas un enregistrement.

Le garde d'écartement ne couvre pas les erreurs common-mode conservant
l'écartement, ni les erreurs longitudinales.

---

## 17. Amendements

Le corps §1 à §16 est gelé en version 2.0.

Tout ajout ou modification prend la forme d'un amendement **numéroté et daté** :
ce qui change, pourquoi, quel élément nouveau le justifie, impact sur
l'engagement du §2 et sur le tableau du §15.

Un sujet qui n'est ni dans le corps ni dans un amendement est hors périmètre.

### Amendements enregistrés

- n°1 — doctrine de séquence et conséquences des premières mesures (22/09)
- n°2 — l'entrée du moteur, la densité, et le flanc (22/09) : corrige le §1.2 du n°1
- n°3 — flanc partiel activé dans le Pilote ; contexte de voie (22/09) : tranche le §2.5 du n°2, déroge au §1.5 du n°1 pour cette seule règle
- n°4 — audit 4.7.5 ; A1 redéfini en calage de convention (22/09) : remplace le §1.4 du n°1, mesure P5
- n°5 — validation du calage et bilan des curseurs (23/09) : précise la règle d'arrêt du §4.4 du n°4
- n°6 — premières mesures terrain de la 4.7.6 (23/09) : calage validé sur cuts inédits, P5 révisé, garde de continuité prioritaire

## Amendement n°1 — doctrine de séquence et conséquences des premières mesures

**22 septembre 2026.** Élément nouveau : les mesures produites depuis la
signature, et la doctrine de séquence arrêtée par la direction.

### 1.1 Doctrine de séquence

> **Rendre l'observation saine → mesurer où le moteur échoue → introduire le
> plus petit apprentissage capable de corriger précisément cette classe
> d'erreur.**

Elle prime sur l'ordre des chantiers du §12. Aucun apprentissage n'est engagé
tant que l'étape qui le précède n'a pas rendu son chiffre.

### 1.2 « Observation saine » devient mesurable

Trois seuils, dont un indicateur nouveau qui agrège les autres.

| Indicateur | Mesuré le 22/09 | Seuil « sain » |
|---|---|---|
| Qualification de collecte (P4) | 61 % | ≥ 60 % — tenu |
| Flanc interne à la meilleure position | médiane 2 points | ≥ 6, cible 10 |
| **Taux de résolution** — rails résolus / rails qualifiés | **10 %** (4 sur 39) | **≥ 70 %** |

Le taux de résolution est l'indicateur de référence de l'étape 1. Tant qu'il
reste bas, « mesurer où le moteur échoue » revient à mesurer où il se tait :
ce n'est pas la même question et les conclusions ne se transportent pas.

### 1.3 La taxonomie d'échec sera refaite, pas réutilisée

Quand l'observation sera saine, la classe dominante actuelle — la famine du
flanc interne — disparaîtra. Ce qui restera relève de E1, les minima parasites
à 69–124 mm, et de la précision fine. La répartition par cause sera donc
reconstruite sur les nouvelles données, par le banc du §5.2.

Condition facile à oublier : mesurer où le moteur échoue exige des cas où il
échoue **et où la vérité est connue**. Cela ramène le taux de qualification et
le plancher P2 au premier plan.

### 1.4 A1 est redéfini — résultat négatif intégré

A0 mesuré sur le lot du 22 septembre : le classement déterministe par somme des
pertes normalisées retrouve le meilleur couple admissible **17 fois sur 17**.
C'est la contrainte d'écartement qui fait le travail, pas le classement.

**A1 tel que défini au §5.3 — « score de justesse pour classer les
hypothèses » — est sans objet.** Le classer n'a rien à gagner.

Mais A0 a testé le CLASSEMENT, pas la DÉCISION DE PUBLIER. Deux fonctions
distinctes :

- *lequel de ces couples est le meilleur ?* — résolu sans apprentissage ;
- *ce couple est-il assez bon pour être publié, ou faut-il s'abstenir ?* —
  **ouvert, et c'est là que vivent les erreurs de 69 à 124 mm.**

A1 devient donc un **modèle d'abstention** : prédire, à partir de `metrics`
déjà calculé, si le placement retenu s'écarte au-delà d'un seuil. Quelques
dizaines de coefficients, entrées existantes, aucune dépendance. Il attaque la
classe d'erreur qui coûte, et lui seul.

Il reste soumis à l'étape 1 de la doctrine : il n'est pas engagé avant que le
taux de résolution ait atteint son seuil.

### 1.5 P2 devient bloquant

A0 publierait à environ 5 mm par rail de la correction humaine. Savoir si c'est
préférable à une abstention est **indécidable** sans le plancher de
reproductibilité humaine. P2 passe de précondition à **blocage** : aucune
décision de publication, aucun seuil d'abstention, aucune cible d'erreur n'est
arrêtée avant sa mesure.

### 1.6 Inférence embarquée écartée du périmètre 4.8

La piste d'un réseau sur nuage de points — ranker et refiner appris, PyTorch,
export ONNX, exécution par ONNX Runtime Web — a été instruite puis écartée pour
la 4.8. Motifs retenus : l'entrée est affamée, et un modèle ne voit pas ce qui
n'a pas été capturé ; le socle géométrique que cette architecture suppose
fiable résout aujourd'hui 4 rails sur 39 ; le service worker MV3 est détruit
après environ trente secondes d'inactivité, si bien que le chargement du
runtime et des poids ne s'amortit pas sur un lot.

La piste n'est pas rejetée sur le fond : son architecture — géométrie, puis
couche apprise, puis arbitrage de paire, puis garde d'écartement, puis
application native — reste la bonne. Elle est reportée, et sa réouverture
demande un amendement adossé à l'atteinte du seuil de résolution du §1.2.

La piste A2 du §5.3 est suspendue en conséquence ; P6 reste en vigueur pour
toute reprise ultérieure.

## Amendement n°2 — l'entrée du moteur, la densité, et le flanc

**22 septembre 2026.** Éléments nouveaux : les collectes Natif 4.7.2 (partie 19,
105 visites) et 4.7.3 (partie 20, 67 visites), la session Pilote de la partie 18
et sa relecture native, et le rapport `tools/resolution-report.cjs`
(`audit/resolution-lots-2026-09-22.json`).

### 2.1 Correction du §1.2 de l'amendement n°1

« Flanc interne à la meilleure position : médiane 2 points » et « flanc ≥ 6
inatteignable avec ce capteur » étaient faux dans leur généralité. Deux
artefacts les produisaient :

- **la lecture Natif 4.7.0–4.7.1** s'arrêtait à chaque mouvement de caméra et
  plafonnait à ~106 000 points/s (corrigé en 4.7.2) ;
- **le banc ne donnait au moteur que le premier instantané qualifié**, déclenché
  dès qu'il y a juste assez de points pour dire « zone couverte ». La suite de la
  même lecture, même pose, avant toute action humaine, était stockée mais jamais
  utilisée.

Avec la lecture 4.7.2+ et l'entrée complète (§2.2) :

| Collecte | Points visibles par rail | Flanc médian | Rails flanc ≥ 6 | Rails résolus |
|---|---|---|---|---|
| 4.7.2, partie 19 | 826 | 6 | 93 / 174 | 50 % (17 % avec l'instantané seul) |
| 4.7.3, partie 20 | 2 138 | 12 | 105 / 111 | 74 % (50 % avec l'instantané seul) |

**La densité dépend de la partie** (données sources) : c'est elle, et non plus la
capture, qui fixe désormais le plafond du flanc. La densité chargée ne croît
quasiment pas pendant une visite (points en mémoire ×1,00 à ×1,04 en médiane
entre première et dernière lecture) : relire plus tard n'apporterait rien, et
n'est pas fait.

### 2.2 Entrée moteur du banc : la lecture complète de la pose de départ

L'entrée par défaut du banc (§5.2) devient l'instantané qualifié **plus la suite
de la même lecture** : même `captureId`, même côté, même pose de rail,
acquisition terminée avant la frontière — première correction observée du rail,
transition non attribuable ou intention de l'opérateur. La frontière anti-fuite
est inchangée : aucun point acquis après une action humaine n'entre.
`first-snapshot` reste disponible pour comparer. L'évaluateur historique 4.4 et
ses artefacts d'audit ne sont pas modifiés.

### 2.3 Étape 1 de la doctrine : seuil atteint sur une partie, pas sur l'autre

Taux de résolution sur données natives, hors ligne : **74 %** sur la partie 20,
**50 %** sur la partie 19, pour un seuil de 70 %. L'étape 1 n'est donc pas
déclarée franchie : le seuil doit tenir sur des parties de densités différentes,
au rythme réel.

Au niveau du cut (deux rails candidats, écartement dans le contrat) : partie 20,
37 cuts appliquables sur 55, **0 faux sur 29 jugés** (pire rail 5,8 mm) ; les 9
paires refusées par l'écartement contenaient toutes un rail faux de 47 à 200 mm.

### 2.4 Le Pilote lit déjà toute la zone chargée

Le Pilote lit, pour chaque vue de rail et après stabilisation du niveau de
détail, **tous** les points chargés dans la zone : ≈ 1 750 points par rail dans
la ROI, ≈ 875 visibles, sur la partie 18. Le gain du §2.1 venait de l'entrée du
banc, que le Pilote n'utilise pas. Le chantier « le Pilote lit comme le Natif »
envisagé le 22/09 est **annulé** : il n'apporterait rien au placement. Les
différés du Pilote sur les parties peu denses viennent d'un flanc de 3 à 5
points, réel.

### 2.5 Proposition « flanc partiel » : maintenue, non tranchée

Le retrait approuvé le 22/09 reposait sur la prémisse corrigée au §2.4. Re-mesurée
sur entrées complètes, la règle (flanc 3 à 5 points acceptés si le dessus a au
moins 15 points, pas de pente hors domaine, rapport de perte ≥ 1,5, deux rails
exigés, écartement dans le contrat, aucune autre garde touchée) donne :

| Jeu | Cuts appliqués | Avec la règle | Nouveaux jugés | Faux > 10 mm |
|---|---|---|---|---|
| Partie 19 (4.7.2) | 18 / 78 | 50 / 78 | 13 | 0 (pire 5,6 mm) |
| Partie 20 (4.7.3) | 37 / 55 | 39 / 55 | 2 | 0 |
| Lots 1–3 + Pilote partie 18 | — | +16 cuts | 14 | 0 (pire 4,3 mm) |

Le risque résiduel est inchangé : une erreur identique sur les deux rails passe
l'écartement. La proposition reste soumise au §1.5 (P2) et à la décision de la
direction.

### 2.6 Volume des collectes Natif

Les lectures LiDAR faites après un déplacement de rail **par l'opérateur** ne
nourrissent jamais le moteur ; elles faisaient 42 % des points exportés de la
collecte 4.7.3. Elles sont supprimées à partir de la 4.7.4
(`collector.captureAfterOperatorRailChange`, désactivé par défaut) ; un
ajustement des rails par ESV sans geste de l'opérateur reste lu.

### 2.7 Impact

Sur le §2 : l'engagement de 90 % n'est ni confirmé ni infirmé ; il dépend
désormais de la densité des parties et de la décision du §2.5. Sur le §15 : P4
tenu en Natif 4.7.2+ (82 à 87 % des rails avec instantané qualifié) ; P2 toujours
bloquant.

## Amendement n°3 — flanc partiel activé dans le Pilote ; contexte de voie

**22 septembre 2026.** Éléments nouveaux : la décision de la direction sur le
§2.5 ; la mesure du moteur réel avec et sans la règle sur les cinq collectes
(`audit/resolution-partial-flank-2026-09-22.json`) ; la session Pilote 4.7.4 de
la partie 20 et sa relecture Natif ; l'étude de continuité de voie
(`tools/continuity-study.cjs`, `audit/continuity-study-2026-09-22.json`).

### 3.1 Décision : flanc partiel actif dans le Pilote à partir de la 4.7.5

La direction tranche le §2.5 : **la règle est activée.** C'est une dérogation
explicite au §1.5 pour cette seule règle — P2 reste non mesuré ; la décision de
publier repose sur la mesure contre la relecture humaine (§3.2), pas sur un
plancher de reproductibilité. Le §1.5 reste en vigueur pour toute autre décision
de publication.

Mise en œuvre : `src/gcv1-shadow.js` passe l'option de laboratoire existante
`partialFaceKeep` à l'appel A_STAR. `src/geometry-candidate-v1.js` n'est pas
modifié (empreinte gelée) ; `minTop` 15, `minFace` 6 et le rapport de perte 1,5
restent les valeurs du contrat. Chaque proposition appliquée porte
`gcv1.partialFlankUsed` et `parameters.partialFlank`. Le retour durable est la
4.7.4 ; `gcv1-shadow-configure` avec `partialFlank:false` coupe la règle jusqu'au
prochain redémarrage du service worker, pour un essai.

**Règle d'arrêt.** Au premier cut appliqué par le Pilote avec un rail en flanc
partiel que la relecture Natif trouve faux de plus de 10 mm, la règle est
coupée et un amendement consigne le cas.

### 3.2 Mesure du moteur réel, règle inactive puis active

Mêmes données, même entrée (lecture complète de la pose de départ, §2.2), moteur
4.7.5 réglé dans les deux états :

| Collecte | Rails résolus | Cuts appliqués | Jugés | Faux > 10 mm | Pire rail |
|---|---|---|---|---|---|
| Lot 1, 4.7.0 | 15 % → 52 % | 1 → 6 | 6 | 0 | 5,4 mm |
| Lot 2, 4.7.1 | 16 % → 59 % | 0 → 11 | 8 | 0 | 4,0 mm |
| Lot 3, 4.7.1 | 19 % → 57 % | 0 → 7 | 4 | 0 | 4,0 mm |
| Partie 19, 4.7.2 | 50 % → 79 % | 18 → 50 | 23 | 0 | 6,5 mm |
| Partie 20, 4.7.3 | 74 % → 77 % | 37 → 39 | 31 | 0 | 5,8 mm |
| **Total** | | **56 → 113** | **72** | **0** | **6,5 mm** |

Au niveau du rail, la règle résout aussi des rails faux : 7 sur 194 jugés au-delà
de 10 mm (4 sur 130 sans la règle). **Aucun n'atteint l'application** : la paire
est exigée et l'écartement vérifié. La sûreté vient de ces deux gardes, pas de la
règle elle-même ; c'est pourquoi aucune d'elles n'est desserrée. Le risque d'une
erreur identique sur les deux rails, qui passe l'écartement, reste entier.

### 3.3 Étape 1 de la doctrine

Hors ligne, le seuil de 70 % est atteint sur les deux parties natives de densités
différentes : **79 %** (partie 19) et **77 %** (partie 20). Il n'est pas déclaré
franchi avant une session Pilote 4.7.5 relue en Natif : le Pilote lit ses propres
vues, et son taux de résolution terrain n'est pas encore mesuré.

### 3.4 Ce qui reste : les appareils de voie et contre-rails

Session Pilote 4.7.4, partie 20, cuts 126 à 138, tous relus en Natif : 2 cuts
appliqués (3 mm au plus de l'humain), 10 différés. Sur les 10, 8 sont refusés par
l'écartement — un rail posé sur une structure voisine à 65–192 mm, l'autre juste
à 4 mm près — et 2 par ambiguïté. Le flanc y est de 10 à 53 points : **ce n'est pas un
problème d'observation**, et le flanc partiel n'y change rien.

Cause : dans un appareil de voie, la pose initiale d'ESV est loin du rail — sur
chacun des 10 cuts différés, l'humain a déplacé au moins un rail de 62 à 115 mm. Le vrai rail est au bord ou hors de la
fenêtre de recherche de GCV1 (±80 mm autour de la pose initiale), et le meilleur
minimum dans la fenêtre est le contre-rail ou l'aiguille.

### 3.5 Contexte de voie — options explorées hors ligne

Question posée par la direction : le moteur peut-il mesurer la position et
l'écartement des rails aux cuts précédents et suivants pour placer ceux-ci ?

| Option | Résultat | Verdict |
|---|---|---|
| A0 : classer les couples par pertes, garder le meilleur admissible | 10 justes, 9 faux sur 19 cuts difficiles | écartée : publie des faux |
| Ancrer sur le rail sûr, reporter l'écartement du voisin | faux publiés | écartée ; et c'est une cible d'écartement (§3.6) |
| Prédire la position par les voisins **validés par l'humain** (±3 cuts) | erreur médiane 4,4 mm | indisponible au Pilote, qui n'a pas de validation en cours de lot |
| Prédire par les voisins **appliqués par le moteur** (±5 cuts), sans recherche | médiane 14 mm, max 25 mm | trop imprécis pour publier ; assez pour guider |
| **Recherche recentrée** : moteur gelé, fenêtre recentrée sur la prédiction des voisins moteur, résultat à ≤ 30 mm de la prédiction, paire + écartement | voir ci-dessous | **retenue pour la 4.8** |

Recherche recentrée, jugée contre la relecture humaine (options de laboratoire
existantes `uSeeds`, `recenterWindow`, `replaceOrigin`, flanc partiel) :

| Jeu | Cuts difficiles | Voisins des deux côtés (second passage) | Voisins précédents seuls (passage unique) |
|---|---|---|---|
| Natif 4.7.3, partie 20 | 12 | 7 justes · 0 faux · 5 différés | 4 justes · 0 faux · 8 différés |
| Relecture du Pilote 4.7.4, partie 20 | 7 | 5 justes · 0 faux · 1 différé · 1 sans référence | 3 justes · 0 faux · 3 différés · 1 sans référence |
| **Total** | **19** | **12 justes · 0 faux** | **7 justes · 0 faux** |

Limites, à lire avant toute conclusion :

- **une seule partie, un seul jour** : les 19 cuts viennent de la partie 20 ;
- **pire rail 9,2 mm** (9,5 mm en passage unique), près du seuil de 10 ; sur le
  lot 5, l'erreur gauche est positive sur les 7 cuts justes (+1 à +9 mm) et la
  droite négative sur 6 (jusqu'à −5,4 mm) : biais possible, à comprendre avant
  toute publication ;
- le passage unique manque les séries de cuts difficiles consécutifs (pas assez
  de voisins appliqués) : d'où le second passage ;
- une erreur de mode commun des voisins se propagerait au cut : la prédiction
  n'est jamais publiée seule, elle ne fait que déplacer la fenêtre.

### 3.6 Écartement des voisins : garde, jamais cible

L'écartement mesuré aux cuts voisins peut servir de **garde** — s'abstenir si
l'écartement du cut s'écarte de celui des voisins au-delà d'une tolérance à
mesurer — et jamais de **cible** : choisir, parmi des candidats, celui dont
l'écartement est le plus proche de celui des voisins est interdit au même titre
que « le plus proche de 1435 ». Dans un appareil de voie, l'écartement varie
lui-même (surécartement) ; la tolérance devra en tenir compte. Cette garde
n'attrape pas l'erreur de mode commun ; la continuité de position, oui. Elle est
proposée pour mesure en 4.8, sans engagement.

### 3.7 Nouveau chantier 4.8 : « contexte de voie »

Ajouté au §5, après le chantier A :

1. **Second passage** sur les cuts différés d'un lot Pilote : voisins appliqués
   des deux côtés, moteur gelé recentré, mêmes gardes (deux rails, écartement
   dans le contrat, acceptation à ≤ 30 mm de la prédiction). Pas de chaînage :
   un cut résolu par continuité ne sert pas de voisin.
2. Préalables à toute application : mesure sur au moins deux autres parties
   comportant des appareils de voie ; explication du biais de signe du §3.5 ;
   d'abord en observation dans le Pilote (calculé, consigné, non appliqué) sur
   un lot complet relu en Natif.
3. Même règle d'arrêt que le §3.1.

L'implémentation dans le Pilote demande un amendement adossé à ces mesures.

### 3.8 Impact

Sur le §2 : le taux de résolution hors ligne dépasse désormais 70 % sur les deux
parties natives ; l'engagement de 90 % reste ouvert et dépend des appareils de
voie (§3.4–3.7). Sur le §15 : P2 toujours non mesuré, et toujours bloquant hors
de la dérogation du §3.1 ; P4 tenu.

## Amendement n°4 — audit 4.7.5 ; A1 redéfini en calage de convention

**22 septembre 2026.** Éléments nouveaux : l'audit `AUDIT_CERVEAU_4.7.5.md`
(385 cuts, 7 sessions, parties 13, 18, 19, 20), ses outils
`tools/brain-audit.cjs` et `tools/convention-fit.cjs`, et leurs relevés
`audit/brain-audit-2026-09-22.json` et `audit/convention-fit-2026-09-22.json`.

### 4.1 Ce que l'audit établit

- **Le banc prédit le Pilote** : 23 décisions Pilote sur 23 reproduites à
  l'identique à partir de ses propres captures.
- **Aucun cut appliqué n'est faux** : 0 sur 76 jugés. Les 9 rails faux publiés
  (17 à 177 mm) sont tous arrêtés par l'exigence des deux rails, l'autre rail
  s'abstenant ; deux ne sont faux que de 17 mm, en deçà de ce que le contrat
  d'écartement peut voir.
- **Les placements appliqués sont biaisés** : latéral +2,1 mm côté champ sur
  chaque rail, vertical −2,8 mm, écartement +4,5 mm en médiane. Le moteur pose
  le gabarit au milieu de la bande de points, l'opérateur en enveloppe.
- **Quand le moteur s'abstient, la bonne position est calculée** pour 88 % des
  rails (minimum local à ≤ 10 mm) ; elle sort de la fenêtre pour 4 rails sur 105.
- **P2 reste non mesurable** (un seul cut commun à deux sessions) mais il est
  **borné** : le moteur calé reproduit l'humain à 1,6 mm latéral et 1,1 mm
  vertical en médiane ; le bruit humain ne peut pas dépasser cet écart.

### 4.2 P5 mesuré

Le dénominateur des mauvais placements (P5) est mesuré : **0 cut appliqué faux
au-delà de 10 mm sur 76 jugés**, erreur latérale médiane 2,4 mm (p90 5,0),
verticale 2,8 mm (p90 6,1). Au sens de C4, il n'y a aujourd'hui rien à réduire
de 90 % ; la qualité des placements se mesure par leur précision (C2), rapportée
avec sa médiane, sa queue et son biais.

### 4.3 A1 redéfini : calage de convention

Le §1.4 faisait d'A1 un modèle d'abstention. Mesuré, il n'a **rien à
apprendre** : aucune erreur appliquée à intercepter. La classe d'erreur qui
coûte est le biais de convention, présent sur 100 % des placements. Le plus
petit apprentissage qui la corrige est un **calage à deux constantes**,
`src/placement-convention.js` :

- dessus au 90e centile des points du dessus, + 1,0 mm ;
- flanc à la médiane des points du flanc, − 2,6 mm (côté voie) ;
- aucune correction latérale sous 6 points de flanc, aucun calage sous 15
  points de dessus ni au-delà de 8 mm de déplacement.

Validation en retenant chaque session à tour de rôle : latéral médian
2,39 → 1,60 mm, vertical 2,83 → 1,13 mm, écartement 4,67 → 2,34 mm (biais
+4,5 → +0,4 mm) ; aucun rail ne franchit 10 mm. Constantes stables d'une
session retenue à l'autre (dessus +0,6 à +1,2 ; flanc −2,1 à −2,8 mm).

### 4.4 Décision et périmètre

Le calage est **actif dans le build TEST 4.7.6**, au titre du mandat du 22/09
(« travaille sur le chantier selon les résultats de l'audit »). Il ne relève pas
du §1.5 : il ne fixe ni seuil d'abstention, ni cible d'erreur, ni décision de
publier, et le biais qu'il corrige se mesure indépendamment de P2 — une médiane
signée sur 185 rails ne dépend pas du bruit humain.

Il est appliqué au rail publié, après S1 et **avant** la garde d'écartement, qui
juge la paire calée. Il ne choisit aucun candidat, ne connaît pas l'autre rail,
ne vise aucun écartement ; un rail non résolu le reste. A_STAR, S1, les seuils,
`geometry-candidate-v1.js` et `engine.js` sont intacts. Chaque proposition
porte son delta brut (`gcv1.convention.rawDelta`). C'est une couche apprise
posée sur la science gelée, au sens de l'architecture du §1.6 — pas une
modification de cette science.

**Règle d'arrêt.** Sur la relecture Natif d'un lot Pilote 4.7.6 (au moins
20 rails jugés), si le placement calé est plus loin de l'humain que le
placement brut, en médiane latérale ou verticale, ou si un cut appliqué est
faux au-delà de 10 mm alors que le placement brut ne l'aurait pas été : retour
4.7.5 et amendement. Limite connue : en relecture, l'opérateur part du
placement calé ; un effet d'ancrage le favoriserait.

### 4.5 Suite, dans l'ordre

1. Mesure terrain du calage (lot Pilote 4.7.6 relu en Natif).
2. Continuité de voie (amendement n°3) : collectes d'autres parties avec
   appareils de voie.
3. Rails abstenus par manque de flanc alors que la bonne position est calculée
   (27 sur 41) : à instruire, en gardant en tête les rails faux de 17 mm que
   seule l'abstention de l'autre rail arrête aujourd'hui.
4. Temps moteur (médiane 152 ms, p90 758 ms par cut) : relevé pour la 4.9.

### 4.6 Impact

Sur le §2 : la couverture n'est pas modifiée par le calage ; la qualité l'est
(C2). Sur le §15 : P5 mesuré ; P2 borné mais toujours non mesuré ; P0 confirmé
sur les données d'observation saine (88 %).

## Amendement n°5 — validation du calage et bilan des curseurs

**23 septembre 2026.** Élément nouveau : KI-034, mesuré sur la partie 15 avant
cet audit — sur les cuts placés par le pilote, la retouche latérale de
l'opérateur vaut +0,23 ± 3,04 mm, alors que l'audit mesure un écart de 2,1 mm
par flanc contre des poses faites sans proposition.

### 5.1 La relecture d'un lot Pilote ne juge pas le calage

En relecture, l'opérateur part du placement proposé et ne retouche qu'au-delà de
sa tolérance. Une différence de 2 mm y reste invisible, dans un sens comme dans
l'autre. La règle d'arrêt du §4.4 de l'amendement n°4 est donc précisée :

- **la mesure qui fait foi** est une collecte Natif indépendante — l'opérateur
  pose depuis l'état ESV, sans proposition — sur une partie non utilisée pour
  l'ajustement, rejouée hors ligne calage actif puis coupé
  (`tools/brain-audit.cjs --convention on|off`) ;
- retour 4.7.5 si le calage y est plus loin de l'humain que le placement brut, en
  médiane latérale ou verticale, ou s'il rend faux au-delà de 10 mm un cut que le
  placement brut n'aurait pas rendu faux ;
- la relecture d'un lot Pilote reste utile pour la couverture réelle du Pilote et
  pour la règle d'arrêt du flanc partiel (erreurs au-delà de 10 mm, que la
  tolérance de l'opérateur ne masque pas).

Cette collecte vaut aussi confirmation terrain au sens du §11 pour le calage.

### 5.2 Bilan des curseurs

Le bilan exigé par C5 est consigné dans `DECISIONS.md`, D-035. En résumé : le
flanc est desserré (flanc partiel) ; `minTop`, le competitive set et la pente
sont conservés, avec leur coût mesuré. Desserrer le competitive set publierait 5
rails faux sur 12, et `minTop` n'a pas encore de bilan de desserrage : C5 reste
partiel sur ce point.

## Amendement n°6 — premières mesures terrain de la 4.7.6

**23 septembre 2026.** Éléments nouveaux : la collecte du 23/09 (`banane-data`,
`collections/2026-09-23_v4.7.6_/`) — un lot Pilote 4.7.6 sur la partie 19
(29 cuts) suivi de sa relecture Natif, et deux sessions Natif sur la partie 20
(cuts 107–995 et 1099–1154, 399 visites) ; les relevés
`audit/brain-audit-2026-09-23.json` et `audit/continuity-guard-2026-09-23.json`.
Les cuts 9033 et 9241 sont exclus du bilan à la demande de l'opérateur.

### 6.1 Le calage tient sur des cuts inédits

Partie 20 déjà vue, mais cuts jamais utilisés pour l'ajustement (le
chevauchement 126–140 est exclu) : c'est la mesure du §5.1 du n°5, sur une
partie connue et non sur une partie nouvelle.

| Cuts justes | Latéral médian | Vertical médian | Biais d'écartement |
|---|---|---|---|
| Natif long, 109 cuts : brut → calé | 2,8 → 1,3 mm | 3,1 → 0,7 mm | +4,9 → −0,2 mm |
| Natif court, 36 cuts : brut → calé | 2,5 → 0,9 mm | 2,9 → 0,9 mm | +4,9 → −0,5 mm |

Aucun cut n'est rendu faux par le calage ; un cut faux (397) est évité, son
écartement calé sortant du contrat. La règle d'arrêt n'est pas déclenchée : le
calage est maintenu. P2 est resserré : le bruit humain ne dépasse pas ≈ 1 mm
médian.

### 6.2 Le Pilote sur le terrain

Partie 19 : 15 cuts appliqués sur 29 (52 %), 14 différés, dont 12 où la pose ESV
de départ est à 20–47 mm de la pose humaine. Le rejeu reproduit les 29 décisions
à l'identique, calage compris. Le cut 9047 est suspect et n'a pas été relu :
écartement appliqué 1 453,8 mm contre 1 434,6 mm pour ses voisins ; son rail
gauche était ambigu pour A_STAR (rapport de perte 1,05) et a été publié par S1.

### 6.3 P5 révisé : des cuts appliqués faux existent

Rejoué hors ligne sur la session Natif longue, le moteur 4.7.6 applique **8 cuts
faux sur 118 jugés** (6,8 %). Le « 0 sur 76 » du n°4 ne tient plus sur cette
partie :

- **6 décalages communs des deux rails**, de 117 à 273 mm (cuts 398 à 405 et
  435), écartement dans le contrat. Ils sont tous dans une zone en courbe où la
  pose ESV de départ est à 100–260 mm de la pose humaine : la vraie position est
  hors de la fenêtre de recherche, et le moteur trouve une autre paire cohérente.
  C'est le mode d'échec que le §16 déclare invisible à la garde d'écartement ;
- **1 rail posé 40 mm trop bas** (241), publié par S1, que le calage avait jugé
  hors domaine ;
- **1 rail à 15 mm** (983).

Aucun n'est dû au calage. La couverture parmi les cuts avec entrée est de 70 %
(178 sur 256) sur la session longue et 97 % (37 sur 38) sur la courte.

### 6.4 Flanc partiel

Sur la session longue, 18 cuts ne sont appliqués que grâce au flanc partiel :
10 justes, 6 sans référence, **2 faux** (405 et 435, dans la zone de décalage
commun : leur autre rail est faux aussi). La règle d'arrêt du n°3 §3.1 vise les
cuts appliqués par le Pilote et n'est pas déclenchée au sens strict. Le flanc
partiel n'est pas la cause de ces erreurs, mais il leur a ouvert la porte : son
maintien est lié à la garde du §6.6.

### 6.5 S1 repêche mal

Un rail qu'A_STAR laisse ambigu et que S1 publie est faux bien plus souvent :
2 sur 10 jugés le 22/09 contre 7 sur 184 pour les publications directes
d'A_STAR ; le 23/09, deux des cuts faux (241, 404) ont un rail repêché par S1, et
le cut suspect 9047 aussi. À instruire.

### 6.6 Garde de continuité : première mesure

Étude hors ligne (`tools/continuity-guard-study.cjs`) : chaque rail d'un cut
appliquable est comparé à la droite tirée des cuts précédents acceptés (6 cuts,
au moins 2) ; au-delà de 30 mm, le cut est différé et ne sert pas d'ancre. Sur la
partie 20 : **4 des 8 cuts faux arrêtés** (398, 404, 405, 435), **4 cuts justes
perdus sur 146**. Passent : 400 et 402, faute de cuts acceptés à proximité, 241
et 983. Garde, jamais cible : elle ne fait que différer.

### 6.7 Exports

83 % du volume exporté est de la répétition : chaque segment automatique
réécrit toutes les visites et tous les événements déjà exportés (1 651 Mo sur
1 989 Mo pour les 41 segments Natif ; les nuages LiDAR ne font que 338 Mo).

### 6.8 Ordre des suites

1. **Garde de continuité**, avant tout nouveau gain de couverture : traiter le
   cas « pas de cut accepté à proximité », mesurer sur d'autres zones, puis
   activer. Elle ne fait que différer : aucun invariant du §7 n'est touché.
2. **Exports allégés** : segments automatiques sans répétition des visites et
   des événements, et compression.
3. **S1** : instruire le repêchage des ambiguïtés, en commençant par 9047.
4. Le temps moteur monte à 1,1 s médian et 2,0 s au p90 par cut sur les
   captures denses de la partie 20 : relevé pour la 4.9.

Sur le §2 : couverture Pilote mesurée à 52 % sur la partie 19. Sur le §15 : P5
révisé (8 sur 118 hors ligne, partie 20) ; P2 resserré.
