# CH-085 — Rapport : le préchauffage passe par Potree (authentification d'ESV)

Branche `chantier/CH-083` (étape demandée par l'intégrateur le 09/11, après le lot « Vision 7 »).

## Constat (terrain, ÉTABLI par l'intégrateur)
Nos `fetch` de préchauffage ont tous reçu **401** : 72 sur 72. Ceux de Potree ont reçu 200.

Conséquences :
- `servisCache` est resté à 0 ;
- le préchauffage s'est arrêté seul (`cache-inutile`) ;
- la phase mémoire de CH-083 ne serait jamais partie, car elle exige un 200.

## (1) Comment Potree 1.8.2 fait sa requête (ÉTABLI par le code)
- `EptLaszipLoader.load` fait `fetch(${base}/ept-data/<clé>.laz)`, sans second argument.
- `PointCloudEptGeometry.loadHierarchyPage` fait `fetch(${base}/ept-hierarchy/<clé>.json)`, de même.
- `XHRFactory.config` (`customHeaders`, `withCredentials`) ne sert qu'aux chargeurs en XMLHttpRequest, pas à l'EPT.

ESV authentifie donc ses requêtes ailleurs que dans le Potree d'origine (SUPPOSÉ, à lire sur le terrain) : `fetch` global enveloppé, chargeur modifié ou service worker. Notre `fetch` différait de celui de Potree par son second argument (`priority`, `mode`, `credentials` explicites). Une enveloppe qui n'ajoute son jeton qu'aux appels sans second argument expliquerait le 401 (SUPPOSÉ).

**Diagnostic ajouté** à `prechauffage-vue` (booléens et compte, jamais de valeur) :
- `fetchNatif` : le `fetch` de la page est-il celui du navigateur ?
- `enTetesXhr` et `credXhr` : en-têtes et accréditations de `XHRFactory`.

## (2) Voie Potree (`voie:'potree'`, livrée)
- **Plus aucune requête à nous.**
  - Données : `node.load()`. Le nœud est décompressé et mis en mémoire, et le cache se remplit, avec l'authentification d'ESV.
  - Frontière : `node.loadHierarchy()`. Potree lit la page et greffe lui-même les enfants, sans toucher au compteur ; on les charge au tour suivant.
- **Mêmes limites que CH-083** :
  - 2 chargements en vol, seulement quand le compteur effectif égale nos chargements (Potree au repos) ;
  - par cible : `noeudsMax` 32 et `hierarchiesMax` 8 ;
  - 256 Mo décodés par vie de la page, plus les plafonds du lot ;
  - annulation par une capture, un changement de coupe, ou Potree qui repart.
- `voie:'fetch'` reste le défaut du module (CH-077 à CH-083). `actif:false` coupe tout.

## (3) Arrêt pour le lot : `refus-serveur`
Le préchauffage s'arrête jusqu'au rechargement de la page dans trois cas :
- une réponse ≥ 400 vue par l'observateur des ressources, sur un nœud ou une page de hiérarchie, pendant une opération ou sur une de nos clés (ou 0 sur une de nos clés) ;
- une page de hiérarchie en échec ;
- un de nos `load()` encore « en cours » au-delà de `delaiMs` (5 s).

Il y a au plus `enVolMax` requêtes en échec avant l'arrêt, donc aucune boucle de refus. Un échec de `load()` bloque le compteur de Potree (CH-062) comme l'aurait fait Potree à l'arrivée ; la ligne de base de CH-062, si elle est allumée, le retire.

## (4) Maquette (panne `eptAuth` : le serveur exige `x-esv-jeton`, que seul le Potree simulé envoie ; forme relevée, modèle mémoire de CH-083, saut de 50 ; une transition, ÉTABLI sur la maquette)
| Module | Voie | Refus du serveur | `load()` | Chargés à l'arrivée | Points affichés |
|---|---|---|---|---|---|
| d'avant (e32c350) | fetch | 32 | 0 | 5 / 56 | 1 649 à 1 738 ms |
| livré | fetch | 32 | 0 | 5 / 56 | 1 645 ms |
| **livré** | **potree** | **0** | 18 | **21 / 56** | **1 130 ms** |

La coupe en cours garde tous ses nœuds dans les deux voies, et rien n'est libéré.

## Preuves
- **Essais rouges d'abord, puis verts** :
  - `tests/ch085-voie-potree.test.cjs` : 6/6 ; rouge 5 sur 6 sur e32c350.
  - Maquette `ch085-voie-potree` : 1/1 ; rouge 0/1 sur le module d'avant.
  - `ch083-relais` : 2/2 (motif `refus-serveur`, diagnostic de la vue).
- **Ajustements déclarés** :
  - `ch077-adaptateur`, `tests/esv-maquette/ch077-outils.cjs` et `ch083-outils.cjs` forcent `voie:'fetch'`, la voie qu'ils mesurent ;
  - `ch081-prechauffage` attend les champs de diagnostic dans la vue ;
  - serveur de maquette : panne `eptAuth`, compteur `refusEpt`.
- **Régression ciblée** (ch077, ch080, ch081, ch083, ch084, ch085, garde `pose-lot-inchanges-4959`, `choix-lot-clic-sw`, relecture, scans) : 256 essais, 255 réussis, 0 échec, 1 sauté.
- **verify, maquette complète, parité** : en cours (complétés au PRÊT).
- **Pas de patch d'adaptateur.**
- **Aucun fichier interdit touché** : `engine`, `adapter-page`, `geometry*`, `gcv2*`, `lot-decision`, écriture dans ESV, `manifest.json`, version.

## Consigne terrain
Dans `prechauffage-vue`, lire `fetchNatif`, `enTetesXhr` et `credXhr`. Dans `prechauffage`, lire :
- `motif` : `refus-serveur` doit être absent ;
- `noeuds`, `hierarchies`, `memCharges`, `memEchecs` (0 attendu), `memOctets` ;
- `tasAvantKo` et `tasApresKo`.

Comparer la capture médiane des sauts de 2 coupes ou plus. Au moindre refus, le préchauffage s'arrête seul. `actif:false` le coupe.
