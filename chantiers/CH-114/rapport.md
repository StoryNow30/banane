# CH-114 : règle « voie des cuts sûrs » en ombre (rapport, D-347)

Branche `chantier/CH-114`, partie de `7710ce3`. Aucun fichier interdit touché : le diff est vide sur `src/engine.js`, `src/lot-decision.js`, `src/adapter-page.js`, `src/geometry*.js`, `src/gcv2*.js` et `manifest.json`. La règle ne change aucune pose.

## Livré
- `src/voie-sure-ombre.js` : module pur qui applique la règle exacte de CH-112 (réglage du rapport : `profil1`, seuil 100 + 2·g² mm, G = 12, deux rails du même côté, moyenne au dixième de mm, marges non arrêtées). Un cut en zone alerte sans référence s'abstient : il passe, mais ne devient pas sûr. Sa mémoire est bornée à 64 cuts.
- `src/settings.js` : `lot.voieSureOmbre` vaut `{actif:true, seuilMm:100, courbureMm:2, ecartCuts:12}` (figé). Avec `actif:false`, la règle ne calcule rien et n'émet aucun événement.
- `background.js` : un bloc CH-114 placé à côté de la garde de voie en ombre, avant `promouvoirAppuis`. Il lit trois choses :
  - l'enveloppe `engine.event`, après l'écriture au journal, qui donne `applied-verified` (les rails relus et l'axe latéral du profil du rail gauche) puis `validation-accepted` du moteur, qui fait évaluer le cut ;
  - `reglesMetierNoter`, qui transmet la zone d'ADV du cut (une ligne ajoutée).
  La mémoire est volatile, propre au lot et à la partie. Un seul événement `voie-sure-ombre` par cut posé en zone `adv: alerte`, avec : `auraitDiffere`, les décalages gauche et droit, la moyenne, l'écart g, le seuil, `referenceCut` (numéro seulement), le motif et `ms`. Le premier événement du lot porte aussi le réglage. Rien n'est écrit dans `batch`, les appuis, la proposition ni les commandes. En cas de panne, aucun événement.
- `chantiers/CH-114/outils/parite-voie-sure.cjs` : parité hors ligne. Sorties par cut dans `chantiers/CH-114/sorties/` (numéros et mm seulement ; l'intégrateur les verse dans `banane-data`).

## Point 3 : références disponibles en direct (ÉTABLI)
- Sur les 14 parties de CH-112, l'ensemble des « cuts traités par l'opérateur hors du lot » est **vide** (fichiers exacts de `lots.cjs`).
- J'ai rejoué `regle-voie.cjs` avec et sans cette source : 2 505 posés, 13 arrêts dans les deux cas, 0 cut différent. Le résultat est identique cut par cut aux CSV publiés de CH-112. **Le compte ne change pas : 12/17 faux arrêtés, 0/779 bons bloqués.**
- En direct, cette information viendrait de l'instantané de la liste pris au chargement de la partie (drapeau TreatedByOperator, lu par `l1eTable`). Je l'ai retirée pour deux raisons :
  - elle n'apporte rien sur ces lots ;
  - ESV pose aussi ce drapeau sur les validations d'Ariane (partie 16 du 11/11 : 378 « traités » pour 378 posés). Au départ d'une partie relancée, les poses d'un lot précédent passeraient donc pour « traitées par l'opérateur » (PROBABLE).
- L'Écho vient après le lot, et le journal ne contient que le lot. Les seules références restent donc les cuts posés plus tôt par le lot et non arrêtés.

## Point 4 : parité hors ligne (ÉTABLI)
Le module est rejoué sur les journaux de CH-112 comme le service worker le nourrit (événements rangés dans le temps, mémoire neuve à chaque lot), puis comparé à `regle-voie.cjs` sans les « traités ».
- **2 500 cuts identiques sur 2 505 (99,8 %)** : verdict, référence, décalages au dixième de mm et présence de l'événement.
- **13 arrêts sur 13 identiques** et 738 événements, ce qui correspond aux 738 posés en zone alerte de CH-112.
- **Les 5 écarts** sont tous sur la partie 6 du 08/11, cuts 181 à 185. Cette partie a eu deux lots : le premier s'arrête au cut 171 en ERREUR, le second repart au cut 181. L'outil de CH-112 garde sa mémoire sur toute la partie ; le module ne garde que celle du lot, comme le demande le ticket. Le cut 181 n'a donc pas de référence en direct : il s'abstient, et les cuts 182 à 185 restent sans référence jusqu'au prochain cut sûr. Aucun verdict ne change : 181 passait déjà (250 mm pour un seuil de 300).
- Abstentions en direct : 30 sur 738 (4,1 %), contre 25 dans CH-112.

## Point 5 : essais et preuves
- `tests/voie-sure-ombre.test.cjs` : 8/8. Rouge d'abord (module absent). Il couvre le verdict, la courbure, l'abstention, la mémoire du lot, une pose illisible, une panne, et une parité tirée au hasard sur 4 000 cuts avec `regle-voie.cjs`.
- `tests/voie-sure-ombre-sw.test.cjs` : 3/3, service worker réel en vm. Rouge d'abord. Avec l'ombre active comme en panne : mêmes commandes, rails, enregistrements, événements métier et décisions du lot à l'octet. Un événement par cut validé en zone alerte ; aucun quand le réglage est coupé.
- `tests/pose-lot-inchanges-4959.test.cjs` : 6/6, avec `voie-sure-ombre.js` (liste `CH114`) et le réglage déclarés. 27 fichiers d'essais voisins (réglages, règles métier, ombres) : 81/81.
- `tools/parite-relecture-sw.cjs` contre `7710ce3` : relevés identiques, sortie 0.
- **Pas lancés** : `tools/garde-gcv2.cjs` et `tools/parite-l1se-sw.cjs --passe`. Il leur faut un rejeu du banc sur des lots archivés hors dépôt, et aucun module de décision n'a changé. La maquette ESV non plus : aucun chemin du navigateur ne change.

## À lire au prochain lot
- Le taux d'abstention et les arrêts « en ombre » sur un lot sans Écho.
- Une séance Écho sur les zones alerte, qui reste le seul examen vierge du seuil (SUPPOSÉ jusque-là).
- L'arrêt réel demande un nouvel accord écrit de l'opérateur (D-347).
