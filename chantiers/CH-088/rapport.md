# CH-088 — Rapport : préchauffer plus tôt les sauts lointains ; bilan et vue de la voie potree

Branche `chantier/CH-088`, partie du tronc (0fb3777). L'étude en 10 lignes a été envoyée à l'intégrateur ; le code a suivi sans attendre (D-312).

## (a) Mesure sur le lot « Vision 8 » du 09/11 (journal, ÉTABLI)
Script : `chantiers/CH-088/mesure-sauts.cjs` (aucune donnée versée).

Il y a 11 sauts de 11 coupes ou plus dans le lot :
- La cible n'est jamais prise plus de **2 coupes avant** (k+2, horizon 2).
- Le premier départ a lieu de **0,9 à 3,9 s avant l'arrivée**, environ 1,4 s en médiane. Un cas part à 40 ms (`reseau-occupe`), un autre jamais.
- Chaque opération est **coupée au changement de coupe** (motif `coupe`) après 250 à 720 ms.
- À l'arrivée, **0 à 4 load() sont finis** pour la cible (2 en général), avec 2 encore en vol. La boîte compte 39 à 53 nœuds, dont 4 à 16 déjà chargés.

## Ce qui est livré
**(b) Opération lointaine** (`src/prechauffage.js`, voie potree) :
- La prochaine cible lointaine est prise dès qu'elle est connue, jusqu'à `coupesMax` 40 coupes à l'avance. Elle se définit par un écart d'au moins `loin.sautMin` (11) avec la coupe précédente de la chaîne.
- Sources de la cible :
  - lot : nouvelle demande `{loin, max}` à l'observateur, qui suit la chaîne « cut non validé suivant » et rend `avant` et `saut` ;
  - relecture et passe : `loin` joint par le service worker (`cibleLoinListe`).
