# BANANE 4.9 — CAHIER DES CHARGES (brouillon)

Version du cahier : **0.1 — ouvert le 24 septembre 2026, non signé**
Base prévue : la version 4.8.0 publiée.

Ce brouillon réunit ce que la direction et les amendements du cahier 4.8 ont
renvoyé à la 4.9. Il sera ordonné, chiffré et signé après la sortie de la 4.8.
D'ici là, un chantier ne s'ajoute ici que sur décision datée dans
`DECISIONS.md`.

Frontière fixée à la signature de la 4.8 (cahier 4.8, §1) : **4.9 — Pilot
Fast**, le chantier vitesse ; **5.0** — multi-session, multi-onglets,
multi-parties.

Les invariants de la 4.8 restent la loi : écartement [1405, 1470] mm en
admissibilité seulement, jamais une cible ; jamais un rail appliqué seul ;
jamais de VALIDATE ou de SKIP automatique sur un cut non résolu ; cuts 9033 et
9241 exclus ; aucune pose humaine dans l'entrée d'une décision sans amendement.

---

## 1. Décentrer la caméra d'ESV pour atteindre le champignon (D-049)

### 1.1 Le besoin

**Idée de la direction, 24 septembre 2026.** Quand l'écart est trop grand et
que la correction à effectuer tombe hors de la caméra d'ESV, il faut un outil
qui **décentre la caméra**, pour que le super cerveau aille chercher dans le
nuage de points la portion où placer le champignon, puis que le Pilote y pose
le rail.

Aujourd'hui, le Pilote clique la cible dans la vue orthographique qu'ESV centre
sur sa propre pose de départ (±0,2 unité de scène). Quand cette pose est loin
des rails, la bonne position sort de la vue et le cut est différé (KI-051,
D-043) ; l'opérateur le pose à la main, en dézoomant et en déplaçant la vue au
clic droit.

### 1.2 Cas mesurés

| Partie | Pose de départ d'ESV | Cuts retrouvés par la voie mais hors de la vue |
|---|---|---|
| 33 (4.7.10, KI-051) | 13 à 21 cm des rails | 8090–8095, retrouvés avec les appuis du lot précédent ; 10 cuts différés en tête du lot 2 (8090–8099) |
| 2 (4.7.14, KI-054) | gabarit à 1500 mm, 60 à 200 mm des rails ; saut à partir de 113 | 114 et 117–121 : positions justes au rejeu (1,5 à 8,2 mm), vue dépassée de 4 à 11 % (ndc −1,04 à −1,11) |

Dans ces cas, les points étaient dans la capture : seul le clic manquait. Pour
un écart plus grand, les points du vrai rail peuvent aussi sortir de la
capture ; l'outil doit couvrir les deux.

### 1.3 Ce qui est demandé

1. **Déclencheurs**, chacun journalisé :
   - la position retrouvée par la voie est hors de la vue (`hors-vue-left`,
     `hors-vue-right` aujourd'hui) ;
   - la paire du moteur est retirée par une garde (continuité, écartement
     voisin) et aucun minimum qualifié n'existe près de la prédiction dans la
     capture ;
   - la pose de départ d'ESV est à plus d'un seuil de la prédiction de la voie
     (seuil à mesurer).
2. **Décentrage** : déplacer la vue d'ESV (translation, dézoom si nécessaire)
   vers la position prédite par la voie, sans changer de cut ; attendre que la
   caméra soit immobile et que le nuage soit chargé.
3. **Nouvelle capture** sur la vue décentrée, puis décision sur le lot relancée
   sur cette capture (moteur relancé depuis la voie, choix).
4. **Pose** par clic dans la vue décentrée, **les deux rails ou aucun** ; relecture
   de la pose à 1 mm avant toute validation, écartement relu dans le contrat.
5. **Retour** : vue remise dans un état connu avant le cut suivant ; si ESV ne
   recentre pas, le lot s'arrête proprement (erreur de capture actuelle « Vue
   ESV non recentrée »), sans pose touchée.
6. **Repli** : tout échec (caméra qui bouge, nuage non chargé, clic refusé,
   pose relue différente) diffère le cut ; jamais de pose partielle, jamais de
   VALIDATE.
7. **Variante à étudier** : clic en deux temps (le rail est d'abord amené en
   bord de vue, la vue est recadrée, puis le rail est posé), si ESV ne permet
   pas de déplacer la vue par programme.

### 1.4 Préalables

- **Inspection d'ESV par l'opérateur** : comment ESV déplace et zoome la vue,
  quels symboles internes le permettent (KI-026 : dépendance à des symboles
  ESV), comment savoir que le nuage est chargé. Même méthode que la fiche du
  chantier 1 (`consignes/chantier-1-operateur.md`).
- **Garde de capture** : aujourd'hui, une caméra qui bouge pendant la capture
  arrête le lot (« La caméra a changé pendant l'export », partie 2, cut 24). Le
  décentrage doit être terminé et stable avant toute capture.
- **Temps** : chaque décentrage ajoute un chargement du nuage ; mesuré avec
  l'instrumentation par phase du chantier vitesse (§2).

### 1.5 Acceptation

- Sur les lots relus des parties 2 et 33, et sur au moins un lot neuf : les
  cuts aujourd'hui différés « hors de la vue » sont placés, **0 faux ajouté**
  (latéral ou vertical > 10 mm, D-038).
- Aucun cut placé avec un seul rail ; aucun VALIDATE sans pose relue.
- Temps ajouté par cut décentré mesuré et publié.

---

## 2. Autres chantiers déjà renvoyés à la 4.9

| Chantier | Origine |
|---|---|
| **Vitesse du Pilote** (Pilot Fast) : instrumentation par phase (capture, analyse, sélection, clic, validation, navigation, chargement du nuage suivant) avant toute optimisation | Cahier 4.8, §1, décision de signature |
| Raccourcis clavier `D` et `Maj+Espace`, sur mesure | Cahier 4.8, §5.5 |
| Chantier 1 : revenir à un cut, aller au cut précédent | Amendement n°10, point 7 ; inspection d'ESV non faite |
| Le Pilote se déplace seul sur les cuts voisins et lit la pose des cuts déjà validés, comme appuis | Direction, 24/09 ; exige un amendement au test I (poses humaines en entrée) |
| Recadrage de la vue d'ESV | D-043, KI-051 — repris au §1 |
| Faux placés par le moteur sans aucun appui (398, 402 de la partie 20) | Bilan des curseurs (D-047) : aucun curseur ne les touche |
| Régresseur de position appris | Cahier 4.8, §4 ; `PLAN_4.8.md` |
