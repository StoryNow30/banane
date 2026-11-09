# CH-081 — Étude : couvrir ce que la zone fixe ne couvre pas (D-311)

Sources : code de Potree 1.8 (dépôt officiel, étiquette 1.8 : `Potree_update_visibility.js`, `PointCloudEptGeometry.js`, `viewer.js`, `Potree.js`) ; corpus et journaux des lots « Vision 5 » (509 captures, 1 018 vues) et « Vision 6 » (48 captures, volume 3 absent ; 491 passages au journal) de `banane-data`, lus par scripts. Aucune donnée terrain versée ici.

## (a) Vue prédite : oui, et plus simple que prévu
- **Caméra d'ESV orthographique** (ÉTABLI, 557 captures). Sa pose ne dépend que des rails : sur le rail, 0,20 m en long, axe dans la voie à 0,025° près. Fenêtre 0,40 × 0,46 m, constante.
- **Boîte de découpe d'ESV** (`SHOW_INSIDE`, `INSIDE_ANY`, une boîte) : 4 × 0,5 × 2 m (travers, long, haut), centrée sur le milieu des rails au millimètre, alignée sur la voie (ÉTABLI).
- **Potree 1.8 en orthographique** (ÉTABLI, code) :
  - le critère de taille à l'écran (`minimumNodePixelSize`, réglé par `minNodeSize`) n'existe que pour la perspective ; en orthographique, le poids est la diagonale du nœud, donc du plus gros au plus fin, **sans arrêt de détail** ;
  - un nœud est retenu s'il coupe le frustum et la boîte, dans `pointBudget` et `maxLevel` ; les niveaux 0 à 2 passent le frustum mais pas la boîte ;
  - au plus `maxNodesLoading` (4) chargements lancés par image, et au plus 2 nœuds passés au GPU par image.