- L'opération survit aux changements de coupe. Elle s'arrête quand la cible change (`remplace`), sur un refus du serveur, ou à l'arrivée (`arrivee`).
- Pause pendant chaque capture : les load() déjà lancés finissent, aucun nouveau ne part. Pause aussi quand Potree charge pour la coupe en cours.
- Plafonds inchangés :
  - `noeudsMax` 32 et `hierarchiesMax` 8 par cible ;
  - `enVolMax` 2 pour **tous** nos load() à la fois (l'opération proche compte avec) ;
  - budget du lot ; 256 Mo décodés.
- La cible lointaine sort de la liste de l'opération proche (motif `loin`).
- Événement `prechauffage-loin` : captures et ms avant l'arrivée, load() lancés et chargés, bilan à l'arrivée.
- Réglage `prechauffer.loin = {actif:true, sautMin:11, coupesMax:40}`. Il est éteint dans le module et allumé dans `src/settings.js` pour le lot d'essai ; `loin.actif:false` le coupe seul.

**(c) Bilan de la voie potree, par l'arbre.** Au début de la capture d'arrivée, un instantané de la boîte de la cible donne :
- `boite` : nœuds connus avec des points ;
- `prets` : nœuds chargés ;
- `nousPrets` : nœuds chargés par nous ;
- `nousEnVol` : nos load() encore en vol.

Au bilan, après cette capture, on ajoute `boiteFin`, `potreeLui` (nœuds que Potree a chargés lui-même) et `nousApres`.

`tools/bilan-lot.cjs` lit ces champs (part de la boîte déjà chargée), les opérations lointaines, les load() (467 lancés, 140 chargés, 0 échec sur ce lot) et la vue.

**(d) Cause de l'absence de `prechauffage-vue` (ÉTABLI).** L'événement était bien émis et relayé : 3 fois sur ce lot. Mais son champ `type` (`orthographique`) écrasait le `type` de l'enveloppe du journal (`esv-observation`), si bien que les outils ne le trouvaient pas. Correction :
- le champ s'appelle maintenant `camera`, dans le module, l'observateur et le service worker ;
- un ancien `type` est relu en `camera` et n'est jamais rendu ;
- le bilan lit aussi l'ancienne forme.

Le bilan du lot affiche maintenant : caméra orthographique, pointBudget 2 000 000, **pointLoadLimit 4 000 000**, fetch natif, 0 en-tête XHR, pas d'accréditation XHR.

**Le Potree d'ESV pose donc un `pointLoadLimit`**, ce que CH-083 jugeait PROBABLE absent. Un nœud préchargé n'entre pas dans la LRU (CH-083, essai `ch083-memoire` avec la limite atteinte). Ce point ne change donc pas la coupe en cours, mais la LRU libère au-delà de 4 M points visibles (PROBABLE).

**Patch** `chantiers/CH-088/adapter-page.patch`, à appliquer par l'intégrateur : `voisinsB1` transmet `loin` et `max` (une ligne). Sans le patch, le lot n'a pas d'opération lointaine, mais la relecture et la passe l'ont, et le reste est inchangé.

## Banc (maquette, `tools/ch088-banc.cjs`, `banc.json`)
Conditions :
- 15 répétitions alternées ;
- 3 coupes voisines, puis un saut de 247 coupes ;
- latence 60 ms, décompression 40 ms ;
- temps mort 400 ms : la durée médiane d'une opération sur le terrain avant le changement de coupe ;
- charge de la machine au départ : 1,94.

Médiane / P90 (ÉTABLI sur la maquette) :

| Réglage | Nœuds de la boîte chargés à l'arrivée | Validation → points affichés | Capture de la coupe d'arrivée | Nœuds perdus par la coupe en cours |
|---|---|---|---|---|
| Vision 8 (loin éteint) | 23 / 56 (41 %) | 793 / 1 141 ms | 2 021 / 2 048 ms | 0 |
| **CH-088 (loin allumé)** | **39 / 56 (70 %)** | **721 / 736 ms** | 2 017 / 2 114 ms | 0 |

- L'opération lointaine part 3 captures avant l'arrivée (9,3 s). Elle lance 32 load() et les 32 aboutissent : c'est le plafond par cible. La boîte de la maquette a 56 nœuds, contre 14 à 17 nœuds nouveaux sur ESV (CH-081). Sur ESV, le plafond de 32 devrait donc couvrir toute la boîte (SUPPOSÉ).
- La capture de la coupe d'arrivée ne bouge pas sur la maquette. Ses attentes fixes y dominent, et l'instantané de l'opération lointaine pris au début de cette capture voit déjà 56 sur 56 nœuds. Le gain sur la capture d'ESV (3,4 s en médiane pour plus de 200 coupes) reste SUPPOSÉ : il faut le lire sur le lot d'essai.
- Rien n'est libéré, et la coupe en cours garde tous ses nœuds.

## Preuves
- **Essais rouges d'abord, puis verts** :
  - `tests/ch088-loin.test.cjs` 5/5 et `tests/ch088-relais.test.cjs` 4/4 : 0/9 sur le tronc ;
  - `tests/ch088-adaptateur.test.cjs` 3/3 : patch appliqué à une copie, demande `loin` ; sans le patch, rien ;
  - maquette `ch088-loin` : 1/1.
- **Ajustements déclarés** :
  - `pose-lot-inchanges-4959` : retrait du bloc `loin` de l'observateur et de la variante patchée de `voisinsB1`. La garde est verte sans le patch et avec lui (avec `ch077-adaptateur` et `ch080-adaptateur`).
  - `ch080-adaptateur` : opération lointaine éteinte, car il compte les demandes faites à l'observateur.
  - `ch081-anticipation`, `ch081-prechauffage`, `ch081-relais` : `camera` remplace `type`, et `loin` s'ajoute à `avecPrechauffage`.
  - Maquette : options `grappe` et `pas` du scénario (les ancres de `tools/relecture-maquette.cjs` sont intactes), et paramètres de plus à `ch083-outils`.
- **Régression ciblée** (ch077 à ch088, garde, relecture, passe, scans, bilan-lot) : 343 essais, 338 réussis, 0 échec, 5 sautés.
- **Parité de la relecture** (`tools/parite-relecture-sw.cjs`, contre le tronc 0fb3777) : **relevés identiques** (SHA-256 9984fe77…).
- `garde-gcv2` et `parite-l1se-sw` ne sont pas lancés : aucun module de décision n'est touché.
- **verify complet et maquette complète** : chiffres en fin de rapport.
- **Aucun fichier interdit touché** hors du patch : `engine`, `adapter-page`, `geometry*`, `gcv2*`, `lot-decision`, l'écriture dans ESV, `manifest.json`, la version. Aucune requête n'est ajoutée au serveur : uniquement `node.load()` et `loadHierarchy()` de Potree, pour les nœuds de la boîte de la cible (D-310, D-314).

## Reste SUPPOSÉ ou à lire sur le terrain
- Une capture en échec (sans capture-ready) laisse l'opération lointaine en pause jusqu'à la capture réussie suivante. C'est le sens prudent.
- Entre les captures, l'opération parcourt l'arbre à chaque image, mais seulement quand une place est libre et que Potree ne charge rien. Elle s'arrête quand la boîte est chargée ou que le plafond est atteint. Coût du fil principal : SUPPOSÉ faible.
- Lire dans `prechauffage-loin` : `captures`, `msAvant`, `charges`, `prets/boite`, `potreeLui`.
- Lire dans `prechauffage-bilan` : `prets`, `nousPrets`, `potreeLui`.
- Comparer la capture médiane des sauts de plus de 200 coupes à 3,4 s.

## verify et maquette complets (dans ma machine, code de 0052817)
- **verify complet** (`node tools/verify.cjs`) : **3 357 essais, 3 349 réussis, 1 échec, 7 sautés**.
  - L'échec est `typage-ch075` (« références d'identité gelées ») : `git show 5699f68` est introuvable dans mon clone superficiel. Il ne vient pas du chantier.
  - Après `git fetch --depth=1000`, `typage-ch075` passe seul : 5/5.
  - Le verify s'arrête sur ce premier lot d'essais : les étapes suivantes (géométrie, moteur) n'ont pas tourné dans ma machine.
  - `audit/verification.*` n'est pas versé.
- **Maquette complète** (`tests/esv-maquette/essais.cjs`) : **83 essais, 80 réussis, 0 échec, 3 sautés** (export réel absent), puis 7/7.
