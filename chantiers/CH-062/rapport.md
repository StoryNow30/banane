# CH-062 — Signal de fin de chargement d'ESV éteint pendant le lot (rapport, 06/11/2026)

Données : les journaux des lots du 04/11 (Constellation 0-4 le matin, Orbite 6-15, Constellation 0-7 le soir) et du 05/11 (8-12). Cela fait 29 chargements de page ESV et 32 371 requêtes de points. Le journal du 06/11 n'est pas encore dans `banane-data` : il n'est pas mesuré ici.
Outil : `tools/ch062-signal-lot.cjs`. Il reprend `capturesParRequete` de CH-060 et `lectureDe` / `observer` de `src/relecture-signal.js`. Agrégats : `mesure.json`, sans identifiant ni coordonnée.

## 0. Pourquoi le compteur se bloque (ÉTABLI)
- **Le code.** ESV charge Potree 1.8.0 au format EPT (relevé `ept` de l'observateur). Dans Potree 1.8 (`EptBinaryLoader`, `EptLaszipLoader`, `PointCloudEptGeometryNode`) :
  - `load()` fait `++numNodesLoading` ;
  - seul `doneLoading()` fait `--` ;
  - une réponse au statut différent de 200 fait seulement `console.log('Failed …')`. Le compteur garde +1 pour toujours, le nœud reste `loading` et n'est jamais redemandé (sa descendance non plus).
- **Les données.**
  - 8 pages ont reçu un **HTTP 502** sur une requête `ept-data`, 10 échecs en tout.
  - Dans les 8, la dernière lecture au signal précède le premier échec de 1 à 11 s. Le signal ne revient ensuite qu'au rechargement suivant.
  - Les 21 pages sans échec ne perdent jamais le signal pour de bon. Une seule extinction passagère (partie 5 du soir), et il est revenu.
  - Après l'échec, 4 921 vues au repli sur 5 017 (98,1 %) ont un compteur **égal** au nombre d'échecs de la page, et seul « chargements » leur manquait. Les 96 autres ont un compteur supérieur (un vrai chargement en cours). Aucune n'a un compteur inférieur.
  - L'échec arrive 68 à 2 659 s après le chargement de la page. Ce n'est donc pas un âge de page (D-109 disait « environ 10 min ») : c'est un hasard du serveur, environ un échec pour 3 200 requêtes.
- **Autres signaux de fin de chargement.** `responseStatus` (Resource Timing, Chrome ≥ 109) compte exactement les nœuds perdus. Ni `framenumber`, ni la signature des nœuds, ni le cache LRU ne disent qu'un nœud est perdu.

## 1. Mesure (ÉTABLI, cuts du lot, intervalle de 120 s au plus entre deux décisions)
- Temps par cut posé (médiane, quartiles) :
  - au signal : **2,7 s** [2,0 ; 3,7], n = 2 372 ;
  - au repli : **4,8 s** [3,6 ; 6,2], n = 230 ;
  - écart : 2,0 s, intervalle à 90 % [1,7 ; 2,4].
- Mort détectée PENDANT le lot par la règle de la relecture (8 replis de suite) : 6 pages. Exemples : partie 10 d'Orbite détectée à 104 s, avec un tiers 1 à 2,9 s par cut contre 6,8 et 6,7 s ensuite ; partie 11 du 05/11 détectée à 2 696 s, avec un tiers 3 à 4,2 s contre 2,5 et 2,2 s. Une des 6 est une extinction passagère sans échec : un rechargement y aurait été inutile.
- Gain sur le temps du lot (13 233 s), bootstrap de 2 000 tirages, intervalle à 90 % :

| Voie | Gain | Part |
|---|--:|--:|
| (B) rechargement, 1 par partie, 20 s par rechargement (SUPPOSÉ), signal neuf qui vit la médiane mesurée (480 s) | 333 s [300 ; 369] | 2,5 % |
| (B) idem, signal neuf qui tient jusqu'à la fin du lot (borne haute) | 944 s [886 ; 1 003] | 7,1 % |
| (A) ligne de base par les échecs, sans rechargement | **1 077 s [1 013 ; 1 148]** | **8,1 %** |

- (A) vaut aussi pour la relecture : CH-060 mesurait 3 495 s au plus en relecture pour le rechargement.

## 2. Ce qui est livré
- **(B), codé** dans `background.js`, réglage `lot.signalEteint` (`actif:false`).
  - **Coupé** : un événement `lot-signal-eteint` (« detecte », action « aucune ») par série, rien d'autre.
  - **Allumé**, le rechargement se fait à un **point sûr** : dans l'enveloppe de `validateAndNext`, après la validation et avant toute commande du cut suivant, si toutes ces conditions tiennent :
    - écriture de validation d'ESV **vue par l'observateur** dans `preuveMs` (un rechargement pendant la requête la perdrait) ;
    - aucune pose à réconcilier, aucun différé en vol, ni deuxième passe, ni relecture, ni Écho, ni Mes corrections ;
    - cut suivant affiché dans la même partie, dans les bornes.
  - **Ensuite** : pause du moteur, rechargement, ré-équipement, liste attendue, puis `reprendreLot` (page rattachée, partie vérifiée, cut retrouvé). ESV muet, ou sur une autre partie, pendant `attenteRepriseMs` : le lot reste en pause avec la consigne F5. **Ariane ne change jamais de partie.**
  - **Plafond** : 1 rechargement par partie, proposé tel quel. Une seconde mort a eu lieu dans 2 pages sur 8 (10 échecs pour 8 pages). Sans signal après le rechargement, le lot continue au repli, sans boucle.
- **(A), en patch seulement** : `adaptateur-ligne-de-base.patch` (fichier interdit). La page compte ses requêtes `ept-data` en échec (lecture seule). La condition « libre » devient `numNodesLoading − échecs === 0`. Réglage `lot.signalEteint.ligneDeBaseEchecs` (`false`). Un échec non vu laisse le repli d'aujourd'hui : jamais de lecture plus tôt.
- **Recommandation de l'exécutant** : appliquer (A), et garder (B) en filet. Seul (B) remplit le trou de détail que laisse le nœud perdu (PROBABLE : le nœud et sa descendance restent absents jusqu'au rechargement).

