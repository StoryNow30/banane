# CH-063 — N'attendre que les points utiles : rapport (06/11/2026)

Données : banane-data, lots du 04/11 (Constellation 0-4, Orbite 6-15, Constellation 0-7 du soir) et du 05/11 (Constellation 8-12).
- **Journaux** : 3 570 captures au lot, 8 443 en relecture.
- **Nuages du corpus** : 3 520 captures, dont 3 139 lisibles par niveau. Les 381 autres (`partial-multi-view`) ont au moins un point sans niveau lisible.

Outils :
- `tools/ch063-attente-reseau.cjs` : le temps, rapproché des requêtes `point-resource` d'ESV ;
- `tools/ch063-niveau-detail.cjs` : le rejeu du moteur par niveau d'octree.

Agrégats sans identifiant ni coordonnée : `agregats.json`. Essais : `tests/ch063-outils.test.cjs` (6) ; prototype : `tests/ch063-lecture-directe.test.cjs` (10) et `tests/esv-maquette/lecture-directe-ombre.test.cjs` (4, 15 s).

## 0. Où part le temps (ÉTABLI)
| | captures | capture / cut | attente / capture | requête de points en vol / attente (borne haute) | attente après la dernière requête |
|---|--:|--:|--:|--:|--:|
| lot | 3 570 | 58,7 % | 85,5 % | 23,8 % | 43,3 % |
| relecture | 8 443 | 80,9 % | 83,9 % | 11,5 % | 65,2 % |

Ce que dit le tableau :
- **Une attente sur deux sans réseau.** Au lot, 3 953 attentes de rail sur 7 140 (55 %) ne voient aucune requête de points ; en relecture, 11 305 sur 16 886 (67 %). Les nœuds sont déjà en mémoire, et l'attente n'est que la règle de fin de chargement : 3 images au signal (médiane 0,26 s) ou 800 ms de calme au repli.
- **Au repli, un temps fixe.** Au lot, 2 142 attentes de rail au repli ont une médiane de 837 ms, dont 833 ms après la dernière requête.
- **Le serveur.** 8 requêtes de points en échec pendant les attentes des 12 013 captures.

## 1. Piste 1 : lecture directe des points de la zone du rail

**Gain.** Borne haute (SUPPOSÉ : la lecture directe ne coûterait que le temps en vol des requêtes d'ESV, et rien d'autre ; sélection des vues et décodage non comptés) :
- lot : 5 183 s sur 13 537 s, soit 38 %, environ 1,45 s par cut ;
- relecture : 12 156 s sur 20 202 s, soit 60 %, environ 1,44 s par cut.

**Mais presque tout ce temps ne dépend pas du réseau.** C'est l'attente de la règle de fin de chargement, et surtout le repli quand le signal d'ESV meurt. CH-060 et CH-062 le traitent déjà par un rechargement de la page.

**Identité : NON PROUVÉE, et non prouvable avec ce que le ticket permet.**
- banane-data n'a aucune ressource de points brute : l'observateur ne garde que des comptes, des octets et des heures, jamais une adresse ni un contenu. Les requêtes vers le vrai ESV sont interdites depuis le dépôt.
- Le format des nœuds d'ESV n'est pas décodé dans Ariane. Les chemins contiennent `ept-data` ; le format exact est SUPPOSÉ.
- L'identité exige aussi de choisir exactement les nœuds qu'ESV affiche (visibilité selon la caméra et le budget de points de Potree). Les requêtes seules ne disent pas quels nœuds servent la vue du cut courant : un nœud demandé plus tôt, ou servi par le cache, échappe à la relecture (SUPPOSÉ pour le vrai ESV).