- **Rejeu hors de Potree** (intersections de `THREE.Frustum` reproduites, rien n'est modifié) :
  - les 13 511 nœuds visibles des 1 114 vues coupent tous la boîte (ÉTABLI) ;
  - 6 à 11 % sortent de la fenêtre de la caméra de capture, jusqu'à 2,4 m en travers. Une autre vue, sans doute celle d'ESV à l'arrivée, charge donc toute la largeur de la boîte (PROBABLE) ;
  - **règle retenue : tous les nœuds de la hiérarchie qui coupent la boîte de la coupe suivante.** Elle couvre 100 % des nœuds nouveaux à l'arrivée (1 264 sur 1 264, lot, tous sauts) ; en trop : médiane 0 à 1, P90 2 à 4 nœuds par coupe, contre 14 à 17 visibles ;
  - **le cube de 0,75 m n'en couvre que 85 %** (Vision 5, sauts ≥ 2 : 502/592) **et 94 %** (Vision 6 : 240/255). Il manque les côtés (la boîte dépasse les rails de 1,25 m) et le haut et le bas (±1 m) ; il déborde en long (±0,75 m contre ±0,25 m).
- La boîte de la coupe suivante se calcule à partir de ses bords dans la liste d'ESV (rails « explicit-before » = liste : PROBABLE). `pointBudget` n'est pas atteint : au plus 797 000 points par vue (PROBABLE ; à lire en lecture seule).

## (b) Situations sans prédiction sûre
- **Vision 6** (code CH-080) : prédiction juste dans **455 cas sur 455** (ÉTABLI) ; aucune prédiction dans 36 cas sur 491. 34 de ces cas sont `reseau-occupe`, corrigé par CH-080b ; les 2 restants (`sans-suivante`) sont des changements de mode : lot → passe (−512) et passe → relecture (−199). Sur 44 sauts ≠ +1, 4 n'ont pas été prédits ; il en resterait 2 après CH-080b.
- **Lot** (CH-080) : 6 passages sur 513 échappent à la règle. Ce sont le départ, une reprise après rechargement et la passe. Le différé suit la règle (134/134 `liste-esv` justes).
- **Candidats proposés** :
  - lot → passe : 1ᵉʳ cut de la liste de la passe ;
  - passe → relecture : `sel.cuts[0]`. Les deux listes sont connues du service worker (ÉTABLI) : nouvelle source au dernier cut du lot ou de la passe, deux candidats une fois par lot ;
  - retour en arrière, reprise : les nœuds ont déjà été chargés, et le cache HTTP les sert (Vision 4 : 72 nœuds) ; rien à préchauffer (PROBABLE) ;
  - changement de partie, retour manuel : aucun candidat sûr, 0 dans ces deux lots.
- **Deux coupes à l'avance** : la coupe k+2 suit la même règle depuis k+1. C'est nécessaire, car la fenêtre libre est courte :
  - entre la capture reçue et la coupe suivante : médiane 0,36 à 0,50 s, P10 0,20 à 0,37 s ;
  - un nœud prend 100 à 190 ms, 2 en vol ;
  - un saut lointain demande 7 à 14 nœuds, soit 0,4 à 1,3 s (ÉTABLI pour les mesures, PROBABLE pour la conclusion).

## (c) Profondeur : jusqu'aux feuilles
Sans critère de taille, Potree descend jusqu'au bout :
- les vues complètes atteignent le niveau le plus profond de la hiérarchie : niveau 9 (nœuds de 1,9 m) dans 91 vues sur 96 en Vision 6, et niveaux 11 et 12 en Vision 5 (ÉTABLI) ;
- il faut donc lire la hiérarchie EPT (étape de CH-080) jusqu'aux feuilles.

Nœuds nouveaux à l'arrivée (médiane / P90) :

| Saut | Nœuds nouveaux | Octets (240 à 290 Ko par nœud) |
|---|---|---|
| 1 | 1 à 2 / 3 à 5 | ~0,4 Mo |
| 2 à 10 | 4 à 6 / 7 à 8 | ~1,5 Mo |
| 11 à 50 | 7 à 10 / 13 à 14 | ~2,5 Mo |
| > 50 | 11 à 14 / 15 à 18 | ~3,5 Mo, 5 Mo au P90 |

Une coupe chargée de zéro fait 14 à 17 nœuds, 3,4 à 4,9 Mo.

## (d) Coût par lot (Vision 5 : 355 passages du lot au corpus ; SUPPOSÉ au-delà)
- Avec la boîte, à partir du saut 1 et sur deux coupes à l'avance :
  - environ 980 requêtes utiles, que Potree aurait faites de toute façon ;
  - en trop, 350 à 1 400 nœuds (médiane × P90), soit 100 à 400 Mo ;
  - plus 2 candidats × 17 nœuds aux changements de mode.
- Les nœuds en trop par lot (environ 350 à 1 400) sont du même ordre que les ~900 de D-310 au P90 du rejeu, et bien moins à la médiane.
- **Plafonds proposés** :
  - par candidat : 32 nœuds, 10 Mo, 8 hiérarchies ;
  - 3 candidats au plus par passage ;
  - par lot : 4 000 requêtes et 1,2 Go ;
  - retour à 1 candidat si plus de 30 % des préchauffés ne sont pas redemandés sur 50 opérations ;
  - `enVolMax` 2 → 3 seulement pendant les temps morts, à mesurer.

## (e) Cibles et ce qui empêche 100 %
- **Cibles mesurables (Vision 7)** :
  - prédiction juste ≥ 99 % des passages, hors départ et reprise ;
  - nœuds couverts ≥ 98 % et servis par le cache ≥ 90 %, à partir du saut 1 ;
  - inutiles ≤ 25 % ;
  - capture médiane après un saut ≤ 1,5 × la voisine ;
  - capture du cut en cours inchangée (départ seulement quand le compteur vaut 0).
- **Freins restants** :
  1. Départ, reprise, changement de partie, retour manuel : rares, quelques passages par lot.
  2. La fenêtre libre est trop courte au P90 des sauts lointains, même à deux coupes.
  3. Même servi par le cache, Potree passe au plus 2 nœuds au GPU par image, et chaque nœud est décompressé à nouveau : environ 0,1 s par saut lointain, incompressible (ÉTABLI, code).
  4. La caméra d'ESV à l'arrivée n'est jamais enregistrée. Il faut une lecture seule de son type, de sa projection, de `pointBudget` et de `maxLevel`.
  5. Même clé de cache entre le XHR de Potree et le `fetch` du préchauffage, et cache HTTP assez grand pour environ 750 Mo par lot (SUPPOSÉ).