## 3. Preuves
- **Essais rouges d'abord** : `lot-signal-eteint` et `-rechargement` étaient rouges avant le code (aucun événement, aucun rechargement). L'essai du patch est rouge sur l'adaptateur non patché.
- **Essais SW**, chacun sous 15 s seul, tous verts : `tests/lot-signal-eteint.test.cjs` (coupé : mêmes commandes qu'un lot au signal), `-rechargement`, `-refus` (règle pure ; écriture jamais vue), `-autre-partie` (partie 0, partie 24), `-sans-retour` (plafond), `tests/lot-signal-ligne-de-base.test.cjs` (patch (A)), `tests/ch062-outils.test.cjs` (outil de mesure, journal synthétique).
- **Non-régression** : deux passes de 58 et 171 fichiers voisins (les listes se recoupent), toutes vertes après une correction d'une ligne : la garde manquait quand le module du signal n'est pas chargé. Dans `pose-lot-inchanges-4959`, la clé `lot.signalEteint` est déclarée, avec l'assertion « coupé ».
- **Maquette** : `tests/esv-maquette/lot-signal-eteint.test.cjs`, compteur bloqué. Pause après la validation du cut 103, reprise 2 s après le rechargement, 3,7 s entre deux validations, chaque cut validé une fois, lectures au signal ensuite, aucun SKIP.
- **Parité** : `parite-relecture-sw` contre le tronc ce98a9a : relevés identiques. `parite-l1se-sw --passe` **non lancée** : il faut un corpus de nuages et un rejeu du banc, absents de cette session. L'essai « coupé » montre des commandes identiques.
- Aucun fichier de décision touché : `engine`, `adapter-page`, `geometry*`, `gcv2*`, `lot-decision`, `manifest` ont un diff vide.

## Risques et limites
- Le coût d'un rechargement sur le vrai ESV est SUPPOSÉ : 20 s retenues (changement de partie : 9 à 16 s, CH-058). Sur la maquette, la reprise vient 2 s après le rechargement.
- La partie qu'ESV affiche après un F5 donné par Ariane est SUPPOSÉE. Le pire cas mesuré en maquette : le lot reste en pause et attend l'opérateur.
- Le banc et la maquette ne sont pas le poste de l'opérateur. Rien n'est allumé.