**Prototype (maquette seulement).** Le module `src/lecture-directe.js` (nouveau) est une lecture directe **en ombre** : il ne remplace jamais la capture et ne la retarde pas.
- Ce qu'il fait : il relit au plus une fois chaque ressource de points qu'ESV a demandée elle-même, en `force-cache`, avec un plafond de 16 par cut, puis compare **au bit près** les tampons décodés aux nœuds affichés **à l'instant de la capture**.
- Arrêt à la première erreur ou au-delà de 1 s, jusqu'au rechargement de la page.
- Aucune adresse n'est postée. Sans décodeur (cas du vrai ESV), il ne demande rien.
- Branchement : `lecture-directe-ombre.patch` pour `src/adapter-page.js` (fichier interdit à l'exécutant, donc livré en patch), `src/esv-observer.js` (liste blanche de l'événement), `src/settings.js` (`lectureDirecte.actif:false`) et `background.js` (injection). Il s'applique au tronc (`git apply --check`) ; il n'est pas appliqué.

**Ce que la maquette prouve, et seulement là.**
- Nœuds relus identiques au bit près aux nœuds affichés.
- Capture inchangée : mêmes points, réglage allumé ou coupé.
- Une seule relecture par requête d'ESV.
- Arrêt au premier 502, puis aucune requête.
- Coupé : aucune requête.

**Défaut trouvé par l'essai rouge et corrigé.** Les relectures d'Ariane, vues à leur tour par l'API de mesure des ressources, comptaient comme des requêtes d'ESV au cut suivant. Leur nombre se serait emballé.

**Risques.**
- Une requête de plus par requête d'ESV si le cache HTTP ne sert pas. Les en-têtes de cache d'ESV sont inconnus (CH-049-E).
- Un décodeur à écrire et à tenir.
- Un écart de sélection des nœuds, qui fausserait la lecture sans le dire.

**Recommandation.** Ne pas ouvrir la piste 1. Pour la rouvrir, il faudrait trois choses :
1. une décision écrite de l'opérateur pour une séance en ombre sur le vrai ESV (requêtes au plus égales à celles d'ESV, cache d'abord) ;
2. un décodeur du format réel ;
3. des centaines de cuts à « identite: true » avant tout usage.

Le gain visé est d'abord celui de CH-062, sans requête ni décodeur.

## 2. Piste 2 : niveau de détail suffisant

**Méthode.** Le niveau de chaque point se lit dans la boîte de son nœud : celle de la racine divisée par 2^n. ÉTABLI : les niveaux sont exactement entiers sur les 3 139 captures. Le moteur d'aujourd'hui (`scientificProposeBothAvecReservoir` puis `toRuntimeRails`) est rejoué sur le nuage complet, puis sur le nuage coupé à « niveau maximal − d ». Le niveau maximal est 11 pour 2 456 captures, 12 pour 267 et 10 pour 312.

| coupe | points gardés (médiane) | captures identiques | dont « candidate » aux deux rails à niveau plein | statut changé | même statut, écart ≥ 1 mm |
|---|--:|--:|--:|--:|--:|
| −1 niveau | 23 % | 612 / 3 139 | **47 / 1 875 (2,5 %)** | 2 235 | 194 (P90 2,0 mm, max 272 mm) |
| −2 niveaux | 5 % | 629 / 3 139 | 0 / 1 875 | 2 493 | 15 |

Les 612 captures identiques sont presque toutes des captures rejetées aux deux niveaux, où il n'y a rien à poser.

**Identité : ÉCHOUÉE (ÉTABLI).** **La piste est fermée** : pas de gain à mesurer, pas de prototype.

Une autre façon de couper (niveau absolu, ou un seul rail) n'y changerait rien. Le niveau le plus profond porte 77 % des points de la zone en médiane, et le moteur en dépend.

## Limites
- Les heures du service worker et de la page sont rapprochées par l'horloge du poste : précision de l'ordre de la milliseconde (PROBABLE).
- Les requêtes sont agrégées par fenêtre de 250 ms : le temps « en vol » est une borne haute.
- Les essais des deux outils de mesure ont été écrits après eux : ils fixent leur comportement, ils ne l'ont pas guidé. Le prototype a suivi l'ordre rouge, puis vert.
- Aucune requête vers le vrai ESV, rien d'activé, aucun fichier interdit modifié.
