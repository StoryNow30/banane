# CH-081 — Rapport : préchauffer ce que Potree chargera vraiment, deux coupes à l'avance (D-311)

Étude : `etude.md` (acceptée par l'intégrateur). Aval de l'intégrateur pour Vision 8, sur D-310 (coût accepté) et D-311 : boîte, horizon 2, candidats aux changements de mode, plafonds relevés, repli ; `sautMin` reste à 2.

## Livré (branche `chantier/CH-081`, tronc fusionné après CH-080c)
- **`src/prechauffage-boite.js`** (pur) : la boîte de découpe d'ESV de la coupe prédite, 4 × 0,5 × 2 m, alignée sur la voie. Le test d'intersection est celui de Potree 1.8 à l'identique. La calibration lit, en lecture seule, la boîte de Potree de la coupe courante, si elle est centrée et alignée.
- **`src/prechauffage-anticipation.js`** (pur) :
  - cibles par passage : k+1, puis le changement de mode, puis k+2 ;
  - budget du lot et repli ;
  - relevé de la vue (`prechauffage-vue`).
- **`src/prechauffage.js`** :
  - la zone devient abstraite : `zone:'cube'` (CH-077) ou `zone:'boite'`, jusqu'aux feuilles ;
  - plusieurs cibles par opération, avec des plafonds `noeudsMax`, `octetsMax` et `hierarchiesMax` par cible, et `lotRequetesMax` et `lotOctetsMax` par lot (vie de la page) ;
  - un nœud déjà préchauffé et pas encore redemandé n'est pas redemandé (`deja-prechauffe`) ;
  - bilan `utiles` / `inutiles` : nœud préchauffé redemandé, ou non, par Potree avant `rang` arrivées ;
  - motifs `plafond-lot` et `deja-prechauffe` ; champs `zone`, `cibles` et `calibree`.
  - Réglage sans les nouvelles clés : comportement de CH-080c.
- **`src/esv-observer.js`** : demande `premiere` (première ligne non validée de toute la table, hors le cut courant). Le relais réduit les nouveaux champs et `prechauffage-vue`.
- **`background.js`** :
  - les deux modules sont ajoutés à `PAGE_FILES` ;
  - `apres` (cut suivant de la même liste) est joint à la cible de la relecture et de la passe, jamais au lot ;
  - `obsFields` est complété.
- **`src/settings.js`** (Vision 8) :
  - `zone:'boite'`, `horizon:2`, `candidatsMax:3` ;
  - par cible : `noeudsMax:32`, `octetsMax:10 Mo`, `hierarchiesMax:8` ;
  - par lot : `lotRequetesMax:4000`, `lotOctetsMax:1 200 Mo` ;
  - repli : `repliInutiles:0.3`, `repliFenetre:50` ;
  - `sautMin:2` inchangé.
- **`chantiers/CH-081/adapter-page.patch`, à appliquer par l'intégrateur** :
  - `voisinsB1` laisse passer `premiere` ;
  - `apresCapture` reçoit `vue()` (caméra active, `Potree.pointBudget`, premier nuage).
  - Sans le patch : pas de changement de mode ni de `prechauffage-vue` ; le reste fonctionne.
- `tools/ch081-rejeu-corpus.cjs` : rejeu sur corpus avec le module livré. `chantiers/CH-081/analyse/` : scripts de l'étude, sans aucune donnée.

## Rejeu sur les corpus du 09/11 (module livré, ÉTABLI sur ces deux lots)
| Lot | Nœuds nouveaux à l'arrivée couverts par la boîte | par le cube de 0,75 m | En trop par coupe (médiane / P90) | Calibration acceptée |
|---|---|---|---|---|
| Vision 6 | 280 / 280 | 267 | 0 / 2 | 48 / 48 |
| Vision 5 | 901 / 901 | 731 | 1 / 4 | 356 / 356 |

## Preuves
- **Essais rouges d'abord, puis verts** :
  - `ch081-boite` 5/5, rouge sans le module ; il compare 20 000 cas à la recopie du code de Potree 1.8 ;
  - `ch081-anticipation` 6/6, rouge sans le module ;
  - `ch081-prechauffage` 6/6, 0/6 sur le module de CH-080c ;
  - `ch081-relais` 3/3, 0/3 sur l'observateur et le service worker d'avant.
- **Ajustements déclarés** :
  - `ch080-prechauffage` : liste des sources plus `changement-mode`, et plafonds de Vision 8 ;
  - `ch080-adaptateur` : une seconde demande à l'observateur (k+2) ;
  - `pose-lot-inchanges-4959` : les deux modules sont déclarés, et le bloc `premiere` de l'observateur est retiré pour comparer.
- **Régression ciblée** (ch077, ch080, relecture, passe des différés, choix-lot-clic-sw, scans, pose-lot-inchanges) : voir les chiffres ci-dessous.
- **verify complet et maquette complète** : voir ci-dessous.

## Ce qui reste SUPPOSÉ ou PROBABLE
- Le Potree d'ESV est 1.8.2 ou plus récent (CH-080c). Le branchement orthographique de `updateVisibility`, lu sur l'étiquette 1.8, y est supposé identique (PROBABLE ; `prechauffage-vue` donnera `type`, `pointBudget` et `maxLevel`).
- Le budget « par lot » est en fait celui de la vie de la page : un rechargement le remet à zéro.
- Passe → relecture : non couvert (la sélection de la relecture n'existe pas avant la fin de la passe), soit environ 1 passage par lot.
- Même clé de cache entre le `fetch` de Potree et le nôtre (CH-080c, SUPPOSÉ).

## Consigne terrain (Vision 8)
1. Appliquer `chantiers/CH-081/adapter-page.patch`.
2. Lire `prechauffage-vue` : `type` orthographique, `pointBudget` et `maxLevel`.
3. Lire dans `prechauffage` : `zone`, `cibles`, `calibree`, `source` (`changement-mode`) et le motif `plafond-lot`.
4. Lire dans `prechauffage-bilan` : `juste`, `couverts / potree`, `servisCache`, `utiles` et `inutiles`. Cibles : couverts ≥ 98 %, servis par le cache ≥ 90 %, inutiles ≤ 25 %.
5. Comparer la capture médiane des sauts ≥ 2 à celle de la coupe voisine.
